import { IPlayer, IPlayerControlWidget } from '../interface';

const POPOUT_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
  </svg>
`;

export class DefaultPopoutButton extends HTMLElement implements IPlayerControlWidget {
  private shadow: ShadowRoot;
  private button!: HTMLButtonElement;
  private tooltip!: HTMLElement;
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
    this.button.setAttribute('aria-label', 'Picture-in-Picture');
    this.button.innerHTML = POPOUT_ICON;

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    this.tooltip.textContent = 'Picture-in-Picture';
    this.button.appendChild(this.tooltip);

    this.button.addEventListener('click', () => {
      this.enterPIP();
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

  enterPIP() {
    if (!this.container) return;

    // TODO: Implement Picture-in-Picture functionality
    // if ((this.container as any).requestPictureInPicture) {
    //   (this.container as any).requestPictureInPicture();
    // }
  }
}

customElements.define('default-popout-button', DefaultPopoutButton);
