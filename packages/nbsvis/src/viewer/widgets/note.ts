import { Note } from '@encode42/nbs.js';
import { Assets, Particle, ParticleContainer, Renderer, Texture } from 'pixi.js';

import { WHITE_KEY_COUNT } from './piano';
import assetPaths from '../../assets';
import { NoteBuffer } from '../../note';
import { NoteData, NoteRenderer, RenderContext } from '../util/note';
import { NoteTextureAtlas } from '../util/note-texture';
import SpritePool from '../util/sprite';

// TODO: how to refactor this to abstract away the complexity?
// The goal: push as many 'as generic as possible' utils out of this and
// into a shared module that can be imported by other viewers.
// Ideally, this class will be very 'dumb' - just draw notes it's given
// and not care about details of how the notes are loaded.

// e.g. export class ViewerContext {}
// ^ contains info such as the notes to play in this tick, the Song object, methods to
// cull offscreen notes, calculate diff between visible and newly entered notes etc.

let noteBlockTexture: Texture;

export async function loadNoteTexture() {
  noteBlockTexture = await Assets.load(assetPaths['img/note_block_grayscale.png']);
  noteBlockTexture.source.scaleMode = 'nearest';
}

await loadNoteTexture();

let BLOCK_SIZE = 32;

const instrumentColors = [
  '#1964ac',
  '#3c8e48',
  '#be6b6b',
  '#bebe19',
  '#9d5a98',
  '#572b21',
  '#bec65c',
  '#be19be',
  '#52908d',
  '#bebebe',
  '#1991be',
  '#be2328',
  '#be5728',
  '#19be19',
  '#be1957',
  '#575757',
];

const keyLabels = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function normalizeKeyAndPitch(note: Note): { key: number; pitch: number } {
  const weightedKey = note.key + note.pitch / 100;
  let key = Math.round(weightedKey);
  key = Math.max(0, Math.min(87, key));
  const pitch = weightedKey - key;
  return { key, pitch };
}

export function estimateMaxVisibleNotes(noteData: NoteBuffer, visibleTickCount: number): number {
  return 2000;
  const totalNotes = Object.values(notesPerTick).reduce((sum, notes) => sum + notes.length, 0);
  const totalTicks = Object.keys(notesPerTick).length;

  const avgNotesPerTick = totalNotes / totalTicks;
  const estimatedVisibleNotes = avgNotesPerTick * visibleTickCount;

  // Add 50% safety margin
  const initialPoolSize = Math.ceil(estimatedVisibleNotes * 1.5);

  return initialPoolSize;
}

export function calculateNoteX(note: NoteData, keyPositions: number[], blockSize: number): number {
  let x = keyPositions[note.key];

  if (note.pitch !== 0) {
    const dir = note.pitch > 0 ? 1 : -1;
    const target = keyPositions[note.key + dir];
    const distance = x - target;
    x -= Math.abs(note.pitch) * distance;
  }

  return x - blockSize / 2;
}

export function getKeyLabel(note: NoteData): string {
  const key = (note.key + 9) % 12;
  const octave = Math.floor((note.key + 9) / 12);
  return `${keyLabels[key]}${octave}`;
}

class NotePool {
  private pool: NoteData[] = [];

  acquire(
    tick: number,
    instrument: number,
    key: number,
    pitch: number,
    velocity: number,
  ): NoteData {
    let note = this.pool.pop();
    if (note) {
      note.tick = tick;
      note.instrument = instrument;
      note.key = key;
      note.pitch = pitch;
      note.velocity = velocity;
    } else {
      note = { tick, instrument, key, pitch, velocity };
    }
    return note;
  }

  release(note: NoteData) {
    this.pool.push(note);
  }
}

export class DefaultNoteRenderer implements NoteRenderer {
  constructor(private textureAtlas: NoteTextureAtlas) {}

  apply(sprite: Particle, note: NoteData, ctx: RenderContext): void {
    sprite.texture = this.textureAtlas.getTexture(note.instrument);

    sprite.x = calculateNoteX(note, ctx.keyPositions, ctx.blockSize);
    sprite.y = -note.tick * ctx.blockSize * ctx.distanceScale;

    sprite.scaleX = ctx.blockSize / this.textureAtlas.textureSize;
    sprite.scaleY = ctx.blockSize / this.textureAtlas.textureSize;

    sprite.alpha = 0.5 + note.velocity * 0.5;
  }
}

export class NoteManager {
  private notes?: NoteBuffer;
  private currentTick = 0;
  private container: ParticleContainer;
  private keyPositions: Array<number>;
  private pianoHeight = 200;
  private screenHeight = 600;

  private notePool: NotePool = new NotePool();

  private activeNotesPerTick: Map<number, NoteData[]> = new Map();
  private activeNotes: Map<NoteData, Particle> = new Map();

  private oldStartTick = 0;
  private oldEndTick = 0;
  private spritePool: SpritePool;

  distanceScale = 0.5;

  private renderer: NoteRenderer;
  private textureAtlas: NoteTextureAtlas;

