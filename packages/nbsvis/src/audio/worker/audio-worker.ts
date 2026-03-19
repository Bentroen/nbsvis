/// <reference lib="webworker" />

import { RingBufferState, resetRingBuffer, ringBufferHasSpace, writeToRingBuffer } from '../buffer';
import { EngineToWorkerMessage } from '../event';
import { TempoMapView } from '../tempo';
import { AdaptiveLoadBalancer } from './adaptive-balancer';
import { CachedResampler } from './cached-resampler';
import { cubicResample, ResamplerFn } from './resampler';
import { BaseTransport as RenderTransport } from '../transport';
import VoiceManager from './voice-manager';
import { NoteBuffer } from '../../note';
import { PlaybackState } from '../worklet/state';

const BLOCK_SIZE = 512;

const DEFAULT_RESAMPLER = cubicResample;

export type AudioWorkerInitOptions = {
  playbackStateSAB: SharedArrayBuffer;
  ringBufferAudioSAB: SharedArrayBuffer;
  ringBufferStateSAB: SharedArrayBuffer;
  sampleRate: number;
};

export class AudioWorker {
  noteData: NoteBuffer | null = null;
  playbackStateSAB: Int32Array;
  rbAudio: Float32Array;
  rbState: Int32Array;
  sampleRate: number;

  cachedResampler: CachedResampler;

  transport: RenderTransport;
  voiceManager: VoiceManager;
  balancer: AdaptiveLoadBalancer;
  renderFrame = 0;
  lastDispatchedTick = -1;

  outL = new Float32Array(BLOCK_SIZE);
  outR = new Float32Array(BLOCK_SIZE);

  resample: ResamplerFn = DEFAULT_RESAMPLER;

  constructor(init: AudioWorkerInitOptions) {
    this.playbackStateSAB = new Int32Array(init.playbackStateSAB);
    this.rbAudio = new Float32Array(init.ringBufferAudioSAB);
    this.rbState = new Int32Array(init.ringBufferStateSAB);
    this.sampleRate = init.sampleRate;

    this.transport = new RenderTransport(this.sampleRate);
    this.voiceManager = new VoiceManager({ maxVoiceCount: 256 });

    this.cachedResampler = new CachedResampler({
      resampler: DEFAULT_RESAMPLER,
      cacheSizeBytes: 16 * 1024 * 1024,
      blockSize: BLOCK_SIZE,
    });

    this.balancer = new AdaptiveLoadBalancer({ blockSize: BLOCK_SIZE });
    this.balancer.init({ sampleRate: this.sampleRate });
    this.balancer.setActive(true);
  }

  onmessage(event: MessageEvent<EngineToWorkerMessage>) {
    const { data } = event;
    switch (data.type) {
      case 'start':
        // Start the render loop
        this.renderLoop();
        break;

      case 'song':
        this.noteData = new NoteBuffer(data.noteData);
        this.transport.setTempoMap(new TempoMapView(data.tempoChanges, data.initialTempo));
        this.transport.seekToTick(0);
        this.resetRender();
        break;

      case 'sample':
        this.voiceManager.loadSample(data.sampleId, data.channels);
        this.cachedResampler.loadSample(data.sampleId, data.channels);
        break;

      case 'stop':
        this.transport.stop();
        this.resetRender();
        break;

      case 'seek':
        this.transport.seekToTick(data.seconds);
        this.resetRender();
        break;
    }
  }

  resetRender() {
    this.voiceManager.resetVoices();
    resetRingBuffer(this.rbState);
    this.lastDispatchedTick = Math.floor(this.transport.currentTick) - 1;
  }

  renderLoop = () => {
    while (ringBufferHasSpace(this.rbState, BLOCK_SIZE)) {
      const block = this.renderBlock();
      writeToRingBuffer(this.rbAudio, this.rbState, block.outL, block.outR);

      // metadata (optional buffer)
      this.writeStats();
    }

    // Schedule next iteration
    setTimeout(this.renderLoop, 0);
  };

  handleNote = (instrument: number, pitch: number, volume: number, panning: number) => {
    this.voiceManager.spawn(instrument, pitch, volume, panning);
  };

