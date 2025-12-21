import { Song, fromArrayBuffer } from '@encode42/nbs.js';
import JSZIP from 'jszip';

function isZipFile(buffer: ArrayBuffer) {
  const view = new Uint8Array(buffer);
  return view[0] === 0x50 && view[1] === 0x4b && view[2] === 0x03 && view[3] === 0x04;
}

function getBaseName(url: string) {
  return new URL(url, 'file://').pathname.split('/').pop() || '';
}

export type ExtraSounds = Record<string, ArrayBuffer>;

export async function loadSongFromUrl(url: string): Promise<{
  song: Song;
  extraSounds: ExtraSounds;
}> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return await loadSong(arrayBuffer);
}

export async function loadSong(arrayBuffer: ArrayBuffer): Promise<{
  song: Song;
  extraSounds: ExtraSounds;
}> {
  let song: Song;
  let extraSounds: ExtraSounds = {};

  if (isZipFile(arrayBuffer)) {
    console.debug('Loading zip file');
    [song, extraSounds] = await loadZipFile(arrayBuffer);
  } else {
    console.debug('Loading nbs file');
    song = await loadNbsFile(arrayBuffer);
  }

  return { song, extraSounds };
}

async function loadZipFile(arrayBuffer: ArrayBuffer): Promise<[Song, ExtraSounds]> {
  const zip = await JSZIP.loadAsync(arrayBuffer);

  // Get the song file 'song.nbs' on the root of the zip
  const songFile = zip.file('song.nbs');
  if (songFile) {
    arrayBuffer = await songFile.async('arraybuffer');
  }
  const song = await loadNbsFile(arrayBuffer);

  // Load sound files from the 'sounds' directory
  const soundFiles = Object.keys(zip.files).filter((file) => file.startsWith('sounds/'));
  const extraSounds: ExtraSounds = {};
  for (const file of soundFiles) {
    const soundData = await zip.file(file)?.async('arraybuffer');
    if (!soundData) continue;
    const fileName = getBaseName(file);
    extraSounds[fileName] = soundData;
  }

  return [song, extraSounds];
}

async function loadNbsFile(arrayBuffer: ArrayBuffer): Promise<Song> {
  const song = await fromArrayBuffer(arrayBuffer);
  return song;
}

// ==========================================

export type NoteEvent = {
  tick: number;
  instrument: number;
  key: number;
  velocity: number;
  panning: number;
};

export function cachedProperty(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
): void {
  const originalGetter = descriptor.get;
  if (!originalGetter) {
    throw new Error(`@cachedProperty must be used on a getter`);
  }

  const backingField = `_${propertyKey}`;

  descriptor.get = function () {
    if (this[backingField] === undefined) {
      this[backingField] = originalGetter.call(this);
    }
    return this[backingField];
  };
}

export class SongManager {
  private _song: Song;

  private _length?: number;
  private _noteEvents?: Record<number, Array<NoteEvent>>;
  private _tempoChangeEvents?: Record<number, number>;
  private _tempoSegments?: Record<number, number>;
  private _ticksPlayedAtEachSecond?: Record<number, number>;

  constructor(song?: Song) {
    this._song = song ?? new Song();
  }

  @cachedProperty
  get length(): number {
    console.log("Calculating song length...");
    let maxTick = 0;
    for (const layer of this._song.layers) {
      for (const tickStr in layer.notes) {
        const tick = parseInt(tickStr);
        if (tick > maxTick) {
          maxTick = tick;
        }
      }
    }
    console.log(`Song length is ${maxTick} ticks`);
    console.trace("Song length calculation stack trace");
    return maxTick;
  }

  @cachedProperty
  get noteEvents(): Record<number, Array<NoteEvent>> {
    const noteEventsPerTick: Record<number, Array<NoteEvent>> = {};
    for (const layer of this._song.layers) {
      for (const tickStr in layer.notes) {
        const note = layer.notes[tickStr];
        const tick = parseInt(tickStr);
        const instrument = note.instrument;
        const key = note.key + note.pitch / 100;
        const velocity = ((note.velocity / 100) * layer.volume) / 100;
        const panning =
          (layer.stereo === 0 ? note.panning : (note.panning + layer.stereo) / 2) / 100;

        const noteEvent: NoteEvent = { tick, instrument, key, velocity, panning };

        if (!(tick in noteEventsPerTick)) {
          noteEventsPerTick[tick] = [];
        }
        noteEventsPerTick[tick].push(noteEvent);
      }
    }
    return noteEventsPerTick;
  }

  get initialTempo(): number {
    return this._song.tempo;
  }

  @cachedProperty()
  get tempoChangeEvents(): Record<number, number> {
    const tempoChangerInstrumentIds = this.getTempoChangerInstrumentIds();
    const tempoChangeEvents: Record<number, number> = {};

    for (const layer of this._song.layers) {
      for (const tickStr in layer.notes) {
        const note = layer.notes[tickStr];
        if (tempoChangerInstrumentIds.includes(note.instrument)) {
          const tick = parseInt(tickStr);
          const tempo = note.pitch / 15;
          tempoChangeEvents[tick] = tempo;
        }
      }
    }

    return tempoChangeEvents;
  }

  @cachedProperty()
  get tempoSegments(): Record<number, number> {
    const segments: Record<number, number> = {};
    const changes = this.tempoChangeEvents;
    let lastTempo = this.initialTempo;

    for (let tick = 0; tick < this.length; tick++) {
      const tempo = changes[tick] ?? lastTempo;
      lastTempo = tempo;
      segments[tick] = tempo;
    }

    return segments;
  }

  @cachedProperty()
  get ticksPlayedAtEachSecond(): Record<number, number> {
    console.log("Calculating ticks played at each second...");
    console.trace("Calculating ticks played at each second");

    const ticksPerSecond: Record<number, number> = {};
    let tickPlayTimeSeconds = 0;
    let lastSecond = -1;

    const segments = this.tempoSegments;

    for (let tick = 0; tick < this.length; tick++) {
      const tempo = segments[tick];
      tickPlayTimeSeconds += 1 / tempo;
      const second = Math.floor(tickPlayTimeSeconds);
      if (second === lastSecond) continue;
      lastSecond = second;
      ticksPerSecond[second] = tick;
    }

    console.log("Finished calculating ticks played at each second.");
    return ticksPerSecond;
  }

  private getTempoChangerInstrumentIds(): number[] {
    return this._song.instruments.loaded.flatMap((instrument, id) =>
      instrument.meta.name === "Tempo Changer" ? [id] : []
    );
  }

  public getTickRangeForTime(startTime: number, length: number): [number, number] {
    if (startTime < 0 || length <= 0) {
      throw new Error("Invalid start time or length");
    }

    const ticksPerSecond = this.ticksPlayedAtEachSecond;
    const startTick = ticksPerSecond[startTime];
    const endTick = ticksPerSecond[startTime + length];

    if (startTick === undefined || endTick === undefined) {
      console.warn(`No ticks found for time range ${startTime} to ${startTime + length}`);
    }

    return [startTick ?? 0, endTick ?? this._song.length];