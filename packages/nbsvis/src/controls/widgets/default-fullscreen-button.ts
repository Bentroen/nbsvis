import { IPlayer, IPlayerControlWidget } from '../interface';

const FULLSCREEN_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
  </svg>
`;

const FULLSCREEN_EXIT_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
  </svg>
`;

export class DefaultFullscreenButton extends HTMLElement implements IPlayerControlWidget {
  private shadow: ShadowRoot;
  private button!: HTMLButtonElement;
  private iconContainer!: HTMLElement;
  private tooltip!: HTMLElement;
  private _isFullscreen = false;
  private container: HTMLElement | null = null;

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
    this.button.setAttribute('aria-label', 'Fullscreen');

    this.iconContainer = document.createElement('div');
    this.iconContainer.innerHTML = FULLSCREEN_ICON;
    this.button.appendChild(this.iconContainer);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    this.tooltip.textContent = 'Fullscreen (F)';
    this.button.appendChild(this.tooltip);

    this.button.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      this._isFullscreen = !!document.fullscreenElement;
      this.updateIcon();
    });

    this.shadow.appendChild(style);
    this.shadow.appendChild(this.button);
  }

  onConnect(_player: IPlayer) {
    // Player parameter kept for interface compliance, may be used in future implementation
    void _player;
    // Find the container element (nbs-player or its parent)
    this.container =
      this.closest('nbs-player') || (this.closest('[data-nbs-player-container]') as HTMLElement);
  }

  toggleFullscreen() {
    if (!this.container) return;

    if (!this._isFullscreen) {
      // TODO: Implement fullscreen functionality
      // if (this.container.requestFullscreen) {
      //   this.container.requestFullscreen();
      // } else if ((this.container as any).webkitRequestFullscreen) {
      //   (this.container as any).webkitRequestFullscreen();
      // } else if ((this.container as any).mozRequestFullScreen) {
      //   (this.container as any).mozRequestFullScreen();
      // }
    } else {
      // TODO: Implement exit fullscreen functionality
      // if (document.exitFullscreen) {
      //   document.exitFullscreen();
      // } else if ((document as any).webkitExitFullscreen) {
      //   (document as any).webkitExitFullscreen();
      // } else if ((document as any).mozCancelFullScreen) {
      //   (document as any).mozCancelFullScreen();
      // }
    }
  }

  private updateIcon() {
    this.iconContainer.innerHTML = this._isFullscreen ? FULLSCREEN_EXIT_ICON : FULLSCREEN_ICON;
    this.tooltip.textContent = this._isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
  }
}

customElements.define('default-fullscreen-button', DefaultFullscreenButton);
