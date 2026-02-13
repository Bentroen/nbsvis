import { Song } from '@encode42/nbs.js';
import { Container, ParticleContainer, ParticleProperties } from 'pixi.js';

import { BaseView } from '../viewer';
import { NoteManager } from '../widgets/note';
import { PianoManager } from '../widgets/piano';

export class PianoRollView extends BaseView {
  pianoManager: PianoManager = new PianoManager(new Container());
  pianoContainer: Container = new Container();
  noteManager: NoteManager = new NoteManager(new ParticleContainer(), []);
  noteContainer: ParticleContainer = new ParticleContainer();

  draw() {
    this.pianoContainer = new Container();
    this.pianoManager = new PianoManager(this.pianoContainer);
    this.pianoContainer.position.set(0, this.stage.height - this.pianoContainer.height - 10);

    this.noteContainer = new ParticleContainer({
      dynamicProperties: {
        position: false,
        rotation: false,
      } satisfies ParticleProperties,
      roundPixels: true,
    });

    const keyPositions = this.pianoManager.keyPositions;
    this.noteManager = new NoteManager(this.noteContainer, keyPositions);

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

  loadSong(song: Song) {
    this.noteManager.setSong(song);
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
