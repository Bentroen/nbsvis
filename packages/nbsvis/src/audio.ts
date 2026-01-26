import { Song } from '@encode42/nbs.js';
import * as Tone from 'tone';

import mixerWorkletUrl from './audio/mixer-processor?worker&url';
import PlayerInstrument, { defaultInstruments } from './instrument';
import { getTempoChangeEvents, getTempoSegments } from './song';

export const MAX_AUDIO_SOURCES = 256;

const DEFAULT_TEMPO_TPS = new Song().tempo * 15;

type NoteEvent = {
  tick: number;
  instrument: number;
  key: number;
  velocity: number;
  panning: number;
};

function decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer> {
  return Tone.getContext().decodeAudioData(buffer);
}

async function loadAudio(audioSource: string | ArrayBuffer): Promise<AudioBuffer | null> {
  if (!audioSource) return null;

  let arrayBuffer: ArrayBuffer;
  if (typeof audioSource === 'string') {
    const response = await fetch(audioSource);
    arrayBuffer = await response.arrayBuffer();
  } else {
    // decodeAudioData detaches the buffer; clone so callers can reuse the original
    arrayBuffer = audioSource.slice(0);
  }

  return decodeAudioData(arrayBuffer);
}

function getNoteEvents(song: Song) {
  const noteEventsPerTick: Record<number, Array<NoteEvent>> = [];

  for (const layer of song.layers) {
    for (const tickStr in layer.notes) {
      const note = layer.notes[tickStr];

      const tick = parseInt(tickStr);
      const instrument = note.instrument;
      const key = note.key + note.pitch / 100;
      const velocity = ((note.velocity / 100) * layer.volume) / 100;
      const panning = (layer.stereo === 0 ? note.panning : (note.panning + layer.stereo) / 2) / 100;

      const noteEvent = {
        tick,
        instrument,
        key,
        velocity,
        panning,
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
    const nativeCtx = new AudioContext();
    Tone.setContext(new Tone.Context({ context: nativeCtx }));
    console.log('Loading worklet from:', mixerWorkletUrl);
    await nativeCtx.audioWorklet.addModule(mixerWorkletUrl);
    console.log('Worklet loaded.');
    console.log('Creating mixer node...');
    console.log(nativeCtx);
    this.mixerNode = new AudioWorkletNode(nativeCtx, 'mixer-processor');

    // Add a downstream limiter to prevent clipping
    const limiter = nativeCtx.createDynamicsCompressor();
    limiter.threshold.value = -6; // start limiting just below 0 dBFS
    limiter.knee.value = 0; // hard knee for limiter behavior
    limiter.ratio.value = 20; // high ratio ≈ limiting
    limiter.attack.value = 0.003; // fast attack
    limiter.release.value = 0.05; // short release

    this.mixerNode.connect(nativeCtx.destination);
  }

  private async loadSounds() {
    const port = this.getPort();

    for (const [index, ins] of this.instruments.entries()) {
      const audioBuffer = await loadAudio(ins.audioSource);
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
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.position = 0;

    transport.bpm.value = tempo;
    const secondsPerTick = 60 / tempo / 4; // 4 ticks per beat

    for (const [tickStr, notes] of Object.entries(noteEvents)) {
      const tick = parseInt(tickStr);
      transport.schedule((time) => {
        this.playNotes(notes, time);
      }, tick * secondsPerTick);
    }

    for (const [tickStr, newTempo] of Object.entries(tempoChangeEvents)) {
      const tick = parseInt(tickStr);
      transport.schedule((time) => {
        transport.bpm.setValueAtTime(newTempo * 15, time);
      }, tick * secondsPerTick);
    }
    console.log('Song scheduled.');
  }

  private playNote(note: NoteEvent, time: number) {
    const { key, instrument, velocity, panning } = note;
    if (velocity === 0) return;

    const insOffset = 45 - this.instruments[instrument].baseKey + 45;
    const pitch = 2 ** ((key - insOffset) / 12);

    const gain = velocity * 0.5; // TODO: masterVolume

    const ctxTime = Tone.getContext().rawContext.currentTime + (time - Tone.getTransport().seconds);

    const port = this.getPort();
    port.postMessage({
      type: 'play',
      sampleId: instrument,
      when: ctxTime,
      gain,
      pan: panning,
      pitch,
    });
  }

  private playNotes(notes: Array<NoteEvent>, time: number) {
    for (const note of notes) {
      this.playNote(note, time);
    }
  }

  public get currentTick() {
    const transport = Tone.getTransport();
    return (transport.ticks / transport.PPQ) * 4;
  }

  public set currentTick(tick: number) {
    const transport = Tone.getTransport();
    transport.ticks = (tick * transport.PPQ) / 4;
    const newBPM = (this.tempoSegments?.[tick] ?? DEFAULT_TEMPO_TPS) * 15;
    console.debug('Setting tick to:', tick);
    console.debug('BPM:', newBPM);
    transport.bpm.value = newBPM;
  }

  public get soundCount() {
    return 0;
  }

  public get isPlaying() {
    return Tone.getTransport().state === 'started';
  }

  public play() {
    Tone.start(); // user gesture gate
    Tone.getContext().resume();
    Tone.getTransport().start();
  }

  public pause() {
    Tone.getTransport().pause();
  }

  public stop() {
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
  }
}
