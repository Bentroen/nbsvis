import { TempoMapView } from '../tempo';

class RenderTransport {
  currentFrame = 0;
  private tempoMap?: TempoMapView;

  constructor(private sampleRate: number) {}

  setTempoMap(tempoMap: TempoMapView) {
    this.tempoMap = tempoMap;
  }

  /** Advance render position by audio frames */
  advance(frames: number) {
    this.currentFrame += frames;
  }

  /** Seek to a specific tick */
  seekTick(tick: number) {
    if (!this.tempoMap) return;
    const seconds = this.tempoMap.ticksToSeconds(tick);
    this.currentFrame = seconds * this.sampleRate;
  }

  /** Seek to a specific frame */
  seekFrame(frame: number) {
    this.currentFrame = frame;
  }

  /** Seek to a specific time in seconds */
  seekSeconds(seconds: number) {
    this.currentFrame = seconds * this.sampleRate;
  }

  /** Current tick position (derived) */
  get currentTick(): number {
    if (!this.tempoMap) return 0;
    const seconds = this.currentFrame / this.sampleRate;
    return this.tempoMap.secondsToTicks(seconds);
  }

  /** Current time in seconds */
  get currentSeconds(): number {
    return this.currentFrame / this.sampleRate;
  }
}

export default RenderTransport;
