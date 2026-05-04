import type { Song } from '@encode42/nbs.js';
import type { AudioPlaybackPayload } from '@opennbs/nbsvis-audio-api';
import { NoteBuffer } from '@opennbs/nbsvis-audio-api';

import type PlayerInstrument from './instrument';
import { getTempoChangeEvents } from './song';

async function instrumentSourceToArrayBuffer(
  source: string | ArrayBuffer,
): Promise<ArrayBuffer | null> {
  if (!source) return null;
  if (typeof source === 'string') {
    const response = await fetch(source);
    return await response.arrayBuffer();
  }
  return source.slice(0);
}

export async function buildAudioPlaybackPayload(
  song: Song,
  noteBuffer: NoteBuffer,
  instruments: readonly PlayerInstrument[],
): Promise<AudioPlaybackPayload> {
  const instrumentBuffers: Record<number, ArrayBuffer> = {};

  for (const [index, ins] of instruments.entries()) {
    const buf = await instrumentSourceToArrayBuffer(ins.audioSource);
    if (buf) {
      instrumentBuffers[index] = buf;
    }
  }

  const tempoChangeEvents = getTempoChangeEvents(song);
  const tempoSegments = Object.entries(tempoChangeEvents).map(([startTick, bpm]) => ({
    startTick: Number(startTick),
    bpm,
  }));
  tempoSegments.sort((a, b) => a.startTick - b.startTick);

  return {
    noteData: noteBuffer.getBuffer(),
    instrumentBuffers,
    timeline: {
      initialTempo: song.tempo * 15,
      lengthTicks: song.length,
      tempoSegments,
    },
    loopStartTick: song.loop.startTick,
    ticksPerBeat: 4,
  };
}
