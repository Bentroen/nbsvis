import { Song } from '@encode42/nbs.js';

import { AudioEngine } from './audio';
import { loadCustomInstruments } from './instrument';
import { MediaSessionActions, MediaSessionHandler } from './mediaSession';
import { loadSongFromUrl } from './song';
import { Viewer } from './viewer';

export class Player {
  viewer: Viewer;
  audioEngine: AudioEngine;
  song?: Song;

  mediaSessionHandler: MediaSessionHandler;

  callbacks: { seek: (tick: number, totalLength: number) => void };

  constructor(viewer: Viewer, callbacks: { seek: (tick: number, totalLength: number) => void }) {
    this.viewer = viewer;
    this.audioEngine = new AudioEngine();
    this.mediaSessionHandler = new MediaSessionHandler(this.getMediaSessionActions());
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

  public getMediaSessionActions(): MediaSessionActions {
    return {
      play: () => this.play(),
      pause: () => this.pause(),
      stop: () => this.stop(),
      // TODO: implement seek actions
      seekbackward: (details) => {
        if (details.seekOffset) {
          this.audioEngine.currentTick -= details.seekOffset;
          this.callbacks.seek(this.audioEngine.currentTick, this.song?.length ?? 0);
        }
      },
      seekforward: (details) => {
        if (details.seekOffset) {
          this.audioEngine.currentTick += details.seekOffset;
          this.callbacks.seek(this.audioEngine.currentTick, this.song?.length ?? 0);
        }
      },
      seekto: (details) => {
        if (details.fastSeek) {
          this.audioEngine.currentTick = details.fastSeek;
          this.callbacks.seek(this.audioEngine.currentTick, this.song?.length ?? 0);
        }
        if (details.seekTime) {
          this.audioEngine.currentTick = details.seekTime;
          this.callbacks.seek(this.audioEngine.currentTick, this.song?.length ?? 0);
        }
      },
      // TODO: implement next/previous track actions
    };
  }

  public async loadSong(url: string) {
    const { song, extraSounds } = await loadSongFromUrl(url);
    const instruments = loadCustomInstruments(song, extraSounds);
    this.song = song;
    this.audioEngine.loadSong(song, instruments);
    this.viewer?.loadSong(song);
    this.mediaSessionHandler.setMetadata({
      title: song.meta.name,
      artist: song.meta.author,
    });
    this.mediaSessionHandler.setPositionState({
      duration: song.length,
      playbackRate: 1,
      position: 0,
    });
    this.mediaSessionHandler.setPlaying(false);
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
    this.mediaSessionHandler.setPlaying(true);
  }

  public pause() {
    this.audioEngine.pause();
    this.mediaSessionHandler.setPlaying(false);
  }

  public stop() {
    this.audioEngine.stop();
    this.mediaSessionHandler.setPlaying(false);
    this.mediaSessionHandler.setPositionState({
      duration: this.song?.length ?? 0,
      playbackRate: 1,
      position: 0,
    });
  }

  get isPlaying() {
    return this.audioEngine.isPlaying;
  }

  seek(tick: number) {
    this.audioEngine.currentTick = tick;
    this.callbacks.seek(tick, this.song?.length ?? 0);
    this.mediaSessionHandler.setPositionState({
      duration: this.song?.length ?? 0,
      playbackRate: 1,
      position: tick,
    });
  }
}
