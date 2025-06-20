import { Player } from '../../player';
import { Viewer } from '../../viewer';
import { Controls } from '../handler';

export class NBSPlayer extends HTMLElement {
  private player: Player;

  private controls: Controls;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot!.innerHTML = ``;

    this.player = new Player();
    this.controls = new Controls(this.player);
  }

  static get observedAttributes() {
    return ['src', 'controls', 'viewer']
  }

  connectedCallback() {
    if (this.hasAttribute('source')) {
      this.player.loadSong(this.getAttribute('source')!);
    }
    if (this.hasAttribute('controls')) {
      this.initControls();
    }
    if (this.hasAttribute('viewer')) {
      this.initViewer();
    }
  }

attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'controls':
        if (newValue !== null) {
          this.initControls();
        } else {
          this.removeControls();
        }
        break;

      case 'viewer':
        if (newValue !== null) {
          this.initViewer();
        } else {
          this.removeViewer();
        }
        break;
    }
  }

  // TODO: other <video> element attributes (autoplay, loop, controlslist, muted, disablepictureinpicture, poster) 
  // TODO: implement an event interface similar to <video></video>
  // TODO: default controls should be similar to styling <video> element controls:
  // https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Audio_and_video_delivery/Video_player_styling_basics

  private initControls() {
    const template = this.getDefaultTemplate();
    this.shadowRoot!.appendChild(template.content.cloneNode(true));
    // TODO: hook events
  }

  private removeControls() {
    const overlay = this.shadowRoot!.querySelector('player-overlay');
    if (overlay) {
      this.shadowRoot!.removeChild(overlay);
    }
  }

  private initViewer() {
    const viewer = this.getAttribute('viewer')!;
    // TODO: get viewer as key from available viewers (e.g. piano-roll); raise if view is not found
    if (viewer) {
      this.player.viewer = new Viewer(this.shadowRoot!);
    }
  }


    get controls() {
      return this.hasAttribute('controls');
    }

    set controls(value: boolean) {
      // Reflect the value of `disabled` as an attribute.
      if (value) {
        this.setAttribute('controls', '');
      } else {
        this.removeAttribute('controls');
      }
    }
  }


  // TODO: check this implementation:

  // get controlsEnabled(): boolean {
  //   return this.hasAttribute('controls');
  // }
  
  // set controlsEnabled(value: boolean) {
  //   if (value) {
  //     this.setAttribute('controls', '');
  //   } else {
  //     this.removeAttribute('controls');
  //   }
  // }
  
  // get viewerInstance(): Viewer | null {
  //   return this.viewer;
  // }
  
  // set viewerInstance(value: Viewer | null) {
  //   if (value) {
  //     this.setAttribute('viewer', 'true');
  //     this.viewer = value;
  //   } else {
  //     this.removeAttribute('viewer');
  //     this.viewer = null;
  //   }
  // }


  private getDefaultTemplate(): HTMLTemplateElement {
    const template = document.createElement('template');
    template.innerHTML = `
      <div id="video-controls" class="controls">
        <button id="play-pause" type="button">Play/Pause</button>
        <button id="stop" type="button">Stop</button>
        <input class="progress">
          <progress id="progress" value="0" min="0"></progress>
        </input>
        <li><button id="mute" type="button">Mute/Unmute</button></li>
        <li><button id="vol-inc" type="button">Vol+</button></li>
        <li><button id="vol-dec" type="button">Vol-</button></li>
        <li><button id="fs" type="button">Fullscreen</button></li>
      </div>
    `;

    template.innerHTML = `
      <player-overlay>
        <player-bar slot="top">
          <h2 class="song-title"></h2>
        </player-bar>
        <player-bar slot="bottom">
          <play-button></play-button>
          <seek-bar></seek-bar>
        </player-bar>
      </player-overlay>
    `
        
    return template;
  }
}

customElements.define('nbs-player', NBSPlayer);
function disabled(val: any) {
  throw new Error('Function not implemented.');
}

