import { Song } from '@encode42/nbs.js';
import * as Tone from 'tone';

import PlayerInstrument, { defaultInstruments } from './instrument';
import { NoteEvent, SongManager } from './song';

export const MAX_AUDIO_SOURCES = 1024;

const DEFAULT_TEMPO_TPS = new Song().tempo * 15;

const DEFAULT_BUFFER_LENGTH_SECONDS = 2; // Default length for offline rendering buffers

function decodeAudioData(buffer: ArrayBuffer): Promise<AudioBuffer> {
  return Tone.getContext().decodeAudioData(buffer);
}

async function loadAudio(audioSource: string | ArrayBuffer): Promise<AudioBuffer | null> {
  let arrayBuffer;
  if (!audioSource) return null;
  if (typeof audioSource === 'string') {
    const response = await fetch(audioSource);
    arrayBuffer = await response.arrayBuffer();
  } else {
    arrayBuffer = audioSource;
  }
  return await decodeAudioData(arrayBuffer);
}

type AudioSourceParams = {
  source: Tone.ToneAudioBuffer;
  destinationNode: Tone.ToneAudioNode;
  time: number;
  playbackRate: number;
  volumeDb: number;
  panning: number;
  onEnded: () => void;
};

class AudioSource {
  static nextId = 0;
  id: number;
  sourceNode: Tone.ToneBufferSource;
  panVolNode: Tone.PanVol;

  constructor() {
    this.id = AudioSource.nextId++;
    this.sourceNode = new Tone.ToneBufferSource();
    this.panVolNode = new Tone.PanVol();
  }

  play(params: AudioSourceParams) {
    const { source, destinationNode, time, playbackRate, volumeDb, panning, onEnded } = params;

    this.sourceNode = new Tone.ToneBufferSource({
      url: source,
      playbackRate,
    });

    this.panVolNode = new Tone.PanVol({ volume: volumeDb, pan: panning });

    this.sourceNode.chain(this.panVolNode, destinationNode);
    this.sourceNode.start(time);
    this.sourceNode.onended = onEnded;
  }

  stop() {
    //this.sourceNode.onended(this.sourceNode);
    this.sourceNode.onended = () => {};
    this.sourceNode.stop(Tone.getTransport().now());
    this.sourceNode.disconnect();
  }
}

class AudioSourcePool {
  private freeSources: Array<AudioSource> = [];

  private activeSources: Array<AudioSource> = [];

  numSources: number;

  constructor(numSources: number) {
    this.numSources = numSources;
    for (let i = 0; i < numSources; i++) {
      this.freeSources.push(new AudioSource());
    }
  }

  get activeSourceCount() {
    return this.activeSources.length;
  }

  get() {
    if (this.freeSources.length === 0) {
      this.freeSource();
    }
    const source = this.freeSources.pop();
    if (!source) throw new Error('No source available in pool (this should not happen!)');
    this.activeSources.push(source);
    return source;
  }

  freeSource() {
    // Recycle oldest source
    const source = this.activeSources[0];
    if (!source) throw new Error('No active source to free (this should not happen!)');
    this.recycle(source);
  }

  recycle(source: AudioSource) {
    source.stop();
    this.activeSources.splice(this.activeSources.indexOf(source), 1);
    this.freeSources.push(source);
  }
}

type ContextInfo = {
  context: Tone.Context;
  destinationNode: Tone.ToneAudioNode;
};

/**
 * Returns a new object containing only the entries from `obj` whose numeric keys are in the range [min, max).
 * The keys in the returned object are shifted so that the lowest key is 0 (i.e., original key - min).
 * Only keys that exist in the original object are included.
 *
 * @param min - The inclusive lower bound of the key range.
 * @param max - The exclusive upper bound of the key range.
 * @param obj - The source object with numeric keys.
 * @returns A new object with keys 0...(max-min-1) containing the filtered and shifted entries.
 */
