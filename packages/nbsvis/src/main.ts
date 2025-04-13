import { Song } from '@encode42/nbs.js';
import { AudioEngine, loadInstruments, Player, loadSongFromUrl, Viewer } from '.';
import { Application, TextureStyle } from 'pixi.js';
import { loadPianoTextures } from './piano';
import { loadNoteTexture } from './note';

TextureStyle.defaultOptions.scaleMode = 'nearest';

const appContainer = document.getElementById('app');

let app: Application;
let viewer: Viewer;
let player: Player;

let song: Song;

export async function initializeApp() {
  app = new Application();

  await app.init({
    backgroundColor: 0x1099bb,
    width: 1280,
    height: 720,
    useBackBuffer: true,
    eventMode: 'none', // https://github.com/pixijs/pixijs/issues/9380
  });

  if (!appContainer) {
    throw new Error('App container not found');
  }

  await loadPianoTextures();
  await loadNoteTexture();

  console.log('Is this running?');

  appContainer.appendChild(app.canvas);

  const { song: loadedSong, extraSounds } = await loadSongFromUrl('mgc.zip');

  song = loadedSong;

  viewer = new Viewer(app, song);

  const instruments = loadInstruments(song, extraSounds);
  const audioEngine = new AudioEngine(song, instruments);

  player = new Player(viewer, audioEngine, song, { seek: seekCallback });

  // Initial resize
  resize();

  addControls();
}

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

function stop() {
  player.stop();
}

function handleSeek(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = parseFloat(input.value);
  seek(value);
}

function seek(tick: number) {
  player.seek(tick);
}

function seekCallback(tick: number) {
  const input = document.getElementById('seek') as HTMLInputElement;
  if (!input) {
    return;
  }
  input.value = tick.toString();
}

function togglePlay() {
  player.togglePlay();
  const button = document.getElementById('togglePlay');
  if (button) {
    button.innerText = player.isPlaying ? '⏸️' : '▶️';
  }
}
