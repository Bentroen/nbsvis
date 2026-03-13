import { Tempo, Tick } from './tempo';

type SongEvent = {
  type: 'song';
  noteData: SharedArrayBuffer;
  tempoChanges: Record<Tick, Tempo>;
  ticksPerBeat: number;
  initialTempo: Tempo;
};

type SampleEvent = {
  type: 'sample';
  sampleId: number;
  channels: Float32Array[];
};

type PlayEvent = {
  type: 'play';
};

type PauseEvent = {
  type: 'pause';
};

type StopEvent = {
  type: 'stop';
};

type SeekEvent = {
  type: 'seek';
  seconds: number;
};

type StartEvent = {
  type: 'start';
};

type InitEvent = {
  type: 'init';
  playbackStateSAB: SharedArrayBuffer;
  ringBufferAudioSAB: SharedArrayBuffer;
  ringBufferStateSAB: SharedArrayBuffer;
  sampleRate: number;
};

type EngineToWorkletMessage = SongEvent | PlayEvent | PauseEvent | StopEvent | SeekEvent;

type EngineToWorkerMessage = SongEvent | SampleEvent | SeekEvent | StartEvent | InitEvent;

type EngineMessage = EngineToWorkletMessage | EngineToWorkerMessage;

export {
  type SongEvent,
  type SampleEvent,
  type PlayEvent,
  type PauseEvent,
  type StopEvent,
  type SeekEvent,
  type EngineToWorkletMessage,
  type EngineToWorkerMessage,
  type EngineMessage,
};
