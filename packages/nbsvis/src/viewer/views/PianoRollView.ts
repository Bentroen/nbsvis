import { Song } from '@encode42/nbs.js';
import { Container, ParticleContainer, Texture } from 'pixi.js';

import { ViewAssetDescriptor, viewerAssets } from '../../assets';
import { NoteBuffer } from '../../note';
import { BaseView } from '../viewer';
import { NoteManager } from '../widgets/note';
import { PianoManager } from '../widgets/piano';

type PianoRollTextures = {
  noteBlockTexture: Texture;
  whiteKeyTexture: Texture;
  blackKeyTexture: Texture;
};

export class PianoRollView extends BaseView {
  pianoManager!: PianoManager;
  pianoContainer: Container = new Container();
  noteManager!: NoteManager;
  noteContainer: ParticleContainer = new ParticleContainer();
  private textures?: PianoRollTextures;

  public getAssetRequirements(): Array<ViewAssetDescriptor> {
    return [
      viewerAssets.noteBlockTexture,
      viewerAssets.whiteKeyTexture,
      viewerAssets.blackKeyTexture,
    ];
  }

  public setAssets(assets: Map<string, unknown>) {
    const noteBlockTexture = assets.get(viewerAssets.noteBlockTexture.id);
    const whiteKeyTexture = assets.get(viewerAssets.whiteKeyTexture.id);
    const blackKeyTexture = assets.get(viewerAssets.blackKeyTexture.id);

    if (!noteBlockTexture || !whiteKeyTexture || !blackKeyTexture) {
      throw new Error('PianoRollView missing required assets');
    }

    this.textures = {
      noteBlockTexture: noteBlockTexture as Texture,
      whiteKeyTexture: whiteKeyTexture as Texture,
      blackKeyTexture: blackKeyTexture as Texture,
    };
  }

  draw() {
    if (!this.textures) {
      throw new Error(
        'PianoRollView assets not injected. Ensure Viewer.init() runs before drawing.',
      );
    }

    const renderer = this.context.renderer;
    if (!renderer) {
      throw new Error(
        'PianoRollView renderer context not bound. Ensure Viewer.init() has completed.',
      );
    }

    this.pianoContainer = new Container();
    this.pianoManager = new PianoManager(
      this.pianoContainer,
      this.textures.whiteKeyTexture,
      this.textures.blackKeyTexture,
    );
    this.pianoContainer.position.set(0, this.stage.height - this.pianoContainer.height - 10);

    this.noteManager = new NoteManager(
      renderer,
      this.noteContainer,
      this.pianoManager.keyPositions,
      this.textures.noteBlockTexture,
    );

    this.noteContainer.position.set(0, 0);
    this.stage.addChild(this.noteContainer);
    this.stage.addChild(this.pianoContainer);

    this.ticker.add((time) => {
      const notesToPlay = this.noteManager.update(this.currentTick);
      this.pianoManager.update(time.elapsedMS, notesToPlay);
    });
  }

  redraw(width: number, _: number) {
    this.pianoManager.redraw(width);
    this.noteManager.redraw(width);
  }

  loadSong(_: Song, noteData: NoteBuffer) {
    this.noteManager.setSong(noteData);
    this.noteManager.redraw(this.stage.width);
    this.pianoManager.redraw(this.stage.width);
  }

  resize(width: number, height: number) {
    this.pianoManager.redraw(width);
    this.noteManager.redraw(width);
    this.pianoContainer.position.set(0, height - this.pianoContainer.height - 10);
    this.noteContainer.position.set(0, 0);
    this.noteManager.setKeyPositions(this.pianoManager.keyPositions);
    this.noteManager.setPianoHeight(this.pianoContainer.height);
    this.noteManager.setScreenHeight(height);
  }
}
