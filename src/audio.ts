import { Song } from '@encode42/nbs.js';
import { AVLTree } from 'avl';
import * as Tone from 'tone';

import PlayerInstrument from './instrument';
import { getTempoChangeEvents, getTempoSegments } from './song';

export const MAX_AUDIO_SOURCES = 256;

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
      const velocity = note.velocity / 100;
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
  onStarted: () => void;
  onEnded: () => void;
};

class AudioSource {
  static nextId = 0;
  id: number;
  sourceNode: Tone.ToneBufferSource;
  panVolNode: Tone.PanVol;
  endTime: number;

  constructor() {
    this.id = AudioSource.nextId++;
    this.sourceNode = new Tone.ToneBufferSource();
    this.panVolNode = new Tone.PanVol();
    this.endTime = -1;
  }

  play(params: AudioSourceParams) {
    const { source, destinationNode, time, playbackRate, volumeDb, panning, onStarted, onEnded } =
      params;

    this.sourceNode = new Tone.ToneBufferSource({
      url: source,
      playbackRate,
    });

    this.panVolNode = new Tone.PanVol({ volume: volumeDb, pan: panning });

    this.sourceNode.chain(this.panVolNode, destinationNode);
    this.sourceNode.start(time);
    this.sourceNode.onended = onEnded;

    this.endTime = time + source.duration * (1 / playbackRate);
    onStarted();
  }

  stop() {
    //this.sourceNode.onended(this.sourceNode);
    this.sourceNode.onended = () => {};
    this.sourceNode.stop();
    this.sourceNode.disconnect();
  }
}

class AudioSourcePool {
  private pool: Array<AudioSource> = [];

  private activeSources: AVLTree<{ endTime: number; id: number }, AudioSource> = new AVLTree(
    (a, b) => a.endTime - b.endTime || a.id - b.id,
  );

  numSources: number;

  constructor(numSources: number) {
    this.numSources = numSources;
    for (let i = 0; i < numSources; i++) {
      this.pool.push(new AudioSource());
    }
  }

  get activeSourceCount() {
    return this.activeSources.size;
  }

  get() {
    // Call register() with the source after playing it!
    //console.log('Pool:', this.pool.length);
    if (this.pool.length === 0) {
      //console.log('No sources available in pool; freeing one.');
      this.freeSource();
    }
    const source = this.pool.pop();
    if (!source) throw new Error('No source available in pool (this should not happen!)');
    return source;
  }

  register(source: AudioSource) {
    const key = { endTime: source.endTime, id: source.id };
    if (this.activeSources.find(key)) {
      //console.log('Source already registered!');
    }
    this.activeSources.insert(key, source);
    //console.log('Adding', key);
  }

  freeSource() {
    //console.log('Freeing source; pool:', this.activeSources.size);
    const minNode = this.activeSources.minNode();
    if (!minNode) throw new Error('No active sources to free (this should not happen!)');
    const source = minNode.data;
    if (!source) {
      throw new Error('No source to free (this should not happen!)');
    }
    this.recycle(source);
    return source;
  }

  recycle(source: AudioSource) {
    const key = { endTime: source.endTime, id: source.id };
    //console.log('Removing', key);

    source.stop();
    const removed = this.activeSources.remove(key);
    if (removed == null) {
      console.log('Failed to remove source from active sources (this should not happen!)');
      //console.log(this.activeSources.keys());
    }
    this.pool.push(source);
  }
}

export class AudioEngine {
  instruments: Array<PlayerInstrument>;
  song: Song;
  tempoSegments: Record<number, number>;

  audioBuffers: Record<number, Tone.ToneAudioBuffer> = {};

  audioDestination: Tone.ToneAudioNode;

  audioSourcePool: AudioSourcePool;

  constructor(
    song: Song,
    instruments: Array<PlayerInstrument>,
    maxAudioSources: number = MAX_AUDIO_SOURCES,
  ) {
    this.song = song;
    this.instruments = instruments;
    this.tempoSegments = getTempoSegments(song);

    // Master audio chain
    const masterGain = new Tone.Gain(0.5); // Master volume control
    const compressor = new Tone.Compressor(-24, 3); // Dynamic range compression
    const limiter = new Tone.Limiter(-3); // Prevent clipping
    masterGain.connect(compressor);
    compressor.connect(limiter);
    limiter.toDestination();
    this.audioDestination = masterGain;

    this.loadSounds();
    this.loadSong();

    this.audioSourcePool = new AudioSourcePool(maxAudioSources);
  }

  private async loadSounds() {
    await Tone.start(); // Ensure the audio context is running

    const promises = this.instruments.map(async (ins, index) => {
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

  private loadSong() {
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
      onStarted: () => {
        this.audioSourcePool.register(source);
      },
      onEnded: () => {
        //console.log('Ended, recycling:', source.id);
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
    const newBPM = this.tempoSegments[tick] * 15;
    console.debug('Setting tick to:', tick);
    console.debug('BPM:', newBPM);
    transport.bpm.value = newBPM;
  }

  public get soundCount() {
    return this.audioSourcePool.activeSourceCount;
  }

  public play() {
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
