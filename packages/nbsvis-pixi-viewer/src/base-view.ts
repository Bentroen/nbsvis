import type { ViewerRenderPayload } from '@opennbs/nbsvis-viewer-api';
import { Container, Renderer, Ticker } from 'pixi.js';

import type { ViewAssetDescriptor } from './assets';

export abstract class BaseView {
  public stage: Container;

  public ticker: Ticker;

  protected context: { renderer?: Renderer };
  private mounted = false;

  public currentTick: number = 0;

  public soundCount: number = 0;

  public maxSoundCount: number = 0;

  constructor(context: { renderer?: Renderer } = {}) {
    this.context = { ...context };

    this.stage = new Container();
    this.ticker = new Ticker();
    this.ticker.autoStart = true;
  }

  public getAssetRequirements(): Array<ViewAssetDescriptor> {
    return [];
  }

  public setAssets(_: Map<string, unknown>) {}

  public bindContext(context: { renderer: Renderer }) {
    this.context = { ...this.context, ...context };
  }

  public get isMounted(): boolean {
    return this.mounted;
  }

  public mount() {
    if (this.mounted) return;
    this.draw();
    this.mounted = true;
  }

  public abstract draw(): void;

  public abstract loadSong(payload: ViewerRenderPayload): void;

  public abstract redraw(width: number, height: number): void;

  public abstract resize(width: number, height: number): void;
}
