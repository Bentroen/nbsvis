/** Marker so the package emits a non-empty JS module (types are erased at runtime). */
export const NBSVIS_VIEWER_API = '@opennbs/nbsvis-viewer-api';

/** Built-in view implementations supported by the Pixi reference viewer. */
export type NbsvisViewMode = 'piano-roll';

export interface ViewerLayerInfo {
  id: number;
  name: string;
  volume: number;
}

/** One scheduled note for the viewer (pitch matches audio `getNoteEvents` ratio semantics). */
export interface ViewerRenderBlock {
  tick: number;
  layer: number;
  instrument: number;
  /** Piano key index (0–87) for labeling; rendering uses `pitchRatio`. */
  key: number;
  velocity: number;
  panning: number;
  /** Frequency ratio `2 ** ((weightedKey - 45) / 12)` as used by the audio path. */
  pitchRatio: number;
}

export interface ViewerRenderPayload {
  layers: ViewerLayerInfo[];
  blocks: ViewerRenderBlock[];
  songLength: number;
  initialTempo: number;
}

export interface NbsvisViewerBackend {
  mount(container: HTMLElement): void;
  destroy(): void;
  loadSong(payload: ViewerRenderPayload): void;

  setViewMode(mode: NbsvisViewMode): void;

  setTick(tick: number): void;
  setPlaying(isPlaying: boolean): void;
  setSoundCount(count: number, max: number): void;

  onRenderTick(callback: (deltaTime: number) => void): () => void;
  resize(width: number, height: number): void;
}
