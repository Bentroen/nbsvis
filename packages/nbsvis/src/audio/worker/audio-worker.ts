/// <reference lib="webworker" />

import { resetRingBuffer, ringBufferHasSpace, writeToRingBuffer } from '../buffer';
import { WorkerMessage } from '../event';
import { TempoMapView } from '../tempo';
import { cubicResample, ResamplerFn } from './resampler';
import Scheduler from './scheduler';
import RenderTransport from './transport';
import VoiceManager from './voice-manager';

const BLOCK_SIZE = 128;

const DEFAULT_RESAMPLER = cubicResample;

export type AudioWorkerInitOptions = {
  ringBufferAudioSAB: SharedArrayBuffer;
  ringBufferStateSAB: SharedArrayBuffer;
  sampleRate: number;
};

export class AudioWorker {
  rbAudio: Float32Array;
  rbState: Int32Array;
  sampleRate: number;

  transport: RenderTransport;
  scheduler: Scheduler;
  voiceManager: VoiceManager;

  resample: ResamplerFn = DEFAULT_RESAMPLER;

  constructor(init: AudioWorkerInitOptions) {
    this.rbAudio = new Float32Array(init.ringBufferAudioSAB);
    this.rbState = new Int32Array(init.ringBufferStateSAB);
    this.sampleRate = init.sampleRate;

    this.transport = new RenderTransport(this.sampleRate);
    this.scheduler = new Scheduler();
    this.voiceManager = new VoiceManager();
  }

  onmessage(event: MessageEvent<WorkerMessage>) {
    const { data } = event;
    switch (data.type) {
      case 'start':
        // Start the render loop
        this.renderLoop();
        break;

      case 'song':
        this.scheduler.loadSong(data.notes, data.tempoChanges);
        this.transport.setTempoMap(new TempoMapView(data.tempoChanges, data.initialTempo));
        break;

      case 'sample':
        this.voiceManager.loadSample(data.sampleId, data.channels);
        break;

      case 'seek':
        this.transport.seekTick(data.seconds);
        this.voiceManager.voices.length = 0; // TODO: extract to method
        resetRingBuffer(this.rbState);
        break;
    }
  }

  renderLoop() {
    while (ringBufferHasSpace(this.rbState, BLOCK_SIZE)) {
      const block = this.renderBlock();
      writeToRingBuffer(this.rbAudio, this.rbState, block.outL, block.outR);

      // metadata (optional buffer)
      //writeVoiceCount(block.voiceCount);
    }

    setTimeout(() => this.renderLoop(), 0);
  }

  renderBlock() {
    const events = this.scheduler.collectEvents(this.transport.currentTick);
    for (const e of events) {
      if ('tempo' in e) {
        //this.transport.currentTempo = e.tempo;
      } else {
        this.voiceManager.spawn(e);
      }
    }

    const outL = new Float32Array(BLOCK_SIZE);
    const outR = new Float32Array(BLOCK_SIZE);
    outL.fill(0);
    outR.fill(0);

    // Mix all active voices
    this.mixVoices(outL, outR);

    this.transport.advance(BLOCK_SIZE);

    return {
      outL,
      outR,
      voiceCount: this.voiceManager.activeCount,
    };
  }

  // TODO: this could be the responsibility of a Mixer class, or VoiceManager
  private mixVoices(outL: Float32Array, outR: Float32Array) {
    for (let v = this.voiceManager.voices.length - 1; v >= 0; v--) {
      const voice = this.voiceManager.voices[v];
      const sample = this.voiceManager.samples[voice.id];
      if (!sample) continue;

      const L = sample[0];
      const R = sample[1] ?? L;

      let advanced = 0;

      for (let i = 0; i < BLOCK_SIZE; i++) {
        const pos = voice.pos + i * voice.pitch;
        if (pos >= L.length) {
          this.voiceManager.voices.splice(v, 1);
          break;
        }

        // TODO: don't resample both channels if the sample is mono
        const lSample = this.resample(L, pos);
        const rSample = this.resample(R, pos);

        outL[i] += lSample * voice.gain * (1 - Math.max(0, voice.pan));
        outR[i] += rSample * voice.gain * (1 + Math.min(0, voice.pan));

        advanced = (i + 1) * voice.pitch;
      }

      voice.pos += advanced;
    }
  }
}

// Web Worker entry point
let worker: AudioWorker | null = null;

self.onmessage = (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'init') {
    // Initialize the worker with SharedArrayBuffers and start immediately
    worker = new AudioWorker({
      ringBufferAudioSAB: msg.ringBufferAudioSAB,
      ringBufferStateSAB: msg.ringBufferStateSAB,
      sampleRate: msg.sampleRate,
    });
  } else if (worker) {
    // Forward other messages to the worker instance
    worker.onmessage(e);
  }
};
