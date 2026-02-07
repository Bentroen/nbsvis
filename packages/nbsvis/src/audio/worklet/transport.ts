import { TempoMapView, Tick } from '../tempo';

class PlaybackTransport {
  isPlaying = false;
  currentFrame = 0;
  private tempoMap?: TempoMapView;

  constructor(private sampleRate: number) {}

  setTempoMap(tempoMap: TempoMapView) {
    this.tempoMap = tempoMap;
  }

  get currentTick(): Tick {
    if (!this.tempoMap) return 0;
    const seconds = this.currentFrame / this.sampleRate;
    return this.tempoMap.secondsToTicks(seconds);
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

  seek(seconds: number) {
    this.currentFrame = seconds * this.sampleRate;
  }

  seekToTick(tick: Tick) {
    if (!this.tempoMap) return;
    const seconds = this.tempoMap.ticksToSeconds(tick);
    this.currentFrame = seconds * this.sampleRate;
  }

  advance(frames: number) {
    this.currentFrame += frames;
  }
}

export default PlaybackTransport;
