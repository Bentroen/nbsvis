import { Song } from '@encode42/nbs.js';

import { AudioEngine } from './audio';
import { Viewer } from './viewer';

export class Player {
  viewer: Viewer;
  audioEngine: AudioEngine;
  song: Song;
  isPlaying: boolean;

  callbacks: { seek: (tick: number) => void };

  constructor(
    viewer: Viewer,
    audioEngine: AudioEngine,
    song: Song,
    callbacks: { seek: (tick: number) => void },
  ) {
    this.viewer = viewer;
    this.audioEngine = audioEngine;
    this.song = song;
    this.isPlaying = false;

    this.callbacks = callbacks;

    // TODO: this may be better handled here than in main.ts
    // this.audioEngine.loadSong(song);

    this.viewer.app.ticker.add(() => {
      const currentTick = this.audioEngine.currentTick;
      this.viewer.currentTick = currentTick;
      this.viewer.soundCount = this.audioEngine.soundCount;
      this.callbacks.seek(currentTick); // TODO: This is a bit hacky; should be part of audio handler
    });
  }

  public togglePlay() {
    if (!this.isPlaying) {
      this.play();
      this.isPlaying = true;
    } else {
      this.pause();
      this.isPlaying = false;
    }
  }

  private play() {
    this.audioEngine.play();
  }

  private pause() {
    this.audioEngine.pause();
  }

  stop() {
    this.audioEngine.stop();
  }

  seek(tick: number) {
    this.audioEngine.currentTick = tick;
    this.callbacks.seek(tick);
  }
}