  private dispatchPendingNotes() {
    // TODO: this logic can be simplified a lot
    if (!this.noteData || this.noteData.tickCount <= 0) return;

    const currentTick = Math.floor(this.transport.currentTick);
    const maxTick = this.noteData.tickCount - 1;
    const targetTick = Math.min(currentTick, maxTick);

    let startTick = this.lastDispatchedTick + 1;
    if (startTick < 0) startTick = 0;
    if (startTick > targetTick) return;

    for (let tick = startTick; tick <= targetTick; tick++) {
      this.noteData.forEachNoteAtTick(tick, this.handleNote);
    }

    this.lastDispatchedTick = targetTick;
  }

  renderBlock() {
    this.balancer.beginProcess();

    this.dispatchPendingNotes();

    this.outL.fill(0);
    this.outR.fill(0);

    // Mix all active voices
    this.mixVoices(this.outL, this.outR);
    this.applyBalancerDecision();

    this.transport.advance(BLOCK_SIZE);
    this.renderFrame += 1;

    return {
      outL: this.outL,
      outR: this.outR,
      voiceCount: this.voiceManager.activeCount,
    };
  }

  // TODO: this could be the responsibility of a Mixer class, or VoiceManager
  private mixVoices(outL: Float32Array, outR: Float32Array) {
    for (let v = this.voiceManager.voices.length - 1; v >= 0; v--) {
      const voice = this.voiceManager.voices[v];
      const sampleChannels = this.voiceManager.samples[voice.id];
      if (!sampleChannels) continue;

      const sample = sampleChannels[0];

      if (voice.pos >= sample.length) {
        this.voiceManager.voices.splice(v, 1);
        continue;
      }

      // Get cached (or build) slice ONCE
      const block = this.cachedResampler.getBlock(voice.id, voice.pitch, voice.sliceIndex);

      if (!block) continue;

      const gainL = voice.gain * (1 - Math.max(0, voice.pan));
      const gainR = voice.gain * (1 + Math.min(0, voice.pan));

      // How many samples remain in the source?
      const maxSamplesLeft = Math.floor((sample.length - voice.pos) / voice.pitch);

      if (maxSamplesLeft <= 0) {
        this.voiceManager.voices.splice(v, 1);
        continue;
      }

      const samplesToCopy = maxSamplesLeft < BLOCK_SIZE ? maxSamplesLeft : BLOCK_SIZE;

      // Tight copy loop
      for (let i = 0; i < samplesToCopy; i++) {
        const s = block[i];
        outL[i] += s * gainL;
        outR[i] += s * gainR;
      }

      // Advance position
      voice.sliceIndex += 1;
      voice.pos += samplesToCopy * voice.pitch;

      // Remove voice if finished
      if (samplesToCopy < BLOCK_SIZE) {
        this.voiceManager.voices.splice(v, 1);
      }
    }
  }

  private applyBalancerDecision() {
    const decision = this.balancer.endProcess({
      frame: this.renderFrame,
      blockSize: BLOCK_SIZE,
      activeVoices: this.voiceManager.activeCount,
      maxVoices: this.voiceManager.maxVoiceCount,
      bufferFill: this.getBufferFill(),
    });
    if (decision) {
      //console.log('Balancer decision:', decision);
      if (decision.resampler) {
        this.resample = decision.resampler;
      }
      if (decision.maxVoices !== undefined) {
        this.voiceManager.trimVoices(decision.maxVoices);
      }
      if (decision.killVoicesRatio) {
        this.voiceManager.killRatio(decision.killVoicesRatio);
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

  private writeStats() {
    Atomics.store(this.playbackStateSAB, PlaybackState.VOICES, this.voiceManager.activeCount);
    Atomics.store(this.playbackStateSAB, PlaybackState.MAX_VOICES, this.voiceManager.maxVoiceCount);
  }
}

// Web Worker entry point
let worker: AudioWorker | null = null;

self.onmessage = (e: MessageEvent<EngineToWorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    // Initialize the worker with SharedArrayBuffers and start immediately
    worker = new AudioWorker({
      playbackStateSAB: msg.playbackStateSAB,
      ringBufferAudioSAB: msg.ringBufferAudioSAB,
      ringBufferStateSAB: msg.ringBufferStateSAB,
      sampleRate: msg.sampleRate,
    });
  } else if (worker) {
    // Forward other messages to the worker instance
    worker.onmessage(e);
  }
};
