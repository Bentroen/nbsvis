import { Song } from '@encode42/nbs.js';
import * as Tone from 'tone';

import PlayerInstrument from './instrument';

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

export class AudioEngine {
  instruments: Array<PlayerInstrument>;
  song: Song;

  audioBuffers: Record<number, Tone.ToneAudioBuffer> = {};

  audioDestination: Tone.ToneAudioNode;

  constructor(song: Song, instruments: Array<PlayerInstrument>) {
    this.song = song;
    this.instruments = instruments;

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
    const notes = getNoteEvents(this.song);
    this.scheduleSong(notes, this.song.tempo * 15);
  }

  private scheduleSong(events: Record<number, Array<NoteEvent>>, tempo: number) {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.position = 0;

    transport.bpm.value = tempo;
    const secondsPerTick = 60 / tempo / 4; // 4 ticks per beat

    for (const [tickStr, notes] of Object.entries(events)) {
      const tick = parseInt(tickStr);
      transport.schedule((time) => {
        this.playNotes(notes, time);
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
    const player = new Tone.ToneBufferSource({
      url: audioBuffer,
      playbackRate: 2 ** ((key - insOffset) / 12),
    });
    player.start(time);

    const gainNode = new Tone.Gain(velocity);
    const pannerNode = new Tone.Panner(panning);

    player.chain(gainNode, pannerNode, this.audioDestination);
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
