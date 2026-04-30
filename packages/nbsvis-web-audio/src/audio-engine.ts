import type { AudioPlaybackPayload, NbsvisAudioBackend } from '@opennbs/nbsvis-audio-api';

import { RingBufferState } from './buffer';
import {
  EngineMessage,
  EngineToWorkerMessage,
  EngineToWorkletMessage,
  WorkletToEngineMessage,
} from './event';
import { tempoSegmentsToChangeRecord } from './tempo-expand';
import { AudioWorkerInitOptions } from './worker/audio-worker';
import audioWorkerUrl from './worker/audio-worker?worker&url';
import workletUrl from './worklet/audio-sink-processor?worker&url';
import { PlaybackState } from './worklet/state';

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function resolveAssetUrl(url: string, urlBase?: string | URL): string {
  if (!urlBase) {
    return url;
  }

  const base =
    typeof urlBase === 'string'
      ? ensureTrailingSlash(urlBase)
      : ensureTrailingSlash(urlBase.toString());
  const relative = url.replace(/^\/+/, '');
  console.log(`Resolving asset URL. Base: ${base}, Relative: ${relative}`);
  return new URL(relative, base).toString();
}

export type AudioEngineOptions = {
  workerUrl?: string;
  workletUrl?: string;
  urlBase?: string | URL;
};

function decodeAudioData(ctx: AudioContext, buffer: ArrayBuffer): Promise<AudioBuffer> {
  return ctx.decodeAudioData(buffer);
}

export class AudioEngine implements NbsvisAudioBackend {
  private worker?: Worker;
  private mixerNode?: AudioWorkletNode;
  private sharedTickBuffer?: SharedArrayBuffer;
  private tickView?: Int32Array;
  private nativeCtx?: AudioContext;
  private initPromise?: Promise<void>;
  private endedListeners = new Set<() => void>();
  private playbackEnded = false;
  private options: AudioEngineOptions;

  constructor(options: AudioEngineOptions = {}) {
    this.options = options;
  }

