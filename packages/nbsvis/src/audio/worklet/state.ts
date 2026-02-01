export enum SharedState {
  FRAME = 0,
  TICK = 1, // tick * 1000
  BPM = 2, // bpm * 1000
  VOICES = 3,
  PLAYING = 4,
  // future-proof padding
  SIZE = 8,
}
