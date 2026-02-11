import { Song } from '@encode42/nbs.js';
import { Application, BitmapText, Container, TextureStyle, Ticker } from 'pixi.js';

// TODO: is this needed?
TextureStyle.defaultOptions.scaleMode = 'nearest';

export class Viewer {
  app: Application;
  container: HTMLElement;

  updateFunction: () => void;

  view?: BaseView;

  private resizeObserver: ResizeObserver = new ResizeObserver(() => {
    this.resize();
  });

  currentTick: number = 0;
  soundCount: number = 0;
  maxSoundCount: number = 0;

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

  public setView(view: BaseView) {
    if (this.view) {
      this.app.stage.removeChild(this.view.stage);
    }
    this.view = view;
    this.app.stage.addChild(this.view.stage);
    this.view?.draw();
  }

  private draw() {
    // Add label showing current FPS
    const fpsLabel = new BitmapText({ style: { fill: 'black' } });
    fpsLabel.x = 10;
    fpsLabel.y = 10;
    this.app.stage.addChild(fpsLabel);

    // Add label showing current tick
    const label = new BitmapText({ style: { fill: 'black' } });
    label.x = 10;
    label.y = 40;
    this.app.stage.addChild(label);

    // Add label showing current sound count
    const soundCountLabel = new BitmapText({ style: { fill: 'black' } });
    soundCountLabel.x = 10;
    soundCountLabel.y = 70;
    this.app.stage.addChild(soundCountLabel);

    this.app.ticker.add(() => {
      label.text = `Tick: ${this.currentTick.toFixed(2)}`;
      fpsLabel.text = `${Math.round(this.app.ticker.FPS)} FPS`;
      soundCountLabel.text = `Sounds: ${this.soundCount} / ${this.maxSoundCount}`;

      if (this.view) {
        this.view.currentTick = this.currentTick;
        this.view.soundCount = this.soundCount;
        this.view.maxSoundCount = this.maxSoundCount;
      }
    });
  }

  public loadSong(song: Song) {
    this.view?.loadSong(song);
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
    this.view?.resize(width, height);
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

export abstract class BaseView {
  public stage: Container;

  public ticker: Ticker;

  // TODO: make this part of a Context object
  public currentTick: number = 0;

  public soundCount: number = 0;

  public maxSoundCount: number = 0;

  constructor() {
    this.stage = new Container();
    this.ticker = new Ticker();
    this.ticker.autoStart = true;
  }

  public abstract draw(): void;

  public abstract loadSong(song: Song): void;

  public abstract redraw(width: number, height: number): void;

  public abstract resize(width: number, height: number): void;
}
