/// <reference lib="webworker" />

declare const sampleRate: number;
declare const currentFrame: number;

type PlayEvent = {
  type: 'play';
  sampleId: number;
  when: number;
  gain: number;
  pan: number;
  pitch: number;
};

type SampleEvent = {
  type: 'sample';
  sampleId: number;
  channels: Float32Array[];
};

type Message = PlayEvent | SampleEvent;

type Voice = {
  id: number;
  pos: number;
  gain: number;
  pan: number;
  pitch: number;
};

const MAX_VOICES = 1024;

class MixerProcessor extends AudioWorkletProcessor {
  samples: Record<number, Float32Array[]>;
  voices: Voice[];
  queue: PlayEvent[];
  lastVoiceCount = 0;

  constructor() {
    super();
    this.samples = {};
    this.voices = [];
    this.queue = [];

    this.port.onmessage = (event: MessageEvent<Message>) => {
      const data = event.data;
      if (data.type === 'sample') {
        this.samples[data.sampleId] = data.channels;
      } else if (data.type === 'play') {
        this.queue.push(data);
      }
    };
  }

  process(_: Float32Array[][], outputs: Float32Array[][]) {
    const outL = outputs[0][0];
    const outR = outputs[0][1] ?? outL;

    outL.fill(0);
    outR.fill(0);

    const now = currentFrame / sampleRate;

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const ev = this.queue[i];
      if (ev.when <= now) {
        if (this.voices.length >= MAX_VOICES) {
          this.voices.shift();
        }
        this.voices.push({
          id: ev.sampleId,
          pos: 0,
          gain: ev.gain,
          pan: ev.pan,
          pitch: ev.pitch,
        });
        this.queue.splice(i, 1);
      }
    }

    for (let v = this.voices.length - 1; v >= 0; v--) {
      const voice = this.voices[v];
      const sample = this.samples[voice.id];
      if (!sample) continue;

      const L = sample[0];
      const R = sample[1] ?? L;

      const basePos = voice.pos; // capture start position for this block
      let advanced = 0;

      for (let i = 0; i < outL.length; i++) {

        // Linear interpolation (new, non-accumulating):
        const pos = basePos + i * voice.pitch;
        const idx0 = Math.floor(pos);
        if (idx0 >= L.length) {
          this.voices.splice(v, 1);
          advanced = i * voice.pitch; // how far we got this block
          break;
        }
        const idx1 = Math.min(idx0 + 1, L.length - 1);
        const frac = pos - idx0;

        const lSample = L[idx0] * (1 - frac) + L[idx1] * frac;
        const rSample = R[idx0] * (1 - frac) + R[idx1] * frac;

        outL[i] += lSample * voice.gain * (1 - Math.max(0, voice.pan));
        outR[i] += rSample * voice.gain * (1 + Math.min(0, voice.pan));

        advanced = (i + 1) * voice.pitch;
      }

      // Advance position once per block to avoid cumulative float drift
      voice.pos = basePos + advanced;
    }

    return true;
  }
}

registerProcessor('mixer-processor', MixerProcessor);
