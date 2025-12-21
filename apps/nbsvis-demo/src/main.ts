import { Player, Viewer, NBSPlayer } from '@nbsvis/core';

import '@nbsvis/core';

// ---------- App ---------- //

async function main() {
  // Get the nbs-player element
  const nbsPlayerElement = document.querySelector('nbs-player') as NBSPlayer & {
    player?: Player;
    viewer?: Viewer;
  };
  if (!nbsPlayerElement) {
    throw new Error('nbs-player not found');
  }

  console.log('nbs-player element:', nbsPlayerElement);

  // Wait a bit for the element to initialize
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log('Done!');
}

main();

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

function getPlayer(): Player | null {
  const nbsPlayerElement = document.querySelector('nbs-player') as NBSPlayer;
  return nbsPlayerElement?.playerInstance || null;
}

function getViewer(): Viewer | null {
  const nbsPlayerElement = document.querySelector('nbs-player') as NBSPlayer;
  return nbsPlayerElement?.viewerInstance || null;
}

async function loadSong() {
  const player = getPlayer();
  if (!player) {
    console.error('Player not available');
    return;
  }

  if (url && url.startsWith('https://noteblock.world/song/')) {
    console.log('Loading song from URL:', url);
    const songId = url.split('/').pop();
    const serverUrl =
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:4000'
        : 'https://api.noteblock.world';
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
  const player = getPlayer();
  if (!player) {
    console.error('Player not available');
    return;
  }
  const isPlaying = player.togglePlayback();
  const button = document.getElementById('togglePlay');
  if (!button) return;
  button.innerText = isPlaying ? '⏸️' : '▶️';
}

function stop() {
  const player = getPlayer();
  if (!player) {
    console.error('Player not available');
    return;
  }
  player.stop();
}

function seek(event: Event) {
  const player = getPlayer();
  if (!player) {
    console.error('Player not available');
    return;
  }
  const input = event.target as HTMLInputElement;
  const value = parseFloat(input.value);
  player.seek(value);
}

function resize(width?: number, height?: number) {
  const viewer = getViewer();
  if (!viewer) {
    console.error('Viewer not available');
    return;
  }
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
