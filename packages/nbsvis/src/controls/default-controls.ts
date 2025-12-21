import { Player } from '../player';
import { IPlayerControlWidget, IPlayer } from './interface';
// Side-effect imports to ensure custom elements are registered
import './widgets/default-play-button';
import './widgets/default-seek-bar';
import './widgets/default-volume-control';
import './widgets/default-settings-button';
import './widgets/default-fullscreen-button';
import './widgets/default-popout-button';
import './widgets/default-top-bar';
import './widgets/player-overlay';
// Type imports
import type { DefaultPlayButton } from './widgets/default-play-button';
import type { DefaultSeekBar } from './widgets/default-seek-bar';
import type { DefaultVolumeControl } from './widgets/default-volume-control';
import type { DefaultSettingsButton } from './widgets/default-settings-button';
import type { DefaultFullscreenButton } from './widgets/default-fullscreen-button';
import type { DefaultPopoutButton } from './widgets/default-popout-button';
import type { DefaultTopBar } from './widgets/default-top-bar';
import type { PlayerOverlay } from './widgets/player-overlay';

export class DefaultControls implements IPlayerControlWidget {
  private player: Player;
  private overlay!: PlayerOverlay;
  private playButton!: DefaultPlayButton;
  private seekBar!: DefaultSeekBar;
  private volumeControl!: DefaultVolumeControl;
  private settingsButton!: DefaultSettingsButton;
  private fullscreenButton!: DefaultFullscreenButton;
  private popoutButton!: DefaultPopoutButton;
  private topBar!: DefaultTopBar;
  private keyboardIndicator!: HTMLElement;
  private keyboardIndicatorTimeout: number | undefined;
  private keyboardHandlers: Map<string, () => void> = new Map();

  constructor(player: Player) {
    this.player = player;
    this.init();

    console.log('DefaultControls constructor', this.player);
  }

