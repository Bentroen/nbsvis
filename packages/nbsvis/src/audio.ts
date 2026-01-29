import { Song } from '@encode42/nbs.js';

import mixerWorkletUrl from './audio/worklet/mixer-processor?worker&url';
import { NoteEvent } from './audio/worklet/scheduler';
import { SharedState } from './audio/worklet/state';
import { MAX_VOICE_COUNT } from './audio/worklet/voice-manager';
import PlayerInstrument, { defaultInstruments } from './instrument';
import { getTempoChangeEvents, getTempoSegments } from './song';

export const MAX_AUDIO_SOURCES = MAX_VOICE_COUNT;

const DEFAULT_TEMPO_TPS = new Song().tempo * 15;

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
      const instrumentKeyOffset = 45 - song.instruments.loaded[instrument].key + 45;
      const key = note.key - instrumentKeyOffset + note.pitch / 100;
      const velocity = ((note.velocity / 100) * layer.volume) / 100;
      const panning = (layer.stereo === 0 ? note.panning : (note.panning + layer.stereo) / 2) / 100;

      // notes -> events
      const sampleId = instrument;
      const pitch = Math.pow(2, (key - 45) / 12);
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
    this.sharedTickBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * SharedState.SIZE);
    this.tickView = new Int32Array(this.sharedTickBuffer);

    console.log('Loading worklet from:', mixerWorkletUrl);
    await this.nativeCtx.audioWorklet.addModule(mixerWorkletUrl);
    console.log('Worklet loaded.');
    console.log('Creating mixer node...');
    console.log(this.nativeCtx);

    this.mixerNode = new AudioWorkletNode(this.nativeCtx, 'mixer-processor', {
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: {
        sharedTickBuffer: this.sharedTickBuffer,
      },
    });

    // Add a downstream limiter to prevent clipping
    const limiter = this.nativeCtx.createDynamicsCompressor();
    limiter.threshold.value = -6; // start limiting just below 0 dBFS
    limiter.knee.value = 0; // hard knee for limiter behavior
    limiter.ratio.value = 20; // high ratio ≈ limiting
    limiter.attack.value = 0.003; // fast attack
    limiter.release.value = 0.05; // short release

    // const masterGain = new Tone.Gain(0.5); // Master volume control
    // const compressor = new Tone.Compressor(-24, 3); // Dynamic range compression
    // const limiter = new Tone.Limiter(-3); // Prevent clipping
    // masterGain.connect(compressor);
    // compressor.connect(limiter);
    // limiter.toDestination();
    // this.audioDestination = masterGain;

    this.mixerNode.connect(limiter);
    limiter.connect(this.nativeCtx.destination);
  }

  private async loadSounds() {
    const port = this.getPort();
    const ctx = this.nativeCtx!;

    for (const [index, ins] of this.instruments.entries()) {
      const audioBuffer = await loadAudio(ctx, ins.audioSource);
      if (!audioBuffer) continue;

      const channels: Float32Array[] = [];
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        channels.push(audioBuffer.getChannelData(c).slice());
      }

      port.postMessage(
        {
          type: 'sample',
          sampleId: index,
          channels,
        },
        channels.map((c) => c.buffer),
      );
    }

    console.debug('All instruments loaded into worklet.');
  }

  private getPort(): MessagePort {
    if (!this.mixerNode) {
      throw new Error('Audio engine not initialized. Call init() before playback.');
    }
    return this.mixerNode.port;
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
  }

  private scheduleSong(
    noteEvents: Record<number, Array<NoteEvent>>,
    tempoChangeEvents: Record<number, number>,
    tempo: number,
  ) {
    this.getPort().postMessage({
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
    return Atomics.load(this.tickView, SharedState.TICK) / 1000;
  }

  public set currentTick(tick: number) {
    this.getPort().postMessage({ type: 'seek', tick });
  }

  public get soundCount() {
    if (!this.tickView) return 0;
    return Atomics.load(this.tickView, SharedState.VOICES);
  }

  public get isPlaying() {
    if (!this.tickView) return false;
    return Atomics.load(this.tickView, SharedState.PLAYING) === 1;
  }

  public play() {
    console.log('Playing');
    this.getPort().postMessage({ type: 'play' });
  }

  public pause() {
    this.getPort().postMessage({ type: 'pause' });
  }

  public stop() {
    this.getPort().postMessage({ type: 'stop' });
  }
}
