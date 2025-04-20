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
  await player.loadSong('mgc.zip');

  console.log('Done!');
}

main();

// ---------- Callbacks ---------- //

function seekCallback(tick: number) {
  const input = document.getElementById('seek') as HTMLInputElement;
  if (!input) return;
  input.value = tick.toString();
}

// ---------- Controls ---------- //

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
      togglePlayback: () => void;
      stop: () => void;
      seek: (event: Event) => void;
      resize: (width?: number, height?: number) => void;
    };
  }
}

window.controls = {
  togglePlayback,
  stop,
  seek,
  resize,
};
