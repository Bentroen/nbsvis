// See:
// https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
// https://web.dev/articles/media-session

export type MediaSessionActions = {
  play?: () => void;
  pause?: () => void;
  stop?: () => void;
  seekbackward?: (details: { seekOffset?: number }) => void;
  seekforward?: (details: { seekOffset?: number }) => void;
  seekto?: (details: { fastSeek?: number; seekTime?: number }) => void;
  previoustrack?: () => void;
  nexttrack?: () => void;
};

export type MediaSessionMetadata = {
  title: string;
  artist: string;
  album?: string;
  artworkSrc?: string;
};

export type MediaSessionPositionState = {
  duration: number;
  playbackRate: number;
  position: number;
};

export class BackgroundAudioHandler {
  private ctx = new AudioContext();
  private source: AudioBufferSourceNode | null = null;

  async start() {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 8, this.ctx.sampleRate); // 1s silence

    // create a buffer source and connect it to the destination
    this.ctx.resume(); // resume the context if it was suspended

    if (this.source) {
      this.source.stop();
      this.source.disconnect();
    }
    // create a new buffer source
    this.source = this.ctx.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;
    this.source.connect(this.ctx.destination);
    this.source.start();
    console.log('Background audio started');
  }

  stop() {
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
      this.source = null;
      console.log('Background audio stopped');
    }
  }
}

export class MediaSessionHandler {
  defaultSeekOffset = 10; // in seconds

  backgroundAudioHandler: BackgroundAudioHandler;

  constructor(actionHandlers: MediaSessionActions) {
    this.initMediaSession(actionHandlers);
    this.backgroundAudioHandler = new BackgroundAudioHandler();
  }

  private initMediaSession(actionHandlers: MediaSessionActions) {
    if (!('mediaSession' in navigator)) {
      console.warn('Media Session API is not supported in this browser.');
      return;
    }

    for (const [action, handler] of Object.entries(actionHandlers)) {
      try {
        navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler);
      } catch {
        console.log(`Media session action "${action}" is not supported.`);
      }
    }
  }

  public clearMediaSession() {
    if (!('mediaSession' in navigator)) {
      return;
    }

    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
    navigator.mediaSession.setActionHandler('play', null);
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('stop', null);
    navigator.mediaSession.setActionHandler('seekbackward', null);
    navigator.mediaSession.setActionHandler('seekforward', null);
    navigator.mediaSession.setActionHandler('seekto', null);
    navigator.mediaSession.setActionHandler('previoustrack', null);
    navigator.mediaSession.setActionHandler('nexttrack', null);
  }

  setMetadata(metadata: MediaSessionMetadata) {
    const { title, artist, album, artworkSrc } = metadata;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: artist,
      album: album,
      artwork: artworkSrc
        ? [
            {
              src: artworkSrc,
              sizes: '',
              type: '',
            },
          ]
        : undefined,
    });
  }

  setPlaying(isPlaying: boolean) {
    if (!('mediaSession' in navigator)) {
      return;
    }

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    console.log(navigator.mediaSession.playbackState);
    this.backgroundAudioHandler[isPlaying ? 'stop' : 'start']();
  }

  setPositionState(info: MediaSessionPositionState) {
    if (!('mediaSession' in navigator)) {
      return;
    }
    const { duration, playbackRate, position } = info;
    if ('setPositionState' in navigator.mediaSession) {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: playbackRate,
        position: position,
      });
    }
  }

  resetPositionState() {
    if ('setPositionState' in navigator.mediaSession) {
      navigator.mediaSession.setPositionState(undefined);
    }
  }
}
