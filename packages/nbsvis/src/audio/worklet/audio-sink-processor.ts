/// <reference lib="webworker" />

import { readFromRingBuffer, RingBufferState } from '../buffer';
import { EngineToWorkletMessage } from '../event';
import { PlaybackState } from './state';
import { TempoMapView } from '../tempo';
import { BaseTransport } from '../transport';

enum ReadStatus {
  UNDERRUN = 0,
  SUCCESS = 1,
  NO_AUDIO = 2,
}

class AudioSinkProcessor extends AudioWorkletProcessor {
  private rbAudio: Float32Array;
  private rbMeta: Int8Array;
  private rbState: Int32Array;
  private playbackState: Int32Array;

  transport: BaseTransport;

  constructor(options: AudioWorkletNodeOptions) {
    super();

    const { ringBufferAudioSAB, ringBufferMetaSAB, ringBufferStateSAB, playbackStateSAB } =
      options.processorOptions;

    this.rbAudio = new Float32Array(ringBufferAudioSAB);
    this.rbMeta = new Int8Array(ringBufferMetaSAB);
    this.rbState = new Int32Array(ringBufferStateSAB);
    this.playbackState = new Int32Array(playbackStateSAB);

    this.transport = new BaseTransport(sampleRate);

    this.port.onmessage = (e: MessageEvent<EngineToWorkletMessage>) => {
      const msg = e.data;

      // TODO: extract to method
      switch (msg.type) {
        case 'song':
          this.transport.stop();
          Atomics.store(this.rbState, RingBufferState.RB_READ_INDEX, 0);
          this.transport.setTempoMap(new TempoMapView(msg.tempoChanges, msg.initialTempo));
          this.transport.setLoopRegion(msg.loopStartTick, msg.lengthTicks);
          break;

        case 'play':
          this.transport.play();
          break;

        case 'pause':
          this.transport.pause();
          break;

        case 'stop':
          this.transport.stop();
          Atomics.store(this.rbState, RingBufferState.RB_READ_INDEX, 0);
          break;

        case 'seek':
          this.transport.seekToTick(msg.seconds); // TODO: tick, frame or second?
          Atomics.store(this.rbState, RingBufferState.RB_READ_INDEX, 0);
          break;

        case 'loop':
          this.transport.setLoop(msg.loop);
          Atomics.store(this.playbackState, PlaybackState.LOOP, msg.loop ? 1 : 0);
          break;
      }
    };
  }

  private writeState() {
    Atomics.store(this.playbackState, PlaybackState.PLAYING, this.transport.isPlaying ? 1 : 0);
    Atomics.store(this.playbackState, PlaybackState.LOOP, this.transport.loop ? 1 : 0);
    Atomics.store(this.playbackState, PlaybackState.FRAME, this.transport.framePosition);
    Atomics.store(this.playbackState, PlaybackState.TICK, this.transport.currentTick * 1000);
  }

  private readAudioIntoOutput(outL: Float32Array, outR: Float32Array): number {
    const frameCount = outL.length;

    const readIndex = Atomics.load(this.rbState, RingBufferState.RB_READ_INDEX);
    const writeIndex = Atomics.load(this.rbState, RingBufferState.RB_WRITE_INDEX);
    const available = writeIndex - readIndex;

    if (available < frameCount) {
      // underrun
      console.log('underrun');
      Atomics.add(this.playbackState, PlaybackState.UNDERRUN_COUNT, 1);
      return ReadStatus.UNDERRUN;
    }

    const hasAudio = readFromRingBuffer(this.rbAudio, this.rbMeta, this.rbState, outL, outR);
    return hasAudio ? ReadStatus.SUCCESS : ReadStatus.NO_AUDIO;
  }

  private processPlayback(outL: Float32Array, outR: Float32Array) {
    if (!this.transport.isPlaying) {
      return false;
    }

    const readStatus = this.readAudioIntoOutput(outL, outR);
    const readSuccess = readStatus === ReadStatus.SUCCESS;

    // Handle looping uniformly; worklet-specific ended logic follows
    const looped = this.transport.checkAndHandleLoop();
    if (looped) {
      Atomics.store(this.playbackState, PlaybackState.RENDER_DONE, 0);
    } else {
      // Not looping; check if we've reached song end (worklet-specific logic)
      const songEndReached = this.transport.currentTick >= this.transport.loopRegion.endTick;
      const renderDone = Atomics.load(this.playbackState, PlaybackState.RENDER_DONE) === 1;
      const bufferEnded = readStatus === ReadStatus.NO_AUDIO;

      if (songEndReached && renderDone && bufferEnded) {
        console.log('Song ended');
        this.transport.pause();
        this.port.postMessage({ type: 'ended' });
      }
    }

    // advance authoritative playback time
    const frameCount = outL.length;
    this.transport.advance(frameCount);

    return readSuccess;
  }

  process(_: Float32Array[][], outputs: Float32Array[][]): boolean {
    const outL = outputs[0][0];
    const outR = outputs[0][1] ?? outL;

    const bufferFilled = this.processPlayback(outL, outR);

    if (!bufferFilled) {
      outL.fill(0);
      outR.fill(0);
    }

    // publish audible state
    this.writeState();

    return true;
  }
}

// TODO: import this name from a variable to avoid desync (magic string)
registerProcessor('audio-sink', AudioSinkProcessor);
