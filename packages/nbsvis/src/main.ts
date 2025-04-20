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

  console.log('Done!');
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
