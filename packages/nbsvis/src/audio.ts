import { Song } from '@encode42/nbs.js';

import { RingBufferState } from './audio/buffer';
import {
  EngineMessage,
  EngineToWorkerMessage,
  EngineToWorkletMessage,
  WorkletToEngineMessage,
} from './audio/event';
import { AudioWorkerInitOptions } from './audio/worker/audio-worker';
import audioWorkerUrl from './audio/worker/audio-worker?worker&url';
import workletUrl from './audio/worklet/audio-sink-processor?worker&url';
import { PlaybackState } from './audio/worklet/state';
import PlayerInstrument, { defaultInstruments } from './instrument';
import { NoteBuffer } from './note';
import { getTempoChangeEvents, getTempoSegments } from './song';

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

async function loadAudio(
  ctx: AudioContext,
  audioSource: string | ArrayBuffer,
): Promise<AudioBuffer | null> {
  if (!audioSource) return null;

  let arrayBuffer: ArrayBuffer;
  if (typeof audioSource === 'string') {
    const response = await fetch(audioSource);
    arrayBuffer = await response.arrayBuffer();
  } else {
    // decodeAudioData detaches the buffer; clone so callers can reuse the original
    arrayBuffer = audioSource.slice(0);
  }

  return decodeAudioData(ctx, arrayBuffer);
}

export class AudioEngine {
  instruments: Array<PlayerInstrument>;
  tempoSegments?: Record<number, number>;

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
    this.instruments = [...defaultInstruments];
    this.options = options;
  }

  /**
   * Lazily prepare the audio worklet and upload instrument samples.
   */
  public async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize();
    return this.initPromise;
  }

  private async initialize() {
    this.nativeCtx = new AudioContext();

    // Set up shared state buffer
    this.sharedTickBuffer = new SharedArrayBuffer(
      Int32Array.BYTES_PER_ELEMENT * PlaybackState.SIZE,
    );
    this.tickView = new Int32Array(this.sharedTickBuffer);

    // Set up shared ring buffer
    // RB_CAPACITY is measured in frames (not interleaved samples)
    const workletBlockSize = 128;
    const workerBlockSize = 512;
    const frameCapacity = 256 * workletBlockSize; // 32768 frames (~682 ms @ 48 kHz)
    const sampleCapacity = frameCapacity * 2; // interleaved stereo samples
    const metaCapacity = frameCapacity / workerBlockSize; // one byte per 512-frame worker block

    const ringBufferData = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * sampleCapacity);
    const ringBufferMeta = new SharedArrayBuffer(Int8Array.BYTES_PER_ELEMENT * metaCapacity);
    const ringBufferState = new SharedArrayBuffer(
      Int32Array.BYTES_PER_ELEMENT * RingBufferState.SIZE,
    );

    const rbState = new Int32Array(ringBufferState);
    rbState[RingBufferState.RB_READ_INDEX] = 0;
    rbState[RingBufferState.RB_WRITE_INDEX] = 0;
    rbState[RingBufferState.RB_CAPACITY] = frameCapacity;

    // Spawn the DSP worker
    const workerUrl =
      this.options.workerUrl ?? resolveAssetUrl(audioWorkerUrl, this.options.urlBase);
    console.log('Spawning audio worker from:', workerUrl);
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.onerror = (error) => {
      console.error('Audio worker error:', error);
    };

    // Initialize worker with SharedArrayBuffers
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

    // chain: mixer -> compressor -> limiter -> masterGain -> destination

    // Soft compressor to smooth out dynamics
    const compressor = this.nativeCtx.createDynamicsCompressor();
    compressor.threshold.value = -24; // threshold in dB
    compressor.knee.value = 30; // knee in dB
    compressor.ratio.value = 12; // compression ratio
    compressor.attack.value = 0.003; // attack time in seconds
    compressor.release.value = 0.25; // release time in seconds

    // Brick-wall limiter to prevent clipping
    const limiter = this.nativeCtx.createDynamicsCompressor();
    limiter.threshold.value = -3; // threshold in dB
    limiter.knee.value = 0; // knee in dB
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001; // attack time in seconds
    limiter.release.value = 0.1; // release time in seconds

    // Gain node for master volume
    const masterGainNode = this.nativeCtx.createGain();
    masterGainNode.gain.value = 0.5;

    // Output chain
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

  private async loadSounds() {
    const ctx = this.nativeCtx!;

    for (const [index, ins] of this.instruments.entries()) {
      const audioBuffer = await loadAudio(ctx, ins.audioSource);
      if (!audioBuffer) continue;

      const channels: Float32Array[] = [];
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        channels.push(audioBuffer.getChannelData(c).slice());
      }

      this.dispatch({
        type: 'sample',
        sampleId: index,
        channels,
      });
    }

    console.debug('All instruments loaded into worker.');
  }

  private async resetSounds() {
    // Drop any previously added custom instruments
    this.instruments = [...defaultInstruments];
  }

  public async loadSong(song: Song, noteData: NoteBuffer, instruments: Array<PlayerInstrument>) {
    await this.init();
    this.playbackEnded = false;

    await this.resetSounds();
    this.instruments = defaultInstruments.concat(instruments);
    await this.loadSounds();

    this.tempoSegments = getTempoSegments(song);
    const noteEvents = noteData.getBuffer();
    const tempoChangeEvents = getTempoChangeEvents(song);
    this.scheduleSong(
      noteEvents,
      tempoChangeEvents,
      song.tempo * 15,
      song.length,
      song.loop.startTick,
    );

    this.dispatch({ type: 'start' });
  }

  private scheduleSong(
    noteData: SharedArrayBuffer,
    tempoChangeEvents: Record<number, number>,
    tempo: number,
    lengthTicks: number,
    loopStartTick: number,
  ) {
    this.dispatch({
      type: 'song',
      noteData: noteData,
      tempoChanges: tempoChangeEvents,
      ticksPerBeat: 4,
      initialTempo: tempo,
      lengthTicks: lengthTicks,
      loopStartTick: loopStartTick,
    });

    console.log('Song scheduled.');
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

  public set currentTick(tick: number) {
    // TODO: implement seconds-based seeking
    this.playbackEnded = false;
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

  public async play() {
    const restartFromEnded = this.playbackEnded;
    if (restartFromEnded) {
      this.playbackEnded = false;
    }

    await this.init();

    const ctx = this.nativeCtx!;

    if (ctx.state !== 'running') {
      await ctx.resume();
    }

    if (restartFromEnded) {
      this.dispatch({ type: 'seek', seconds: 0 });
    }

    this.dispatch({ type: 'play' });
  }

  public pause() {
    this.dispatch({ type: 'pause' });
  }

  public stop() {
    // TODO: this should stop the worker too
    this.playbackEnded = false;
    this.dispatch({ type: 'stop' });
  }

  public onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }
}
