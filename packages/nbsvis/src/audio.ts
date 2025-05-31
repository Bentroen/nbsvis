import { Song } from '@encode42/nbs.js';
import * as Tone from 'tone';

import PlayerInstrument, { defaultInstruments } from './instrument';
import { getTempoChangeEvents, getTempoSegments } from './song';
import { TransportClass } from 'tone/build/esm/core/clock/Transport';

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
  let arrayBuffer;
  if (!audioSource) return null;
  if (typeof audioSource === 'string') {
    const response = await fetch(audioSource);
    arrayBuffer = await response.arrayBuffer();
  } else {
    arrayBuffer = audioSource;
  }
  return await decodeAudioData(arrayBuffer);
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

type AudioSourceParams = {
  source: Tone.ToneAudioBuffer;
  destinationNode: Tone.ToneAudioNode;
  time: number;
  playbackRate: number;
  volumeDb: number;
  panning: number;
  onEnded: () => void;
};

class AudioSource {
  static nextId = 0;
  id: number;
  sourceNode: Tone.ToneBufferSource;
  panVolNode: Tone.PanVol;

  constructor() {
    this.id = AudioSource.nextId++;
    this.sourceNode = new Tone.ToneBufferSource();
    this.panVolNode = new Tone.PanVol();
  }

  play(params: AudioSourceParams) {
    const { source, destinationNode, time, playbackRate, volumeDb, panning, onEnded } = params;

    this.sourceNode = new Tone.ToneBufferSource({
      url: source,
      playbackRate,
    });

    this.panVolNode = new Tone.PanVol({ volume: volumeDb, pan: panning });

    this.sourceNode.chain(this.panVolNode, destinationNode);
    this.sourceNode.start(time);
    this.sourceNode.onended = onEnded;
  }

  stop() {
    //this.sourceNode.onended(this.sourceNode);
    this.sourceNode.onended = () => {};
    this.sourceNode.stop(Tone.getTransport().now());
    this.sourceNode.disconnect();
  }
}

class AudioSourcePool {
  private freeSources: Array<AudioSource> = [];

  private activeSources: Array<AudioSource> = [];

  numSources: number;

  constructor(numSources: number) {
    this.numSources = numSources;
    for (let i = 0; i < numSources; i++) {
      this.freeSources.push(new AudioSource());
    }
  }

  get activeSourceCount() {
    return this.activeSources.length;
  }

  get() {
    if (this.freeSources.length === 0) {
      this.freeSource();
    }
    const source = this.freeSources.pop();
    if (!source) throw new Error('No source available in pool (this should not happen!)');
    this.activeSources.push(source);
    return source;
  }

  freeSource() {
    // Recycle oldest source
    const source = this.activeSources[0];
    if (!source) throw new Error('No active source to free (this should not happen!)');
    this.recycle(source);
  }

  recycle(source: AudioSource) {
    source.stop();
    this.activeSources.splice(this.activeSources.indexOf(source), 1);
    this.freeSources.push(source);
  }
}

export class AudioEngine {
  instruments: Array<PlayerInstrument>;
  song?: Song;
  tempoSegments?: Record<number, number>;

  audioBuffers: Record<number, Tone.ToneAudioBuffer> = {};

  audioDestination: Tone.ToneAudioNode;

  audioSourcePool: AudioSourcePool;

  outputBuffer?: Tone.ToneBufferSource;

  defaultContext: Tone.BaseContext;

  player: Tone.Player;

  constructor(maxAudioSources: number = MAX_AUDIO_SOURCES) {
    this.instruments = [...defaultInstruments];

    // Master audio chain
    const masterGain = new Tone.Gain(0.5); // Master volume control
    const compressor = new Tone.Compressor(-24, 3); // Dynamic range compression
    const limiter = new Tone.Limiter(-3); // Prevent clipping
    masterGain.connect(compressor);
    compressor.connect(limiter);
    //limiter.toDestination();
    this.audioDestination = masterGain;

    this.loadSounds();

    this.audioSourcePool = new AudioSourcePool(maxAudioSources);

    this.defaultContext = Tone.getContext();

    // Set up player
    this.player = new Tone.Player({
      onload: () => {
        console.log('Player loaded');
      },
      onerror: (error) => {
        console.error('Error loading player:', error);
      },
    })
      .sync()
      .toDestination();
  }

