import { CachedResampler } from './cached-resampler';

describe('CachedResampler', () => {
  it('does not keep resampled blocks after clearAll and reload', () => {
    const resampler = new CachedResampler({
      cacheSizeBytes: 4096,
      blockSize: 8,
    });

    resampler.loadSample(16, [new Float32Array(16).fill(1)]);
    const first = resampler.getBlock(16, 1, 0);
    expect(first).not.toBeNull();
    expect(first![0]).toBe(1);

    resampler.clearAll();
    resampler.loadSample(16, [new Float32Array(16).fill(0.5)]);
    const second = resampler.getBlock(16, 1, 0);
    expect(second).not.toBeNull();
    expect(second![0]).toBe(0.5);
  });

  it('forgets samples after clearAll', () => {
    const resampler = new CachedResampler({
      cacheSizeBytes: 4096,
      blockSize: 8,
    });

    resampler.loadSample(16, [new Float32Array(16).fill(1)]);
    resampler.getBlock(16, 1, 0);
    resampler.clearAll();

    expect(resampler.getBlock(16, 1, 0)).toBeNull();
  });
});
