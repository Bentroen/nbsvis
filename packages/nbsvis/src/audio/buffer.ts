enum RingBufferState {
  PLAYBACK_TICK, // authoritative, written by worklet
  BPM,
  ACTIVE_VOICES,
  RB_READ_INDEX,
  RB_WRITE_INDEX,
  RB_CAPACITY,

  SIZE = 8,
}

function ringBufferHasSpace(rbState: Int32Array, framesNeeded: number): boolean {
  const read = Atomics.load(rbState, RingBufferState.RB_READ_INDEX);
  const write = Atomics.load(rbState, RingBufferState.RB_WRITE_INDEX);
  const capacity = Atomics.load(rbState, RingBufferState.RB_CAPACITY);

  const free = capacity - (write - read);
  return free >= framesNeeded;
}

function readFromRingBuffer(
  rbAudio: Float32Array,
  rbState: Int32Array,
  outL: Float32Array,
  outR: Float32Array,
) {
  const readIndex = Atomics.load(rbState, RingBufferState.RB_READ_INDEX); // monotonic
  const capacity = Atomics.load(rbState, RingBufferState.RB_CAPACITY);
  const framesNeeded = outL.length;

  for (let i = 0; i < framesNeeded; i++) {
    const frameIndex = (readIndex + i) % capacity;
    const srcBase = frameIndex * 2;
    outL[i] = rbAudio[srcBase]; // left channel
    outR[i] = rbAudio[srcBase + 1]; // right channel
  }
  Atomics.store(rbState, RingBufferState.RB_READ_INDEX, readIndex + framesNeeded);
}

function writeToRingBuffer(
  rbAudio: Float32Array,
  rbState: Int32Array,
  inL: Float32Array,
  inR: Float32Array,
) {
  const writeIndex = Atomics.load(rbState, RingBufferState.RB_WRITE_INDEX);
  const capacity = Atomics.load(rbState, RingBufferState.RB_CAPACITY);
  const framesToWrite = inL.length;

  for (let i = 0; i < framesToWrite; i++) {
    const frameIndex = (writeIndex + i) % capacity;
    const dstBase = frameIndex * 2;
    rbAudio[dstBase] = inL[i]; // left channel
    rbAudio[dstBase + 1] = inR[i]; // right channel
  }
  Atomics.store(rbState, RingBufferState.RB_WRITE_INDEX, writeIndex + framesToWrite);
}

function resetRingBuffer(rbState: Int32Array) {
  Atomics.store(rbState, RingBufferState.RB_READ_INDEX, 0);
  Atomics.store(rbState, RingBufferState.RB_WRITE_INDEX, 0);
}

export {
  RingBufferState,
  ringBufferHasSpace,
  readFromRingBuffer,
  writeToRingBuffer,
  resetRingBuffer,
};
