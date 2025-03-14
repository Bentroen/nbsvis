import { fromArrayBuffer, Note, Song } from '@encode42/nbs.js';
import { Assets, Container, Sprite } from 'pixi.js';

const noteBlockTexture = await Assets.load('/img/note-block-grayscale.png');

const BLOCK_SIZE = 32;

export async function loadSong(url: string) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return fromArrayBuffer(arrayBuffer);
}

export function loadNotes(song: Song) {
  const notesPerTick: Record<number, Array<Note>> = {};

  for (const layer of song.layers) {
    for (const tickStr in layer.notes) {
      const note = layer.notes[tickStr];
      const tick = parseInt(tickStr);
      if (!(tick in notesPerTick)) {
        notesPerTick[tick] = [];
      }
      notesPerTick[tick].push(note);
    }
  }

  return notesPerTick;
}

export class NoteManager {
  private notes: Record<number, Array<Note>> = {};
  private currentTick = 0;
  private container: Container;
  private keyPositions: Array<number>;
  private visibleRows: Record<number, Container> = {};

  constructor(song: Song, container: Container, keyPositions: Array<number>) {
    this.notes = loadNotes(song);
    this.container = container;
    this.keyPositions = keyPositions;
  }

  getNotesAtTick(tick: number) {
    return this.notes[tick] || [];
  }

  addNoteSprite(note: Note, container: Container) {
    const sprite = new Sprite(noteBlockTexture);
    sprite.scale.set(2.0);
    const x = this.keyPositions[note.key];
    const y = 0;
    sprite.position.set(x, y);
    container.addChild(sprite);
  }

  addTick(tick: number) {
    const rowContainer = new Container();
    rowContainer.y = -tick * BLOCK_SIZE;
    this.container.addChild(rowContainer);
    this.visibleRows[tick] = rowContainer;
    for (const note of this.getNotesAtTick(tick)) {
      this.addNoteSprite(note, rowContainer);
    }
  }

  removeTick(tick: number) {
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
    //const visibleRange = this.container.height / BLOCK_SIZE;
    const newTicks = new Set<number>();
    for (let i = 0; i < 22; i++) {
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
