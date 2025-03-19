import { Song } from '@encode42/nbs.js';

import { play, pause, stop, getCurrentTick, loadSong, setCurrentTick } from './audio';
import { Viewer } from './viewer';

export class Player {
  viewer: Viewer;
  song: Song;

  constructor(viewer: Viewer, song: Song) {
    this.viewer = viewer;
    this.song = song;

    loadSong(song);

    this.viewer.app.ticker.add(() => {
      this.viewer.currentTick = getCurrentTick();
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

  seek(percent: number) {
    const tick = (percent / 100) * this.song.length;
    setCurrentTick(tick);
  }
}
