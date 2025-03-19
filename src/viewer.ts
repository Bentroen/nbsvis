import { Song } from '@encode42/nbs.js';
import { Application, Container, Text } from 'pixi.js';

import { NoteManager } from './note';
import { PianoManager } from './piano';

export class Viewer {
  app: Application;
  song: Song;

  pianoManager: PianoManager;
  pianoContainer: Container;
  noteManager: NoteManager;
  noteContainer: Container;

  currentTick: number = 0;

  constructor(app: Application, song: Song) {
    this.app = app;
    this.song = song;

    this.pianoContainer = new Container();
    this.pianoManager = new PianoManager(this.pianoContainer);
    this.pianoContainer.position.set(0, app.screen.height - this.pianoContainer.height - 10);

    const keyPositions = this.pianoManager.keyPositions;
    this.noteContainer = new Container();
    this.noteManager = new NoteManager(song, this.noteContainer, keyPositions);
    this.noteContainer.position.set(0, 0);
    app.stage.addChild(this.noteContainer);
    app.stage.addChild(this.pianoContainer);

    // Add label showing current FPS
    const fpsLabel = new Text();
    fpsLabel.x = 10;
    fpsLabel.y = 10;
    app.stage.addChild(fpsLabel);

    // Add label showing current tick
    const label = new Text();
    label.x = 10;
    label.y = 40;
    app.stage.addChild(label);

    app.ticker.add((time) => {
      this.currentTick += (time.elapsedMS / 1000) * song.tempo;
      label.text = `Tick: ${this.currentTick.toFixed(2)}`;
      fpsLabel.text = `${Math.round(app.ticker.FPS)} FPS`;
      const notesToPlay = this.noteManager.update(this.currentTick);
      this.pianoManager.update(time.elapsedMS, notesToPlay);
    });
  }

  resize(width: number, height: number) {
    this.app.renderer.resize(width, height);
    this.pianoManager.redraw(width);
    this.noteManager.redraw(width);
    this.pianoContainer.position.set(0, height - this.pianoContainer.height - 10);
    this.noteContainer.position.set(0, 0);
    this.noteManager.setKeyPositions(this.pianoManager.keyPositions);
    this.noteManager.setPianoHeight(this.pianoContainer.height);
    this.noteManager.setScreenHeight(height);
  }
}
