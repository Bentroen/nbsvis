import type { Tick, Tempo } from './tempo';

/** Convert segment change points to the sparse `Record<tick, bpm>` shape expected by `TempoMapView`. */
export function tempoSegmentsToChangeRecord(
  segments: ReadonlyArray<{ startTick: number; bpm: Tempo }>,
): Record<Tick, Tempo> {
  const record: Record<Tick, Tempo> = {};
  for (const seg of segments) {
    record[seg.startTick] = seg.bpm;
  }
  return record;
}
