import { Player, Viewer, PianoRollView } from '@nbsvis/core';

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

  viewer.setView(new PianoRollView());

  player = new Player(viewer, { seek: seekCallback });
  await player.loadSong('megacollab.zip');

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

let url = '';
let file: File | null = null;

function setUrl(event: Event) {
  const input = event.target as HTMLInputElement;
  url = input.value;
}

function setFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const inputFile = input.files?.[0];
  if (!inputFile) return;
  file = inputFile;
}

async function loadSong() {
  if (url && url.startsWith('https://noteblock.world/song/')) {
    console.log('Loading song from URL:', url);
    const songId = url.split('/').pop();
    const serverUrl =
      process.env.NODE_ENV === 'development' ? 'http://localhost:4000' : 'https://noteblock.world';
    const songDownloadUrl = `${serverUrl}/api/v1/song/${songId}/open`;
    console.log('Downloading song from Note Block World:', songDownloadUrl);
    const response = await fetch(songDownloadUrl, {
      headers: { src: 'downloadButton' },
    });
    const objectUrl = await response.text();
    await player.loadSong(objectUrl);
  } else if (file) {
    console.log('Loading song from file:', file.name);
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer]);
    const url = URL.createObjectURL(blob);
    await player.loadSong(url);
  } else {
    console.error('No URL or file provided for loading song');
  }
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
      setUrl: (event: Event) => void;
      setFile: (event: Event) => void;
      loadSong: () => Promise<void>;
      togglePlayback: () => void;
      stop: () => void;
      seek: (event: Event) => void;
      resize: (width?: number, height?: number) => void;
    };
  }
}

window.controls = {
  setUrl,
  setFile,
  loadSong,
  togglePlayback,
  stop,
  seek,
  resize,
};
