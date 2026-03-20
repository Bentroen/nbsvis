import { Tempo, Tick } from '../tempo';

export type NoteEvent = {
  tick: number;
  sampleId: number;
  pitch: number;
  gain: number;
  pan: number;
};

class Scheduler {
  notes: Record<Tick, NoteEvent[]> = {};
  tempoChanges: Record<Tick, Tempo> = {};
  lastTick: Tick = -1;

  loadSong(notes: Record<Tick, NoteEvent[]>, tempoChanges: Record<Tick, Tempo>) {
    this.notes = notes;
    this.tempoChanges = tempoChanges;
    this.lastTick = -1;
  }

  collectEvents(tick: Tick) {
    tick = Math.floor(tick);
    const events = [];

    if (tick !== this.lastTick) {
      if (this.notes[tick]) {
        events.push(...this.notes[tick]);
      }
      if (this.tempoChanges[tick]) {
        events.push({ tempo: this.tempoChanges[tick] });
      }
      this.lastTick = tick;
    }

    return events;
  }
}

export default Scheduler;
