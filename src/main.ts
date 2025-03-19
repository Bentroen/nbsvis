import { Application, TextureStyle } from 'pixi.js';

import { loadInstruments, playSong } from './audio';
import { loadSong } from './song';
import { Viewer } from './viewer';

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

const song = await loadSong('song.nbs');
const viewer = new Viewer(app, song);

function resize(width?: number, height?: number) {
  if (!width || !height) {
    setResponsive(true);
  } else {
    setResponsive(false);
  }
  width = width || window.innerWidth;
  height = height || window.innerHeight;
  app.renderer.resize(width, height);

  // 4x = block size 64x
  // 3x = block size 48x
  // 2x = block size 32x
  // 1x = block size 16x
  // 0.5x = block size 8x
  // 0.25x = block size 4x
  //app.stage.scale.set(0.5, 0.5);

  viewer.resize(width, height);
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
  await loadInstruments();
  playSong(song);
}

window.main = main;
window.resize = resize;
