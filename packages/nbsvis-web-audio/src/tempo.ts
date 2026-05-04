// TODO: this should come from the song data and not be hardcoded
const TICKS_PER_BEAT = 4;

export type Tempo = number;

export type Tick = number;

export type TimeUs = number;

export type TimeSeconds = number;

export type TempoEvent = {
  tick: Tick;
  bpm: Tempo;
};

export type TempoEntry = {
  tick: Tick;
  usPerTick: TimeUs;
  cumulativeUs: TimeUs;
};

// TODO: move tempo to be globally stored as TempoEvent[] and remove Record<Tick, Tempo> from scheduler
function recordToTempoEvents(record: Record<Tick, Tempo>, initialTempo: Tempo): TempoEvent[] {
  const events: TempoEvent[] = [];

  const ticks = Object.keys(record)
    .map(Number)
    .sort((a, b) => a - b);

  if (ticks.length === 0 || ticks[0] !== 0) {
    events.push({ tick: 0, bpm: initialTempo });
  }

  for (const tick of ticks) {
    events.push({ tick, bpm: record[tick] });
  }

  return events;
}

export class TempoMapView {
  entries: TempoEntry[] = [];

  constructor(record: Record<Tick, Tempo>, initialTempo: Tempo) {
    const events = recordToTempoEvents(record, initialTempo);

    let cumulativeUs = 0;

    for (let i = 0; i < events.length; i++) {
      const curr = events[i];
      const next = events[i + 1];

      const usPerTick = (60 * 1e6) / (curr.bpm * TICKS_PER_BEAT);

      this.entries.push({
        tick: curr.tick,
        usPerTick,
        cumulativeUs,
      });

      if (next) {
        const tickDelta = next.tick - curr.tick;
        cumulativeUs += tickDelta * usPerTick;
      }
    }
  }

  ticksToSeconds(tick: Tick): TimeSeconds {
    const i = this.findEntry(tick);
    const e = this.entries[i];
    return (e.cumulativeUs + (tick - e.tick) * e.usPerTick) / 1e6;
  }

  secondsToTicks(seconds: TimeSeconds): Tick {
    const us = seconds * 1e6;
    const i = this.findEntryByTime(us);
    const e = this.entries[i];
    return e.tick + (us - e.cumulativeUs) / e.usPerTick;
  }

  ticksToFrames(tick: Tick, sampleRate: number): number {
    return this.ticksToSeconds(tick) * sampleRate;
  }

  framesToTicks(frames: number, sampleRate: number): Tick {
    return this.secondsToTicks(frames / sampleRate);
  }

  private findEntry(tick: Tick) {
    // binary search
    let lo = 0;
    let hi = this.entries.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.entries[mid].tick <= tick) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  private findEntryByTime(us: TimeUs) {
    let lo = 0;
    let hi = this.entries.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.entries[mid].cumulativeUs <= us) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
}
