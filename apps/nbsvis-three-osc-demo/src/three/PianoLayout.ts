export const MIDI_START = 21; // A0
export const MIDI_END = 108; // C8

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export function isBlackKey(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(midi % 12);
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function getWhiteKeyIndex(midi: number): number {
  let index = 0;
  for (let m = MIDI_START; m < midi; m++) {
    if (!isBlackKey(m)) {
      index += 1;
    }
  }
  return index;
}
