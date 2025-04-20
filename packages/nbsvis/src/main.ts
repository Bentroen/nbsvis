import { Player, Viewer } from '.';

const appContainer = document.getElementById('app');

let viewer: Viewer;
let player: Player;

export async function initializeApp() {
  // Append the app canvas to the container
  if (!appContainer) {
    throw new Error('App container not found');
  }

  viewer = new Viewer(appContainer);
  await viewer.init();

  player = new Player(viewer, { seek: seekCallback });
  await player.loadSong('mgc.zip');

  // Initial resize
  resize();

  console.log('Done!');
}

function resize(width?: number, height?: number) {
  if (!width || !height) {
    setResponsive(true);
  } else {
    setResponsive(false);
  }
  width = width || window.innerWidth;
  height = height || window.innerHeight;

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
