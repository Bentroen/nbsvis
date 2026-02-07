import { Tempo, Tick } from './tempo';
import { NoteEvent } from './worker/scheduler';

type SongEvent = {
  type: 'song';
  notes: Record<Tick, NoteEvent[]>;
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

type WorkletMessage = SongEvent | PlayEvent | PauseEvent | StopEvent | SeekEvent;

type WorkerMessage = SongEvent | SampleEvent | SeekEvent | StartEvent;

export {
  type SongEvent,
  type SampleEvent,
  type PlayEvent,
  type PauseEvent,
  type StopEvent,
  type SeekEvent,
  type WorkletMessage,
  type WorkerMessage,
};
