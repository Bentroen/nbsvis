import type { Song } from '@encode42/nbs.js';
import type { ViewerRenderBlock, ViewerRenderPayload } from '@opennbs/nbsvis-viewer-api';

import { forEachScheduledNote } from './song';

const CENTS_PER_OCTAVE = 1200;

export function buildViewerRenderPayload(song: Song): ViewerRenderPayload {
  const layers = song.layers.map((layer, id) => ({
    id,
    name: `Layer ${id}`,
    volume: layer.volume,
  }));

  const blocks: ViewerRenderBlock[] = [];

  forEachScheduledNote(song, (e) => {
    const pitchCents = Math.log2(e.pitch) * CENTS_PER_OCTAVE;
    const key = Math.max(0, Math.min(87, Math.floor(pitchCents / 100) + 45));
    blocks.push({
      tick: e.tick,
      layer: e.layerIndex,
      instrument: e.sampleId,
      key,
      velocity: e.gain,
      panning: e.pan,
      pitchRatio: e.pitch,
    });
  });

  return {
    layers,
    blocks,
    songLength: song.length,
    initialTempo: song.tempo * 15,
  };
}
