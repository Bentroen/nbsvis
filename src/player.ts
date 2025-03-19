import { Song } from '@encode42/nbs.js';

import { play, pause, stop, getCurrentTick, loadSong, setCurrentTick } from './audio';
import { Viewer } from './viewer';

export class Player {
  viewer: Viewer;
  song: Song;

  callbacks: { seek: (tick: number) => void };

  constructor(viewer: Viewer, song: Song, callbacks: { seek: (tick: number) => void }) {
    this.viewer = viewer;
    this.song = song;

    this.callbacks = callbacks;

    loadSong(song);

    this.viewer.app.ticker.add(() => {
      const currentTick = getCurrentTick();
      this.viewer.currentTick = currentTick;
      this.callbacks.seek(currentTick); // TODO: This is a bit hacky; should be part of audio handler
    });
  }

  play() {
    play();
  }

  pause() {
    pause();
  }

  stop() {
    stop();
  }

  seek(tick: number) {
    setCurrentTick(tick);
    this.callbacks.seek(tick);
  }
}
