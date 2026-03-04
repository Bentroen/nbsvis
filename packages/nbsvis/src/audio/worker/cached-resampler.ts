import { cubicResample, ResamplerFn } from './resampler';

const CENTS_PER_OCTAVE = 1200;

type CacheKey = `${number}|${number}|${number}`; // sampleId|centOffset|sliceIndex

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

export class CachedResampler {
  private samples = new Map<number, Float32Array>();
  private cache: BlockCache;
  private readonly buildResampler: ResamplerFn;
  private readonly blockSize: number;

  constructor(
    buildResampler: ResamplerFn = cubicResample,
    cacheSizeBytes: number,
    blockSize: number,
  ) {
    this.buildResampler = buildResampler;
    this.blockSize = blockSize;

    this.cache = new BlockCache(cacheSizeBytes, blockSize);
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

  private makeKey(sampleId: number, pitch: number, sliceIndex: number): CacheKey {
    const centOffset = Math.round(CENTS_PER_OCTAVE * Math.log2(pitch));
    return `${sampleId}|${centOffset}|${sliceIndex}`;
  }
}
