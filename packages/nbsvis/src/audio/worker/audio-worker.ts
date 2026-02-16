/// <reference lib="webworker" />

import { RingBufferState, resetRingBuffer, ringBufferHasSpace, writeToRingBuffer } from '../buffer';
import { EngineToWorkerMessage } from '../event';
import { TempoMapView } from '../tempo';
import { AdaptiveLoadBalancer } from './adaptive-balancer';
import { cubicResample } from './resampler';
import Scheduler from './scheduler';
import init, { Engine } from '../../../wasm/pkg/audio_wasm.js';
import { BaseTransport as RenderTransport } from '../transport';

const BLOCK_SIZE = 128;

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
  balancer: AdaptiveLoadBalancer;
  renderFrame = 0;

  outL = new Float32Array(BLOCK_SIZE);
  outR = new Float32Array(BLOCK_SIZE);

  wasmReady = false;

  engine!: Engine; // WASM engine instance

  sampleAtlas = new Float32Array(0);
  sampleOffsets: number[] = [];
  sampleLengths: number[] = [];

  constructor(init: AudioWorkerInitOptions) {
    this.rbAudio = new Float32Array(init.ringBufferAudioSAB);
    this.rbState = new Int32Array(init.ringBufferStateSAB);
    this.sampleRate = init.sampleRate;

    this.transport = new RenderTransport(this.sampleRate);
    this.scheduler = new Scheduler();

    this.balancer = new AdaptiveLoadBalancer();
    this.balancer.init({ sampleRate: this.sampleRate });
    this.balancer.setActive(true);

    this.initWasm();
  }

  async initWasm() {
    await init(); // loads and initializes the wasm
    this.engine = new Engine(1024); // max voices
    this.wasmReady = true;
    console.log('WASM mixer ready');
  }

  onmessage(event: MessageEvent<EngineToWorkerMessage>) {
    const { data } = event;
    switch (data.type) {
      case 'start':
        // Start the render loop
        this.renderLoop();
        break;

      case 'song':
        this.scheduler.loadSong(data.notes, data.tempoChanges);
        this.transport.setTempoMap(new TempoMapView(data.tempoChanges, data.initialTempo));
        this.transport.seekToTick(0);
        this.resetRender();
        break;

      case 'sample': {
        const sampleData = data.channels[0];
        const oldAtlas = this.sampleAtlas;

        const newAtlas = new Float32Array(oldAtlas.length + sampleData.length);
        newAtlas.set(oldAtlas, 0);
        newAtlas.set(sampleData, oldAtlas.length);

        this.sampleAtlas = newAtlas;

        this.sampleOffsets[data.sampleId] = oldAtlas.length;
        this.sampleLengths[data.sampleId] = sampleData.length;

        const offsets = new Uint32Array(this.sampleOffsets);
        const lengths = new Uint32Array(this.sampleLengths);

        this.engine.set_sample_atlas(this.sampleAtlas, offsets, lengths);

        break;
      }

      case 'seek':
        this.transport.seekToTick(data.seconds);
        this.resetRender();
        break;
    }
  }

  resetRender() {
    resetRingBuffer(this.rbState);
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
    this.balancer.beginProcess();

    const events = this.scheduler.collectEvents(this.transport.currentTick);
    for (const e of events) {
      if ('tempo' in e) {
        //this.transport.currentTempo = e.tempo;
      } else {
        this.engine.spawn(e.sampleId, e.gain, e.pan, e.pitch);
      }
    }

    this.outL.fill(0);
    this.outR.fill(0);

    // Mix all active voices
    if (this.wasmReady) {
      this.engine.render(this.outL, this.outR);
    } else {
      console.log('mixing with JS');
      //this.mixVoices(this.outL, this.outR); // fallback JS
    }
    this.applyBalancerDecision();

    this.transport.advance(BLOCK_SIZE);
    this.renderFrame += 1;

    const metrics = this.engine.get_metrics();

    return {
      outL: this.outL,
      outR: this.outR,
      voiceCount: metrics.active_voices,
    };
  }

  private applyBalancerDecision() {
    const metrics = this.engine.get_metrics();

    const decision = this.balancer.endProcess({
      frame: this.renderFrame,
      blockSize: BLOCK_SIZE,
      activeVoices: metrics.active_voices,
      maxVoices: metrics.max_voices,
      bufferFill: this.getBufferFill(),
    });

    if (!decision) return;

    if (decision.maxVoices !== undefined) {
      this.engine.set_max_voices(decision.maxVoices);
    }

    if (decision.killVoicesRatio !== undefined) {
      this.engine.kill_ratio(decision.killVoicesRatio);
    }

    if (decision.resampler !== undefined) {
      // map function to numeric mode
      if (decision.resampler === cubicResample) {
        this.engine.set_resampler(2);
      } else {
        // add mapping for others if needed
        this.engine.set_resampler(1);
      }
    }
  }

  private getBufferFill(): number {
    const read = Atomics.load(this.rbState, RingBufferState.RB_READ_INDEX);
    const write = Atomics.load(this.rbState, RingBufferState.RB_WRITE_INDEX);
    const capacity = Atomics.load(this.rbState, RingBufferState.RB_CAPACITY);
    if (capacity <= 0) return 0;
    const filled = write - read;
    return Math.max(0, Math.min(1, filled / capacity));
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
