export class PlayerOverlay extends HTMLElement {
  shadow: ShadowRoot;
  private hideTimeout: number | undefined;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.init();
  }

  private init() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-rows: auto 1fr auto;
        background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%),
                    linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 50%);
        background-size: 100% 15%, 100% 15%;
        background-position: bottom, top;
        background-repeat: no-repeat;
        color: white;
        padding: 1rem;
        pointer-events: none;
        opacity: 1;
        transition: opacity 0.3s ease;
      }

      ::slotted([slot="top"]) {
        align-self: start;
        pointer-events: auto;
      }
      ::slotted([slot="bottom"]) {
        align-self: end;
        pointer-events: auto;
      }
    `;

    const topSlot = document.createElement('slot');
    topSlot.name = 'top';

    const spacer = document.createElement('div');

    const bottomSlot = document.createElement('slot');
    bottomSlot.name = 'bottom';

    this.shadow.appendChild(style);
    this.shadow.appendChild(topSlot);
    this.shadow.appendChild(spacer);
    this.shadow.appendChild(bottomSlot);

    this.setupHover();
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

customElements.define('player-overlay', PlayerOverlay);
