import { Particle, ParticleContainer, Texture } from 'pixi.js';

class SpritePool {
  private pool: Particle[] = [];
  private container: ParticleContainer;
  private texture: Texture;
  private growthStep: number;

  constructor(size: number, texture: Texture, container: ParticleContainer) {
    this.container = container;
    this.texture = texture;
    this.growthStep = Math.max(32, Math.floor(size * 0.25));
    this.expand(size);
  }

  acquire(): Particle {
    if (this.pool.length === 0) {
      this.expand();
    }
    const sprite = this.pool.pop();
    if (!sprite) {
      throw new Error('Failed to acquire sprite from pool');
    }
    return sprite;
  }

  release(sprite: Particle) {
    sprite.alpha = 0;
    this.pool.push(sprite);
  }

  expand(count = this.growthStep) {
    for (let i = 0; i < count; i++) {
      this.createSprite();
    }
  }

  private createSprite(): Particle {
    const sprite = new Particle({ texture: this.texture });
    this.container.addParticle(sprite); // add once, never remove
    this.pool.push(sprite);
    return sprite;
  }

  destroy() {
    this.container.removeParticles();
    this.pool.length = 0;
  }
}

export default SpritePool;
