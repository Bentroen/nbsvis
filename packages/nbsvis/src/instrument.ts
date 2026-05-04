import { Song } from '@encode42/nbs.js';

import instrumentAssetPaths from './instrument-assets/manifest';
import { ExtraSounds } from './song';

export const defaultInstrumentData = [
  { name: 'Harp', audioSource: instrumentAssetPaths['sounds/harp.ogg'] },
  { name: 'Double Bass', audioSource: instrumentAssetPaths['sounds/dbass.ogg'] },
  { name: 'Bass Drum', audioSource: instrumentAssetPaths['sounds/bdrum.ogg'] },
  { name: 'Snare Drum', audioSource: instrumentAssetPaths['sounds/sdrum.ogg'] },
  { name: 'Click', audioSource: instrumentAssetPaths['sounds/click.ogg'] },
  { name: 'Guitar', audioSource: instrumentAssetPaths['sounds/guitar.ogg'] },
  { name: 'Flute', audioSource: instrumentAssetPaths['sounds/flute.ogg'] },
  { name: 'Bell', audioSource: instrumentAssetPaths['sounds/bell.ogg'] },
  { name: 'Chime', audioSource: instrumentAssetPaths['sounds/icechime.ogg'] },
  { name: 'Xylophone', audioSource: instrumentAssetPaths['sounds/xylobone.ogg'] },
  { name: 'Iron Xylophone', audioSource: instrumentAssetPaths['sounds/iron_xylophone.ogg'] },
  { name: 'Cow Bell', audioSource: instrumentAssetPaths['sounds/cow_bell.ogg'] },
  { name: 'Didgeridoo', audioSource: instrumentAssetPaths['sounds/didgeridoo.ogg'] },
  { name: 'Bit', audioSource: instrumentAssetPaths['sounds/bit.ogg'] },
  { name: 'Banjo', audioSource: instrumentAssetPaths['sounds/banjo.ogg'] },
  { name: 'Pling', audioSource: instrumentAssetPaths['sounds/pling.ogg'] },
];

export default class PlayerInstrument {
  name: string;
  baseKey: number;
  audioSource: string | ArrayBuffer;
  audioBuffer?: AudioBuffer;
  isBuiltIn: boolean;

  constructor(
    name: string,
    baseKey: number,
    audioSource: string | ArrayBuffer = '',
    isBuiltIn: boolean = false,
  ) {
    this.name = name;
    this.baseKey = baseKey;
    this.audioSource = audioSource;
    this.isBuiltIn = isBuiltIn;
  }
}

export const defaultInstruments: readonly PlayerInstrument[] = defaultInstrumentData.map(
  (data) => new PlayerInstrument(data.name, 45, data.audioSource, true),
);

export function loadCustomInstruments(song: Song, extraSounds: ExtraSounds) {
  const customInstruments = song.instruments.loaded
    .filter((ins) => !ins.builtIn)
    .map(
      (ins) =>
        new PlayerInstrument(ins.meta.name, ins.key, extraSounds[ins.meta.soundFile] || '', false),
    );
  return customInstruments;
}
