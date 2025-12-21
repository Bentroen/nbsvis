import { Player } from '../player';
import { Viewer } from '../viewer';
import { PianoRollView } from '../viewer/views';
import { DefaultControls } from './default-controls';

export class NBSPlayer extends HTMLElement {
  private player: Player;
  private defaultControls: DefaultControls | null = null;
  private viewer: Viewer | null = null;
  private _loop = false;
  private container: HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    console.log('Player initialized');

    // Create container for viewer and controls
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
        min-width: 640px;
        min-height: 360px;
      }
      .viewer-container {
        position: relative;
        width: 100%;
        height: 100%;
      }
    `;

    this.container = document.createElement('div');
    this.container.className = 'viewer-container';

    // set red background
    this.container.style.backgroundColor = 'red';

    this.shadowRoot!.appendChild(style);
    this.shadowRoot!.appendChild(this.container);

    this.player = new Player();

    // Setup loop handling
    this.setupLoopHandling();
  }

  static get observedAttributes() {
    return ['src', 'controls', 'viewer', 'loop'];
  }

  async connectedCallback() {
    // Initialize viewer first if needed
    if (this.hasAttribute('viewer')) {
      await this.initViewer();
    }

    // Then initialize controls (they need the viewer container)
    if (this.hasAttribute('controls')) {
      this.initControls();
    }

    // Load song if src is provided
    if (this.hasAttribute('src')) {
      await this.player.loadSong(this.getAttribute('src')!);
    }

    if (this.hasAttribute('loop')) {
      this.loop = true;
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'src':
        if (newValue) {
          this.player.loadSong(newValue).catch(console.error);
        }
        break;

      case 'controls':
        if (newValue !== null) {
          // Ensure viewer is initialized before controls
          if (this.hasAttribute('viewer') && !this.viewer) {
            this.initViewer()
              .then(() => this.initControls())
              .catch(console.error);
          } else {
            this.initControls();
          }
        } else {
          this.removeControls();
        }
        break;

      case 'viewer':
        if (newValue !== null) {
          this.initViewer().catch(console.error);
        } else {
          this.removeViewer();
        }
        break;

      case 'loop':
        this.loop = newValue !== null;
        break;
    }
  }

  // TODO: other <video> element attributes (autoplay, loop, controlslist, muted, disablepictureinpicture, poster)
  // TODO: implement an event interface similar to <video>
  // TODO: default controls should be similar to styling <video> element controls:
  // https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Audio_and_video_delivery/Video_player_styling_basics

  private initControls() {
    // Remove existing controls if any
    this.removeControls();

    // Create default controls
    this.defaultControls = new DefaultControls(this.player);
    const overlay = this.defaultControls.getOverlay();

    // Append overlay to the container (not shadow root) so it's positioned over the viewer
    this.container.appendChild(overlay);

    // Connect default controls
    this.defaultControls.onConnect(this.player);
  }

  private removeControls() {
    if (this.defaultControls) {
      this.defaultControls.destroy();
      this.defaultControls = null;
    }
    const overlay = this.container.querySelector('player-overlay');
    if (overlay) {
      this.container.removeChild(overlay);
    }
  }

  private setupLoopHandling() {
    // Loop handling is now done in the Player class
    // The loop attribute is synced via the getter/setter
  }

  private async initViewer() {
    if (this.viewer) {
      // Viewer already initialized
      return;
    }

    const viewerType = this.getAttribute('viewer') || 'piano-roll';

    // Create and initialize viewer
    this.viewer = new Viewer(this.container);
    await this.viewer.init();

    // Set default view (piano roll for now)
    // TODO: get viewer as key from available viewers (e.g. piano-roll); raise if view is not found
    if (viewerType === 'piano-roll') {
      this.viewer.setView(new PianoRollView());
    }

    // Connect viewer to player
    this.player.viewer = this.viewer;

    // If controls are already initialized, reinitialize them to ensure overlay is on top
    if (this.hasAttribute('controls')) {
      this.initControls();
    }
  }

  private removeViewer() {
    if (this.viewer) {
      // Cleanup viewer if needed
      this.viewer = null;
      this.player.viewer = undefined;
    }
  }

  get controls() {
    return this.hasAttribute('controls');
  }

  set controls(value: boolean) {
    if (value) {
      this.setAttribute('controls', '');
    } else {
      this.removeAttribute('controls');
    }
  }

  get loop() {
    return this._loop;
  }

  set loop(value: boolean) {
    this._loop = value;
    this.player.loop = value;
    if (value) {
      this.setAttribute('loop', '');
    } else {
      this.removeAttribute('loop');
    }
  }

  // Expose player and viewer for external access
  get playerInstance(): Player {
    return this.player;
  }

  get viewerInstance(): Viewer | null {
    return this.viewer;
  }
}

customElements.define('nbs-player', NBSPlayer);
