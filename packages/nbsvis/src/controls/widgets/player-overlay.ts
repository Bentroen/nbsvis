export class PlayerOverlay extends HTMLElement {
  shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = `
      <style>
        :host {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-rows: auto 1fr auto;
          background: linear-gradient(to top, rgba(0,0,0,0.8), transparent 50%);
          color: white;
          padding: 1rem;
          pointer-events: none;
        }

        ::slotted(player-bar[slot="top"]) {
          align-self: start;
          pointer-events: auto;
        }
        ::slotted(player-bar[slot="bottom"]) {
          align-self: end;
          pointer-events: auto;
        }
      </style>

      <slot name="top"></slot>
      <div></div> <!-- Spacer for central area -->
      <slot name="bottom"></slot>
    `;
  }
}

customElements.define('player-overlay', PlayerOverlay);
