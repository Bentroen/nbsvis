import { IPlayer, IPlayerControlWidget } from '../interface';

export class PlayButton extends HTMLElement implements IPlayerControlWidget {
  shadow: ShadowRoot;
  private _state: 'playing' | 'paused' = 'paused';

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = `
      <style>
        button {
          background: none;
          border: none;
          color: white;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          transition: background 0.3s;
          pointer-events: auto;
        }
      </style>
    `;
  }

  get state() {
    return this._state;
  }
  set state(value: 'playing' | 'paused') {
    this._state = value;
    const btn = this.shadow.querySelector('button');
    if (btn) {
      btn.textContent = value === 'playing' ? 'Pause' : 'Play';
    }
  }

  onConnect(player: IPlayer) {
    this.addEventListener('click', () => {
      if (player.isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    });

    player.on('play', () => {
      this.state = 'playing';
    });
    player.on('pause', () => {
      this.state = 'paused';
    });
  }
}
