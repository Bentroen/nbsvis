type Voice = {
  id: number;
  pos: number;
  gain: number;
  pan: number;
  pitch: number;
  sliceIndex: number;
};

class VoicePool {
  private pool: Voice[] = [];

  acquire(): Voice {
    return (
      this.pool.pop() ?? {
        id: 0,
        pos: 0,
        gain: 0,
        pan: 0,
        pitch: 1,
        sliceIndex: 0,
      }
    );
  }

  release(voice: Voice): void {
    this.pool.push(voice);
  }
}

export type VoiceManagerOptions = {
  maxVoiceCount: number;
};

export class VoiceManager {
  samples: Record<number, Float32Array[]> = {};
  voices: Voice[] = [];
  maxVoiceCount: number;
  private voicePool: VoicePool;

  constructor(options: VoiceManagerOptions) {
    this.maxVoiceCount = options.maxVoiceCount;
    this.voicePool = new VoicePool();
  }

  get activeCount() {
    return this.voices.length;
  }

  loadSample(id: number, channels: Float32Array[]) {
    this.samples[id] = channels;
  }

  spawn(sampleId: number, pitch: number, gain: number, pan: number) {
    // TODO: we can remove this check by filtering out notes with missing samples beforehand (e.g. in Scheduler)
    if (!this.samples[sampleId]) return;
    if (this.voices.length >= this.maxVoiceCount) {
      const killed = this.voices.shift(); // basic stealing
      if (killed) this.voicePool.release(killed);
    }

    const voice = this.voicePool.acquire();
    voice.id = sampleId;
    voice.pos = 0;
    voice.gain = gain;
    voice.pan = pan;
    voice.pitch = pitch;
    voice.sliceIndex = 0;
    this.voices.push(voice);
  }

  trimVoices(maxVoices: number) {
    this.maxVoiceCount = maxVoices;
    if (this.voices.length > maxVoices) {
      this.voices.splice(0, this.voices.length - maxVoices);
    }
  }

  resetVoices() {
    for (const voice of this.voices) {
      this.voicePool.release(voice);
    }
    //clear existing voices array instead of assigning a new one
    this.voices.length = 0;
  }

  killRatio(ratio: number) {
    const killCount = Math.floor(this.voices.length * ratio);
    for (let i = 0; i < killCount; i++) {
      const killed = this.voices.shift();
      if (killed) this.voicePool.release(killed);
    }
  }
}

export default VoiceManager;
