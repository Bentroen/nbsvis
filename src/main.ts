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
