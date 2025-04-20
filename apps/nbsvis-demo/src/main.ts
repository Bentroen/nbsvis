import { Player, Viewer } from '@nbsvis/core';

// ---------- App ---------- //

const appContainer = document.getElementById('app');

let viewer: Viewer;
let player: Player;

async function main() {
  // Append the app canvas to the container
  if (!appContainer) {
    throw new Error('App container not found');
  }

  viewer = new Viewer(appContainer);
  await viewer.init();

  player = new Player(viewer, { seek: seekCallback });

  console.log('Done!');
}

main();

// ---------- Callbacks ---------- //

function seekCallback(tick: number, totalLength: number) {
  const input = document.getElementById('seek') as HTMLInputElement;
  if (!input) return;
  input.value = tick.toString();
  input.max = totalLength.toString();
}

// ---------- Controls ---------- //

async function loadSong() {
  await player.loadSong('mgc.zip');
}

function togglePlayback() {
  const isPlaying = player.togglePlayback();
  const button = document.getElementById('togglePlay');
  if (!button) return;
  button.innerText = isPlaying ? '⏸️' : '▶️';
}

function stop() {
  player.stop();
}

function seek(event: Event) {
  const input = event.target as HTMLInputElement;
  const value = parseFloat(input.value);
  player.seek(value);
}

function resize(width?: number, height?: number) {
  viewer.resize(width, height);
}

// ---------- Exports ---------- //

declare global {
  interface Window {
    controls: {
      loadSong: () => Promise<void>;
      togglePlayback: () => void;
      stop: () => void;
      seek: (event: Event) => void;
      resize: (width?: number, height?: number) => void;
    };
  }
}

window.controls = {
  loadSong,
  togglePlayback,
  stop,
  seek,
  resize,
};
