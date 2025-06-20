export class SeekBar extends HTMLElement {
  private input!: HTMLInputElement;
  private _value = 0;
  private _max = 100;

  constructor() {
    super();
  }

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.render();

    this.input = this.shadowRoot!.querySelector('input')!;
    this.input.addEventListener('input', () => {
      const tick = Number(this.input.value);
      this.dispatchEvent(
        new CustomEvent('seek', {
          detail: { tick },
          bubbles: true,
        }),
      );
    });
  }

  get value() {
    return this._value;
  }

  set value(val: number) {
    this._value = val;
    if (this.input) {
      this.input.value = val.toString();
    }
  }

  get max() {
    return this._max;
  }

  set max(val: number) {
    this._max = val;
    if (this.input) {
      this.input.max = val.toString();
    }
  }

  private render() {
    this.shadowRoot!.innerHTML = `
      <input type="range" min="0" max="100" value="0">
    `;
  }
}

customElements.define('seek-bar', SeekBar);

/*

export class SeekBar extends HTMLElement {
  shadow: ShadowRoot;
  input: HTMLInputElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });

    this.shadow.innerHTML = `
      <style>
        input[type="range"] {
          width: 100%;
        }
      </style>
      <input type="range" min="0" max="100" value="0" />
    `;

    this.input = this.shadow.querySelector('input')!;
  }

  set value(val: number) {
    this.input.value = val.toString();
  }

  set max(val: number) {
    this.input.max = val.toString();
  }
}

customElements.define('seek-bar', SeekBar);

*/
