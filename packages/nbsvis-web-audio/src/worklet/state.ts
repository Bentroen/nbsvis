export enum PlaybackState {
  FRAME = 0,
  TICK = 1, // tick * 1000
  BPM = 2, // bpm * 1000
  VOICES = 3,
  PLAYING = 4,
  LOOP = 5,
  UNDERRUN_COUNT = 6,
  MAX_VOICES = 7,
  RENDER_DONE = 8,

  // future-proof padding
  SIZE = 10,
}
