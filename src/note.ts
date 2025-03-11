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

  constructor(song: Song, container: Container, keyPositions: Array<number>) {
    this.notes = loadNotes(song);
    this.container = container;
    this.keyPositions = keyPositions;
  }

  getNotesAtTick(tick: number) {
    return this.notes[tick] || [];
  }

  update(tick: number, deltaTime: number) {
    this.container.y = this.currentTick * BLOCK_SIZE;

    const floorTick = Math.floor(this.currentTick);
    if (Math.floor(tick) !== floorTick) {
      //console.log(tick);
      //console.log(this.getNotesAtTick(floorTick));
      for (const note of this.getNotesAtTick(floorTick)) {
        console.log(note);
        const sprite = new Sprite(noteBlockTexture);
        sprite.scale.set(2.0);
        const x = this.keyPositions[note.key];
        const y = -Math.floor(this.currentTick) * BLOCK_SIZE;
        sprite.position.set(x, y);
        this.container.addChild(sprite);
      }
    }

    this.currentTick = tick;
  }
}
