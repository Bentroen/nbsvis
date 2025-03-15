import { Container, Graphics } from 'pixi.js';

const WHITE_KEY_WIDTH = 35;
const WHITE_KEY_HEIGHT = 113;
const BLACK_KEY_WIDTH_FACTOR = 2 / 3;
const BLACK_KEY_HEIGHT_FACTOR = 2 / 3;

const BLACK_KEY_POSITIONS = new Set([1, 3, 6, 8, 10]);

const KEY_ANIMATION_TIME_MS = 200;

abstract class KeyItem {
  sprite: Container;

  animationTime = 0;

  constructor(posX: number) {
    this.sprite = this.draw(posX);
  }

  abstract draw(posX: number): Container;

  play() {
    this.animationTime = KEY_ANIMATION_TIME_MS;
    this.sprite.alpha = 0.5;
    this.sprite.y = 5;
  }

  reset() {
    this.sprite.alpha = 1;
    this.sprite.y = 0;
  }

  update(deltaTime: number) {
    this.animationTime -= deltaTime;
  }
}

class BlackKeyItem extends KeyItem {
  draw(posX: number) {
    const container = new Container();
    const key = new Graphics();
    const width = WHITE_KEY_WIDTH * BLACK_KEY_WIDTH_FACTOR;
    const height = WHITE_KEY_HEIGHT * BLACK_KEY_HEIGHT_FACTOR;
    key.rect(0, 0, width, height);
    key.fill(0x000000);
    container.position.set(posX + (width - WHITE_KEY_WIDTH) / 2 - 3, 0);
    container.addChild(key);
    return container;
  }
}

class WhiteKeyItem extends KeyItem {
  draw(posX: number) {
    const container = new Container();
    const key = new Graphics();
    key.rect(0, 3, WHITE_KEY_WIDTH, WHITE_KEY_HEIGHT);
    key.fill(0xffffff);
    container.position.set(posX, 0);
    container.addChild(key);
    return container;
  }
}

export class PianoManager {
  container: Container;
  keys: Array<KeyItem> = [];
  playingKeys: Set<KeyItem> = new Set();
  keyPositions: Array<number> = [];

  constructor(container: Container) {
    this.container = container;
    this.draw();
  }

  private draw() {
    const blackKeys: Array<BlackKeyItem> = [];

    let x = 0;

    for (let i = 0; i <= 87; i++) {
      let key: KeyItem;
      const isBlackKey = BLACK_KEY_POSITIONS.has((i + 9) % 12);
      if (isBlackKey) {
        key = new BlackKeyItem(x);
        blackKeys.push(key);
      } else {
        key = new WhiteKeyItem(x);
        this.container.addChild(key.sprite);
        x += WHITE_KEY_WIDTH + 2;
      }
      this.keys.push(key);
      this.keyPositions.push(key.sprite.position.x);
    }

    for (const key of blackKeys) {
      this.container.addChild(key.sprite);
    }
  }

  update(deltaTimeMs: number, notesToPlay: Array<number>) {
    for (const note of notesToPlay) {
      const key = this.keys[note];
      key.play();
      this.playingKeys.add(key);
    }

    for (const key of this.playingKeys) {
      key.update(deltaTimeMs);
      if (key.animationTime <= 0) {
        key.reset();
      }
    }
  }
}