  constructor(renderer: Renderer, container: ParticleContainer, keyPositions: Array<number>) {
    this.container = container;
    this.keyPositions = keyPositions;

    // TODO: move this to dependency injection
    this.textureAtlas = new NoteTextureAtlas(renderer, noteBlockTexture, instrumentColors);

    this.renderer = new DefaultNoteRenderer(this.textureAtlas);

    this.spritePool = new SpritePool(0, this.textureAtlas.getTexture(0), this.container);
  }

  public setSong(noteData: NoteBuffer) {
    this.notes = noteData;

    // TODO: duplicated code with update()
    const visibleHeight = this.screenHeight - this.pianoHeight;
    const visibleRowCount = Math.floor(visibleHeight / BLOCK_SIZE) * (1 / this.distanceScale);

    const visibleTickCount = Math.ceil(visibleRowCount);

    this.spritePool.destroy();

    const poolSize = estimateMaxVisibleNotes(this.notes, visibleTickCount);

    console.log('Sprite pool size:', poolSize);

    this.spritePool = new SpritePool(poolSize, this.textureAtlas.getTexture(0), this.container);
  }

  public setKeyPositions(keyPositions: Array<number>) {
    this.keyPositions = keyPositions;
  }

  public setScreenHeight(screenHeight: number) {
    this.screenHeight = screenHeight;
  }

  public setPianoHeight(pianoHeight: number) {
    this.pianoHeight = pianoHeight;
  }

  private activateTick(tick: number) {
    this.notes?.forEachNoteAtTick(tick, (instrument, pitch, volume) => {
      pitch = Math.log2(pitch) * 1200;
      const key = Math.floor(pitch / 100) + 45;
      const detune = pitch % 100;

      const note = this.notePool.acquire(tick, instrument, key, detune, volume);
      const sprite = this.spritePool.acquire();

      this.renderer.apply(sprite, note, {
        keyPositions: this.keyPositions,
        blockSize: BLOCK_SIZE,
        distanceScale: this.distanceScale,
      });

      this.activeNotes.set(note, sprite);

      if (!this.activeNotesPerTick.has(tick)) {
        this.activeNotesPerTick.set(tick, []);
      }
      this.activeNotesPerTick.get(tick)?.push(note);
    });
  }

  private deactivateTick(tick: number) {
    const notes = this.activeNotesPerTick.get(tick);
    if (!notes) return;
    for (const note of notes) {
      const sprite = this.activeNotes.get(note);
      if (!sprite) continue;

      this.spritePool.release(sprite);
      this.activeNotes.delete(note);
    }
    this.activeNotesPerTick.delete(tick);
  }

  public updateNoteSize(totalWidth: number) {
    // Update BLOCK_SIZE based on screen size
    BLOCK_SIZE = 2 ** Math.floor(Math.log2(totalWidth / WHITE_KEY_COUNT));

    // For allowing non-power-of-two block sizes:
    // (Disabled because it causes rounding artifacts when moving the notes)
    //BLOCK_SIZE = Math.floor(totalWidth / WHITE_KEY_COUNT);
  }

  public redraw(totalWidth: number) {
    // Return all active sprites to the pool
    for (const sprite of this.activeNotes.values()) {
      this.spritePool.release(sprite);
    }
    this.activeNotes.clear();

    this.oldStartTick = 0;
    this.oldEndTick = 0;

    this.updateNoteSize(totalWidth);
    this.update(-1);
  }

  update(tick: number): Array<number> {
    const screenHeight = this.screenHeight;
    const pianoHeight = this.pianoHeight;
    this.container.y =
      screenHeight - pianoHeight + tick * BLOCK_SIZE * this.distanceScale - 1.5 * BLOCK_SIZE;

    // Check if the tick has changed
    const floorTick = Math.floor(tick);
    if (floorTick === Math.floor(this.currentTick)) {
      this.currentTick = tick;
      return [];
    }

    // Calculate ticks that should be visible
    const visibleHeight = screenHeight - pianoHeight;
    const visibleRowCount = Math.floor(visibleHeight / BLOCK_SIZE) * (1 / this.distanceScale);

    const oldStart = this.oldStartTick;
    const oldEnd = this.oldEndTick;

    const newStart = floorTick;
    const newEnd = floorTick + visibleRowCount;

    // Remove anything no longer visible
    for (let t = oldStart; t < oldEnd; t++) {
      if (t < newStart || t >= newEnd) {
        this.deactivateTick(t);
      }
    }

    // Add anything newly visible
    for (let t = newStart; t < newEnd; t++) {
      if (t < oldStart || t >= oldEnd) {
        this.activateTick(t);
      }
    }

    // Store new state
    this.oldStartTick = newStart;
    this.oldEndTick = newEnd;

    this.currentTick = tick;

    // Re-upload particle properties to GPU
    this.container.update();

    // Return which keys should be played at this tick
    const keysToPlay: Array<number> = [];
    this.notes?.forEachNoteAtTick(floorTick, (_instrument, pitch) => {
      pitch = Math.log2(pitch) * 1200;
      let key = Math.floor(pitch / 100) + 45;
      key = Math.max(0, Math.min(87, key));
      keysToPlay.push(key);
    });

    return keysToPlay;
  }
}
