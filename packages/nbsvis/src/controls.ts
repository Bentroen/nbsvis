import { Player } from './player';

export class PlayButton extends HTMLElement {
  private _playing = false;
  private button: HTMLButtonElement;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    this.button = document.createElement('button');
    this.button.textContent = 'Play';
    shadow.appendChild(this.button);

    // Listen to clicks inside
    this.button.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('toggleplay', { bubbles: true, composed: true }));
    });
  }

  get playing() {
    return this._playing;
  }

  set playing(value: boolean) {
    this._playing = value;
    this.updateVisuals();
  }

  private updateVisuals() {
    this.button.textContent = this._playing ? 'Pause' : 'Play';
    // TODO: swap SVG icons here instead of text
  }
}

customElements.define('play-button', PlayButton);

class SeekBar extends HTMLElement {
  private player: Player | null = null;
  private inputElement!: HTMLInputElement;

  constructor() {
    super();
  }

  connectedCallback() {
    this.init();

    this.inputElement.addEventListener('input', (event) => {
      const value = (event.target as HTMLInputElement).value;
      if (this.player) {
        this.player.seek(parseInt(value, 10));
      }
    });
  }

  init() {
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'range';
    this.inputElement.min = '0';
    this.inputElement.max = '100';
    this.inputElement.value = '0';
    this.appendChild(this.inputElement);

    this.style.width = '100%';
  }

  setPlayer(player: Player) {
    this.player = player;
  }

  setProgress(value: number) {
    this.inputElement.value = value.toString();
  }

  setMax(max: number) {
    this.inputElement.max = max.toString();
  }
}

customElements.define('seek-bar', SeekBar);

export class PlayerBar extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: flex;
        gap: 10px;
        padding: 10px;
        background-color: rgba(0, 0, 0, 0.5);
        border-radius: 5px;
      }
    `;
    shadow.appendChild(style);

    const slot = document.createElement('slot');
    shadow.appendChild(slot);
  }
}

customElements.define('player-bar', PlayerBar);

// Export default controls
export { DefaultControls } from './controls/default-controls';

export class PlayerControlHandler {
  private player: Player;

  constructor(player: Player, options?: { template?: HTMLTemplateElement }) {
    this.player = player;
    const template = options?.template || this.createDefaultTemplate();
    this.init(template);
  }

  init(template: HTMLTemplateElement) {
    if (!template) {
      console.error('No template found for player controls.');
      return;
    }

    // Clone the template content
    const content = template.content.cloneNode(true) as DocumentFragment;

    // Find and initialize elements in the cloned content
    const overlay = content.querySelector('player-overlay') as PlayerOverlay;
    const playButton = content.querySelector('play-button') as HTMLButtonElement;
    const seekBar = content.querySelector('seek-bar') as HTMLInputElement;
    const songTitle = content.querySelector('.song-title') as HTMLElement;

    // Update the song title
    songTitle.textContent = this.player.song?.meta.name || 'No song loaded';

    // Add functionality to the play button
    playButton.addEventListener('click', () => {
      if (this.player.isPlaying) {
        this.player.pause();
      } else {
        this.player.play();
      }
    });

    // Sync the play button state with the player
    this.player.on('play', () => {
      playButton.textContent = 'Pause';
    });
    this.player.on('pause', () => {
      playButton.textContent = 'Play';
    });

    // Add functionality to the seek bar
    seekBar.addEventListener('input', (event) => {
      const value = (event.target as HTMLInputElement).value;
      this.player.seek(parseInt(value, 10));
    });

    // Sync the seek bar with the player's progress
    //this.player.on('progress', (progress: number) => { // or 'progress'
    //  seekBar.value = progress.toString();
    //});
    //this.player.on('durationchange', (duration: number) => { // or 'durationchange
    //  seekBar.max = duration.toString();
    //});

    this.player.on('seek', (event) => {
      seekBar.value = event.tick.toString();
      seekBar.max = event.totalLength.toString(); // Assuming totalLength is in ticks
    });

    // Attach the overlay to the player's container
    const container = this.player.viewer?.app?.canvas.parentElement;
    if (container) {
      container.appendChild(overlay);
    } else {
      console.error('Player container not found. Default controls will not be displayed.');
    }
  }

  private createDefaultTemplate(): HTMLTemplateElement {
    const template = document.createElement('template');
    template.innerHTML = `
      <player-overlay>
        <player-bar slot="top-bar">
          <h2 class="song-title"></h2>
        </player-bar>
        <player-bar slot="bottom-bar">
          <play-button></play-button>
          <seek-bar />
        </player-bar>
      </player-overlay>
    `;
    return template;
  }
}
