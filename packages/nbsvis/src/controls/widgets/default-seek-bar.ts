import { IPlayer, IPlayerControlWidget } from '../interface';

export class DefaultSeekBar extends HTMLElement implements IPlayerControlWidget {
  private shadow: ShadowRoot;
  private player: IPlayer | null = null;
  private inputElement!: HTMLInputElement;
  private isDragging = false;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.init();
  }

  private init() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        width: 100%;
      }
      .seek-container {
        width: 100%;
        position: relative;
        height: 4px;
        cursor: pointer;
      }
      .seek-bar {
        width: 100%;
        height: 4px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        position: relative;
        transition: height 0.2s ease;
        cursor: pointer;
        -webkit-appearance: none;
        appearance: none;
        outline: none;
        margin: 0;
      }
      .seek-bar::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .seek-bar::-moz-range-thumb {
        width: 12px;
        height: 12px;
        background: white;
        border-radius: 50%;
        cursor: pointer;
        border: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .seek-container:hover .seek-bar {
        height: 6px;
      }
      .seek-container:hover .seek-bar::-webkit-slider-thumb {
        opacity: 1;
      }
      .seek-container:hover .seek-bar::-moz-range-thumb {
        opacity: 1;
      }
    `;

    const container = document.createElement('div');
    container.className = 'seek-container';

    this.inputElement = document.createElement('input');
    this.inputElement.type = 'range';
    this.inputElement.className = 'seek-bar';
    this.inputElement.min = '0';
    this.inputElement.max = '100';
    this.inputElement.value = '0';
    this.inputElement.step = '1';

    this.inputElement.addEventListener('input', () => {
      if (this.player && !this.isDragging) {
        const value = parseInt(this.inputElement.value, 10);
        this.player.seek(value);
      }
    });

    this.inputElement.addEventListener('mousedown', () => {
      this.isDragging = true;
    });

    this.inputElement.addEventListener('mouseup', () => {
      if (this.player) {
        const value = parseInt(this.inputElement.value, 10);
        this.player.seek(value);
      }
      this.isDragging = false;
    });

    container.appendChild(this.inputElement);
    this.shadow.appendChild(style);
    this.shadow.appendChild(container);
  }

  onConnect(player: IPlayer) {
    this.player = player;

    // Update seek bar when player seeks
    player.on('seek', (event: any) => {
      if (!this.isDragging && event.tick !== undefined) {
        this.inputElement.value = event.tick.toString();
        this.inputElement.max = event.totalLength?.toString() || '100';
      }
    });
  }

  setValue(value: number) {
    if (!this.isDragging) {
      this.inputElement.value = value.toString();
    }
  }

  setMax(max: number) {
    this.inputElement.max = max.toString();
  }
}

customElements.define('default-seek-bar', DefaultSeekBar);


