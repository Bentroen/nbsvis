import { Container, Graphics, Rectangle, Renderer, Sprite, Texture } from 'pixi.js';

export class NoteTextureAtlas {
  private textures: Texture[];
  private atlasTexture?: Texture;

  constructor(
    private renderer: Renderer,
    private blockSize: number,
    private noteBlockTexture: Texture,
    private colors: (number | string)[],
  ) {
    this.textures = this.generateTextures();
  }

  getTexture(instrument: number): Texture {
    return this.textures[instrument % this.textures.length];
  }

  private generateTextures(): Texture[] {
    const textures: Texture[] = [];

    console.log('Generating note textures...');

    const container = new Container();

    for (let i = 0; i < this.colors.length; i++) {
      const offsetX = i * this.blockSize;

      // Background
      const rect = new Graphics().rect(0, 0, this.blockSize, this.blockSize).fill(this.colors[i]);
      rect.x = offsetX;

      container.addChild(rect);

      // Overlay block texture
      const overlay = new Sprite(this.noteBlockTexture);
      overlay.width = this.blockSize;
      overlay.height = this.blockSize;
      overlay.x = offsetX;
      overlay.blendMode = 'hard-light';
      overlay.alpha = 0.67;

      container.addChild(overlay);
    }

    // Bake into a single sprite-sheet texture
    this.atlasTexture = this.renderer.generateTexture(container);
    this.atlasTexture.source.scaleMode = 'nearest';

    for (let i = 0; i < this.colors.length; i++) {
      const frame = new Rectangle(i * this.blockSize, 0, this.blockSize, this.blockSize);
      const texture = new Texture({ source: this.atlasTexture.source, frame });
      textures.push(texture);
    }

    // Cleanup temp display objects
    container.destroy({ children: true });

    console.log('Note textures generated.');

    return textures;
  }
}
