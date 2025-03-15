import { Song } from '@encode42/nbs.js';
import * as Tone from 'tone';

export const defaultInstrumentData = [
  { name: 'Harp', audioSrc: 'assets/sounds/harp.ogg' },
  { name: 'Double Bass', audioSrc: 'assets/sounds/dbass.ogg' },
  { name: 'Bass Drum', audioSrc: 'assets/sounds/bdrum.ogg' },
  { name: 'Snare Drum', audioSrc: 'assets/sounds/sdrum.ogg' },
  { name: 'Click', audioSrc: 'assets/sounds/click.ogg' },
  { name: 'Guitar', audioSrc: 'assets/sounds/guitar.ogg' },
  { name: 'Flute', audioSrc: 'assets/sounds/flute.ogg' },
  { name: 'Bell', audioSrc: 'assets/sounds/bell.ogg' },
  { name: 'Chime', audioSrc: 'assets/sounds/icechime.ogg' },
  { name: 'Xylophone', audioSrc: 'assets/sounds/xylobone.ogg' },
  { name: 'Iron Xylophone', audioSrc: 'assets/sounds/iron_xylophone.ogg' },
  { name: 'Cow Bell', audioSrc: 'assets/sounds/cow_bell.ogg' },
  { name: 'Didgeridoo', audioSrc: 'assets/sounds/didgeridoo.ogg' },
  { name: 'Bit', audioSrc: 'assets/sounds/bit.ogg' },
  { name: 'Banjo', audioSrc: 'assets/sounds/banjo.ogg' },
  { name: 'Pling', audioSrc: 'assets/sounds/pling.ogg' },
];

type NoteEvent = {
  tick: number;
  instrument: number;
  key: number;
  velocity: number;
  panning: number;
};

// Master audio chain
const masterGain = new Tone.Gain(1); // Master volume control
const compressor = new Tone.Compressor(-30, 3); // Dynamic range compression
const limiter = new Tone.Limiter(-3); // Prevent clipping
masterGain.connect(compressor);
compressor.connect(limiter);
limiter.toDestination();

const instrumentBuffers: Record<number, Tone.ToneAudioBuffer> = {};

export async function loadInstruments() {
  await Tone.start(); // Ensure the audio context is running

  const promises = defaultInstrumentData.map(async (ins, index) => {
    const buffer = new Tone.ToneAudioBuffer({
      url: ins.audioSrc,
    });

    await Tone.loaded(); // Wait for all samples to load
    instrumentBuffers[index] = buffer;
  });

  await Promise.all(promises);
  console.log('All instruments loaded.');
}

function playNote(note: NoteEvent, time: number) {
  const { key, instrument, velocity, panning } = note;

  if (velocity === 0) return;

  const audioBuffer = instrumentBuffers[instrument];
  if (!audioBuffer) return;

  const player = new Tone.ToneBufferSource({
    url: instrumentBuffers[instrument],
    playbackRate: 2 ** ((key - 45) / 12),
  });
  player.start(time);

  const gainNode = new Tone.Gain(velocity * 0.5);

  const pannerNode = new Tone.Panner(panning / 100);

  player.chain(gainNode, pannerNode, masterGain);
}

function playNotes(notes: Array<NoteEvent>, time: number) {
  for (const note of notes) {
    playNote(note, time);
  }
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

export function scheduleSong(events: Record<number, Array<NoteEvent>>, tempo: number) {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel();
  transport.position = 0;

  transport.bpm.value = tempo;
  const secondsPerTick = 60 / tempo / 4; // 4 ticks per beat

  for (const [tickStr, notes] of Object.entries(events)) {
    const tick = parseInt(tickStr);
    transport.schedule((time) => {
      playNotes(notes, time);
    }, tick * secondsPerTick);
  }

  transport.start();
}

export function playSong(song: Song) {
  const notes = getNoteEvents(song);
  scheduleSong(notes, song.tempo * 15);
  Tone.getContext().resume();
}
