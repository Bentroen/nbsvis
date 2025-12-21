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
  private inputElement: HTMLInputElement;

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

export class PlayerOverlay extends HTMLElement {
  /*
   * Player overlay for the player controls.
   * This is a simple overlay that shows a gradient
   * and holds widgets that can be attached to the top and bottom.
   * It is displayed on top of the canvas and is hidden when not in use.
   */

  private shadow: ShadowRoot | null = null;
  private hideTimeout: number | undefined;

  connectedCallback() {
    this.shadow = this.attachShadow({ mode: 'open' });
    this.init();
  }

  private init() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        top: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        pointer-events: none; /* Prevent overlay from blocking interactions */
        opacity: 1;
        transition: opacity 0.3s;
      }

      :host {
        background: linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.5)) top,
                    linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.5)) bottom;
        background-size: 100% 15%, 100% 15%;
        background-repeat: no-repeat;
      }

      ::slotted([slot="top-bar"]) {
        pointer-events: auto; /* Allow interactions with the top bar */
      }

      ::slotted([slot="bottom-bar"]) {
        pointer-events: auto; /* Allow interactions with the bottom bar */
      }
    `;

    // Alternative for gradient - :before and :after

    //:host::before,
    //:host::after {
    //  content: '';
    //  position: absolute;
    //  left: 0;
    //  right: 0;
    //  pointer-events: none; /* Allow interaction with slotted content */
    //  z-index: 0; /* Ensure gradients are behind the content */
    //}
    //
    //:host::before {
    //  top: 0;
    //  height: 15%; /* Height of the top gradient */
    //  background: linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.5));
    //}
    //
    //:host::after {
    //  bottom: 0;
    //  height: 15%; /* Height of the bottom gradient */
    //  background: linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.5));
    //}

    //this.setupGradient();

    // Create the top-bar slot
    const topBarSlot = document.createElement('slot');
    topBarSlot.name = 'top-bar';

    // Create the bottom-bar slot
    const bottomBarSlot = document.createElement('slot');
    bottomBarSlot.name = 'bottom-bar';

    // Append the style and slots directly to the shadow root
    this.shadowRoot?.append(style, topBarSlot, bottomBarSlot);

    this.setupHover();
  }

  setupGradient() {
    // Set up bottom gradient element
    const bottomGradient = document.createElement('div');
    bottomGradient.style.position = 'absolute';
    bottomGradient.style.bottom = '0';
    bottomGradient.style.left = '0';
    bottomGradient.style.right = '0';
    bottomGradient.style.height = '15%'; // Height of the gradient
    bottomGradient.style.background =
      'linear-gradient(to bottom, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.5))';
    bottomGradient.style.pointerEvents = 'none'; // Disable pointer events to allow interaction with the canvas below
    this.shadow?.appendChild(bottomGradient);

    // Set up top gradient element
    const topGradient = document.createElement('div');
    topGradient.style.position = 'absolute';
    topGradient.style.top = '0';
    topGradient.style.left = '0';
    topGradient.style.right = '0';
    topGradient.style.height = '15%'; // Height of the gradient
    topGradient.style.background = 'linear-gradient(to top, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.5))';
    topGradient.style.pointerEvents = 'none'; // Disable pointer events to allow interaction with the canvas below
    this.shadow?.appendChild(topGradient);
  }

  private setupHover() {
    const parent = this.parentElement;
    if (!parent) return;

    parent.addEventListener('mousemove', () => this.show());
    parent.addEventListener('mouseleave', () => this.hideLater());
  }

  private show() {
    clearTimeout(this.hideTimeout);
    this.style.opacity = '1';
    this.hideLater();
  }

  private hideLater() {
    clearTimeout(this.hideTimeout);
    this.hideTimeout = window.setTimeout(() => {
      this.style.opacity = '0';
    }, 3000); // 3 seconds after last movement
  }
}

// Note: player-overlay is now defined in controls/widgets/player-overlay.ts
// customElements.define('player-overlay', PlayerOverlay);

export class PlayerControlHandler {
  private player: Player;
  private template: HTMLTemplateElement;

  constructor(player: Player, options?: { template?: HTMLTemplateElement }) {
    this.player = player;
    this.template = options?.template || this.createDefaultTemplate();
    this.init();
  }

  init() {
    // Check for a custom template
    const customTemplate = document.getElementById('custom-player') as HTMLTemplateElement;

    // Fallback to a default template if no custom template is found
    const template = customTemplate || this.createDefaultTemplate();

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
