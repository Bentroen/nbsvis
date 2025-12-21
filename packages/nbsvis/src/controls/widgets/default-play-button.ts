import { IPlayer, IPlayerControlWidget } from '../interface';

const PLAY_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
`;

const PAUSE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
  </svg>
`;

export class DefaultPlayButton extends HTMLElement implements IPlayerControlWidget {
  private shadow: ShadowRoot;
  private player: IPlayer | null = null;
  private button!: HTMLButtonElement;
  private iconContainer!: HTMLElement;
  private tooltip!: HTMLElement;
  private _playing = false;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.init();
  }

  private init() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: inline-block;
      }
      .button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s ease;
        position: relative;
        width: 40px;
        height: 40px;
      }
      .button:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
      .button:active {
        background-color: rgba(255, 255, 255, 0.2);
      }
      .button svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
      }
      .tooltip {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        margin-bottom: 0.5rem;
        padding: 0.375rem 0.75rem;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        font-size: 0.75rem;
        border-radius: 4px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        z-index: 1000;
      }
      .button:hover .tooltip {
        opacity: 1;
      }
    `;

    this.button = document.createElement('button');
    this.button.className = 'button';
    this.button.setAttribute('aria-label', 'Play/Pause');

    this.iconContainer = document.createElement('div');
    this.iconContainer.innerHTML = PLAY_ICON;
    this.button.appendChild(this.iconContainer);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    this.tooltip.textContent = 'Play/Pause (Space)';
    this.button.appendChild(this.tooltip);

    this.button.addEventListener('click', () => {
      if (this.player) {
        if (this.player.isPlaying) {
          this.player.pause();
        } else {
          this.player.play();
        }
      }
    });

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.button);
  }

  onConnect(player: IPlayer) {
    this.player = player;

    player.on('play', () => {
      this._playing = true;
      this.updateIcon();
    });

    player.on('pause', () => {
      this._playing = false;
      this.updateIcon();
    });

    // Initial state
    this._playing = player.isPlaying;
    this.updateIcon();
  }

  private updateIcon() {
    this.iconContainer.innerHTML = this._playing ? PAUSE_ICON : PLAY_ICON;
  }

  get playing() {
    return this._playing;
  }
}

customElements.define('default-play-button', DefaultPlayButton);


