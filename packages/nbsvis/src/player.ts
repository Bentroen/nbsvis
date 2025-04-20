import { Song } from '@encode42/nbs.js';

import { AudioEngine } from './audio';
import { loadCustomInstruments } from './instrument';
import { loadSongFromUrl } from './song';
import { Viewer } from './viewer';

export class Player {
  viewer: Viewer;
  audioEngine: AudioEngine;
  song?: Song;

  callbacks: { seek: (tick: number, totalLength: number) => void };

  constructor(viewer: Viewer, callbacks: { seek: (tick: number, totalLength: number) => void }) {
    this.viewer = viewer;
    this.audioEngine = new AudioEngine();
    this.callbacks = callbacks;

    if (this.viewer) {
      this.viewer.app.ticker.add(() => {
        const currentTick = this.audioEngine.currentTick;
        this.viewer.currentTick = currentTick;
        this.viewer.soundCount = this.audioEngine.soundCount;
        this.callbacks.seek(currentTick, this.song?.length ?? 0); // TODO: This is a bit hacky; should be part of audio handler
      });
    } else {
      console.debug('Viewer not initialized, skipping ticker update');
    }
  }

  public async loadSong(url: string) {
    const { song, extraSounds } = await loadSongFromUrl(url);
    const instruments = loadCustomInstruments(song, extraSounds);
    this.song = song;
    this.audioEngine.loadSong(song, instruments);
    this.viewer?.loadSong(song);
  }

  public togglePlayback(): boolean {
    if (!this.isPlaying) {
      this.play();
    } else {
      this.pause();
    }
    return this.isPlaying;
  }

  public play() {
    if (!this.song) return;
    this.audioEngine.play();
  }

  public pause() {
    this.audioEngine.pause();
  }

  public stop() {
    this.audioEngine.stop();
  }

  get isPlaying() {
    return this.audioEngine.isPlaying;
  }

  seek(tick: number) {
    this.audioEngine.currentTick = tick;
    this.callbacks.seek(tick, this.song?.length ?? 0);
  }
}
