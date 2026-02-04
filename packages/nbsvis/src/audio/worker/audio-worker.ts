import { Message } from '../event';
import Scheduler from './scheduler';
import { SharedState } from './state';
import Transport from './transport';
import VoiceManager from './voice-manager';

const RB_READ = 0;
const RB_WRITE = 1;
const RB_CAPACITY = 2;

let playbackState: Int32Array;
let rbData: Float32Array;
let rbState: Int32Array;

const scheduler = new Scheduler();
const transport = new Transport(scheduler);
const voiceManager = new VoiceManager();

let sampleRate = 48000;
let playing = false;

const BLOCK_SIZE = 128;

self.onmessage = (e: MessageEvent<Message | any>) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init':
      sampleRate = msg.sampleRate;
      startRenderLoop();
      break;

    case 'song':
      transport.currentTempo = scheduler.loadSong(msg.notes, msg.tempoChanges, msg.initialTempo);
      break;

    case 'sample':
      voiceManager.loadSample(msg.sampleId, msg.channels);
      break;

    case 'play':
      playing = true;
      transport.play();
      break;

    case 'pause':
      playing = false;
      transport.pause();
      break;

    case 'seek':
      transport.seek(msg.tick);
      voiceManager.voices.length = 0;
      resetRingBuffer();
      break;

    case 'buffer':
      playbackState = new Int32Array(msg.playbackState);
      rbData = new Float32Array(msg.data);
      rbState = new Int32Array(msg.state);
      Atomics.store(rbState, RB_CAPACITY, msg.capacity);
      break;
  }
};

function storeState() {
  Atomics.store(state, SharedState.TICK, (transport.currentTick * 1000) | 0);
  Atomics.store(state, SharedState.BPM, (transport.currentTempo * 1000) | 0);
  Atomics.store(state, SharedState.VOICES, voiceManager.activeCount);
  Atomics.store(state, SharedState.PLAYING, transport.isPlaying ? 1 : 0);
}

function resetRingBuffer() {
  Atomics.store(rbState, RB_READ, 0);
  Atomics.store(rbState, RB_WRITE, 0);
}

function startRenderLoop() {
  function loop() {
    if (playing) {
      renderIfPossible();
    }
    setTimeout(loop, 0);
  }
  loop();
}

function renderIfPossible() {
  const read = Atomics.load(rbState, RB_READ);
  const write = Atomics.load(rbState, RB_WRITE);
  const capacity = Atomics.load(rbState, RB_CAPACITY);

  const free = capacity - (write - read);
  if (free < BLOCK_SIZE) return;

  const outL = new Float32Array(BLOCK_SIZE);
  const outR = new Float32Array(BLOCK_SIZE);

  mixBlock(outL, outR);

  for (let i = 0; i < BLOCK_SIZE; i++) {
    const frameIndex = (write + i) % capacity;
    const base = frameIndex * 2;

    rbData[base] = outL[i];
    rbData[base + 1] = outR[i];
  }

  Atomics.store(rbState, RB_WRITE, write + BLOCK_SIZE);
}

function mixBlock(outL: Float32Array, outR: Float32Array) {
  outL.fill(0);
  outR.fill(0);

  if (!transport.isPlaying) return;

  if (transport.advance(BLOCK_SIZE / sampleRate)) {
    const tick = Math.floor(transport.currentTick);
    const events = scheduler.collectEvents(tick);

    for (const e of events) {
      if ('tempo' in e) {
        transport.currentTempo = e.tempo;
      } else {
        voiceManager.spawn(e);
      }
    }
  }

  for (let v = voiceManager.voices.length - 1; v >= 0; v--) {
    const voice = voiceManager.voices[v];
    const sample = voiceManager.samples[voice.id];
    if (!sample) continue;

    const L = sample[0];
    const R = sample[1] ?? L;

    let advanced = 0;

    for (let i = 0; i < BLOCK_SIZE; i++) {
      const pos = voice.pos + i * voice.pitch;
      if (pos >= L.length) {
        voiceManager.voices.splice(v, 1);
        break;
      }

      const l = L[Math.floor(pos)];
      const r = R[Math.floor(pos)];

      outL[i] += l * voice.gain * (1 - Math.max(0, voice.pan));
      outR[i] += r * voice.gain * (1 + Math.min(0, voice.pan));

      advanced = (i + 1) * voice.pitch;
    }

    voice.pos += advanced;
  }
}