  public async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize();
    return this.initPromise;
  }

  private async initialize() {
    this.nativeCtx = new AudioContext();

    this.sharedTickBuffer = new SharedArrayBuffer(
      Int32Array.BYTES_PER_ELEMENT * PlaybackState.SIZE,
    );
    this.tickView = new Int32Array(this.sharedTickBuffer);

    const workerBlockSize = 512;
    const frameCapacity = 256 * workerBlockSize;
    const sampleCapacity = frameCapacity * 2;
    const metaCapacity = frameCapacity / workerBlockSize;

    const ringBufferData = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * sampleCapacity);
    const ringBufferMeta = new SharedArrayBuffer(Int8Array.BYTES_PER_ELEMENT * metaCapacity);
    const ringBufferState = new SharedArrayBuffer(
      Int32Array.BYTES_PER_ELEMENT * RingBufferState.SIZE,
    );

    const rbState = new Int32Array(ringBufferState);
    rbState[RingBufferState.RB_READ_INDEX] = 0;
    rbState[RingBufferState.RB_WRITE_INDEX] = 0;
    rbState[RingBufferState.RB_CAPACITY] = frameCapacity;

    const workerUrl =
      this.options.workerUrl ?? resolveAssetUrl(audioWorkerUrl, this.options.urlBase);
    console.log('Spawning audio worker from:', workerUrl);
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.onerror = (error) => {
      console.error('Audio worker error:', error);
    };

    console.log('Initializing audio worker...');
    this.worker.postMessage({
      type: 'init',
      playbackStateSAB: this.sharedTickBuffer,
      ringBufferAudioSAB: ringBufferData,
      ringBufferMetaSAB: ringBufferMeta,
      ringBufferStateSAB: ringBufferState,
      sampleRate: this.nativeCtx.sampleRate,
    } satisfies AudioWorkerInitOptions & { type: 'init' });

    const mixerWorkletUrl =
      this.options.workletUrl ?? resolveAssetUrl(workletUrl, this.options.urlBase);
    console.log('Loading worklet from:', mixerWorkletUrl);
    await this.nativeCtx.audioWorklet.addModule(mixerWorkletUrl);
    console.log('Worklet loaded.');
    console.log('Creating mixer node...');
    console.log(this.nativeCtx);

    this.mixerNode = new AudioWorkletNode(this.nativeCtx, 'audio-sink', {
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: {
        playbackStateSAB: this.sharedTickBuffer,
        ringBufferAudioSAB: ringBufferData,
        ringBufferMetaSAB: ringBufferMeta,
        ringBufferStateSAB: ringBufferState,
      },
    });
    this.mixerNode.port.onmessage = (event: MessageEvent<WorkletToEngineMessage>) => {
      if (event.data.type === 'ended') {
        this.playbackEnded = true;
        for (const listener of this.endedListeners) {
          listener();
        }
      }
    };

    const compressor = this.nativeCtx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const limiter = this.nativeCtx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;

    const masterGainNode = this.nativeCtx.createGain();
    masterGainNode.gain.value = 0.5;

    this.mixerNode.connect(compressor);
    compressor.connect(limiter);
    limiter.connect(masterGainNode);
    masterGainNode.connect(this.nativeCtx.destination);
  }

  private postToWorklet(msg: EngineToWorkletMessage, transfer?: Transferable[]) {
    if (!this.mixerNode) {
      throw new Error('Audio engine not initialized.');
    }
    this.mixerNode.port.postMessage(msg, transfer ?? []);
  }

  private postToWorker(msg: EngineToWorkerMessage, transfer?: Transferable[]) {
    if (!this.worker) {
      throw new Error('Audio engine not initialized.');
    }
    this.worker.postMessage(msg, transfer ?? []);
  }

  private dispatch(msg: EngineMessage) {
    switch (msg.type) {
      case 'song':
        this.postToWorker(msg);
        this.postToWorklet(msg);
        break;

      case 'sample': {
        const transfer = msg.channels.map((c) => c.buffer);
        this.postToWorker(msg, transfer);
        break;
      }

      case 'start': {
        this.postToWorker(msg);
        break;
      }

      case 'seek':
      case 'stop':
      case 'loop':
        this.postToWorker(msg);
        this.postToWorklet(msg);
        break;

      case 'play':
      case 'pause':
        this.postToWorklet(msg);
        break;
    }
  }

  private async decodeAndUploadSamples(payload: AudioPlaybackPayload) {
    const ctx = this.nativeCtx!;

    const ids = Object.keys(payload.instrumentBuffers)
      .map(Number)
      .sort((a, b) => a - b);

    for (const sampleId of ids) {
      const raw = payload.instrumentBuffers[sampleId];
      const arrayBuffer = raw.slice(0);
      const audioBuffer = await decodeAudioData(ctx, arrayBuffer);

      const channels: Float32Array[] = [];
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        channels.push(audioBuffer.getChannelData(c).slice());
      }

      this.dispatch({
        type: 'sample',
        sampleId,
        channels,
      });
    }

    console.debug('All instrument samples loaded into worker.');
  }

  public async loadSong(payload: AudioPlaybackPayload) {
    await this.init();
    this.playbackEnded = false;

    await this.decodeAndUploadSamples(payload);

    const { timeline, noteData, loopStartTick, ticksPerBeat } = payload;
    const tempoChanges = tempoSegmentsToChangeRecord(timeline.tempoSegments);

    this.dispatch({
      type: 'song',
      noteData,
      tempoChanges,
      ticksPerBeat,
      initialTempo: timeline.initialTempo,
      lengthTicks: timeline.lengthTicks,
      loopStartTick,
    });

    this.dispatch({ type: 'start' });
  }

  public get loop() {
    if (!this.tickView) return false;
    return Atomics.load(this.tickView, PlaybackState.LOOP) === 1;
  }

  public set loop(loop: boolean) {
    this.dispatch({ type: 'loop', loop });
  }

  public get currentTick() {
    if (!this.tickView) return 0;
    return Atomics.load(this.tickView, PlaybackState.TICK) / 1000;
  }

  public seekToTick(tick: number) {
    this.playbackEnded = false;
    // Worker transport expects a tick; the message field is historically named `seconds`.
    this.dispatch({ type: 'seek', seconds: tick });
  }

  public get soundCount() {
    if (!this.tickView) return 0;
    return Atomics.load(this.tickView, PlaybackState.VOICES);
  }

  public get maxSoundCount() {
    if (!this.tickView) return 0;
    return Atomics.load(this.tickView, PlaybackState.MAX_VOICES);
  }

  public get isPlaying() {
    if (!this.tickView) return false;
    return Atomics.load(this.tickView, PlaybackState.PLAYING) === 1;
  }

  public get isEnded() {
    return this.playbackEnded;
  }

  public play() {
    const restartFromEnded = this.playbackEnded;
    if (restartFromEnded) {
      this.playbackEnded = false;
    }

    void (async () => {
      await this.init();

      const ctx = this.nativeCtx!;

      if (ctx.state !== 'running') {
        await ctx.resume();
      }

      if (restartFromEnded) {
        this.dispatch({ type: 'seek', seconds: 0 });
      }

      this.dispatch({ type: 'play' });
    })();
  }

  public pause() {
    this.dispatch({ type: 'pause' });
  }

  public stop() {
    this.playbackEnded = false;
    this.dispatch({ type: 'stop' });
  }

  public onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }
}
