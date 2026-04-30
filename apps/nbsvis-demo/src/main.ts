import { Player, Viewer, PianoRollView } from '@opennbs/nbsvis';

// ---------- App ---------- //

const appContainer = document.getElementById('app');

let viewer: Viewer;
let player: Player;

function updatePlayButton() {
  const button = document.getElementById('togglePlay');
  if (!button || !player) return;
  button.innerText = player.isEnded ? '↺' : player.isPlaying ? '⏸️' : '▶️';
}

async function main() {
  // Append the app canvas to the container
  if (!appContainer) {
    throw new Error('App container not found');
  }

  viewer = new Viewer(appContainer);
  await viewer.setView(new PianoRollView({ renderer: viewer.app.renderer }));
  await viewer.init();

  player = new Player(viewer, {
    webAudio: {
      urlBase: document.baseURI,
    },
  });
  const base = document.baseURI.endsWith('/') ? document.baseURI : `${document.baseURI}/`;
  await player.loadSong(new URL('megacollab.zip', base).href);

  player.on('seek', ({ tick, totalLength }) => {
    const input = document.getElementById('seek') as HTMLInputElement;
    if (!input) return;
    input.value = tick.toString();
    input.max = totalLength.toString();
    updatePlayButton();
  });
  player.on('play', updatePlayButton);
  player.on('pause', updatePlayButton);
  player.on('stop', updatePlayButton);
  player.on('ended', updatePlayButton);

  updatePlayButton();

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

async function loadSong() {
  if (url && url.startsWith('https://noteblock.world/song/')) {
    console.log('Loading song from URL:', url);
    const songId = url.split('/').pop();
    const serverUrl = import.meta.env.DEV ? 'http://localhost:4000' : 'https://api.noteblock.world';
    const songDownloadUrl = `${serverUrl}/v1/song/${songId}/open`;
    console.log('Downloading song from Note Block World:', songDownloadUrl);
    const response = await fetch(songDownloadUrl, {
      headers: { src: 'downloadButton' },
    });
    const objectUrl = await response.text();
    await player.loadSong(objectUrl);
    updatePlayButton();
  } else if (file) {
    console.log('Loading song from file:', file.name);
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer]);
    const url = URL.createObjectURL(blob);
    await player.loadSong(url);
    updatePlayButton();
  } else {
    console.error('No URL or file provided for loading song');
  }
}

function togglePlayback() {
  player.togglePlayback();
  updatePlayButton();
}

function toggleLoop() {
  const nextLoop = !player.loop;
  player.loop = nextLoop;
  const button = document.getElementById('toggleLoop');
  if (!button) return;
  button.innerText = nextLoop ? '🔁' : '➡';
  console.log('Looping is now', nextLoop);
}

function stop() {
  player.stop();
  updatePlayButton();
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
      toggleLoop: () => void;
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
  toggleLoop,
  stop,
  seek,
  resize,
};
