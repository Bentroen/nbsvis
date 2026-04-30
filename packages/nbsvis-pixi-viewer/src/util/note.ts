import { Particle } from 'pixi.js';

export interface NoteData {
  tick: number;
  instrument: number;
  key: number;
  pitch: number;
  velocity: number;
}

export interface RenderContext {
  keyPositions: number[];
  blockSize: number;
  distanceScale: number;
}

export interface NoteRenderer {
  apply(sprite: Particle, note: NoteData, context: RenderContext): void;
}
