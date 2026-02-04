import { Message } from '../event';

declare const sampleRate: number;

/**
 * Ring buffer layout (interleaved stereo)
 * data: Float32Array
 * state:
 *   [0] = readIndex (frames)
 *   [1] = writeIndex (frames)
 *   [2] = capacity (frames)
 */
const RB_READ = 0;
const RB_WRITE = 1;
const RB_CAPACITY = 2;

class AudioSinkProcessor extends AudioWorkletProcessor {
  private worker: Worker;

  state: Int32Array;
  private rbData: Float32Array;
  private rbState: Int32Array;

  constructor(options: AudioWorkletNodeOptions) {
    super();

    const { sharedTickBuffer, ringBufferData, ringBufferState, workerUrl } =
      options.processorOptions;

    this.state = new Int32Array(sharedTickBuffer);
    this.rbData = new Float32Array(ringBufferData);
    this.rbState = new Int32Array(ringBufferState);

    // Spawn the DSP worker
    this.worker = new Worker(workerUrl, { type: 'module' });

    // Forward all engine messages to the worker
    this.port.onmessage = (e: MessageEvent<Message>) => {
      this.worker.postMessage(e.data);
    };

    // Send ring buffer references to the worker
    this.worker.postMessage({
      type: 'buffer',
      playbackState: this.state.buffer,
      data: this.rbData.buffer,
      state: this.rbState.buffer,
      capacity: this.rbState.length / 2,
    });

    // Initial handshake
    this.worker.postMessage({
      type: 'init',
      sampleRate,
    });
  }

  process(_: Float32Array[][], outputs: Float32Array[][]): boolean {
    const outL = outputs[0][0];
    const outR = outputs[0][1] ?? outL;

    const read = Atomics.load(this.rbState, RB_READ);
    const write = Atomics.load(this.rbState, RB_WRITE);
    const capacity = Atomics.load(this.rbState, RB_CAPACITY);

    const available = write - read;

    if (available < outL.length) {
      // Underrun → output silence
      outL.fill(0);
      outR.fill(0);
      return true;
    }

    for (let i = 0; i < outL.length; i++) {
      const frameIndex = (read + i) % capacity;
      const base = frameIndex * 2;

      outL[i] = this.rbData[base];
      outR[i] = this.rbData[base + 1];
    }

    Atomics.store(this.rbState, RB_READ, read + outL.length);

    return true;
  }
}

registerProcessor('audio-sink', AudioSinkProcessor);
