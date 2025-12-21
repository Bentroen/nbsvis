import { IPlayer, IPlayerControlWidget } from '../interface';
import { Player } from '../../../player';

export class DefaultTopBar extends HTMLElement implements IPlayerControlWidget {
  private shadow: ShadowRoot;
  private player: Player | null = null;
  private titleElement: HTMLElement;
  private authorElement: HTMLElement;
  private originalAuthorElement: HTMLElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.init();
  }

  private init() {
    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
      }
      .top-bar {
        display: flex;
        flex-direction: column;
        padding: 1rem 1.5rem;
        gap: 0.25rem;
        pointer-events: auto;
      }
      .song-title {
        font-size: 1.125rem;
        font-weight: 500;
        color: white;
        margin: 0;
        line-height: 1.4;
      }
      .song-author {
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.7);
        margin: 0;
        line-height: 1.4;
      }
      .song-original-author {
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
        line-height: 1.4;
      }
    `;

    const container = document.createElement('div');
    container.className = 'top-bar';

    this.titleElement = document.createElement('div');
    this.titleElement.className = 'song-title';
    this.titleElement.textContent = 'No song loaded';

    this.authorElement = document.createElement('div');
    this.authorElement.className = 'song-author';

    this.originalAuthorElement = document.createElement('div');
    this.originalAuthorElement.className = 'song-original-author';

    container.appendChild(this.titleElement);
    container.appendChild(this.authorElement);
    container.appendChild(this.originalAuthorElement);

    this.shadow.appendChild(style);
    this.shadow.appendChild(container);
  }

  onConnect(player: IPlayer) {
    this.player = player as Player;
    this.updateSongInfo();

    // Update when song changes (we'll need to listen for a song loaded event)
    // For now, we'll update periodically or when seek events fire
    player.on('seek', () => {
      // This is a workaround - ideally we'd have a 'songloaded' event
      this.updateSongInfo();
    });
  }

  updateSongInfo() {
    if (!this.player || !('song' in this.player) || !this.player.song) {
      this.titleElement.textContent = 'No song loaded';
      this.authorElement.textContent = '';
      this.originalAuthorElement.textContent = '';
      return;
    }

    const song = this.player.song;
    this.titleElement.textContent = song.meta.name || 'Untitled';
    this.authorElement.textContent = song.meta.author || '';

    if (song.meta.originalAuthor && song.meta.originalAuthor.trim() !== '') {
      this.originalAuthorElement.textContent = `Original by: ${song.meta.originalAuthor}`;
      this.originalAuthorElement.style.display = 'block';
    } else {
      this.originalAuthorElement.style.display = 'none';
    }
  }
}

customElements.define('default-top-bar', DefaultTopBar);





