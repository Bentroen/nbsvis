import { Application, Container, Text, TextStyle, TextureStyle } from 'pixi.js';

import { loadInstruments, playSong } from './audio';
import { loadSong, NoteManager, setBlockSize } from './note';
import { PianoManager } from './piano';

TextureStyle.defaultOptions.scaleMode = 'nearest';

const app = new Application();

const appContainer = document.getElementById('app');

if (!appContainer) {
  throw new Error('App container not found');
}

await app.init({
  backgroundColor: 0x1099bb,
  width: 1280,
  height: 720,
  useBackBuffer: true,
});

appContainer.appendChild(app.canvas);

// Text style

//----------------------------------------------------------------

const song = await loadSong('/song.nbs');

const pianoContainer = new Container();
const pianoManager = new PianoManager(pianoContainer);
pianoContainer.position.set(0, app.screen.height - pianoContainer.height - 10);

const keyPositions = pianoManager.keyPositions;
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
fpsLabel.style = new TextStyle({
  fontFamily: 'Monocraft', // Change this to your desired font
  fontSize: 24,
  fill: 'black',
  align: 'center',
});
app.stage.addChild(fpsLabel);

// Add label showing current tick
const label = new Text();
label.x = 10;
label.y = 40;
label.style = new TextStyle({
  fontFamily: 'Monocraft', // Change this to your desired font
  fontSize: 24,
  fill: 'black',
  align: 'center',
});
app.stage.addChild(label);

app.ticker.add((time) => {
  currentTick += (time.elapsedMS / 1000) * song.tempo;
  label.text = `Tick: ${currentTick.toFixed(2)}`;
  fpsLabel.text = `${Math.round(app.ticker.FPS)} FPS`;
  const notesToPlay = noteManager.update(currentTick);
  pianoManager.update(time.elapsedMS, notesToPlay);
});

function resize(width?: number, height?: number) {
  if (!width || !height) {
    setResponsive(true);
  } else {
    setResponsive(false);
  }
  width = width || window.innerWidth;
  height = height || window.innerHeight;
  app.renderer.resize(window.innerWidth, window.innerHeight);
  pianoManager.redraw(app);
  noteManager.redraw(app);
  pianoContainer.position.set(0, app.screen.height - pianoContainer.height - 10);
  noteContainer.position.set(0, 0);
  noteManager.setKeyPositions(pianoManager.keyPositions);
  noteManager.setPianoHeight(pianoContainer.height);
  noteManager.setScreenHeight(app.screen.height);
  setBlockSize(app.screen.width / 57);
}

// Add event listener for window resize
function resizeHandler() {
  resize();
}

function setResponsive(responsive: boolean) {
  if (responsive) {
    window.addEventListener('resize', resizeHandler);
  } else {
    window.removeEventListener('resize', resizeHandler);
  }
}

// Initial resize
resize();

//----------------------------------------------------------------

declare global {
  interface Window {
    main: () => Promise<void>;
    resize: (width?: number, height?: number) => void;
  }
}

// Audio
async function main() {
  const font = new FontFace('Monocraft', 'url(/fonts/Monocraft.ttf)');
  const loadedFont = await font.load();
  document.fonts.add(loadedFont);
  await loadInstruments();
  playSong(song);
}

window.main = main;
window.resize = resize;