  private async loadSounds() {
    const promises = this.instruments.map(async (ins, index) => {
      if (this.audioBuffers[index]) return; // Skip if already loaded
      const audioBuffer = await loadAudio(ins.audioSource);
      if (!audioBuffer) return;
      const buffer = new Tone.ToneAudioBuffer({
        url: audioBuffer,
        onload: () => console.log(`Loaded instrument ${ins.name}`),
      });

      await Tone.loaded(); // Wait for all samples to load
      this.audioBuffers[index] = buffer;
    });

    await Promise.all(promises);
    console.debug('All instruments loaded.');
  }

  private async resetSounds() {
    /*
    Clears all custom instrument sounds from the audio engine, resetting it to the initial state.
    */
    this.instruments
      .filter((ins) => !ins.isBuiltIn)
      .forEach((ins, index) => {
        const audioBuffer = this.audioBuffers[index];
        if (audioBuffer) {
          audioBuffer.dispose();
          delete this.audioBuffers[index];
          console.log(`Disposed custom instrument ${ins.name} (id: ${index})`);
        }
      });
    this.instruments = this.instruments.filter((ins) => ins.isBuiltIn);
  }

  public async loadSong(song: Song, instruments: Array<PlayerInstrument>) {
    // Custom sounds
    this.resetSounds();
    this.instruments = defaultInstruments.concat(instruments);
    this.loadSounds();

    // Song
    this.song = song;
    this.tempoSegments = getTempoSegments(song);
    const noteEvents = getNoteEvents(this.song);
    const tempoChangeEvents = getTempoChangeEvents(this.song);

    const transport = Tone.getTransport();
    this.scheduleSong(transport, [], tempoChangeEvents, this.song.tempo * 15);

    const buffer = await this.renderSong(noteEvents, tempoChangeEvents, this.song.tempo * 15);
    console.log(buffer);
    console.log('Song pre-render complete.');

    Tone.setContext(this.defaultContext); // Ensure Tone context is set

    this.player = new Tone.Player({
      url: buffer,
      loop: false,
      autostart: false,
      onload: () => {
        console.log('Player loaded');
      },
      onerror: (error) => {
        console.error('Error loading player:', error);
      },
    })
      .toDestination()
      .sync()
      .start(0);

    //const player2 = new Tone.Player({
    //  url: buffer,
    //  loop: false,
    //  autostart: false,
    //  onload: () => {
    //    console.log('Player loaded');
    //  },
    //  onerror: (error) => {
    //    console.error('Error loading player:', error);
    //  },
    //})
    //  .toDestination()
    //  .sync()
    //  .start(0.2);
  }

