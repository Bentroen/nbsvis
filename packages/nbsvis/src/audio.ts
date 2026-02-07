import { Song } from '@encode42/nbs.js';

import { RingBufferState } from './audio/buffer';
import { EngineMessage, WorkerMessage, WorkletMessage } from './audio/event';
import { AudioWorkerInitOptions } from './audio/worker/audio-worker';
import audioWorkerUrl from './audio/worker/audio-worker?worker&url';
import { NoteEvent } from './audio/worker/scheduler';
import { MAX_VOICE_COUNT } from './audio/worker/voice-manager';
import mixerWorkletUrl from './audio/worklet/mixer-processor?worker&url';
import { PlaybackState } from './audio/worklet/state';
import PlayerInstrument, { defaultInstruments } from './instrument';
import { getTempoChangeEvents, getTempoSegments } from './song';

export const MAX_AUDIO_SOURCES = MAX_VOICE_COUNT;

function resolveWorkletUrl() {
  const base = document.baseURI.endsWith('/') ? document.baseURI : `${document.baseURI}/`;
  const relative = mixerWorkletUrl.replace(/^\/+/, '');
  return new URL(relative, base).toString();
}

function resolveWorkerUrl() {
  const base = document.baseURI.endsWith('/') ? document.baseURI : `${document.baseURI}/`;
  const relative = audioWorkerUrl.replace(/^\/+/, '');
  return new URL(relative, base).toString();
}

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

function getNoteEvents(song: Song) {
  const noteEventsPerTick: Record<number, Array<NoteEvent>> = {};

  for (const layer of song.layers) {
    for (const tickStr in layer.notes) {
      const note = layer.notes[tickStr];

      // TODO: move this logic one abstraction level higher
      // song -> notes
      const tick = parseInt(tickStr);
      const instrument = note.instrument;
      const instrumentKeyOffset = song.instruments.loaded[instrument].key - 45;
      const key = note.key + instrumentKeyOffset + note.pitch / 100;
      const velocity = ((note.velocity / 100) * layer.volume) / 100;
      const panning = (layer.stereo === 0 ? note.panning : (note.panning + layer.stereo) / 2) / 100;

      if (velocity == 0) continue;

      // notes -> events
      const sampleId = instrument;
      const pitch = 2 ** ((key - 45) / 12);
      const gain = velocity;
      const pan = panning;

      const noteEvent = {
        tick,
        sampleId,
        pitch,
        gain,
        pan,
      };

      if (!(tick in noteEventsPerTick)) {
        noteEventsPerTick[tick] = [];
      }
      noteEventsPerTick[tick].push(noteEvent);
    }
  }
  return noteEventsPerTick;
}

export class AudioEngine {
  instruments: Array<PlayerInstrument>;
  song?: Song;
  tempoSegments?: Record<number, number>;

  private worker?: Worker;
  private mixerNode?: AudioWorkletNode;
  private sharedTickBuffer?: SharedArrayBuffer;
  private tickView?: Int32Array;
  private nativeCtx?: AudioContext;
  private initPromise?: Promise<void>;

  constructor() {
    this.instruments = [...defaultInstruments];
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
    // 128 frames × 2 channels × 64 blocks = 8192 frames
    const capacity = 8192; // frames

    const ringBufferData = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * capacity * 2);

    const ringBufferState = new SharedArrayBuffer(
      Int32Array.BYTES_PER_ELEMENT * RingBufferState.SIZE,
    );

    const rbState = new Int32Array(ringBufferState);
    rbState[RingBufferState.RB_READ_INDEX] = 0;
    rbState[RingBufferState.RB_WRITE_INDEX] = 0;
    rbState[RingBufferState.RB_CAPACITY] = capacity;

    // Spawn the DSP worker
    const workerUrl = resolveWorkerUrl();
    console.log('Spawning audio worker from:', workerUrl);
    this.worker = new Worker(workerUrl, { type: 'module' });
    this.worker.onerror = (error) => {
      console.error('Audio worker error:', error);
    };

    // Initialize worker with SharedArrayBuffers
    console.log('Initializing audio worker...');
    this.worker.postMessage({
      type: 'init',
      ringBufferAudioSAB: ringBufferData,
      ringBufferStateSAB: ringBufferState,
      sampleRate: this.nativeCtx.sampleRate,
    } satisfies AudioWorkerInitOptions & { type: 'init' });

    const mixerWorkletUrl = resolveWorkletUrl();
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
        ringBufferStateSAB: ringBufferState,
      },
    });

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

  private postToWorklet(msg: WorkletMessage, transfer?: Transferable[]) {
    if (!this.mixerNode) {
      throw new Error('Audio engine not initialized.');
    }
    this.mixerNode.port.postMessage(msg, transfer ?? []);
  }

  private postToWorker(msg: WorkerMessage, transfer?: Transferable[]) {
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
        this.postToWorker(msg);
        this.postToWorklet(msg);
        break;

      case 'play':
      case 'pause':
      case 'stop':
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

  public async loadSong(song: Song, instruments: Array<PlayerInstrument>) {
    await this.init();

    await this.resetSounds();
    this.instruments = defaultInstruments.concat(instruments);
    await this.loadSounds();

    this.song = song;
    this.tempoSegments = getTempoSegments(song);
    const noteEvents = getNoteEvents(this.song);
    const tempoChangeEvents = getTempoChangeEvents(this.song);
    this.scheduleSong(noteEvents, tempoChangeEvents, this.song.tempo * 15);

    this.dispatch({ type: 'start' });
  }

  private scheduleSong(
    noteEvents: Record<number, Array<NoteEvent>>,
    tempoChangeEvents: Record<number, number>,
    tempo: number,
  ) {
    this.dispatch({
      type: 'song',
      notes: noteEvents,
      tempoChanges: tempoChangeEvents,
      ticksPerBeat: 4,
      initialTempo: tempo,
    });

    console.log('Song scheduled.');
  }

  public get currentTick() {
    if (!this.tickView) return 0;
    return Atomics.load(this.tickView, PlaybackState.TICK) / 1000;
  }

  public set currentTick(tick: number) {
    // TODO: implement seconds-based seeking
    this.dispatch({ type: 'seek', seconds: tick });
  }

  public get soundCount() {
    if (!this.tickView) return 0;
    return Atomics.load(this.tickView, PlaybackState.VOICES);
  }

  public get isPlaying() {
    if (!this.tickView) return false;
    return Atomics.load(this.tickView, PlaybackState.PLAYING) === 1;
  }

  public async play() {
    await this.init();

    const ctx = this.nativeCtx!;

    if (ctx.state !== 'running') {
      await ctx.resume();
    }

    this.dispatch({ type: 'play' });
  }

  public pause() {
    this.dispatch({ type: 'pause' });
  }

  public stop() {
    // TODO: this should stop the worker too
    this.dispatch({ type: 'stop' });
  }
}
