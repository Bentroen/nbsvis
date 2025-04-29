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

  private render() {
    this.shadowRoot!.innerHTML = `
      <style>
        button {
          all: unset;
          padding: 0.5rem 1rem;
          background: #eee;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background: #ddd;
        }
      </style>
      <button>Play</button>
    `;
  }
}

customElements.define('play-button', PlayButton);
