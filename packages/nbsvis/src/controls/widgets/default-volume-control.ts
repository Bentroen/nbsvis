import { IPlayer, IPlayerControlWidget } from '../interface';

const VOLUME_UP_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
  </svg>
`;

const VOLUME_DOWN_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
  </svg>
`;

const VOLUME_OFF_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
  </svg>
`;

export class DefaultVolumeControl extends HTMLElement implements IPlayerControlWidget {
  private shadow: ShadowRoot;
  private button!: HTMLButtonElement;
  private iconContainer!: HTMLElement;
  private sliderContainer!: HTMLElement;
  private slider!: HTMLInputElement;
  private tooltip!: HTMLElement;
  private _volume = 1.0;
  private _muted = false;

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
      .volume-container {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        position: relative;
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
      .slider-container {
        width: 0;
        opacity: 0;
        transition: width 0.2s ease, opacity 0.2s ease;
        overflow: hidden;
      }
      .volume-container:hover .slider-container {
        width: 80px;
        opacity: 1;
      }
      .slider {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }
      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        cursor: pointer;
      }
      .slider::-moz-range-thumb {
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        cursor: pointer;
        border: none;
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

    const container = document.createElement('div');
    container.className = 'volume-container';

    this.button = document.createElement('button');
    this.button.className = 'button';
    this.button.setAttribute('aria-label', 'Volume');

    this.iconContainer = document.createElement('div');
    this.iconContainer.innerHTML = VOLUME_UP_ICON;
    this.button.appendChild(this.iconContainer);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    this.tooltip.textContent = 'Mute (M)';
    this.button.appendChild(this.tooltip);

    this.button.addEventListener('click', () => {
      this.toggleMute();
    });

    this.sliderContainer = document.createElement('div');
    this.sliderContainer.className = 'slider-container';

    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.className = 'slider';
    this.slider.min = '0';
    this.slider.max = '100';
    this.slider.value = '100';
    this.slider.step = '1';

    this.slider.addEventListener('input', () => {
      const value = parseFloat(this.slider.value) / 100;
      this.setVolume(value);
      if (this._muted && value > 0) {
        this._muted = false;
        this.updateIcon();
      }
    });

    this.sliderContainer.appendChild(this.slider);
    container.appendChild(this.button);
    container.appendChild(this.sliderContainer);

    this.shadow.appendChild(style);
    this.shadow.appendChild(container);
  }

  onConnect(_player: IPlayer) {
    // Note: Volume control would need to be implemented in the Player/AudioEngine
    // For now, this is a UI component that can be connected later
    void _player;
  }

  toggleMute() {
    this._muted = !this._muted;
    this.updateIcon();
    // TODO: Implement actual mute functionality in AudioEngine
  }

  setVolume(volume: number) {
    this._volume = Math.max(0, Math.min(1, volume));
    this.slider.value = (this._volume * 100).toString();
    // TODO: Implement actual volume control in AudioEngine
  }

  private updateIcon() {
    if (this._muted || this._volume === 0) {
      this.iconContainer.innerHTML = VOLUME_OFF_ICON;
      this.tooltip.textContent = 'Unmute (M)';
    } else if (this._volume < 0.5) {
      this.iconContainer.innerHTML = VOLUME_DOWN_ICON;
      this.tooltip.textContent = 'Mute (M)';
    } else {
      this.iconContainer.innerHTML = VOLUME_UP_ICON;
      this.tooltip.textContent = 'Mute (M)';
    }
  }

  get volume() {
    return this._volume;
  }

  get muted() {
    return this._muted;
  }
}

customElements.define('default-volume-control', DefaultVolumeControl);
