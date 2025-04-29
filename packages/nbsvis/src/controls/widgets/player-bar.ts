export class PlayerBar extends HTMLElement {
  shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = `
      <style>
        :host {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: rgba(255, 255, 255, 0.1);
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          pointer-events: auto;
        }
      </style>

      <slot></slot>
    `;
  }
}

customElements.define('player-bar', PlayerBar);
