import { PlayerEvents } from '../../player';

export interface IPlayerControlWidget {
  onConnect(player: IPlayer): void;
}

export interface IPlayer {
  play(): void;
  pause(): void;
  seek(tick: number): void;

  isPlaying: boolean;
  currentTick: number;

  on<K extends keyof PlayerEvents>(type: K, handler: (event: PlayerEvents[K]) => void): void;
  off<K extends keyof PlayerEvents>(type: K, handler: (event: PlayerEvents[K]) => void): void;
}
