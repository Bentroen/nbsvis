/// <reference lib="webworker" />

import { Message } from './event';
import Scheduler from './scheduler';
import Transport from './transport';
import VoiceManager from './voice-manager';

declare const sampleRate: number;
declare const currentFrame: number;
declare const currentTime: number;

class MixerProcessor extends AudioWorkletProcessor {
  scheduler = new Scheduler();
  transport = new Transport(this.scheduler, 120);
  voiceManager = new VoiceManager();

  constructor(options: AudioWorkletNodeOptions) {
    super();

    this.port.onmessage = (e: MessageEvent<Message>) => {
      const msg = e.data;

      switch (msg.type) {
        case 'song':
          this.transport.currentTempo = this.scheduler.loadSong(
            msg.notes,
            msg.tempoChanges,
            msg.initialTempo,
          );
          break;

        case 'sample':
          this.voiceManager.loadSample(msg.sampleId, msg.channels);
          break;

        case 'play':
          this.transport.play();
          break;

        case 'pause':
          this.transport.pause();
          break;

        case 'stop':
          this.transport.stop();
          this.voiceManager.voices.length = 0;
          break;

        case 'seek':
          this.transport.seek(msg.tick);
          this.voiceManager.voices.length = 0;
          break;
      }
    };
  }

  process(_: Float32Array[][], outputs: Float32Array[][]): boolean {
    if (this.transport.advance(currentTime)) {
      const tick = Math.floor(this.transport.currentTick);
      const events = this.scheduler.collectEvents(tick);

      for (const e of events) {
        if ('tempo' in e) {
          this.transport.currentTempo = e.tempo;
        } else {
          this.voiceManager.spawn(e);
        }
      }
    }

    // mixing loop
    const outL = outputs[0][0];
    const outR = outputs[0][1] ?? outL;

    outL.fill(0);
    outR.fill(0);

    for (let v = this.voiceManager.voices.length - 1; v >= 0; v--) {
      const voice = this.voiceManager.voices[v];
      const sample = this.voiceManager.samples[voice.id];
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
          this.voiceManager.voices.splice(v, 1);
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
