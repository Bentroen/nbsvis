import { Container, Graphics } from 'pixi.js';

const WHITE_KEY_WIDTH = 35;
const WHITE_KEY_HEIGHT = 113;
const BLACK_KEY_WIDTH_FACTOR = 2 / 3;
const BLACK_KEY_HEIGHT_FACTOR = 2 / 3;

const BLACK_KEY_POSITIONS = new Set([1, 3, 6, 8, 10]);

export function drawPiano(container: Container) {
  const blackKeys: Array<Graphics> = [];
  const blackKeyWidth = WHITE_KEY_WIDTH * BLACK_KEY_WIDTH_FACTOR;
  const blackKeyHeight = WHITE_KEY_HEIGHT * BLACK_KEY_HEIGHT_FACTOR;

  const keyPositions = [];

  let x = 0;

  for (let i = 0; i <= 87; i++) {
    if (BLACK_KEY_POSITIONS.has((i + 9) % 12)) {
      const blackKey = new Graphics();
      blackKey.rect(0, 0, blackKeyWidth, blackKeyHeight);
      blackKey.fill(0x000000);
      blackKey.position.set(x + (blackKeyWidth - WHITE_KEY_WIDTH) / 2 - 3, 0);
      blackKeys.push(blackKey);
      keyPositions.push(blackKey.position.x);
    } else {
      const whiteKey = new Graphics();
      whiteKey.rect(0, 3, WHITE_KEY_WIDTH, WHITE_KEY_HEIGHT);
      whiteKey.fill(0xffffff);
      whiteKey.position.set(x, 0);
      container.addChild(whiteKey);
      keyPositions.push(whiteKey.position.x);
      x += WHITE_KEY_WIDTH + 2;
    }
  }

  for (const blackKey of blackKeys) {
    container.addChild(blackKey);
  }

  return keyPositions;
}
