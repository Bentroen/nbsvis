import { IPlayer, IPlayerControlWidget } from '../interface';

const SETTINGS_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
  </svg>
`;

export class DefaultSettingsButton extends HTMLElement implements IPlayerControlWidget {
  private shadow: ShadowRoot;
  private player: IPlayer | null = null;
  private button: HTMLButtonElement;
  private menu: HTMLElement;
  private tooltip: HTMLElement;
  private _open = false;

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
      .menu {
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 0.5rem;
        background: rgba(0, 0, 0, 0.9);
        border-radius: 4px;
        padding: 0.5rem 0;
        min-width: 200px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        opacity: 0;
        pointer-events: none;
        transform: translateY(10px);
        transition: opacity 0.2s ease, transform 0.2s ease;
        z-index: 1000;
      }
      .menu.open {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      .menu-item {
        padding: 0.75rem 1rem;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        transition: background-color 0.2s ease;
      }
      .menu-item:hover {
        background-color: rgba(255, 255, 255, 0.1);
      }
      .menu-item input[type="checkbox"] {
        margin-left: auto;
      }
      .menu-item label {
        cursor: pointer;
        flex: 1;
      }
    `;

    this.button = document.createElement('button');
    this.button.className = 'button';
    this.button.setAttribute('aria-label', 'Settings');
    this.button.innerHTML = SETTINGS_ICON;

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    this.tooltip.textContent = 'Settings';
    this.button.appendChild(this.tooltip);

    this.menu = document.createElement('div');
    this.menu.className = 'menu';

    // Loop option
    const loopItem = document.createElement('div');
    loopItem.className = 'menu-item';
    const loopLabel = document.createElement('label');
    loopLabel.textContent = 'Loop';
    loopLabel.setAttribute('for', 'loop-checkbox');
    const loopCheckbox = document.createElement('input');
    loopCheckbox.type = 'checkbox';
    loopCheckbox.id = 'loop-checkbox';
    loopItem.appendChild(loopLabel);
    loopItem.appendChild(loopCheckbox);
    this.menu.appendChild(loopItem);

    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMenu();
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (this._open && !this.shadow.contains(e.target as Node)) {
        this.closeMenu();
      }
    });

    const container = document.createElement('div');
    container.style.position = 'relative';
    container.appendChild(this.button);
    container.appendChild(this.menu);

    this.shadow.appendChild(style);
    this.shadow.appendChild(container);
  }

  onConnect(player: IPlayer) {
    this.player = player;
    const loopCheckbox = this.shadow.querySelector('#loop-checkbox') as HTMLInputElement;
    
    if (loopCheckbox && 'loop' in player) {
      // Sync loop checkbox with player loop state
      loopCheckbox.checked = (player as any).loop || false;
      
      loopCheckbox.addEventListener('change', () => {
        if ('loop' in player) {
          (player as any).loop = loopCheckbox.checked;
        }
      });
    }
  }

  toggleMenu() {
    this._open = !this._open;
    if (this._open) {
      this.menu.classList.add('open');
    } else {
      this.menu.classList.remove('open');
    }
  }

  closeMenu() {
    this._open = false;
    this.menu.classList.remove('open');
  }
}

customElements.define('default-settings-button', DefaultSettingsButton);

