import { Song } from '@encode42/nbs.js';

import assetPaths from './assets';
import { ExtraSounds } from './song';

export const defaultInstrumentData = [
  { name: 'Harp', audioSource: assetPaths['sounds/harp.ogg'] },
  { name: 'Double Bass', audioSource: assetPaths['sounds/dbass.ogg'] },
  { name: 'Bass Drum', audioSource: assetPaths['sounds/bdrum.ogg'] },
  { name: 'Snare Drum', audioSource: assetPaths['sounds/sdrum.ogg'] },
  { name: 'Click', audioSource: assetPaths['sounds/click.ogg'] },
  { name: 'Guitar', audioSource: assetPaths['sounds/guitar.ogg'] },
  { name: 'Flute', audioSource: assetPaths['sounds/flute.ogg'] },
  { name: 'Bell', audioSource: assetPaths['sounds/bell.ogg'] },
  { name: 'Chime', audioSource: assetPaths['sounds/icechime.ogg'] },
  { name: 'Xylophone', audioSource: assetPaths['sounds/xylobone.ogg'] },
  { name: 'Iron Xylophone', audioSource: assetPaths['sounds/iron_xylophone.ogg'] },
  { name: 'Cow Bell', audioSource: assetPaths['sounds/cow_bell.ogg'] },
  { name: 'Didgeridoo', audioSource: assetPaths['sounds/didgeridoo.ogg'] },
  { name: 'Bit', audioSource: assetPaths['sounds/bit.ogg'] },
  { name: 'Banjo', audioSource: assetPaths['sounds/banjo.ogg'] },
  { name: 'Pling', audioSource: assetPaths['sounds/pling.ogg'] },
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
