import { NoteEvent, Tempo, Tick } from './worker/scheduler';

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
  tick: number;
};

type Message = SongEvent | SampleEvent | PlayEvent | PauseEvent | StopEvent | SeekEvent;

export {
  type SongEvent,
  type SampleEvent,
  type PlayEvent,
  type PauseEvent,
  type StopEvent,
  type SeekEvent,
  type Message,
};
