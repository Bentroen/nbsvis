import { Song } from '@encode42/nbs.js';
import { Container, ParticleContainer } from 'pixi.js';

import { NoteBuffer } from '../../note';
import { BaseView } from '../viewer';
import { NoteManager } from '../widgets/note';
import { PianoManager } from '../widgets/piano';

export class PianoRollView extends BaseView {
  pianoManager: PianoManager = new PianoManager(new Container());
  pianoContainer: Container = new Container();
  noteManager!: NoteManager;
  noteContainer: ParticleContainer = new ParticleContainer();

  draw() {
    this.pianoContainer = new Container();
    this.pianoManager = new PianoManager(this.pianoContainer);
    this.pianoContainer.position.set(0, this.stage.height - this.pianoContainer.height - 10);

    this.noteManager = new NoteManager(
      this.context.renderer,
      this.noteContainer,
      this.pianoManager.keyPositions,
    );

    this.noteContainer.position.set(0, 0);
    this.stage.addChild(this.noteContainer);
    this.stage.addChild(this.pianoContainer);

    this.ticker.add((time) => {
      const notesToPlay = this.noteManager.update(this.currentTick);
      this.pianoManager.update(time.elapsedMS, notesToPlay);
    });
  }

  redraw(width: number, _: number) {
    this.pianoManager.redraw(width);
    this.noteManager.redraw(width);
  }

  loadSong(_: Song, noteData: NoteBuffer) {
    this.noteManager.setSong(noteData);
    this.noteManager.redraw(this.stage.width);
    this.pianoManager.redraw(this.stage.width);
  }

  resize(width: number, height: number) {
    this.pianoManager.redraw(width);
    this.noteManager.redraw(width);
    this.pianoContainer.position.set(0, height - this.pianoContainer.height - 10);
    this.noteContainer.position.set(0, 0);
    this.noteManager.setKeyPositions(this.pianoManager.keyPositions);
    this.noteManager.setPianoHeight(this.pianoContainer.height);
    this.noteManager.setScreenHeight(height);
  }
}
