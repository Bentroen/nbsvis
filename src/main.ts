import { Application, Assets, Graphics, Sprite } from 'pixi.js';

const app = new Application();

await app.init({
  backgroundColor: 0x1099bb,
  resizeTo: window,
});

document.getElementById('app')?.appendChild(app.view);

const graphics = new Graphics();
graphics.rect(100, 100, 200, 200);
graphics.fill(0xff0000);
app.stage.addChild(graphics); // Add the graphics to the PixiJS stage

const texture = await Assets.load('https://pixijs.com/assets/bunny.png');

const noteBlockSprite = new Sprite(texture);
noteBlockSprite.position.set(250, 100);
app.stage.addChild(noteBlockSprite);

noteBlockSprite.anchor.set(0.5);

noteBlockSprite.x = app.screen.width / 2;
noteBlockSprite.y = app.screen.height / 2;

noteBlockSprite.scale.set(2);

app.ticker.add((time) => {
  noteBlockSprite.rotation += 0.1 * time.deltaTime;
});

//----------------------------------------------------------------

function mod(a: number, b: number) {
  return ((a % b) + b) % b;
}

const blackKeyPositions = new Set([1, 3, 6, 8, 10]);

const WHITE_KEY_WIDTH = 34;
const WHITE_KEY_HEIGHT = 113;
const BLACK_KEY_WIDTH_FACTOR = 2 / 3;
const BLACK_KEY_HEIGHT_FACTOR = 2 / 3;

let x = 0;
const blackKeys: Array<Graphics> = [];
const blackKeyWidth = WHITE_KEY_WIDTH * BLACK_KEY_WIDTH_FACTOR;
const blackKeyHeight = WHITE_KEY_HEIGHT * BLACK_KEY_HEIGHT_FACTOR;
for (let i = 0; i <= 87; i++) {
  if (blackKeyPositions.has(mod(i - 3, 12))) {
    console.log(i);
    const blackKey = new Graphics();
    blackKey.rect(0, 0, blackKeyWidth, blackKeyHeight);
    blackKey.fill(0x000000);
    blackKey.position.set(x + (blackKeyWidth - WHITE_KEY_WIDTH) / 2 - 3, 0);
    blackKeys.push(blackKey);
  } else {
    const whiteKey = new Graphics();
    whiteKey.rect(0, 3, WHITE_KEY_WIDTH, WHITE_KEY_HEIGHT);
    whiteKey.fill(0xffffff);
    whiteKey.position.set(x, 0);
    app.stage.addChild(whiteKey);
    x += WHITE_KEY_WIDTH + 2;
  }
}
for (const blackKey of blackKeys) {
  app.stage.addChild(blackKey);
}
