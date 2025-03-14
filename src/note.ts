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
  private visibleNotes: Record<number, Array<Sprite>> = {};

  constructor(song: Song, container: Container, keyPositions: Array<number>) {
    this.notes = loadNotes(song);
    this.container = container;
    this.keyPositions = keyPositions;
  }

  getNotesAtTick(tick: number) {
    return this.notes[tick] || [];
  }

  addNoteSprite(note: Note, tick: number) {
    const sprite = new Sprite(noteBlockTexture);
    sprite.scale.set(2.0);
    const x = this.keyPositions[note.key];
    const y = -tick * BLOCK_SIZE;
    sprite.position.set(x, y);
    this.container.addChild(sprite);
    if (!(tick in this.visibleNotes)) {
      this.visibleNotes[tick] = [];
    }
    this.visibleNotes[tick].push(sprite);
  }

  update(tick: number, deltaTime: number) {
    this.container.y = this.container.height + this.currentTick * BLOCK_SIZE;

    // Check if the tick has changed
    if (Math.floor(tick) === Math.floor(this.currentTick)) {
      this.currentTick = tick;
      return;
    }

    // Calculate ticks that are currently visible
    const visibleTicks = new Set<number>(Object.keys(this.visibleNotes).map(Number));

    // Calculate ticks that should be seen after the update
    //const visibleRange = this.container.height / BLOCK_SIZE;
    const newTicks = new Set<number>();
    for (let i = 0; i < 22; i++) {
      newTicks.add(Math.floor(tick) + i);
    }

    // Diff to find what needs to be updated
    const ticksToAdd = newTicks.difference(visibleTicks);
    const ticksToRemove = visibleTicks.difference(newTicks);

    for (const tick of ticksToAdd) {
      for (const note of this.getNotesAtTick(tick)) {
        this.addNoteSprite(note, tick);
      }
    }

    for (const tick of ticksToRemove) {
      for (const sprite of this.visibleNotes[tick]) {
        this.container.removeChild(sprite);
      }
      delete this.visibleNotes[tick];
    }

    this.currentTick = tick;
  }
}
