import mitt, { Emitter } from 'mitt';

import { AudioEngine } from './audio';
import { loadCustomInstruments } from './instrument';
import { getNoteEvents, loadSongFromUrl } from './song';
import { Viewer } from './viewer';

type PlayerEvents = {
  play: void;
  pause: void;
  stop: void;
  seek: { tick: number; totalLength: number };
};

export class Player {
  viewer: Viewer;
  audioEngine: AudioEngine;
  songLoaded: boolean = false;

  // TODO: replace with SongData object
  lengthTicks: number = 0;
  private emitter: Emitter<PlayerEvents>;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.audioEngine = new AudioEngine();
    this.emitter = mitt<PlayerEvents>();

    if (this.viewer) {
      this.viewer.app.ticker.add(() => {
        const currentTick = this.audioEngine.currentTick;
        this.viewer.currentTick = currentTick;
        this.viewer.soundCount = this.audioEngine.soundCount;
        this.viewer.maxSoundCount = this.audioEngine.maxSoundCount;
        this.emitter.emit('seek', { tick: currentTick, totalLength: this.lengthTicks }); // TODO: This is a bit hacky; should be part of audio handler
      });
    } else {
      console.debug('Viewer not initialized, skipping ticker update');
    }
  }

  public async loadSong(url: string) {
    const { song, extraSounds } = await loadSongFromUrl(url);
    const noteData = getNoteEvents(song);
    const instruments = loadCustomInstruments(song, extraSounds);
    await this.audioEngine.loadSong(song, noteData, instruments);
    this.viewer?.loadSong(song, noteData);
    this.lengthTicks = song.length;
    this.songLoaded = true;
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
    if (!this.songLoaded) return;
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

  seek(tick: number) {
    this.audioEngine.currentTick = tick;
    this.emitter.emit('seek', { tick, totalLength: this.lengthTicks });
  }

  on<K extends keyof PlayerEvents>(type: K, handler: (event: PlayerEvents[K]) => void) {
    this.emitter.on(type, handler);
  }

  off<K extends keyof PlayerEvents>(type: K, handler: (event: PlayerEvents[K]) => void) {
    this.emitter.off(type, handler);
  }
}
