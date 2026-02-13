import { Container, Sprite, Texture } from 'pixi.js';

class SpritePool {
  private pool: Sprite[] = [];
  private container: Container;
  private texture: Texture;
  private growthStep: number;

  constructor(size: number, texture: Texture, container: Container) {
    this.container = container;
    this.texture = texture;
    this.growthStep = Math.max(32, Math.floor(size * 0.25));
    this.expand(size);
  }

  acquire(): Sprite {
    if (this.pool.length === 0) {
      this.expand();
    }
    const sprite = this.pool.pop();
    if (!sprite) {
      throw new Error('Failed to acquire sprite from pool');
    }
    sprite.visible = true;
    return sprite;
  }

  release(sprite: Sprite) {
    sprite.visible = false;
    this.pool.push(sprite);
  }

  expand(count = this.growthStep) {
    for (let i = 0; i < count; i++) {
      this.createSprite();
    }
  }

  private createSprite(): Sprite {
    const sprite = new Sprite(this.texture);
    sprite.visible = false;
    this.container.addChild(sprite); // add once, never remove
    this.pool.push(sprite);
    return sprite;
  }

  destroy() {
    for (const sprite of this.pool) {
      this.container.removeChild(sprite);
      sprite.destroy();
    }
    this.pool.length = 0;
  }
}

export default SpritePool;