  private init() {
    // Create overlay
    this.overlay = document.createElement('player-overlay') as PlayerOverlay;

    // Create top bar
    this.topBar = document.createElement('default-top-bar') as DefaultTopBar;
    this.topBar.setAttribute('slot', 'top');
    this.overlay.appendChild(this.topBar);

    // Create bottom bar container
    const bottomBar = document.createElement('div');
    bottomBar.setAttribute('slot', 'bottom');
    bottomBar.style.cssText = `
      display: flex;
      flex-direction: column;
      padding: 0.75rem 1rem;
      gap: 0.5rem;
      pointer-events: auto;
    `;

    // Create seek bar container
    const seekContainer = document.createElement('div');
    seekContainer.style.cssText = 'width: 100%; margin-bottom: 0.25rem;';
    this.seekBar = document.createElement('default-seek-bar') as DefaultSeekBar;
    seekContainer.appendChild(this.seekBar);
    bottomBar.appendChild(seekContainer);

    // Create controls row
    const controlsRow = document.createElement('div');
    controlsRow.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0.5rem;
    `;

    // Left controls
    const leftControls = document.createElement('div');
    leftControls.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 0 0 auto;
    `;

    this.playButton = document.createElement('default-play-button') as DefaultPlayButton;
    leftControls.appendChild(this.playButton);

    // Right controls
    const rightControls = document.createElement('div');
    rightControls.style.cssText = `
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 0 0 auto;
      margin-left: auto;
    `;

    this.volumeControl = document.createElement('default-volume-control') as DefaultVolumeControl;
    rightControls.appendChild(this.volumeControl);

    this.popoutButton = document.createElement('default-popout-button') as DefaultPopoutButton;
    rightControls.appendChild(this.popoutButton);

    this.settingsButton = document.createElement(
      'default-settings-button',
    ) as DefaultSettingsButton;
    rightControls.appendChild(this.settingsButton);

    this.fullscreenButton = document.createElement(
      'default-fullscreen-button',
    ) as DefaultFullscreenButton;
    rightControls.appendChild(this.fullscreenButton);

    controlsRow.appendChild(leftControls);
    controlsRow.appendChild(rightControls);
    bottomBar.appendChild(controlsRow);

    this.overlay.appendChild(bottomBar);

    // Create keyboard indicator
    this.keyboardIndicator = document.createElement('div');
    this.keyboardIndicator.className = 'nbs-controls-keyboard-indicator';
    // Add styles inline since it's outside shadow DOM
    this.keyboardIndicator.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 1rem 2rem;
      border-radius: 8px;
      font-size: 1.5rem;
      font-weight: 500;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    `;
    document.body.appendChild(this.keyboardIndicator);

    // Connect all widgets (wait for custom elements to be defined and upgraded)
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      this.connectWidgetsAsync();
    });

    // Setup keyboard controls
    this.setupKeyboardControls();
  }

  onConnect(_player: IPlayer) {
    // This method is called by the Controls system
    // Widgets are already connected in init()
    // Player is already set in constructor
    void _player;
  }

  private async connectWidgetsAsync() {
    const widgetNames = [
      'default-top-bar',
      'default-play-button',
      'default-seek-bar',
      'default-volume-control',
      'default-settings-button',
      'default-fullscreen-button',
      'default-popout-button',
    ];

    // Wait for all custom elements to be defined
    await Promise.all(widgetNames.map((name) => customElements.whenDefined(name)));

    const widgets: IPlayerControlWidget[] = [
      this.topBar,
      this.playButton,
      this.seekBar,
      this.volumeControl,
      this.settingsButton,
      this.fullscreenButton,
      this.popoutButton,
    ];

    widgets.forEach((widget) => {
      // Player implements IPlayer interface
      console.log('Connecting widget', widget);
      if (widget && typeof widget.onConnect === 'function') {
        widget.onConnect(this.player as IPlayer);
      } else {
        console.warn('Widget does not have onConnect method:', widget);
      }
    });
  }

  private setupKeyboardControls() {
    // Play/Pause (Space)
    this.keyboardHandlers.set(' ', () => {
      if (this.player.isPlaying) {
        this.player.pause();
      } else {
        this.player.play();
      }
      this.showKeyboardIndicator('Play/Pause');
    });

    // Mute (M)
    this.keyboardHandlers.set('m', () => {
      // TODO: Implement mute toggle
      this.showKeyboardIndicator('Mute');
    });

    // Seek backward 5 seconds (Left Arrow)
    this.keyboardHandlers.set('ArrowLeft', () => {
      const currentTick = this.player.audioEngine.currentTick;
      const newTick = Math.max(0, currentTick - 5 * 20); // Approximate 5 seconds (assuming 20 ticks/second)
      this.player.seek(newTick);
      this.showKeyboardIndicator('← 5s');
    });

    // Seek forward 5 seconds (Right Arrow)
    this.keyboardHandlers.set('ArrowRight', () => {
      const currentTick = this.player.audioEngine.currentTick;
      const maxTick = this.player.song?.length || 0;
      const newTick = Math.min(maxTick, currentTick + 5 * 20); // Approximate 5 seconds
      this.player.seek(newTick);
      this.showKeyboardIndicator('→ 5s');
    });

    // Fullscreen (F)
    this.keyboardHandlers.set('f', () => {
      // TODO: Implement fullscreen toggle
      this.showKeyboardIndicator('Fullscreen');
    });

    // Add event listener
    document.addEventListener('keydown', (e) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key;
      const handler = this.keyboardHandlers.get(key);

      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }

  private showKeyboardIndicator(text: string) {
    this.keyboardIndicator.textContent = text;
    this.keyboardIndicator.style.opacity = '1';

    clearTimeout(this.keyboardIndicatorTimeout);
    this.keyboardIndicatorTimeout = window.setTimeout(() => {
      this.keyboardIndicator.style.opacity = '0';
    }, 1000);
  }

  getOverlay(): PlayerOverlay {
    return this.overlay;
  }

  destroy() {
    // Cleanup
    if (this.keyboardIndicatorTimeout) {
      clearTimeout(this.keyboardIndicatorTimeout);
    }
    if (this.keyboardIndicator.parentNode) {
      this.keyboardIndicator.parentNode.removeChild(this.keyboardIndicator);
    }
  }
}
