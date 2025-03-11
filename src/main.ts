import { Application, Assets, Container, Graphics, Sprite } from 'pixi.js';

import { drawPiano } from './piano';

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

const pianoContainer = new Container();
drawPiano(pianoContainer);
app.stage.addChild(pianoContainer);
