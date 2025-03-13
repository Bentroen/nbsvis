import { Application, Assets, Container, Graphics, Sprite, Text, TextureStyle } from 'pixi.js';

import { loadInstruments, playSong } from './audio';
import { loadSong, NoteManager } from './note';
import { drawPiano } from './piano';

TextureStyle.defaultOptions.scaleMode = 'nearest';

const app = new Application();

const appContainer = document.getElementById('app');

if (!appContainer) {
  throw new Error('App container not found');
}

await app.init({
  backgroundColor: 0x1099bb,
  resizeTo: window,
});

appContainer.appendChild(app.canvas);

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

const song = await loadSong('/song.nbs');

const pianoContainer = new Container();
const keyPositions = drawPiano(pianoContainer);
pianoContainer.position.set(0, app.screen.height - pianoContainer.height - 10);

const noteContainer = new Container();
const noteManager = new NoteManager(song, noteContainer, keyPositions);
noteContainer.position.set(0, 0);
app.stage.addChild(noteContainer);

app.stage.addChild(pianoContainer);

let currentTick = 0;

// Add label showing current FPS
const fpsLabel = new Text();
fpsLabel.x = 10;
fpsLabel.y = 10;
app.stage.addChild(fpsLabel);

// Add label showing current tick
const label = new Text();
label.x = 10;
label.y = 40;
app.stage.addChild(label);

app.ticker.add((time) => {
  currentTick += (time.elapsedMS / 1000) * song.tempo;
  label.text = `Tick: ${currentTick.toFixed(2)}`;
  fpsLabel.text = `${Math.round(app.ticker.FPS)} FPS`;
  noteManager.update(currentTick);
});

//----------------------------------------------------------------

// Audio
async function main() {
  await loadInstruments();
  playSong(song);
}

(window as any).main = main;
