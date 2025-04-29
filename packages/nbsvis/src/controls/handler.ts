import { Player } from '../player';

interface IPlayButton extends HTMLElement {
  playing: boolean;
}

interface ISeekBar extends HTMLElement {
  value: number;
  max: number;
}

export class PlayerControlHandler {
  private player: Player;
  private playButton: IPlayButton;
  private seekBar: ISeekBar;

  constructor(player: Player, playButton: IPlayButton, seekBar: ISeekBar) {
    this.player = player;
    this.playButton = playButton;
    this.seekBar = seekBar;

    this.attachEventListeners();
    this.initializeSeekBar();
  }

  private attachEventListeners() {
    this.playButton.addEventListener('toggleplay', () => {
      if (this.player.isPlaying) {
        this.player.pause();
      } else {
        this.player.play();
      }
      this.playButton.playing = this.player.isPlaying;
    });

    this.seekBar.addEventListener('seek', (event: Event) => {
      const customEvent = event as CustomEvent<{ tick: number }>;
      this.player.seek(customEvent.detail.tick);
    });

    this.player.on('seek', (tick: number) => {
      this.seekBar.value = tick;
    });

    //this.player.on('ended', () => {
    //  this.playButton.playing = false;
    //});
  }

  private initializeSeekBar() {
    this.seekBar.max = this.player.getTotalTicks();
  }
}

export class PlayerControlHandler {
  private player: Player;

  private playButtons: IPlayButton[] = [];
  private seekBars: ISeekBar[] = [];

  constructor(player: Player, options?: { template?: HTMLTemplateElement }) {
    this.player = player;

    const template = options?.template ?? this.createDefaultTemplate();
    this.init(template);
  }

  private init(template: HTMLTemplateElement) {
    const content = template.content.cloneNode(true) as DocumentFragment;

    const playButtons = content.querySelectorAll('play-button');
    playButtons.forEach((button) => this.registerPlayButton(button as IPlayButton));

    const seekBars = content.querySelectorAll('seek-bar');
    seekBars.forEach((seekbar) => this.registerSeekBar(seekbar as ISeekBar));

    const container = this.player.viewer?.app?.canvas?.parentElement;
    if (container) {
      container.appendChild(content);
    }
  }

  /** Register a new PlayButton manually */
  registerPlayButton(button: IPlayButton) {
    this.playButtons.push(button);

    button.addEventListener('click', () => {
      this.player.isPlaying ? this.player.pause() : this.player.play();
    });

    // Initial sync
    button.state = this.player.isPlaying ? 'playing' : 'paused';
  }

  registerSeekBar(seekBar: ISeekBar) {
    this.seekBars.push(seekBar);

    seekBar.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const tick = parseInt(target.value, 10);
      this.player.seek(tick);
    });

    // Initial sync
    seekBar.value = this.player.currentTick ?? 0;
    seekBar.max = this.player.totalTicks ?? 100;
  }

  /** Should be called once on player event listeners setup */
  wirePlayerEvents() {
    this.player.on('play', () => {
      this.playButtons.forEach((button) => (button.state = 'playing'));
    });
    this.player.on('pause', () => {
      this.playButtons.forEach((button) => (button.state = 'paused'));
    });
    this.player.on('seek', (e) => {
      this.seekBars.forEach((seekbar) => {
        seekbar.value = e.tick;
        seekbar.max = e.totalLength;
      });
    });
  }

  private createDefaultTemplate(): HTMLTemplateElement {
    const template = document.createElement('template');
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
    `;
    return template;
  }
}
