import './style.css';

import { Player } from '@opennbs/nbsvis';

import { OscillatorAudioBackend } from './audio/OscillatorAudioBackend';
import { ThreeViewerBackend } from './three/ThreeViewerBackend';

const app = document.getElementById('app');
const statusEl = document.getElementById('status');
const loadBtn = document.getElementById('loadSong');
const toggleBtn = document.getElementById('togglePlay');
const fileInput = document.getElementById('songFile') as HTMLInputElement | null;

if (!app || !statusEl || !loadBtn || !toggleBtn) {
  throw new Error('Missing app UI elements.');
}
const statusNode: HTMLElement = statusEl;
const viewer = new ThreeViewerBackend();
const audio = new OscillatorAudioBackend();
viewer.mount(app);
viewer.setViewMode('piano-roll');
const player = new Player({ viewerBackend: viewer, audioBackend: audio });
let songLoaded = false;
let lastObjectUrl: string | null = null;

function setStatus(text: string): void {
  statusNode.textContent = text;
}

async function loadSong(url: string): Promise<void> {
  try {
    songLoaded = false;
    setStatus('Loading song...');
    await player.loadSong(url);
    songLoaded = true;
    setStatus('Song loaded. Press Play / Pause.');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[three-osc-demo] song load failed', error);
    setStatus(`Load failed: ${msg}`);
  }
}

loadBtn.addEventListener('click', () => {
  const file = fileInput?.files?.[0];
  if (!file) {
    setStatus('Select a .nbs or .zip file first.');
    return;
  }
  if (lastObjectUrl) {
    URL.revokeObjectURL(lastObjectUrl);
    lastObjectUrl = null;
  }
  lastObjectUrl = URL.createObjectURL(file);
  void loadSong(lastObjectUrl);
});

toggleBtn.addEventListener('click', () => {
  if (!songLoaded) {
    setStatus('Load a .nbs/.zip file first.');
    return;
  }
  const isPlaying = player.togglePlayback();
  setStatus(isPlaying ? 'Playing...' : 'Paused');
});

player.on('ended', () => setStatus('Ended'));
player.on('seek', ({ tick, totalLength }) => {
  if (!songLoaded) return;
  setStatus(`Tick ${tick.toFixed(2)} / ${totalLength}`);
});

window.addEventListener('resize', () => {
  viewer.resize(app.clientWidth, app.clientHeight);
});

window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyZ') return;
  const target = event.target as HTMLElement | null;
  const tag = target?.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  event.preventDefault();
  const enabled = viewer.toggleFpsMode();
  const camera = viewer.getCameraState();
  if (camera) {
    console.log('[camera]', {
      fpsMode: enabled,
      position: {
        x: Number(camera.position.x.toFixed(3)),
        y: Number(camera.position.y.toFixed(3)),
        z: Number(camera.position.z.toFixed(3)),
      },
      yaw: Number(camera.yaw.toFixed(4)),
      pitch: Number(camera.pitch.toFixed(4)),
    });
  }
  setStatus(enabled ? 'FPS mode enabled: WASD + mouse (Esc or Z to exit)' : 'FPS mode disabled.');
});

window.addEventListener('beforeunload', () => {
  if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
  player.dispose();
  viewer.destroy();
});

setStatus('Ready. Select a local .nbs/.zip file and click Load file.');