  private async renderSong(
    noteEvents: Record<number, Array<NoteEvent>> = {},
    tempoChangeEvents: Record<number, number> = {},
    tempo: number,
  ) {
    console.log('Starting offline rendering...');

    return await Tone.Offline((context) => {
      //this.scheduleSong(transport, noteEvents, tempoChangeEvents, tempo);

      Tone.setContext(context);
      const transport = context.transport;

      // Master chain
      const masterGain = new Tone.Gain(0.5); // Master volume control
      const compressor = new Tone.Compressor(-24, 3); // Dynamic range compression
      const limiter = new Tone.Limiter(-3); // Prevent clipping
      console.log(masterGain.context);
      masterGain.connect(compressor);
      compressor.connect(limiter);
      limiter.toDestination();
      const audioDestination = masterGain;

      const secondsPerTick = 60 / tempo / 4;

      for (const [tickStr, notes] of Object.entries(noteEvents)) {
        const tick = parseInt(tickStr);

        for (const note of notes) {
          transport.schedule((time) => {
            Tone.setContext(context);

            const { key, instrument, velocity, panning } = note;

            if (velocity === 0) return;

            const audioBuffer = this.audioBuffers[instrument];
            if (!audioBuffer) return;

            const insOffset = 45 - this.instruments[instrument].baseKey + 45;
            const playbackRate = 2 ** ((key - insOffset) / 12);

            const volumeDb = Tone.gainToDb(velocity);

            const sourceNode = new Tone.ToneBufferSource({
              url: audioBuffer,
              playbackRate,
            });

            const panVolNode = new Tone.PanVol({ volume: volumeDb, pan: panning });

            sourceNode.chain(panVolNode, audioDestination);
            sourceNode.start(time);
          }, tick * secondsPerTick);
        }
      }

      console.log(tempo);
      transport.bpm.value = tempo / 6; // TODO: why??
      console.log(tempo / 6);

      //for (const [tickStr, newTempo] of Object.entries(tempoChangeEvents)) {
      //  const tick = parseInt(tickStr);
      //  transport.schedule((time) => {
      //    transport.bpm.setValueAtTime(newTempo * 15, time);
      //  }, tick * secondsPerTick);
      //}

      //const osc = new Tone.Oscillator(440).toDestination();
      //transport.schedule((time) => {
      //  osc.start(time).stop(time + 0.5);
      //}, 0);
      //make sure to start the transport
      transport.start(0);
    }, 5);
  }

  private scheduleSong(
    transport: TransportClass,
    noteEvents: Record<number, Array<NoteEvent>>,
    tempoChangeEvents: Record<number, number>,
    tempo: number,
  ) {
    transport.stop();
    transport.cancel();
    transport.position = 0;

    const secondsPerTick = 60 / tempo / 4; // 4 ticks per beat

    this.scheduleNotes(transport, noteEvents, secondsPerTick);
    this.scheduleTempoChanges(transport, tempo, tempoChangeEvents, secondsPerTick);

    console.log('Song scheduled.');
  }

  private scheduleNotes(
    transport: TransportClass,
    noteEvents: Record<number, Array<NoteEvent>>,
    secondsPerTick: number,
  ) {
    for (const [tickStr, notes] of Object.entries(noteEvents)) {
      const tick = parseInt(tickStr);
      transport.schedule((time) => {
        this.playNotes(notes, time);
      }, tick * secondsPerTick);
    }
  }

  private scheduleTempoChanges(
    transport: TransportClass,
    initialTempo: number,
    tempoChangeEvents: Record<number, number>,
    secondsPerTick: number,
  ) {
    transport.bpm.value = initialTempo;
    for (const [tickStr, newTempo] of Object.entries(tempoChangeEvents)) {
      const tick = parseInt(tickStr);
      transport.schedule((time) => {
        transport.bpm.setValueAtTime(newTempo * 15, time);
      }, tick * secondsPerTick);
    }
  }

  private playNote(note: NoteEvent, time: number) {
    const { key, instrument, velocity, panning } = note;

    if (velocity === 0) return;

    const audioBuffer = this.audioBuffers[instrument];
    if (!audioBuffer) return;

    const insOffset = 45 - this.instruments[instrument].baseKey + 45;
    const playbackRate = 2 ** ((key - insOffset) / 12);

    const volumeDb = Tone.gainToDb(velocity);

    const source = this.audioSourcePool.get();

    source.play({
      source: audioBuffer,
      destinationNode: this.audioDestination,
      time,
      playbackRate,
      panning,
      volumeDb,
      onEnded: () => {
        this.audioSourcePool.recycle(source);
      },
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
    return this.audioSourcePool.activeSourceCount;
  }

  public get isPlaying() {
    return Tone.getTransport().state === 'started';
  }

  public play() {
    Tone.setContext(this.defaultContext);
    Tone.getContext().resume();
    Tone.getTransport().start();
  }

  public pause() {
    Tone.setContext(this.defaultContext);
    Tone.getTransport().pause();
  }

  public stop() {
    Tone.setContext(this.defaultContext);
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
  }
}
