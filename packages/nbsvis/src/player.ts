import { Song } from '@encode42/nbs.js';

import { AudioEngine } from './audio';
import { loadInstruments } from './instrument';
import { loadSongFromUrl } from './song';
import { Viewer } from './viewer';

export class Player {
  viewer: Viewer;
  audioEngine: AudioEngine;
  song?: Song;
  isPlaying: boolean;

  callbacks: { seek: (tick: number) => void };

  constructor(viewer: Viewer, callbacks: { seek: (tick: number) => void }) {
    this.viewer = viewer;
    this.audioEngine = new AudioEngine();
    this.isPlaying = false;
    this.callbacks = callbacks;

    if (this.viewer) {
      this.viewer.app.ticker.add(() => {
        const currentTick = this.audioEngine.currentTick;
        this.viewer.currentTick = currentTick;
        this.viewer.soundCount = this.audioEngine.soundCount;
        this.callbacks.seek(currentTick); // TODO: This is a bit hacky; should be part of audio handler
      });
    } else {
      console.debug('Viewer not initialized, skipping ticker update');
    }
  }

  public async loadSong(url: string) {
    const { song, extraSounds } = await loadSongFromUrl(url);
    const instruments = loadInstruments(song, extraSounds);
    this.song = song;
    this.audioEngine.loadSong(song);
    // TODO: load custom instruments in the audio engine
    this.viewer?.loadSong(song);
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
