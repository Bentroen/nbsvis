import { fromArrayBuffer, Note, Song } from '@encode42/nbs.js';
import { Assets, Container, Sprite } from 'pixi.js';

const noteBlockTexture = await Assets.load('/img/note-block-grayscale.png');

const BLOCK_SIZE = 32;

function normalizeKeyAndPitch(note: Note): { key: number; pitch: number } {
  const weightedKey = note.key + note.pitch / 100;
  const key = Math.floor(weightedKey);
  const pitch = weightedKey % 1;
  return { key, pitch };
}

export async function loadSong(url: string) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return fromArrayBuffer(arrayBuffer);
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

  return notesPerTick;
}

class NoteItem {
  tick: number;
  key: number;
  pitch: number;
  velocity: number;

  constructor(note: Note, tick: number) {
    this.tick = tick;
    const { key, pitch } = normalizeKeyAndPitch(note);
    this.key = key;
    this.pitch = pitch;
    this.velocity = note.velocity;
  }
  private getXPos(keyPositions: Array<number>): number {
    let x = keyPositions[this.key];
    if (this.pitch !== 0) {
      // Halfway between its actual key and the key it's gliding to
      const pitchingDirection = this.pitch > 0 ? 1 : -1;
      const pitchingToNote = this.key + pitchingDirection;
      const pitchingToX = keyPositions[pitchingToNote];
      const pitchingX = (x + pitchingToX) / 2;
      x = pitchingX;
    }
    return x;
  }

  getSprite(keyPositions: Array<number>): Sprite {
    const sprite = new Sprite(noteBlockTexture);
    sprite.scale.set(2.0);
    const x = this.getXPos(keyPositions);
    const y = 0;
    sprite.position.set(x, y);
    return sprite;
  }
}

export class NoteManager {
  private notes: Record<number, Array<NoteItem>> = {};
  private currentTick = 0;
  private container: Container;
  private keyPositions: Array<number>;
  private visibleRows: Record<number, Container> = {};

  constructor(song: Song, container: Container, keyPositions: Array<number>) {
    this.notes = loadNotes(song);
    this.container = container;
    this.keyPositions = keyPositions;
  }

  private getNotesAtTick(tick: number) {
    return this.notes[tick] || [];
  }

  private addNoteSprite(note: NoteItem, container: Container) {
    const sprite = note.getSprite(this.keyPositions);
    container.addChild(sprite);
  }

  private addTick(tick: number) {
    const rowContainer = new Container();
    rowContainer.y = -tick * BLOCK_SIZE;
    this.container.addChild(rowContainer);
    this.visibleRows[tick] = rowContainer;
    for (const note of this.getNotesAtTick(tick)) {
      this.addNoteSprite(note, rowContainer);
    }
  }

  private removeTick(tick: number) {
    const rowContainer = this.visibleRows[tick];
    this.container.removeChild(rowContainer);
    delete this.visibleRows[tick];
  }

  update(tick: number) {
    this.container.y = this.container.height + this.currentTick * BLOCK_SIZE;

    // Check if the tick has changed
    if (Math.floor(tick) === Math.floor(this.currentTick)) {
      this.currentTick = tick;
      return;
    }

    // Calculate ticks that are currently visible
    const visibleTicks = new Set<number>(Object.keys(this.visibleRows).map(Number));

    // Calculate ticks that should be seen after the update
    const visibleHeight = this.container.parent.height - 180; // height of piano
    const visibleRowCount = Math.floor(visibleHeight / BLOCK_SIZE);
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
  }
}
