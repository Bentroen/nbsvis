class Transport {
  isPlaying = false;
  currentTick = 0;
  currentTempo = 120;
  prevTime = -1;

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

  seek(tick: number) {
    this.currentTick = tick;
    this.prevTime = -1;
  }

  advance(currentTime: number) {
    if (!this.isPlaying) return false;

    if (this.prevTime < 0) {
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
