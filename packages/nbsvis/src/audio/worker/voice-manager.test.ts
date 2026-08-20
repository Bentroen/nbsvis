import VoiceManager from './voice-manager';

describe('VoiceManager samples', () => {
  it('drops previously loaded custom samples', () => {
    const voices = new VoiceManager({ maxVoiceCount: 8 });
    const leftover = [new Float32Array([1, 2, 3])];
    const next = [new Float32Array([4, 5, 6])];

    voices.loadSample(16, leftover);
    voices.loadSample(20, leftover);
    voices.spawn(16, 1, 1, 0);

    voices.clearSamples();

    expect(voices.samples[16]).toBeUndefined();
    expect(voices.samples[20]).toBeUndefined();
    expect(voices.activeCount).toBe(0);

    voices.spawn(16, 1, 1, 0);
    expect(voices.activeCount).toBe(0);

    voices.loadSample(16, next);
    voices.spawn(16, 1, 1, 0);
    expect(voices.activeCount).toBe(1);
  });
});
