import type { NbsvisAudioBackend } from '@opennbs/nbsvis-audio-api';
import { AudioEngine, type AudioEngineOptions } from '@opennbs/nbsvis-web-audio';
import mitt, { Emitter } from 'mitt';

import { buildAudioPlaybackPayload } from './audio-payload';
import { defaultInstruments, loadCustomInstruments } from './instrument';
import { getNoteEvents, loadSongFromUrl } from './song';
import type { Viewer } from './viewer';

export type PlayerOptions = {
  audioBackend?: NbsvisAudioBackend;
  webAudio?: AudioEngineOptions;
};

type PlayerEvents = {
  play: void;
  pause: void;
  stop: void;
  ended: void;
  seek: { tick: number; totalLength: number };
};

export class Player {
  viewer: Viewer;
  audioBackend: NbsvisAudioBackend;
  songLoaded: boolean = false;

  lengthTicks: number = 0;
  private emitter: Emitter<PlayerEvents>;

  constructor(viewer: Viewer, options: PlayerOptions = {}) {
    this.viewer = viewer;
    this.audioBackend = options.audioBackend ?? new AudioEngine(options.webAudio ?? {});
    this.emitter = mitt<PlayerEvents>();
    this.audioBackend.onEnded(() => {
      this.emitter.emit('ended');
    });

    if (this.viewer) {
      this.viewer.app.ticker.add(() => {
        const currentTick = this.audioBackend.currentTick;
        this.viewer.currentTick = currentTick;
        this.viewer.soundCount = this.audioBackend.soundCount;
        this.viewer.maxSoundCount = this.audioBackend.maxSoundCount;
        this.emitter.emit('seek', { tick: currentTick, totalLength: this.lengthTicks });
      });
    } else {
      console.debug('Viewer not initialized, skipping ticker update');
    }
  }

  public async loadSong(url: string) {
    const { song, extraSounds } = await loadSongFromUrl(url);
    const noteData = getNoteEvents(song);
    const instruments = loadCustomInstruments(song, extraSounds);
    const merged = defaultInstruments.concat(instruments);
    const payload = await buildAudioPlaybackPayload(song, noteData, merged);
    await this.audioBackend.loadSong(payload);
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
    this.audioBackend.play();
    this.emitter.emit('play');
  }

  public pause() {
    this.audioBackend.pause();
    this.emitter.emit('pause');
  }

  public stop() {
    this.audioBackend.stop();
    this.emitter.emit('stop');
  }

  get loop() {
    return this.audioBackend.loop;
  }

  set loop(loop: boolean) {
    this.audioBackend.loop = loop;
  }

  get isPlaying() {
    return this.audioBackend.isPlaying;
  }

  get isEnded() {
    return this.audioBackend.isEnded;
  }

  seek(tick: number) {
    this.audioBackend.seekToTick(tick);
    this.emitter.emit('seek', { tick, totalLength: this.lengthTicks });
  }

  on<K extends keyof PlayerEvents>(type: K, handler: (event: PlayerEvents[K]) => void) {
    this.emitter.on(type, handler);
  }

  off<K extends keyof PlayerEvents>(type: K, handler: (event: PlayerEvents[K]) => void) {
    this.emitter.off(type, handler);
  }
}
