// Sourced from:
// https://github.com/OpenNBS/NoteBlockWorld/blob/6e7e740bff85367bbeddf0308bacf5bff3480900/packages/song/src/nbsCompat.ts

import { Song } from '@encode42/nbs.js';
import JSZIP from 'jszip';

import { NoteBuffer } from './note';
import { loadNbsFromBuffer } from './util/nbsCompat';

function isZipFile(buffer: ArrayBuffer) {
  const view = new Uint8Array(buffer);
  return view[0] === 0x50 && view[1] === 0x4b && view[2] === 0x03 && view[3] === 0x04;
}

/**
 * Extra custom-instrument samples, keyed by path relative to the sounds root.
 *
 * Sound file resolution cases:
 *
 * - **Default instruments:** only the base path is loaded in `defaultInstruments`
 *   (e.g. `"pling.ogg"`; resolved from the root; loaded from the default set of
 *   sounds bundled in the package).
 * - **Custom instruments in non-zipped files:** resolve exactly the same way as default instruments
 *   (e.g. `"custom1.ogg"` would look for a file colocated with `"pling.ogg"` in
 *   the root; `"foo/bar.ogg"` would look for `"bar.ogg"` inside `"foo/"`). We
 *   don't handle this case specifically yet as there's nowhere to source the
 *   files from if the loaded song is not a ZIP.
 * - **Custom instruments in ZIP files:** sound files are stored inside the `sounds/` folder in the ZIP.
 *   Sounds are resolved relative to `sounds/` (i.e. the `"sounds/"` prefix
 *   should never be part of the instrument's prefix; instead, `"sounds/"` is
 *   our root to resolve from).
 */
export type ExtraSounds = Record<string, ArrayBuffer>;

/** Path relative to the sounds root (never includes a leading `sounds/`). */
function normalizeSoundFile(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.startsWith('sounds/') ? normalized.slice('sounds/'.length) : normalized;
}

export function addExtraSound(extraSounds: ExtraSounds, zipPath: string, data: ArrayBuffer) {
  const key = normalizeSoundFile(zipPath);
  if (!key) return;
  extraSounds[key] = data;
}

export function resolveExtraSound(
  extraSounds: ExtraSounds,
  soundFile: string,
): ArrayBuffer | undefined {
  const key = normalizeSoundFile(soundFile);
  if (!key) return undefined;
  return extraSounds[key];
}

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
  const extraSounds: ExtraSounds = {};
  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;
    if (!path.replace(/\\/g, '/').startsWith('sounds/')) continue;

    const soundData = await zipEntry.async('arraybuffer');
    if (!soundData || soundData.byteLength === 0) continue;
    addExtraSound(extraSounds, path, soundData);
  }

  return [song, extraSounds];
}

async function loadNbsFile(arrayBuffer: ArrayBuffer): Promise<Song> {
  const song = await loadNbsFromBuffer(arrayBuffer);
  return song;
}

function getTempoChangerInstrumentIds(song: Song): Array<number> {
  return song.instruments.loaded.flatMap((instrument, id) =>
    instrument.meta.name === 'Tempo Changer' ? [id] : [],
  );
}
export function getTempoChangeEvents(song: Song) {
  const tempoChangerInstrumentIds = getTempoChangerInstrumentIds(song);
  const tempoChangeEvents: Record<number, number> = {};

  for (const layer of song.layers) {
    for (const tickStr in layer.notes) {
      const note = layer.notes[tickStr];
      if (tempoChangerInstrumentIds.includes(note.instrument)) {
        const tick = parseInt(tickStr);
        const tempo = note.pitch; // TODO: we should work with t/s at this abstraction level - not BPM
        tempoChangeEvents[tick] = tempo;
      }
    }
  }

  return tempoChangeEvents;
}

export function getTempoSegments(song: Song) {
  // TODO: this is recalculated. Cache it or extend the Song class with this data
  const tempoChangeEvents = getTempoChangeEvents(song);
  const tempoSegments: Record<number, number> = {};
  let lastTempo = song.tempo;

  for (let tick = 0; tick < song.length; tick++) {
    const tempo = tempoChangeEvents[tick] || lastTempo;
    lastTempo = tempo;
    tempoSegments[tick] = tempo;
  }

  return tempoSegments;
}

export function getNoteEvents(song: Song) {
  const forEachEvent = (
    callback: (event: {
      tick: number;
      sampleId: number;
      pitch: number;
      gain: number;
      pan: number;
    }) => void,
  ) => {
    for (const layer of song.layers) {
      for (const tickStr in layer.notes) {
        const note = layer.notes[tickStr];

        const tick = parseInt(tickStr, 10);
        const instrument = note.instrument;
        const instrumentKeyOffset = song.instruments.loaded[instrument].key - 45;
        const key = note.key + instrumentKeyOffset + note.pitch / 100;
        const velocity = ((note.velocity / 100) * layer.volume) / 100;
        const panning =
          (layer.stereo === 0 ? note.panning : (note.panning + layer.stereo) / 2) / 100;

        if (velocity === 0) continue;

        callback({
          tick,
          sampleId: instrument,
          pitch: 2 ** ((key - 45) / 12),
          gain: velocity,
          pan: panning,
        });
      }
    }
  };

  let noteCount = 0;
  let maxTick = 0;
  forEachEvent(({ tick }) => {
    noteCount += 1;
    if (tick > maxTick) maxTick = tick;
  });

  const tickCount = maxTick + 1;
  const noteBuffer = NoteBuffer.allocate(noteCount, tickCount);

  const noteCountsPerTick = new Uint32Array(tickCount);
  forEachEvent((event) => {
    noteCountsPerTick[event.tick] += 1;
  });

  noteBuffer.initializeTickOffsets(noteCountsPerTick);

  forEachEvent((event) => {
    noteBuffer.writeNote(event.tick, event.sampleId, event.pitch, event.gain, event.pan);
  });

  return noteBuffer;
}
