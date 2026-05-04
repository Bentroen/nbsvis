import type {
  NbsvisViewMode,
  NbsvisViewerBackend,
  ViewerRenderPayload,
} from '@opennbs/nbsvis-viewer-api';

import type { CameraState } from './PianoScene';
import { PianoScene } from './PianoScene';

export class ThreeViewerBackend implements NbsvisViewerBackend {
  private container: HTMLElement | null = null;
  private scene: PianoScene | null = null;
  private mode: NbsvisViewMode = 'piano-roll';
  private tickBlocks = new Map<number, number[]>();
  private currentActive = new Set<number>();
  private currentTick = 0;
  private rafCallbacks = new Set<(deltaTime: number) => void>();
  private rafId: number | null = null;
  private lastFrameMs = 0;

  mount(container: HTMLElement): void {
    this.container = container;
    this.scene = new PianoScene(container);
    this.ensureRafLoop();
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.rafCallbacks.clear();
    this.currentActive.clear();
    this.tickBlocks.clear();
    this.scene?.destroy();
    this.scene = null;
    this.container = null;
  }

  loadSong(payload: ViewerRenderPayload): void {
    this.tickBlocks.clear();
    for (const block of payload.blocks) {
      const t = Math.floor(block.tick);
      if (!this.tickBlocks.has(t)) this.tickBlocks.set(t, []);
      this.tickBlocks.get(t)!.push(block.key);
    }
    this.setTick(0);
  }

  setViewMode(mode: NbsvisViewMode): void {
    this.mode = mode;
  }

  setTick(tick: number): void {
    this.currentTick = tick;
    const scene = this.scene;
    if (!scene) return;
    const keys = this.tickBlocks.get(Math.floor(tick)) ?? [];
    const nextActive = new Set(keys);

    for (const key of this.currentActive) {
      if (!nextActive.has(key)) scene.setKeyActive(key + 21, false);
    }
    for (const key of nextActive) {
      if (!this.currentActive.has(key)) scene.setKeyActive(key + 21, true);
    }
    this.currentActive = nextActive;
  }

  setPlaying(_isPlaying: boolean): void {}

  setSoundCount(_count: number, _max: number): void {}

  onRenderTick(callback: (deltaTime: number) => void): () => void {
    this.rafCallbacks.add(callback);
    this.ensureRafLoop();
    return () => {
      this.rafCallbacks.delete(callback);
    };
  }

  resize(width: number, height: number): void {
    const scene = this.scene;
    const container = this.container;
    if (!scene || !container) return;
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    scene.resize();
  }

  toggleFpsMode(): boolean {
    return this.scene?.toggleFpsMode() ?? false;
  }

  getCameraState(): CameraState | null {
    return this.scene?.getCameraState() ?? null;
  }

  private ensureRafLoop(): void {
    if (this.rafId !== null) return;
    this.lastFrameMs = performance.now();
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      const now = performance.now();
      const delta = (now - this.lastFrameMs) / 1000;
      this.lastFrameMs = now;
      for (const cb of this.rafCallbacks) cb(delta);
    };
    this.rafId = requestAnimationFrame(loop);
  }
}
