import { cubicResample, ResamplerFn } from './resampler';

const BLOCK_SIZE = 128;
const PITCH_SCALE = 65536;

export class CachedResampler {
  private samples = new Map<number, Float32Array>();
  private cache = new Map<string, Float32Array>();
  private readonly buildResampler: ResamplerFn;

  constructor(buildResampler: ResamplerFn = cubicResample) {
    this.buildResampler = buildResampler;
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

    let block = this.cache.get(key);
    if (!block) {
      block = this.buildSlice(sample, pitch, sliceIndex);
      this.cache.set(key, block);
    }

    return block;
  }

  private buildSlice(sample: Float32Array, pitch: number, sliceIndex: number): Float32Array {
    const sliceStartPos = sliceIndex * pitch * BLOCK_SIZE;
    const out = new Float32Array(BLOCK_SIZE);

    for (let i = 0; i < BLOCK_SIZE; i++) {
      const sourcePos = sliceStartPos + i * pitch;

      if (sourcePos >= sample.length) break;

      out[i] = this.buildResampler(sample, sourcePos);
    }

    return out;
  }

  private makeKey(sampleId: number, pitch: number, sliceIndex: number): string {
    const pitchQuant = Math.round(pitch * PITCH_SCALE);
    return `${sampleId}|${pitchQuant}|${sliceIndex}`;
  }
}
