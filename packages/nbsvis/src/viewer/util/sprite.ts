import { Container, Sprite, Texture } from 'pixi.js';

class SpritePool {
  private pool: Sprite[] = [];

  constructor(size: number, texture: Texture, container: Container) {
    for (let i = 0; i < size; i++) {
      const sprite = new Sprite(texture);
      sprite.visible = false;
      container.addChild(sprite); // add once, never remove
      this.pool.push(sprite);
    }
  }

  acquire(): Sprite {
    const sprite = this.pool.pop();
    if (!sprite) {
      throw new Error('Sprite pool exhausted');
    }
    sprite.visible = true;
    return sprite;
  }

  release(sprite: Sprite) {
    sprite.visible = false;
    this.pool.push(sprite);
  }
}

export default SpritePool;
