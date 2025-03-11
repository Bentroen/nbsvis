import * as PIXI from 'pixi.js';

const app = new PIXI.Application();

await app.init({
  width: 800,
  height: 600,
  backgroundColor: 0x1099bb,
});

document.getElementById('app')?.appendChild(app.view);

const graphics = new PIXI.Graphics();
graphics.rect(100, 100, 200, 200);
graphics.fill(0xff0000);
app.stage.addChild(graphics); // Add the graphics to the PixiJS stage
