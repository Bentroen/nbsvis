import { BaseTransport } from '../transport';

class PlaybackTransport extends BaseTransport {
  isPlaying = false;

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
}

export default PlaybackTransport;
