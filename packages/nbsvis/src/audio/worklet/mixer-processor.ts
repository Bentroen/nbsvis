/// <reference lib="webworker" />

import { readFromRingBuffer, RingBufferState } from '../buffer';
import { WorkerMessage, WorkletMessage } from '../event';
import { PlaybackState } from './state';
import PlaybackTransport from './transport';
import { TempoMapView } from '../tempo';
import { AudioWorkerInitOptions } from '../worker/audio-worker';

class AudioSinkWorklet extends AudioWorkletProcessor {
  private worker: Worker;

  private rbAudio: Float32Array;
  private rbState: Int32Array;
  private playbackState: Int32Array;

  transport: PlaybackTransport;

  constructor(options: AudioWorkletNodeOptions) {
    super();

    const { ringBufferAudioSAB, ringBufferStateSAB, playbackStateSAB, workerUrl } =
      options.processorOptions;

    this.rbAudio = new Float32Array(ringBufferAudioSAB);
    this.rbState = new Int32Array(ringBufferStateSAB);
    this.playbackState = new Int32Array(playbackStateSAB);

    this.transport = new PlaybackTransport(sampleRate);

    // Spawn the DSP worker
    this.worker = new Worker(workerUrl, { type: 'module' });

    // Initialize worker with SharedArrayBuffers
    this.worker.postMessage({
      type: 'init',
      ringBufferAudioSAB,
      ringBufferStateSAB,
      sampleRate,
    } satisfies AudioWorkerInitOptions & { type: 'init' });

    this.port.onmessage = (e: MessageEvent<WorkletMessage>) => {
      const msg = e.data;

      // TODO: extract to method
      switch (msg.type) {
        case 'song':
          // TODO: this.transport.stop();
          this.transport.setTempoMap(new TempoMapView(msg.tempoChanges, msg.initialTempo));
          // forward to worker
          this.worker.postMessage(msg);
          break;

        case 'sample':
          // forward to worker
          this.worker.postMessage(msg);
          break;

        case 'play':
          this.transport.play();
          break;

        case 'pause':
          this.transport.pause();
          break;

        case 'stop':
          this.transport.stop();
          this.worker.postMessage({ type: 'seek', seconds: 0 } satisfies WorkerMessage);
          Atomics.store(this.rbState, RingBufferState.RB_READ_INDEX, 0);
          break;

        case 'seek':
          this.transport.seekToTick(msg.seconds); // TODO: tick, frame or second?
          this.worker.postMessage(msg);
          Atomics.store(this.rbState, RingBufferState.RB_READ_INDEX, 0);
          break;
      }
    };
  }

  private writeState() {
    Atomics.store(this.playbackState, PlaybackState.PLAYING, this.transport.isPlaying ? 1 : 0);
    Atomics.store(this.playbackState, PlaybackState.FRAME, this.transport.currentFrame);
    Atomics.store(this.playbackState, PlaybackState.TICK, this.transport.currentTick * 1000);
  }

  process(_: Float32Array[][], outputs: Float32Array[][]): boolean {
    const outL = outputs[0][0];
    const outR = outputs[0][1] ?? outL;

    if (!this.transport.isPlaying) {
      // not playing, output silence
      outL.fill(0);
      outR.fill(0);

      // publish audible state
      this.writeState();

      return true;
    }

    const frameCount = outL.length;

    const readIndex = Atomics.load(this.rbState, RingBufferState.RB_READ_INDEX);
    const writeIndex = Atomics.load(this.rbState, RingBufferState.RB_WRITE_INDEX);
    const available = writeIndex - readIndex;
    if (available < frameCount) {
      // underrun
      console.log('underrun');
      Atomics.add(this.playbackState, PlaybackState.UNDERRUN_COUNT, 1);
      outL.fill(0);
      outR.fill(0);
      this.writeState();
      return true;
    }

    // read audio directly into output channels
    readFromRingBuffer(this.rbAudio, this.rbState, outL, outR);

    // advance authoritative playback time
    this.transport.advance(frameCount);

    // publish audible state
    this.writeState();

    return true;
  }
}

// TODO: import this name from a variable to avoid desync (magic string)
registerProcessor('audio-sink', AudioSinkWorklet);
