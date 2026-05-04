import type {
  NbsvisViewMode,
  NbsvisViewerBackend,
  ViewerRenderPayload,
} from '@opennbs/nbsvis-viewer-api';
import { Application, BitmapText, TextureStyle, Ticker } from 'pixi.js';

import { BaseView } from './base-view';
import { PianoRollView } from './views/PianoRollView';

TextureStyle.defaultOptions.scaleMode = 'nearest';

export { BaseView } from './base-view';

export class PixiViewer implements NbsvisViewerBackend {
  app = new Application();
  private container: HTMLElement | null = null;

  view?: BaseView;

  private resizeObserver = new ResizeObserver(() => {
    this.resize();
  });

  currentTick = 0;
  soundCount = 0;
  maxSoundCount = 0;

  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private readonly assetCache = new Map<string, unknown>();
  private pendingViewMode: NbsvisViewMode | null = null;

  private readonly renderTickUnsubscribers = new Set<() => void>();

  mount(container: HTMLElement): void {
    this.container = container;
  }

  /**
   * Initializes the Pixi application and mounts any view requested via {@link setViewMode}.
   * Call after {@link mount} and {@link setViewMode}.
   */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (!this.container) {
      throw new Error('PixiViewer.mount(container) must be called before init()');
    }
    this.initPromise = this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    await this.app.init({
      backgroundColor: 0x1099bb,
      width: 1280,
      height: 720,
      useBackBuffer: true,
      eventMode: 'none',
    });

    console.log('PixiViewer: app initialized');
    this.container!.appendChild(this.app.canvas);

    this.drawHud();
    this.initialized = true;

    if (this.pendingViewMode) {
      await this.applyViewMode(this.pendingViewMode);
      this.pendingViewMode = null;
    }

    this.setResponsive(true);
  }

  destroy(): void {
    for (const off of this.renderTickUnsubscribers) {
      off();
    }
    this.renderTickUnsubscribers.clear();
    this.resizeObserver.disconnect();
    if (this.view?.isMounted) {
      this.app.stage.removeChild(this.view.stage);
    }
    this.view = undefined;
    void this.app.destroy(true);
    this.initialized = false;
    this.initPromise = null;
    this.assetCache.clear();
    this.container = null;
  }

  loadSong(payload: ViewerRenderPayload): void {
    this.view?.loadSong(payload);
  }

  setViewMode(mode: NbsvisViewMode): void {
    if (!this.initialized) {
      this.pendingViewMode = mode;
      return;
    }
    void this.applyViewMode(mode);
  }

  private async applyViewMode(mode: NbsvisViewMode): Promise<void> {
    if (mode !== 'piano-roll') {
      throw new Error(`Unsupported view mode: ${mode}`);
    }

    const next = new PianoRollView({ renderer: this.app.renderer });
    if (this.view?.isMounted) {
      this.app.stage.removeChild(this.view.stage);
    }
    this.view = next;
    await this.resolveAndInjectViewAssets(this.view);
    this.view.bindContext({ renderer: this.app.renderer });
    this.app.stage.addChild(this.view.stage);
    this.view.mount();
    this.syncViewState();
  }

  setTick(tick: number): void {
    this.currentTick = tick;
    this.syncViewState();
  }

  setPlaying(_isPlaying: boolean): void {
    // Reserved for future playback UI; piano animation is driven by tick updates.
  }

  setSoundCount(count: number, max: number): void {
    this.soundCount = count;
    this.maxSoundCount = max;
    this.syncViewState();
  }

  onRenderTick(callback: (deltaTime: number) => void): () => void {
    const wrapper = (t: Ticker) => callback(t.deltaTime);
    this.app.ticker.add(wrapper);
    const off = () => {
      this.app.ticker.remove(wrapper);
    };
    this.renderTickUnsubscribers.add(off);
    return () => {
      this.app.ticker.remove(wrapper);
      this.renderTickUnsubscribers.delete(off);
    };
  }

  resize(width?: number, height?: number): void {
    if (!width || !height) {
      this.setResponsive(true);
    } else {
      this.setResponsive(false);
    }

    const el = this.container;
    if (!el) return;

    width = width ?? el.clientWidth;
    height = height ?? el.clientHeight;
    console.debug('Resizing to:', width, height);
    this.app.renderer.resize(width, height);
    this.app.render();
    if (this.view?.isMounted) {
      this.view.resize(width, height);
    }
  }

  private syncViewState(): void {
    if (this.view) {
      this.view.currentTick = this.currentTick;
      this.view.soundCount = this.soundCount;
      this.view.maxSoundCount = this.maxSoundCount;
    }
  }

  private async resolveAndInjectViewAssets(view: BaseView) {
    const requirements = view.getAssetRequirements();

    await Promise.all(
      requirements.map(async (asset) => {
        if (this.assetCache.has(asset.id)) return;
        const loaded = await asset.load();
        this.assetCache.set(asset.id, loaded);
      }),
    );

    const resolvedAssets = new Map<string, unknown>();
    for (const asset of requirements) {
      if (!this.assetCache.has(asset.id)) {
        throw new Error(`Failed to resolve asset "${asset.id}"`);
      }
      resolvedAssets.set(asset.id, this.assetCache.get(asset.id));
    }

    view.setAssets(resolvedAssets);
  }

  private drawHud() {
    const fpsLabel = new BitmapText({ style: { fill: 'black' } });
    fpsLabel.x = 10;
    fpsLabel.y = 10;
    this.app.stage.addChild(fpsLabel);

    const label = new BitmapText({ style: { fill: 'black' } });
    label.x = 10;
    label.y = 40;
    this.app.stage.addChild(label);

    const soundCountLabel = new BitmapText({ style: { fill: 'black' } });
    soundCountLabel.x = 10;
    soundCountLabel.y = 70;
    this.app.stage.addChild(soundCountLabel);

    this.app.ticker.add(() => {
      label.text = `Tick: ${this.currentTick.toFixed(2)}`;
      fpsLabel.text = `${Math.round(this.app.ticker.FPS)} FPS`;
      soundCountLabel.text = `Sounds: ${this.soundCount} / ${this.maxSoundCount}`;
      this.syncViewState();
    });
  }

  public setResponsive(responsive: boolean) {
    const el = this.container;
    if (!el) return;
    if (responsive) {
      this.resizeObserver.observe(el);
    } else {
      this.resizeObserver.unobserve(el);
    }
  }
}
