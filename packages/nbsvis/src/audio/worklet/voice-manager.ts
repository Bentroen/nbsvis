import { NoteEvent } from './scheduler';

const MAX_VOICES = 1024;

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

  get activeCount() {
    return this.voices.length;
  }

  loadSample(id: number, channels: Float32Array[]) {
    this.samples[id] = channels;
  }

  spawn(note: NoteEvent) {
    if (this.voices.length >= MAX_VOICES) {
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
}

export default VoiceManager;
