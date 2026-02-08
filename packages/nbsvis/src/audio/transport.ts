import { TempoMapView, Tick } from './tempo';

export class BaseTransport {
  protected currentFrame = 0;
  protected tempoMap?: TempoMapView;

  constructor(protected sampleRate: number) {}

  setTempoMap(tempoMap: TempoMapView) {
    this.tempoMap = tempoMap;
  }

  /** Advance render position by audio frames */
  advance(frames: number) {
    this.currentFrame += frames;
  }

  /** Seek to a specific tick */
  seekToTick(tick: Tick) {
    if (!this.tempoMap) return;
    const seconds = this.tempoMap.ticksToSeconds(tick);
    this.currentFrame = seconds * this.sampleRate;
  }

  /** Seek to a specific time in seconds */
  seekToSeconds(seconds: number) {
    this.currentFrame = seconds * this.sampleRate;
  }

  /** Current tick position (derived) */
  get currentTick(): Tick {
    if (!this.tempoMap) return 0;
    const seconds = this.currentFrame / this.sampleRate;
    return this.tempoMap.secondsToTicks(seconds);
  }

  /** Current time in seconds */
  get currentSeconds(): number {
    return this.currentFrame / this.sampleRate;
  }

  /** Current frame position */
  get framePosition(): number {
    return this.currentFrame;
  }
}
