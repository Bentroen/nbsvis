import { Song } from '@encode42/nbs.js';
import mitt, { Emitter } from 'mitt';

import { AudioEngine } from './audio';
import { loadCustomInstruments } from './instrument';
import { loadSongFromUrl } from './song';
import { Viewer } from './viewer';

export type PlayerEvents = {
  play: void;
  pause: void;
  stop: void;
  seek: { tick: number; totalLength: number };
  ended: void;
};

export class Player {
  viewer?: Viewer;
  audioEngine: AudioEngine;
  song?: Song;
  private emitter: Emitter<PlayerEvents>;
  private _loop = false;

  constructor(viewer?: Viewer) {
    this.viewer = viewer;
    this.audioEngine = new AudioEngine();
    this.emitter = mitt<PlayerEvents>();

    if (this.viewer) {
      this.viewer.app.ticker.add(() => {
        if (!this.viewer) return; // TODO: viewer probably shouldn't stay here with the event system in place
        const currentTick = this.audioEngine.currentTick;
        this.viewer.currentTick = currentTick;
        this.viewer.soundCount = this.audioEngine.soundCount;
        this.emitter.emit('seek', { tick: currentTick, totalLength: this.song?.length ?? 0 }); // TODO: This is a bit hacky; should be part of audio handler
        
        // Check if song has ended
        if (this.song && currentTick >= this.song.length && this.audioEngine.isPlaying) {
          this.handleSongEnd();
        }
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
    this.emitter.emit('play');
  }

  public pause() {
    this.audioEngine.pause();
    this.emitter.emit('pause');
  }

  public stop() {
    this.audioEngine.stop();
    this.emitter.emit('stop');
  }

  get isPlaying() {
    return this.audioEngine.isPlaying;
  }

  get currentTick() {
    return this.audioEngine.currentTick;
  }

  seek(tick: number) {
    this.audioEngine.currentTick = tick;
    this.emitter.emit('seek', { tick, totalLength: this.song?.length ?? 0 });
  }

  on<K extends keyof PlayerEvents>(type: K, handler: (event: PlayerEvents[K]) => void) {
    this.emitter.on(type, handler);
  }

  off<K extends keyof PlayerEvents>(type: K, handler: (event: PlayerEvents[K]) => void) {
    this.emitter.off(type, handler);
  }

  private handleSongEnd() {
    this.emitter.emit('ended');
    if (this._loop) {
      this.seek(0);
      this.play();
    } else {
      this.pause();
    }
  }

  get loop() {
    return this._loop;
  }

  set loop(value: boolean) {
    this._loop = value;
  }
}