function sliceObject<T>(min: number, max: number, obj: Record<number, T>): Record<number, T> {
  const result: Record<number, T> = {};
  for (let k = min; k < max; k++) {
    if (obj[k] !== undefined) {
      result[k - min] = obj[k];
    }
  }
  return result;
}

class OfflineRenderer {
  private buffers: Record<string, Tone.ToneAudioBuffer> = {};

  private players: Array<Tone.Player> = [];

  private audioEngine: AudioEngine;

  //private songManager: SongManager;

  private bufferLengthSeconds: number;

  constructor(
    audioEngine: AudioEngine,
    bufferLengthSeconds: number = DEFAULT_BUFFER_LENGTH_SECONDS,
  ) {
    this.audioEngine = audioEngine;
    // TODO: this causes an empty SongManager to be persisted as a reference to it is stored, not its value
    //this.songManager = audioEngine.songManager;
    this.bufferLengthSeconds = bufferLengthSeconds;
  }

  private async renderSlice(startTime: number, length: number) {
    return await Tone.Offline((context) => {
      const transport = context.transport;
      const destinationNode = new Tone.Gain(0.5).toDestination();

      const audioSourcePool = new AudioSourcePool(1024);

      const [startTick, endTick] = this.audioEngine.songManager.getTickRangeForTime(
        startTime,
        length,
      );
      console.log(`Rendering slice from ${startTime} to ${startTime + length} seconds...`);

      const initialTempo = this.audioEngine.songManager.initialTempo;
      transport.bpm.value = initialTempo * 15;
      const secondsPerTick = 60 / (initialTempo * 15) / 4; // 4 ticks per beat

      const noteEvents = sliceObject(startTick, endTick, this.audioEngine.songManager.noteEvents);
      const tempoChangeEvents = sliceObject(
        startTick,
        endTick,
        this.audioEngine.songManager.tempoChangeEvents,
      );

      this.audioEngine.scheduleNotes(
        context,
        noteEvents,
        secondsPerTick,
        destinationNode,
        //audioSourcePool,
      );
      this.audioEngine.scheduleTempoChanges(
        context,
        initialTempo,
        tempoChangeEvents,
        secondsPerTick,
      );

      transport.start(0);
    }, length + 2 /* + 3*/); // TODO: calculate exact length needed (+3s may be too much or not enough)
  }

  public async startRendering() {
    console.log('Starting offline rendering...');

    const length = this.bufferLengthSeconds;

    let currentPosition = 0;
    let currentTick = 0;

    // TESTS
    const ticksPerSecond = this.audioEngine.songManager.ticksPlayedAtEachSecond;
    console.log(ticksPerSecond);

    console.log(this.audioEngine.songManager.getTickRangeForTime(5, 5));
    console.log(this.audioEngine.songManager.getTickRangeForTime(10, 5));

    while (true) {
      // currentPosition < this.audioEngine.songManager.length
      try {
        const renderedBuffer = await this.renderSlice(currentPosition, length);
        this.scheduleRenderedBuffer(currentPosition, renderedBuffer);
        currentPosition += length;
      } catch (error) {
        console.error('Error during rendering:', error);
        break; // Exit loop on error
      }
    }
  }

  public async scheduleRenderedBuffer(time: number, buffer: Tone.ToneAudioBuffer) {
    /*-
    Schedules a rendered buffer to be played at the specified time.
    Used for playing pre-rendered audio slices for offline rendering.
    */
    Tone.setContext(this.audioEngine.defaultContext);
    const player = new Tone.Player({
      url: buffer,
      loop: false,
      autostart: false,
    })
      .connect(this.audioEngine.audioDestination)
      .sync() // sync this player with the audio engine's transport
      .start(time);

    this.players.push(player);
  }

  public dispose() {
    for (const key in this.buffers) {
      this.buffers[key].dispose();
      delete this.buffers[key];
    }
    for (const player of this.players) {
      player.dispose();
    }
  }
}

