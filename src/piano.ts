import { Container, Graphics } from 'pixi.js';

const WHITE_KEY_WIDTH = 35;
const WHITE_KEY_HEIGHT = 113;
const BLACK_KEY_WIDTH_FACTOR = 2 / 3;
const BLACK_KEY_HEIGHT_FACTOR = 2 / 3;

const BLACK_KEY_POSITIONS = new Set([1, 3, 6, 8, 10]);

abstract class KeyItem {
  sprite: Graphics;

  constructor(posX: number) {
    this.sprite = this.draw(posX);
  }

  abstract draw(posX: number): Graphics;
}

class BlackKeyItem extends KeyItem {
  draw(posX: number) {
    const key = new Graphics();
    const width = WHITE_KEY_WIDTH * BLACK_KEY_WIDTH_FACTOR;
    const height = WHITE_KEY_HEIGHT * BLACK_KEY_HEIGHT_FACTOR;
    key.rect(0, 0, width, height);
    key.fill(0x000000);
    key.position.set(posX + (width - WHITE_KEY_WIDTH) / 2 - 3, 0);
    return key;
  }
}

class WhiteKeyItem extends KeyItem {
  draw(posX: number) {
    const key = new Graphics();
    key.rect(0, 3, WHITE_KEY_WIDTH, WHITE_KEY_HEIGHT);
    key.fill(0xffffff);
    key.position.set(posX, 0);
    return key;
  }
}

export class PianoManager {
  container: Container;
  keys: Array<KeyItem> = [];
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
      const isBlackKey = BLACK_KEY_POSITIONS.has(i % 12);
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

  update(notesToPlay: Array<number>) {
    for (const note of notesToPlay) {
      const key = this.keys[note];
      key.sprite.tint = 0xff0000;
    }
  }
}
