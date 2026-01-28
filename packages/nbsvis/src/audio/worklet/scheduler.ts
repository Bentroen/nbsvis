export type Note = {
  sampleId: number;
  pitch: number;
  gain: number;
  pan: number;
};

export type Tempo = number;

export type Tick = number;

class Scheduler {
  notes: Record<Tick, Note[]> = {};
  tempoChanges: Record<Tick, Tempo> = {};
  lastTick = -1;

  loadSong(notes: Record<Tick, Note[]>, tempoChanges: Record<Tick, Tempo>, initialTempo: Tempo) {
    this.notes = notes;
    this.tempoChanges = tempoChanges;
    this.lastTick = -1;
    return initialTempo;
  }

  collectEvents(tick: Tick) {
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
