import type { NbsvisAudioBackend } from '@opennbs/nbsvis-audio-api';
import type { NbsvisViewerBackend } from '@opennbs/nbsvis-viewer-api';
import { AudioEngine, type AudioEngineOptions } from '@opennbs/nbsvis-web-audio';
import mitt, { Emitter } from 'mitt';

import { buildAudioPlaybackPayload } from './audio-payload';
import { defaultInstruments, loadCustomInstruments } from './instrument';
import { getNoteEvents, loadSongFromUrl } from './song';
import { buildViewerRenderPayload } from './viewer-payload';

export type PlayerOptions = {
  viewerBackend: NbsvisViewerBackend;
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
  private readonly viewerBackend: NbsvisViewerBackend;
  audioBackend: NbsvisAudioBackend;
  songLoaded: boolean = false;

  lengthTicks: number = 0;
  private emitter: Emitter<PlayerEvents>;
  private readonly stopViewerSync: () => void;

  constructor(options: PlayerOptions) {
    this.viewerBackend = options.viewerBackend;
    this.audioBackend = options.audioBackend ?? new AudioEngine(options.webAudio ?? {});
    this.emitter = mitt<PlayerEvents>();
    this.audioBackend.onEnded(() => {
      this.emitter.emit('ended');
    });

    this.stopViewerSync = this.viewerBackend.onRenderTick(() => {
      this.viewerBackend.setTick(this.audioBackend.currentTick);
      this.viewerBackend.setSoundCount(
        this.audioBackend.soundCount,
        this.audioBackend.maxSoundCount,
      );
      this.viewerBackend.setPlaying(this.audioBackend.isPlaying);
      this.emitter.emit('seek', {
        tick: this.audioBackend.currentTick,
        totalLength: this.lengthTicks,
      });
    });
  }

  public dispose(): void {
    this.stopViewerSync();
  }

  public async loadSong(url: string) {
    const { song, extraSounds } = await loadSongFromUrl(url);
    const noteData = getNoteEvents(song);
    const instruments = loadCustomInstruments(song, extraSounds);
    const merged = defaultInstruments.concat(instruments);
    const payload = await buildAudioPlaybackPayload(song, noteData, merged);
    await this.audioBackend.loadSong(payload);
    this.viewerBackend.loadSong(buildViewerRenderPayload(song));
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
