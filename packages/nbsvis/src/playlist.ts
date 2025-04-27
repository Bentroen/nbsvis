import { Song } from '@encode42/nbs.js';

export type PlaylistSong = {
  name: string;
  author: string;
  source: string | ArrayBuffer | Song;
  thumbnailUrl?: string;
  song?: Song;
  extraSounds?: Record<string, ArrayBuffer>;
};

export class PlaylistManager {
  private playlist: Array<PlaylistSong> = [];
  private currentSongIndex: number = -1;

  constructor() {}

  public addSong(song: PlaylistSong) {
    this.playlist.push(song);
  }

  public removeSong(index: number) {
    if (index < 0 || index >= this.playlist.length) {
      throw new Error('Index out of bounds');
    }
    this.playlist.splice(index, 1);
  }

  public clear() {
    this.playlist = [];
    this.currentSongIndex = -1;
  }

  public playNext() {
    if (this.currentSongIndex < this.playlist.length - 1) {
      this.currentSongIndex++;
      return this.playlist[this.currentSongIndex];
    }
    return null;
  }

  public playPrevious() {
    if (this.currentSongIndex > 0) {
      this.currentSongIndex--;
      return this.playlist[this.currentSongIndex];
    }
    return null;
  }

  public getCurrentSong() {
    if (this.currentSongIndex >= 0 && this.currentSongIndex < this.playlist.length) {
      return this.playlist[this.currentSongIndex];
    }
    return null;
  }
}
