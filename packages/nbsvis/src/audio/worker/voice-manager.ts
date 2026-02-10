import { NoteEvent } from './scheduler';

type Voice = {
  id: number;
  pos: number;
  gain: number;
  pan: number;
  pitch: number;
};

class VoiceManager {
  samples: Record<number, Float32Array[]> = {};
  voices: Voice[] = [];
  maxVoiceCount: number;

  constructor(maxVoiceCount: number) {
    this.maxVoiceCount = maxVoiceCount;
  }

  get activeCount() {
    return this.voices.length;
  }

  loadSample(id: number, channels: Float32Array[]) {
    this.samples[id] = channels;
  }

  spawn(note: NoteEvent) {
    if (this.voices.length >= this.maxVoiceCount) {
      this.voices.shift(); // basic stealing
    }
    this.voices.push({
      id: note.sampleId,
      pos: 0,
      gain: note.gain,
      pan: note.pan,
      pitch: note.pitch,
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
