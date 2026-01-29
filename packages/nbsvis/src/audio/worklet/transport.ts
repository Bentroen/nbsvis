import Scheduler, { Tick } from './scheduler';

class Transport {
  isPlaying = false;
  currentTick = 0;
  currentTempo = -1;
  prevTime = -1;

  constructor(private scheduler: Scheduler) {}

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  stop() {
    this.isPlaying = false;
    this.currentTick = 0;
    this.prevTime = -1;
  }

  seek(tick: Tick) {
    this.currentTick = tick;
    this.currentTempo = this.scheduler.getTempoAt(tick, this.currentTempo);
    this.prevTime = -1;
  }

  advance(currentTime: number) {
    if (!this.isPlaying || this.prevTime < 0) {
      this.prevTime = currentTime;
      return false;
    }

    const delta = currentTime - this.prevTime;
    this.currentTick += (this.currentTempo / 60) * (delta * 4);
    this.prevTime = currentTime;

    return true;
  }
}

export default Transport;