export class AudioEngine {
  songManager: SongManager;

  instruments: Array<PlayerInstrument>;

  audioBuffers: Record<number, Tone.ToneAudioBuffer> = {};

  audioDestination: Tone.ToneAudioNode;

  audioSourcePool: AudioSourcePool;

  offlineRenderer: OfflineRenderer;

  players: Array<Tone.Player> = [];

  defaultContext: Tone.Context;

  constructor(maxAudioSources: number = MAX_AUDIO_SOURCES) {
    this.songManager = new SongManager(new Song());
    this.songManager._song.meta.name = 'Default Song'; // Set default song name
    // TODO: this is problematic. We don't want a default song to be created here?

    this.instruments = [...defaultInstruments];

    // Master audio chain
    const compressor = new Tone.Compressor(-24, 3); // Dynamic range compression
    const limiter = new Tone.Limiter(-3); // Prevent clipping
    const masterGain = new Tone.Gain(1); // Master volume control
    compressor.connect(limiter);
    limiter.connect(masterGain);
    masterGain.toDestination();
    this.audioDestination = compressor;

    this.loadSounds();

    this.audioSourcePool = new AudioSourcePool(maxAudioSources);

    this.offlineRenderer = new OfflineRenderer(this);

    this.defaultContext = Tone.getContext() as Tone.Context;
  }

  private async loadSounds() {
    const promises = this.instruments.map(async (ins, index) => {
      if (this.audioBuffers[index]) return; // Skip if already loaded
      const audioBuffer = await loadAudio(ins.audioSource);
      if (!audioBuffer) return;
      const buffer = new Tone.ToneAudioBuffer({
        url: audioBuffer,
        onload: () => console.log(`Loaded instrument ${ins.name}`),
      });

      await Tone.loaded(); // Wait for all samples to load
      this.audioBuffers[index] = buffer;
    });

    await Promise.all(promises);
    console.debug('All instruments loaded.');
  }

  private async resetSounds() {
    /*
    Clears all custom instrument sounds from the audio engine, resetting it to the initial state.
    */
    this.instruments
      .filter((ins) => !ins.isBuiltIn)
      .forEach((ins, index) => {
        const audioBuffer = this.audioBuffers[index];
        if (audioBuffer) {
          audioBuffer.dispose();
          delete this.audioBuffers[index];
          console.log(`Disposed custom instrument ${ins.name} (id: ${index})`);
        }
      });
    this.instruments = this.instruments.filter((ins) => ins.isBuiltIn);
  }

  public async loadSong(song: Song, instruments: Array<PlayerInstrument>) {
    // Custom sounds
    this.resetSounds();
    this.instruments = defaultInstruments.concat(instruments);
    this.loadSounds();

    // Song
    this.songManager = new SongManager(song);
    this.songManager._song.meta.name = 'Loaded Song'; // Set song name

    const transport = Tone.getTransport();

    this.scheduleSong(
      this.defaultContext,
      song.tempo * 15,
      this.songManager.noteEvents,
      this.songManager.tempoChangeEvents,
    );

    // Offline rendering setup
    this.offlineRenderer.dispose();
    this.offlineRenderer.startRendering();
  }

  private scheduleSong(
    context: Tone.Context,
    tempo: number,
    noteEvents: Record<number, Array<NoteEvent>>,
    tempoChangeEvents: Record<number, number>,
  ) {
    //Tone.setContext(context);
    const transport = this.defaultContext.transport;

    transport.stop();
    transport.cancel();
    transport.position = 0;

    transport.bpm.value = tempo;
    const secondsPerTick = 60 / tempo / 4; // 4 ticks per beat

    //this.scheduleNotes(context, noteEvents, secondsPerTick, this.audioDestination);
    this.scheduleTempoChanges(context, tempo, tempoChangeEvents, secondsPerTick);

    console.log('Song scheduled.');
  }

