import { Song } from '@encode42/nbs.js';
import { Application, Container, Text, TextureStyle } from 'pixi.js';

import { MAX_AUDIO_SOURCES } from './audio';
import { NoteManager } from './note';
import { PianoManager } from './piano';

// TODO: is this needed?
TextureStyle.defaultOptions.scaleMode = 'nearest';

export class Viewer {
  app: Application;
  container: HTMLElement;

  updateFunction: () => void;
  pianoManager: PianoManager;
  pianoContainer: Container;
  noteManager: NoteManager;
  noteContainer: Container;

  currentTick: number = 0;
  soundCount: number = 0;

  constructor(container: HTMLElement) {
    this.app = new Application();
    this.container = container;
    this.updateFunction = () => {};
  }

  public async init() {
    await this.app.init({
      backgroundColor: 0x1099bb,
      width: 1280,
      height: 720,
      useBackBuffer: true,
      eventMode: 'none', // https://github.com/pixijs/pixijs/issues/9380
    });

    console.log('App initialized');
    this.container.appendChild(this.app.canvas);
    this.app.ticker.add(this.updateFunction);
    this.draw();
  }

  private draw() {
    this.pianoContainer = new Container();
    this.pianoManager = new PianoManager(this.pianoContainer);
    this.pianoContainer.position.set(0, this.app.screen.height - this.pianoContainer.height - 10);

    this.noteContainer = new Container();

    const keyPositions = this.pianoManager.keyPositions;
    this.noteManager = new NoteManager(this.noteContainer, keyPositions);

    this.noteContainer.position.set(0, 0);
    this.app.stage.addChild(this.noteContainer);
    this.app.stage.addChild(this.pianoContainer);

    // Add label showing current FPS
    const fpsLabel = new Text();
    fpsLabel.x = 10;
    fpsLabel.y = 10;
    this.app.stage.addChild(fpsLabel);

    // Add label showing current tick
    const label = new Text();
    label.x = 10;
    label.y = 40;
    this.app.stage.addChild(label);

    // Add label showing current sound count
    const soundCountLabel = new Text();
    soundCountLabel.x = 10;
    soundCountLabel.y = 70;
    this.app.stage.addChild(soundCountLabel);

    this.app.ticker.add((time) => {
      label.text = `Tick: ${this.currentTick.toFixed(2)}`;
      fpsLabel.text = `${Math.round(this.app.ticker.FPS)} FPS`;
      soundCountLabel.text = `Sounds: ${this.soundCount} / ${MAX_AUDIO_SOURCES}`;
      const notesToPlay = this.noteManager.update(this.currentTick);
      this.pianoManager.update(time.elapsedMS, notesToPlay);
    });
  }

  public loadSong(song: Song) {
    this.noteManager.setSong(song);
    this.noteManager.redraw(this.app.screen.width);
    this.pianoManager.redraw(this.app.screen.width);
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
