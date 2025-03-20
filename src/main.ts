import { Application, TextureStyle } from 'pixi.js';

import { AudioEngine } from './audio';
import { loadInstruments } from './instrument';
import { Player } from './player';
import { loadSongFromUrl } from './song';
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

const { song, extraSounds } = await loadSongFromUrl('song.nbs');
const viewer = new Viewer(app, song);

// Audio
const instruments = loadInstruments(song, extraSounds);
const audioEngine = new AudioEngine(song, instruments);

const player = new Player(viewer, audioEngine, song, { seek: seekCallback });

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
  input.value = tick.toString();
}

function togglePlay() {
  player.togglePlay();
  const button = document.getElementById('togglePlay');
  if (button) {
    button.innerText = player.isPlaying ? '⏸️' : '▶️';
  }
}

const controls = document.getElementById('controls');
if (!controls) {
  throw new Error('Controls container not found');
}

controls.style.position = 'absolute';
controls.style.bottom = '10px';
controls.style.left = '10px';
controls.style.zIndex = '9999';

const togglePlayButton = document.createElement('button');
togglePlayButton.id = 'togglePlay';
togglePlayButton.innerText = '⏸️';
togglePlayButton.onclick = togglePlay;
controls.appendChild(togglePlayButton);
const stopButton = document.createElement('button');
stopButton.id = 'stop';
stopButton.innerText = '⏹️';
stopButton.onclick = stop;
controls.appendChild(stopButton);
const seekInput = document.createElement('input');
seekInput.id = 'seek';
seekInput.type = 'range';
seekInput.min = '0';
seekInput.max = song.length.toString();
seekInput.step = '1';
seekInput.value = '0';
seekInput.style.width = '500px';
seekInput.oninput = handleSeek;
controls.appendChild(seekInput);
const resizeButton = document.createElement('button');
resizeButton.innerText = 'Scale to window';
resizeButton.onclick = () => resize();
controls.appendChild(resizeButton);
const resizeButton640 = document.createElement('button');
resizeButton640.innerText = '640x360';
resizeButton640.onclick = () => resize(640, 360);
controls.appendChild(resizeButton640);
const resizeButton1280 = document.createElement('button');
resizeButton1280.innerText = '1280x720';
resizeButton1280.onclick = () => resize(1280, 720);
controls.appendChild(resizeButton1280);
const resizeButton1920 = document.createElement('button');
resizeButton1920.innerText = '1920x720';
resizeButton1920.onclick = () => resize(1920, 720);
controls.appendChild(resizeButton1920);
appContainer.appendChild(controls);

// add the controls element after the app container
appContainer.parentNode?.insertBefore(controls, appContainer.nextSibling);
// add the app container to the document body
