import { Tempo, Tick } from './tempo';

type SongEvent = {
  type: 'song';
  noteData: SharedArrayBuffer;
  tempoChanges: Record<Tick, Tempo>;
  ticksPerBeat: number;
  initialTempo: Tempo;
  lengthTicks: number;
  loopStartTick: number;
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

type SetLoopEvent = {
  type: 'loop';
  loop: boolean;
};

type EndedEvent = {
  type: 'ended';
};

type StartEvent = {
  type: 'start';
};

type InitEvent = {
  type: 'init';
  playbackStateSAB: SharedArrayBuffer;
  ringBufferAudioSAB: SharedArrayBuffer;
  ringBufferMetaSAB: SharedArrayBuffer;
  ringBufferStateSAB: SharedArrayBuffer;
  sampleRate: number;
};

type EngineToWorkletMessage =
  | SongEvent
  | PlayEvent
  | PauseEvent
  | StopEvent
  | SeekEvent
  | SetLoopEvent;

type EngineToWorkerMessage =
  | SongEvent
  | SampleEvent
  | StopEvent
  | SeekEvent
  | SetLoopEvent
  | StartEvent
  | InitEvent;

type EngineMessage = EngineToWorkletMessage | EngineToWorkerMessage;

type WorkletToEngineMessage = EndedEvent;

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
  type WorkletToEngineMessage,
};
