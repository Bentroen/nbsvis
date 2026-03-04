import { cubicResample, ResamplerFn } from './resampler';

const BLOCK_SIZE = 128;
const PITCH_SCALE = 65536;

class BlockCache {
  private readonly blockSize: number;
  private readonly totalBlocks: number;

  private readonly buffer: Float32Array;
  private readonly keyToBlock = new Map<string, number>();
  private readonly blockToKey: (string | null)[];

  private writePointer = 0;

  constructor(cacheSizeBytes: number, blockSize: number) {
    this.blockSize = blockSize;

    this.totalBlocks = Math.floor(cacheSizeBytes / (blockSize * Float32Array.BYTES_PER_ELEMENT));

    this.buffer = new Float32Array(this.totalBlocks * blockSize);
    this.blockToKey = new Array(this.totalBlocks).fill(null);
  }

  getBlock(key: string): Float32Array | null {
    const blockIndex = this.keyToBlock.get(key);
    if (blockIndex === undefined) return null;

    const start = blockIndex * this.blockSize;
    return this.buffer.subarray(start, start + this.blockSize);
  }

  allocateBlock(key: string): { blockIndex: number; block: Float32Array } {
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
}

export class CachedResampler {
  private samples = new Map<number, Float32Array>();
  private cache: BlockCache;
  private readonly buildResampler: ResamplerFn;

  constructor(
    buildResampler: ResamplerFn = cubicResample,
    cacheSizeBytes: number = 16 * 1024 * 1024,
  ) {
    this.buildResampler = buildResampler;

    this.cache = new BlockCache(cacheSizeBytes, BLOCK_SIZE);
  }

  loadSample(sampleId: number, channels: Float32Array[]) {
    if (!channels.length) return;
    this.samples.set(sampleId, channels[0]);
  }

  clearSample(sampleId: number) {
    this.samples.delete(sampleId);

    // Remove cache entries for this sample
    const prefix = `${sampleId}|`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
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
    const sliceStartPos = sliceIndex * pitch * BLOCK_SIZE;

    for (let i = 0; i < BLOCK_SIZE; i++) {
      const sourcePos = sliceStartPos + i * pitch;

      if (sourcePos >= sample.length) {
        block[i] = 0;
      } else {
        block[i] = this.buildResampler(sample, sourcePos);
      }
    }
  }

  private makeKey(sampleId: number, pitch: number, sliceIndex: number): string {
    const pitchQuant = Math.round(pitch * PITCH_SCALE);
    return `${sampleId}|${pitchQuant}|${sliceIndex}`;
  }
}
