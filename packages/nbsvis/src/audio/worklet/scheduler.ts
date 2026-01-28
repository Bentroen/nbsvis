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

  /** Find the effective tempo at a given tick */
  getTempoAt(tick: Tick, fallback: Tempo): Tempo {
    let lastTempo = fallback;
    // TODO: optimize last tempo lookup
    for (const [t, tempo] of Object.entries(this.tempoChanges)) {
      if (Number(t) > tick) break;
      lastTempo = tempo;
    }
    return lastTempo;
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
