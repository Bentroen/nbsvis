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

  // TODO: remove this mess
  pianoManager: PianoManager = new PianoManager(new Container());
  pianoContainer: Container = new Container();
  noteManager: NoteManager = new NoteManager(new Container(), []);
  noteContainer: Container = new Container();

  private resizeObserver: ResizeObserver = new ResizeObserver(() => {
    this.resize();
  });

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
    this.setResponsive(true);
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

  resize(width?: number, height?: number) {
    if (!width || !height) {
      this.setResponsive(true);
    } else {
      this.setResponsive(false);
    }

    //const containerRect = this.container.getBoundingClientRect();
    width = width ?? this.container.clientWidth;
    height = height ?? this.container.clientHeight;
    console.debug('Resizing to:', width, height);
    this.app.renderer.resize(width, height);
    // Re-render current scene to avoid flickering. See:
    // https://github.com/pixijs/pixijs/issues/3395#issuecomment-328495407
    this.app.render();
    this.pianoManager.redraw(width);
    this.noteManager.redraw(width);
    this.pianoContainer.position.set(0, height - this.pianoContainer.height - 10);
    this.noteContainer.position.set(0, 0);
    this.noteManager.setKeyPositions(this.pianoManager.keyPositions);
    this.noteManager.setPianoHeight(this.pianoContainer.height);
    this.noteManager.setScreenHeight(height);
  }

  public setResponsive(responsive: boolean) {
    if (responsive) {
      this.resizeObserver.observe(this.container);
    } else {
      this.resizeObserver.unobserve(this.container);
    }
  }
}

// 4x = block size 64x
// 3x = block size 48x
// 2x = block size 32x
// 1x = block size 16x
// 0.5x = block size 8x
// 0.25x = block size 4x
//app.stage.scale.set(0.5, 0.5);
