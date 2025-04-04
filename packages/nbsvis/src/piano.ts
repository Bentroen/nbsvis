import { Assets, Container, Graphics, Sprite } from 'pixi.js';

import assetPaths from './assets';

const KEY_COUNT = 88;
export const WHITE_KEY_COUNT = Math.ceil((KEY_COUNT / 12) * 7);

let WHITE_KEY_WIDTH = 35;
let WHITE_KEY_HEIGHT = 113;
const BLACK_KEY_WIDTH_FACTOR = 2 / 3;
const BLACK_KEY_HEIGHT_FACTOR = 2 / 3;

const whiteKeyTexture = await Assets.load(assetPaths['img/key_white.png']);
const blackKeyTexture = await Assets.load(assetPaths['img/key_black.png']);

//whiteKeyTexture.source.scaleMode = 'nearest';
//blackKeyTexture.source.scaleMode = 'nearest';

const BLACK_KEY_POSITIONS = new Set([1, 3, 6, 8, 10]);

const PRESS_ANIM_DURATION_MS = 250;
let PRESS_TRAVEL_DISTANCE = 7;

function easeOutQuad(x: number): number {
  return 1 - (1 - x) * (1 - x);
}

abstract class KeyItem {
  sprite: Container;

  // 1.0 at the start, 0.0 when fully released
  animationProgress = 0;

  constructor(posX: number) {
    this.sprite = this.draw(posX);
  }

  abstract draw(posX: number): Container;

  play() {
    const progress = this.animationProgress;

    if (progress === 0) {
      // Idle
      this.animationProgress = 1.0;
    } else if (progress < 0.5) {
      // Lifting
      this.animationProgress = 1 - progress;
    } else {
      // Pressing (do nothing)
    }
  }

  update(deltaTimeMs: number) {
    this.animationProgress -= deltaTimeMs * (1 / PRESS_ANIM_DURATION_MS);
    this.animationProgress = Math.max(this.animationProgress, 0);

    const progress = this.animationProgress;
    const travelAmount = (progress > 0.5 ? 1 - progress : progress) * 2;
    const travelDistance = easeOutQuad(travelAmount) * PRESS_TRAVEL_DISTANCE;
    this.sprite.position.y = travelDistance;
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

    // Apply texture
    const textureSprite = new Sprite(blackKeyTexture);
    textureSprite.width = width;
    textureSprite.height = height;
    container.addChild(textureSprite);

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

    // Apply texture
    const textureSprite = new Sprite(whiteKeyTexture);
    textureSprite.width = WHITE_KEY_WIDTH;
    textureSprite.height = WHITE_KEY_HEIGHT;
    textureSprite.position.set(0, 3);
    textureSprite.anchor.set(0, 0);
    container.addChild(textureSprite);

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
      this.keyPositions.push(key.sprite.position.x + key.sprite.width / 2);
    }

    for (const key of blackKeys) {
      this.container.addChild(key.sprite);
    }
  }

  public updateKeySize(totalWidth: number) {
    const pianoKeyWidth = totalWidth / WHITE_KEY_COUNT - 2;

    WHITE_KEY_WIDTH = pianoKeyWidth;
    WHITE_KEY_HEIGHT = WHITE_KEY_WIDTH * 3.25;

    PRESS_TRAVEL_DISTANCE = WHITE_KEY_HEIGHT / 15;
  }

  public update(deltaTimeMs: number, notesToPlay: Array<number>) {
    for (const note of notesToPlay) {
      const key = this.keys[note];
      key.play();
      this.playingKeys.add(key);
    }

    for (const key of this.playingKeys) {
      key.update(deltaTimeMs);
      if (key.animationProgress <= 0) {
        this.playingKeys.delete(key);
      }
    }
  }

  public get pianoHeight(): number {
    return WHITE_KEY_HEIGHT;
  }

  public redraw(totalWidth: number) {
    this.container.removeChildren();
    this.keys = [];
    this.keyPositions = [];
    this.updateKeySize(totalWidth);
    this.draw();
  }
}
