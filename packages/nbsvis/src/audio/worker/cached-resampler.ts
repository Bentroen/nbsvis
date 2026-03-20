import { cubicResample, ResamplerFn } from './resampler';

/**
 * CacheKey
 *
 * Packed 53-bit integer used as the key for the resampling cache.
 *
 * JavaScript numbers preserve integer precision up to 2^53-1,
 * allowing us to safely pack multiple fields into one integer.
 *
 * Layout (MSB → LSB)
 *
 * [ sampleId | centOffset | sliceIndex ]
 *
 * Bit allocation:
 *
 *   sampleId   : 16 bits  (0–65,535)
 *   centOffset : 16 bits  (-32,768 → +32,767) stored as unsigned via bias
 *   sliceIndex : 20 bits  (0–1,048,576)
 *
 * Total: 52 bits
 *
 * ----------------------------------------------------------------
 * Sample ID
 * ----------------------------------------------------------------
 *
 * As of Note Block Studio 3.11 / NBS format version 6, instrument
 * indices are represented by a byte (0-255). This means it can
 * be represented with 8 bits.
 *
 * Our 16-bit sampleId range (0-65,535) is effectively the square
 * of our original domain (256^2), so it's comfortably future-proof.
 *
 * ----------------------------------------------------------------
 * Pitch representation
 * ----------------------------------------------------------------
 *
 * Note Block Studio pitch works as:
 *
 *   key range : 0–87
 *   resolution: 0.01 semitone (1 cent)
 *
 * That means:
 *
 *   87 semitones × 100 cents = 8700 cents
 *
 * In the engine, we don't store semitone + detune separately.
 * Instead, we operate directly on a playback ratio:
 *
 *   pitch = 2^(semitones / 12)
 *
 * To obtain a stable cache key we convert the ratio back into cents:
 *
 *   centOffset = round(1200 * log2(pitch))
 *
 * The 16-bit signed range easily covers any realistic pitch deviation.
 *
 * ----------------------------------------------------------------
 * Slice indexing
 * ----------------------------------------------------------------
 *
 * Each cache entry stores one resampled block of BLOCK_SIZE samples.
 *
 * With 20 bits we can index:
 *
 *   1,048,576 slices
 *
 * Playback duration coverage:
 *
 *   BLOCK_SIZE = 512 @ 48 kHz
 *   → ~3.1 hours of audio
 *
 * Even with smaller blocks (128 samples):
 *
 *   → ~46.6 minutes
 *
 * Which is far beyond the length of any realistic NBS sample.
 *
 * ----------------------------------------------------------------
 * Why we use numeric keys
 * ----------------------------------------------------------------
 *
 * Using a packed numeric key avoids:
 *
 *   • millions of temporary string allocations
 *   • GC pressure
 *   • slower string hashing in Map lookups
 *
 * This significantly improves performance for large songs
 * containing millions of notes.
 */
type CacheKey = number;

const CENTS_PER_OCTAVE = 1200;
const CENT_OFFSET_BIAS = 65536;

const SAMPLE_SHIFT = 2 ** 36; // 16 + 20
const CENT_SHIFT = 2 ** 20;

class BlockCache {
  private readonly blockSize: number;
  private readonly totalBlocks: number;

  private readonly buffer: Float32Array;
  private readonly keyToBlock = new Map<CacheKey, number>();
  private readonly blockToKey: (CacheKey | null)[];

  private writePointer = 0;

  constructor(cacheSizeBytes: number, blockSize: number) {
    this.blockSize = blockSize;

    this.totalBlocks = Math.floor(cacheSizeBytes / (blockSize * Float32Array.BYTES_PER_ELEMENT));

    this.buffer = new Float32Array(this.totalBlocks * blockSize);
    this.blockToKey = new Array(this.totalBlocks).fill(null);
  }

  getBlock(key: CacheKey): Float32Array | null {
    const blockIndex = this.keyToBlock.get(key);
    if (blockIndex === undefined) return null;

    const start = blockIndex * this.blockSize;
    return this.buffer.subarray(start, start + this.blockSize);
  }

  allocateBlock(key: CacheKey): { blockIndex: number; block: Float32Array } {
    const blockIndex = this.writePointer;

    // Evict old key if needed
    const oldKey = this.blockToKey[blockIndex];
    if (oldKey !== null) {
      this.keyToBlock.delete(oldKey);
    }

    this.blockToKey[blockIndex] = key;
    this.keyToBlock.set(key, blockIndex);

    this.writePointer++;
    if (this.writePointer >= this.totalBlocks) {
      this.writePointer = 0;
    }

    const start = blockIndex * this.blockSize;
    return {
      blockIndex,
      block: this.buffer.subarray(start, start + this.blockSize),
    };
  }

  reset() {
    this.keyToBlock.clear();

    // Clear reverse lookup
    for (let i = 0; i < this.blockToKey.length; i++) {
      this.blockToKey[i] = null;
    }
    //this.blockToKey = new Array(this.totalBlocks).fill(null);

    this.writePointer = 0;
  }
}

export type CachedResamplerOptions = {
  resampler?: ResamplerFn;
  cacheSizeBytes: number;
  blockSize: number;
};

export class CachedResampler {
  private samples = new Map<number, Float32Array>();
  private cache: BlockCache;
  private readonly buildResampler: ResamplerFn;
  private readonly blockSize: number;

  constructor(options: CachedResamplerOptions) {
    this.buildResampler = options.resampler ?? cubicResample;

    this.blockSize = options.blockSize;

    const cacheSizeBytes = options.cacheSizeBytes;
    this.cache = new BlockCache(cacheSizeBytes, options.blockSize);
  }

  loadSample(sampleId: number, channels: Float32Array[]) {
    if (!channels.length) return;
    this.samples.set(sampleId, channels[0]);
  }

  clearAll() {
    this.samples.clear();
    this.cache.reset();
  }

  getBlock(sampleId: number, pitch: number, sliceIndex: number): Float32Array | null {
    if (pitch <= 0) return null;

    const sample = this.samples.get(sampleId);
    if (!sample) return null;

    const key = this.makeKey(sampleId, pitch, sliceIndex);

    const cached = this.cache.getBlock(key);
    if (cached) return cached;

    const { block } = this.cache.allocateBlock(key);

    this.buildSlice(sample, pitch, sliceIndex, block);

    return block;
  }

  private buildSlice(sample: Float32Array, pitch: number, sliceIndex: number, block: Float32Array) {
    const sliceStartPos = sliceIndex * pitch * this.blockSize;

    for (let i = 0; i < this.blockSize; i++) {
      const sourcePos = sliceStartPos + i * pitch;

      if (sourcePos >= sample.length) {
        block[i] = 0;
      } else {
        block[i] = this.buildResampler(sample, sourcePos);
      }
    }
  }

  /**
   * Packs sampleId, pitch and sliceIndex into a 52-bit integer cache key.
   */
  private makeKey(sampleId: number, pitch: number, sliceIndex: number): CacheKey {
    const centOffset = Math.round(CENTS_PER_OCTAVE * Math.log2(pitch));
    const centEncoded = centOffset + CENT_OFFSET_BIAS;

    return sampleId * SAMPLE_SHIFT + centEncoded * CENT_SHIFT + sliceIndex;
  }
}
