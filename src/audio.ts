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

// Define the master audio chain
const masterGain = new Tone.Gain(1); // Master volume control
const limiter = new Tone.Limiter(-6); // Prevents audio clipping
masterGain.connect(limiter);
limiter.toDestination(); // Connects to speakers

// Create a map to store instrument samplers
const instruments: Record<number, Tone.Sampler> = {};

// Load instruments
export async function loadInstruments() {
  await Tone.start(); // Ensure the audio context is running

  const promises = defaultInstrumentData.map(async (ins, index) => {
    const sampler = new Tone.Sampler({
      urls: { 'F#4': ins.audioSrc },
    });

    await Tone.loaded(); // Wait for all samples to load
    instruments[index] = sampler;
  });

  await Promise.all(promises);
  console.log('All instruments loaded.');
}

// Play a note using Tone.js
function playNote(note: NoteEvent) {
  const { key, instrument, velocity, panning } = note;

  const sampler = instruments[instrument];
  if (!sampler) return;

  // Create gain node for volume control
  const gainNode = new Tone.Gain({ gain: Tone.dbToGain(-10) }).toDestination();

  // Create panner node for stereo effect
  const pannerNode = new Tone.Panner(panning / 100).connect(gainNode);

  // Chain audio processing
  sampler.chain(gainNode, pannerNode);

  // Trigger note
  sampler.triggerAttackRelease(Tone.Midi(key).toFrequency(), '1n', Tone.now(), velocity);
}

function getNoteEvents(song: Song) {
  const noteEvents: Array<NoteEvent> = [];

  for (const layer of song.layers) {
    for (const tickStr in layer.notes) {
      const note = layer.notes[tickStr];

      const tick = parseInt(tickStr);
      const instrument = note.instrument;
      const key = note.key + note.pitch / 100 + 21;
      const velocity = note.velocity / 100;
      const panning =
        layer.stereo === 0 ? note.panning : ((note.panning ?? 100) + layer.stereo) / 2;

      noteEvents.push({
        tick,
        instrument,
        key,
        velocity,
        panning,
      });
    }
  }
  return noteEvents;
}

// Schedule playback using Tone.Transport
export function scheduleSong(notes: NoteEvent[], tempo: number) {
  const transport = Tone.getTransport();
  transport.stop();
  transport.cancel(); // Clear existing events
  transport.position = 0;

  // Set tempo for the transport
  transport.bpm.value = tempo;
  const secondsPerTick = 60 / tempo / 4; // 4 ticks per beat

  notes.forEach((note) => {
    const time = note.tick * secondsPerTick;
    transport.schedule((time) => {
      playNote(note);
    }, time);
  });

  transport.start();
}

export function playSong(song: Song) {
  const notes = getNoteEvents(song);
  scheduleSong(notes, song.tempo * 15);
  Tone.getContext().resume();
}
