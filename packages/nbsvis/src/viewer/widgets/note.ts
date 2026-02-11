import { Note, Song } from '@encode42/nbs.js';
import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js';

import { WHITE_KEY_COUNT } from './piano';
import assetPaths from '../../assets';

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
  private visibleRows: Record<number, Container> = {};

  distanceScale = 0.5;

  constructor(container: Container, keyPositions: Array<number>) {
    this.container = container;
    this.keyPositions = keyPositions;
  }

  public setSong(song: Song) {
    this.notes = loadNotes(song);
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
    container.addChildAt(sprite, 0);
  }

  private addTick(tick: number) {
    const rowContainer = new Container();
    rowContainer.y = -tick * BLOCK_SIZE * this.distanceScale;
    this.container.addChildAt(rowContainer, 0);
    this.visibleRows[tick] = rowContainer;
    for (const note of this.getNotesAtTick(tick)) {
      this.addNoteSprite(note, rowContainer);
    }
  }

  private removeTick(tick: number) {
    const rowContainer = this.visibleRows[tick];
    this.container.removeChild(rowContainer);
    rowContainer.destroy({ children: true });
    delete this.visibleRows[tick];
  }

  public updateNoteSize(totalWidth: number) {
    // Update BLOCK_SIZE based on screen size
    BLOCK_SIZE = 2 ** Math.floor(Math.log2(totalWidth / WHITE_KEY_COUNT));

    // For allowing non-power-of-two block sizes:
    // (Disabled because it causes rounding artifacts when moving the notes)
    //BLOCK_SIZE = Math.floor(totalWidth / WHITE_KEY_COUNT);
  }

  public redraw(totalWidth: number) {
    this.container.removeChildren();
    this.visibleRows = {};
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

    // Calculate ticks that are currently visible
    const visibleTicks = new Set<number>(Object.keys(this.visibleRows).map(Number));

    // Calculate ticks that should be seen after the update
    const visibleHeight = screenHeight - pianoHeight;
    const visibleRowCount = Math.floor(visibleHeight / BLOCK_SIZE) * (1 / this.distanceScale);
    const newTicks = new Set<number>();
    for (let i = 0; i < visibleRowCount; i++) {
      newTicks.add(Math.floor(tick) + i);
    }

    // Diff to find what needs to be updated
    const ticksToAdd = newTicks.difference(visibleTicks);
    const ticksToRemove = visibleTicks.difference(newTicks);

    ticksToAdd.forEach((tick) => this.addTick(tick));
    ticksToRemove.forEach((tick) => this.removeTick(tick));

    this.currentTick = tick;

    // Return which keys should be played at this tick
    const keysToPlay = this.getNotesAtTick(floorTick).map((note) => note.key);
    return keysToPlay;
  }
}
