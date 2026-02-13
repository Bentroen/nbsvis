import { Note, Song } from '@encode42/nbs.js';
import { Assets, Container, Sprite, Texture } from 'pixi.js';

import { WHITE_KEY_COUNT } from './piano';
import assetPaths from '../../assets';
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

export function loadNotes(song: Song) {
  const notesPerTick: Record<number, Array<NoteItem>> = {};

  for (const layer of song.layers) {
    for (const tickStr in layer.notes) {
      const note = layer.notes[tickStr];
      const tick = parseInt(tickStr);
      const noteItem = new NoteItem(note, tick);
      if (!(tick in notesPerTick)) {
        notesPerTick[tick] = [];
      }
      notesPerTick[tick].push(noteItem);
    }
  }

  for (const tick in notesPerTick) {
    notesPerTick[tick].sort((a, b) => b.key + b.pitch / 100 - (a.key + a.pitch / 100));
  }

  return notesPerTick;
}

export function estimateMaxVisibleNotes(
  notesPerTick: Record<number, NoteItem[]>,
  visibleTickCount: number,
): number {
  const totalNotes = Object.values(notesPerTick).reduce((sum, notes) => sum + notes.length, 0);
  const totalTicks = Object.keys(notesPerTick).length;

  const avgNotesPerTick = totalNotes / totalTicks;
  const estimatedVisibleNotes = avgNotesPerTick * visibleTickCount;

  // Add 50% safety margin
  const initialPoolSize = Math.ceil(estimatedVisibleNotes * 1.5);

  return initialPoolSize;
}

class NoteItem {
  tick: number;
  instrument: number;
  key: number;
  pitch: number;
  velocity: number;

  constructor(note: Note, tick: number) {
    this.tick = tick;
    const { key, pitch } = normalizeKeyAndPitch(note);
    this.instrument = note.instrument;
    this.key = key;
    this.pitch = pitch;
    this.velocity = note.velocity / 100;
  }

  private getXPos(keyPositions: Array<number>): number {
    let x = keyPositions[this.key];
    if (this.pitch !== 0) {
      // Halfway between its actual key and the key it's gliding to
      const pitchingDirection = this.pitch > 0 ? 1 : -1;
      const pitchingToNote = this.key + pitchingDirection;
      const pitchingToX = keyPositions[pitchingToNote];
      const pitchingDistance = x - pitchingToX;
      const pitchingAmount = Math.abs(this.pitch) * pitchingDistance;
      const pitchingX = x - pitchingAmount;
      x = pitchingX;
    }
    x -= BLOCK_SIZE / 2;
    return x;
  }

  private getKeyLabel(): string {
    const key = (this.key + 9) % 12;
    const octave = Math.floor((this.key + 9) / 12);
    return `${keyLabels[key]}${octave}`;
  }

  getSprite(keyPositions: Array<number>): Sprite {
    const x = this.getXPos(keyPositions);
    const sprite = new Sprite(noteBlockTexture);

    sprite.position.set(x, 0);
    sprite.width = BLOCK_SIZE;
    sprite.height = BLOCK_SIZE;
    sprite.alpha = 0.5 + this.velocity * 0.5;
    sprite.tint = instrumentColors[this.instrument % 16];

    return sprite;
  }
}

export class NoteManager {
  private notes: Record<number, Array<NoteItem>> = {};
  private currentTick = 0;
  private container: Container;
  private keyPositions: Array<number>;
  private pianoHeight = 200;
  private screenHeight = 600;

  private activeNotes: Map<NoteItem, Sprite> = new Map();

  private oldStartTick = 0;
  private oldEndTick = 0;
  private spritePool: SpritePool;

  distanceScale = 0.5;

  constructor(container: Container, keyPositions: Array<number>) {
    this.container = container;
    this.keyPositions = keyPositions;

    this.spritePool = new SpritePool(0, noteBlockTexture, this.container);
  }

  public setSong(song: Song) {
    this.notes = loadNotes(song);

    // TODO: duplicated code with update()
    const visibleHeight = this.screenHeight - this.pianoHeight;
    const visibleRowCount = Math.floor(visibleHeight / BLOCK_SIZE) * (1 / this.distanceScale);

    const visibleTickCount = Math.ceil(visibleRowCount);

    this.spritePool.destroy();

    const poolSize = estimateMaxVisibleNotes(this.notes, visibleTickCount);

    console.log('Sprite pool size:', poolSize);

    this.spritePool = new SpritePool(poolSize, noteBlockTexture, this.container);
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

  private getNotesAtTick(tick: number) {
    return this.notes[tick] || [];
  }

  private addNoteSprite(note: NoteItem, container: Container) {
    const sprite = note.getSprite(this.keyPositions);
    container.addChild(sprite);
  }

  private activateTick(tick: number) {
    for (const note of this.getNotesAtTick(tick)) {
      let sprite: Sprite;
      try {
        sprite = this.spritePool.acquire();
      } catch {
        console.warn('Sprite pool exhausted! Consider increasing the pool size.');
        break;
      }

      const x = this.keyPositions[note.key] - BLOCK_SIZE / 2;
      sprite.position.set(x, -tick * BLOCK_SIZE * this.distanceScale);
      sprite.width = BLOCK_SIZE;
      sprite.height = BLOCK_SIZE;
      sprite.alpha = 0.5 + note.velocity * 0.5;
      sprite.tint = instrumentColors[note.instrument % 16];

      this.activeNotes.set(note, sprite);
    }
  }

  private deactivateTick(tick: number) {
    for (const note of this.getNotesAtTick(tick)) {
      const sprite = this.activeNotes.get(note);
      if (!sprite) continue;

      this.spritePool.release(sprite);
      this.activeNotes.delete(note);
    }
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

    // Return which keys should be played at this tick
    const keysToPlay = this.getNotesAtTick(floorTick).map((note) => note.key);
    return keysToPlay;
  }
}
