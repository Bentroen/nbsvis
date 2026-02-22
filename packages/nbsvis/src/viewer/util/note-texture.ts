import { Container, Graphics, Rectangle, Renderer, Sprite, Texture } from 'pixi.js';

export class NoteTextureAtlas {
  private _textureSize: number;
  private textures: Texture[];
  private atlasTexture?: Texture;

  constructor(
    private renderer: Renderer,
    private noteBlockTexture: Texture,
    private colors: (number | string)[],
  ) {
    this._textureSize = noteBlockTexture.width; // assuming square texture
    this.textures = this.generateTextures();
  }

  get textureSize(): number {
    return this._textureSize;
  }

  getTexture(instrument: number): Texture {
    return this.textures[instrument % this.textures.length];
  }

  private generateTextures(): Texture[] {
    const textures: Texture[] = [];

    console.log('Generating note textures...');

    const container = new Container();

    const size = this.textureSize;

    for (let i = 0; i < this.colors.length; i++) {
      const offsetX = i * size;

      // Background
      const rect = new Graphics().rect(0, 0, size, size).fill(this.colors[i]);
      rect.x = offsetX;

      container.addChild(rect);

      // Overlay block texture
      const overlay = new Sprite(this.noteBlockTexture);
      overlay.width = size;
      overlay.height = size;
      overlay.x = offsetX;
      overlay.blendMode = 'hard-light';
      overlay.alpha = 0.67;

      container.addChild(overlay);
    }

    // Bake into a single sprite-sheet texture
    this.atlasTexture = this.renderer.generateTexture(container);
    this.atlasTexture.source.scaleMode = 'nearest';

    for (let i = 0; i < this.colors.length; i++) {
      const frame = new Rectangle(i * size, 0, size, size);
      const texture = new Texture({ source: this.atlasTexture.source, frame });
      textures.push(texture);
    }

    // Cleanup temp display objects
    container.destroy({ children: true });

    console.log('Note textures generated.');

    return textures;
  }
}