  public scheduleNotes(
    context: Tone.Context,
    noteEvents: Record<number, Array<NoteEvent>>,
    secondsPerTick: number,
    destinationNode: Tone.ToneAudioNode = this.audioDestination,
    audioSourcePool: AudioSourcePool = this.audioSourcePool,
  ) {
    Tone.setContext(context);
    const transport = Tone.getTransport();
    for (const [tickStr, notes] of Object.entries(noteEvents)) {
      const tick = parseInt(tickStr);
      transport.schedule((time) => {
        this.playNotes(notes, time, context, destinationNode, audioSourcePool);
      }, tick * secondsPerTick);
    }
  }

  public scheduleTempoChanges(
    context: Tone.Context,
    initialTempo: number,
    tempoChangeEvents: Record<number, number>,
    secondsPerTick: number,
  ) {
    Tone.setContext(context);
    const transport = Tone.getTransport();
    //transport.bpm.value = initialTempo * 15; // Set initial BPM
    // TODO: the above assignment makes the scheduled BPM changes stop working
    for (const [tickStr, newTempo] of Object.entries(tempoChangeEvents)) {
      const tick = parseInt(tickStr);
      transport.schedule((time) => {
        Tone.setContext(context);
        transport.bpm.setValueAtTime(newTempo * 15, time);
        console.log(
          `Scheduled BPM change at tick ${tick}: ${newTempo * 15} BPM (offline: ${context.isOffline})`,
        );
      }, tick * secondsPerTick);
    }
  }

  private playNote(
    note: NoteEvent,
    time: number,
    destinationNode: Tone.ToneAudioNode = this.audioDestination,
    audioSourcePool: AudioSourcePool = this.audioSourcePool,
  ) {
    const { key, instrument, velocity, panning } = note;

    if (velocity === 0) return;

    const audioBuffer = this.audioBuffers[instrument];
    if (!audioBuffer) return;

    const insOffset = 45 - this.instruments[instrument].baseKey + 45;
    const playbackRate = 2 ** ((key - insOffset) / 12);

    const volumeDb = Tone.gainToDb(velocity);

    const source = audioSourcePool.get();

    source.play({
      source: audioBuffer,
      destinationNode: destinationNode,
      time,
      playbackRate,
      panning,
      volumeDb,
      onEnded: () => {
        audioSourcePool.recycle(source);
      },
    });
  }

  // TODO: should be private, but used in offline rendering
  public playNotes(
    notes: Array<NoteEvent>,
    time: number,
    context: Tone.Context = this.defaultContext,
    destinationNode: Tone.ToneAudioNode = this.audioDestination,
    audioSourcePool: AudioSourcePool = this.audioSourcePool,
  ) {
    Tone.setContext(context);
    for (const note of notes) {
      this.playNote(note, time, destinationNode, audioSourcePool);
    }
  }

  public get currentTick() {
    const transport = this.defaultContext.transport;
    return (transport.ticks / transport.PPQ) * 4;
  }

  public set currentTick(tick: number) {
    const transport = this.defaultContext.transport;
    transport.ticks = (tick * transport.PPQ) / 4;
    const newBPM = (this.songManager.tempoSegments[tick] ?? DEFAULT_TEMPO_TPS) * 15;
    console.debug('Setting tick to:', tick);
    console.debug('BPM:', newBPM);
    transport.bpm.value = newBPM;
  }

  public get soundCount() {
    return this.audioSourcePool.activeSourceCount;
  }

  public get isPlaying() {
    return this.defaultContext.transport.state === 'started';
  }

  public play() {
    Tone.setContext(this.defaultContext);
    this.defaultContext.resume();
    this.defaultContext.transport.start();
  }

  public pause() {
    Tone.setContext(this.defaultContext);
    this.defaultContext.transport.pause();
  }

  public stop() {
    Tone.setContext(this.defaultContext);
    this.defaultContext.transport.stop();
    this.defaultContext.transport.position = 0;
  }
}
