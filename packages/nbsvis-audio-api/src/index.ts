export { NoteBuffer, type NoteView } from './note-buffer';

/**
 * Flat scheduling data: no NBS domain types. Engines consume raw bytes and tempo curves.
 */
export interface AudioPlaybackTimeline {
  /** Initial tempo in the same units as per-tick tempo in the worker (e.g. song.tempo * 15). */
  initialTempo: number;
  lengthTicks: number;
  /** Piecewise-constant segments: BPM from startTick until the next segment or end of song. */
  tempoSegments: Array<{ startTick: number; bpm: number }>;
}

export interface AudioPlaybackPayload {
  noteData: SharedArrayBuffer;
  /** Per-instrument PCM or encoded audio bytes; the backend decodes as needed. */
  instrumentBuffers: Record<number, ArrayBuffer>;
  timeline: AudioPlaybackTimeline;
  loopStartTick: number;
  ticksPerBeat: number;
}

export interface NbsvisAudioBackend {
  loadSong(payload: AudioPlaybackPayload): Promise<void>;

  play(): void;
  pause(): void;
  stop(): void;
  seekToTick(tick: number): void;

  loop: boolean;
  readonly currentTick: number;
  readonly soundCount: number;
  readonly maxSoundCount: number;
  readonly isPlaying: boolean;
  readonly isEnded: boolean;

  onEnded(listener: () => void): () => void;
}
