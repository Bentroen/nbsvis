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

export class SongManager {
  private _song: Song;

  private _length: number = 0;

  private _noteEvents: Record<number, Array<NoteEvent>> = {};

  private _tempoChangeEvents: Record<number, number> = {};

  private _tempoSegments: Record<number, number> = {};

  private _ticksPlayedAtEachSecond: Record<number, number> = {};

  constructor(song: Song) {
    this._song = song;
  }

  get length() {
    if (this._length === 0) {
      this._length = this.getLength();
    }
    return this._length;
  }

  get noteEvents() {
    if (Object.keys(this._noteEvents).length === 0) {
      this._noteEvents = this.getNoteEvents();
    }
    return this._noteEvents;
  }

  get initialTempo() {
    return this._song.tempo;
  }

  get tempoChangeEvents() {
    if (Object.keys(this._tempoChangeEvents).length === 0) {
      this._tempoChangeEvents = this.getTempoChangeEvents();
    }
    return this._tempoChangeEvents;
  }

  get tempoSegments() {
    if (Object.keys(this._tempoSegments).length === 0) {
      //console.log('Calculating tempo segments...');
      this._tempoSegments = this.getTempoSegments();
    } // else {
    //console.log('Using cached tempo segments');
    //}
    return this._tempoSegments;
  }

  get ticksPlayedAtEachSecond() {
    if (Object.keys(this._ticksPlayedAtEachSecond).length === 0) {
      this._ticksPlayedAtEachSecond = this.getTicksPlayedAtEachSecond();
    }
    return this._ticksPlayedAtEachSecond;
  }

  private getLength(): number {
    let length = 0;
    //console.log(this._song.layers);
    //console.log(this._song.meta.name);
    for (const layer of this._song.layers) {
      for (const tickStr in layer.notes) {
        const tick = parseInt(tickStr);
        if (tick > length) {
          length = tick;
        }
      }
    }
    //console.log('Calculated length:', length);
    return length;
  }

  private getNoteEvents() {
    const noteEventsPerTick: Record<number, Array<NoteEvent>> = [];

    for (const layer of this._song.layers) {
      for (const tickStr in layer.notes) {
        const note = layer.notes[tickStr];

        const tick = parseInt(tickStr);
        const instrument = note.instrument;
        const key = note.key + note.pitch / 100;
        const velocity = ((note.velocity / 100) * layer.volume) / 100;
        const panning =
          (layer.stereo === 0 ? note.panning : (note.panning + layer.stereo) / 2) / 100;

        const noteEvent = {
          tick,
          instrument,
          key,
          velocity,
          panning,
        };

        if (!(tick in noteEventsPerTick)) {
          noteEventsPerTick[tick] = [];
        }
        noteEventsPerTick[tick].push(noteEvent);
      }
    }
    return noteEventsPerTick;
  }

  private getTempoChangerInstrumentIds(): Array<number> {
    return this._song.instruments.loaded.flatMap((instrument, id) =>
      instrument.meta.name === 'Tempo Changer' ? [id] : [],
    );
  }
  private getTempoChangeEvents() {
    const tempoChangerInstrumentIds = this.getTempoChangerInstrumentIds();
    const tempoChangeEvents: Record<number, number> = {};

    for (const layer of this._song.layers) {
      for (const tickStr in layer.notes) {
        const note = layer.notes[tickStr];
        if (tempoChangerInstrumentIds.includes(note.instrument)) {
          const tick = parseInt(tickStr);
          const tempo = note.pitch / 15; // Convert from BPM to t/s
          tempoChangeEvents[tick] = tempo;
        }
      }
    }

    return tempoChangeEvents;
  }

  private getTempoSegments() {
    const tempoChangeEvents = this.tempoChangeEvents;
    const tempoSegments: Record<number, number> = {};
    let lastTempo = this._song.tempo;

    //console.log('Song length:', this.length);
    //console.log('Tempo change events:', tempoChangeEvents);

    for (let tick = 0; tick < this.length; tick++) {
      const tempo = tempoChangeEvents[tick] || lastTempo;
      lastTempo = tempo;
      tempoSegments[tick] = tempo;
    }

    return tempoSegments;
  }

  private getTicksPlayedAtEachSecond(): Record<number, number> {
    const ticksPerSecond: Record<number, number> = {};

    //console.log('Calculating ticks played at each second...');

    let tickPlayTimeSeconds = 0;
    let lastSecond = -1;
    const tempoSegments = this.tempoSegments;
    //console.log(this.length, tempoSegments);
    for (let tick = 0; tick < this.length; tick++) {
      const tempoAtTick = tempoSegments[tick];
      tickPlayTimeSeconds += 1 / tempoAtTick;
      const second = Math.floor(tickPlayTimeSeconds);
      if (second === lastSecond) continue; // Skip if we're still in the same second
      lastSecond = second;
      // Store the tick at the end of this second
      ticksPerSecond[second] = tick;
    }

    // TODO: Ensure the last second captures the end of the song

    //console.log('Finished calculating ticks played at each second.');

    return ticksPerSecond;
  }

  // TODO: may be better as startTime and endTime
  public getTickRangeForTime(startTime: number, length: number): [number, number] {
    if (startTime < 0 || length <= 0) {
      throw new Error('Invalid start time or length');
    }
    const ticksPerSecond = this.ticksPlayedAtEachSecond;
    const startTick = ticksPerSecond[startTime];
    const endTick = ticksPerSecond[startTime + length];

    //console.log(ticksPerSecond);
    //
    //console.log(startTime, length);
    //
    //console.log(startTick, endTick);
    //
    //console.trace(
    //  `Getting tick range for time ${startTime} to ${startTime + length}:`,
    //  startTick,
    //  endTick,
    //);

    if (startTick === undefined || endTick === undefined) {
      console.log(startTick, endTick);
      console.warn(`No ticks found for time range ${startTime} to ${startTime + length}`);
    }

    return [startTick ?? 0, endTick ?? this.length];
  }
}
