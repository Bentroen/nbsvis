import { TempoMapView, Tick } from './tempo';

type LoopRegion = {
  startTick: number;
  endTick: number;
};

export class BaseTransport {
  protected currentFrame = 0;
  protected tempoMap?: TempoMapView;

  isPlaying = false;

  loop: boolean = false;
  protected _loopRegion: LoopRegion = {
    startTick: 0,
    endTick: Infinity,
  };

  constructor(protected sampleRate: number) {}

  setTempoMap(tempoMap: TempoMapView) {
    this.tempoMap = tempoMap;
  }

  setLoop(loop: boolean) {
    this.loop = loop;
  }

  setLoopRegion(startTick: number, endTick: number) {
    this._loopRegion.startTick = startTick;
    this._loopRegion.endTick = endTick;
  }

  get loopRegion() {
    return this._loopRegion;
  }

  /**
   * Check if song end is reached and handle looping.
   * Returns true if looping occurred, false if we've reached the end.
   */
  checkAndHandleLoop(): boolean {
    const songEndReached = this.currentTick >= this._loopRegion.endTick;

    if (songEndReached && this.loop) {
      console.log('Looping back to start of loop region at tick', this._loopRegion.startTick);
      this.seekToTick(this._loopRegion.startTick);
      return true;
    }

    return false;
  }

  /** Advance render position by audio frames */
  advance(frames: number) {
    this.currentFrame += frames;
  }

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  stop() {
    this.isPlaying = false;
    this.currentFrame = 0;
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
