import { NoteEvent } from './scheduler';

type Voice = {
  id: number;
  pos: number;
  gain: number;
  pan: number;
  pitch: number;
  sliceIndex: number;
};

export type VoiceManagerOptions = {
  maxVoiceCount: number;
};

class VoiceManager {
  samples: Record<number, Float32Array[]> = {};
  voices: Voice[] = [];
  maxVoiceCount: number;

  constructor(options: VoiceManagerOptions) {
    this.maxVoiceCount = options.maxVoiceCount;
  }

  get activeCount() {
    return this.voices.length;
  }

  loadSample(id: number, channels: Float32Array[]) {
    this.samples[id] = channels;
  }

  spawn(note: NoteEvent) {
    // TODO: we can remove this check by filtering out notes with missing samples beforehand (e.g. in Scheduler)
    if (!this.samples[note.sampleId]) return;
    if (this.voices.length >= this.maxVoiceCount) {
      this.voices.shift(); // basic stealing
    }
    this.voices.push({
      id: note.sampleId,
      pos: 0,
      gain: note.gain,
      pan: note.pan,
      pitch: note.pitch,
      sliceIndex: 0,
    });
  }

  trimVoices(maxVoices: number) {
    this.maxVoiceCount = maxVoices;
    if (this.voices.length > maxVoices) {
      this.voices.splice(0, this.voices.length - maxVoices);
    }
  }

  resetVoices() {
    //clear existing voices array instead of assigning a new one
    this.voices.length = 0;
  }

  killRatio(ratio: number) {
    const killCount = Math.floor(this.voices.length * ratio);
    this.voices.splice(0, killCount);
  }
}

export default VoiceManager;
