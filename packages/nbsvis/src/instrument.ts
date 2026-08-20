import { Song } from '@encode42/nbs.js';

import assetPaths from './assets';
import { ExtraSounds, resolveExtraSound } from './song';

export class MissingAudioFileError extends Error {
  constructor(
    readonly instrumentId: number,
    readonly instrumentName: string,
    readonly soundFile?: string,
  ) {
    const label = `${instrumentId} (${instrumentName})`;
    super(
      soundFile
        ? `Missing audio file "${soundFile}" for instrument ${label}`
        : `Missing audio file for instrument ${label}`,
    );
    this.name = 'MissingAudioFileError';
  }
}

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
  { name: 'Trumpet', audioSource: assetPaths['sounds/trumpet.ogg'] },
  { name: 'Exposed Trumpet', audioSource: assetPaths['sounds/trumpet_exposed.ogg'] },
  { name: 'Weathered Trumpet', audioSource: assetPaths['sounds/trumpet_weathered.ogg'] },
  { name: 'Oxidized Trumpet', audioSource: assetPaths['sounds/trumpet_oxidized.ogg'] },
];

export default class PlayerInstrument {
  id: number;
  name: string;
  baseKey: number;
  audioSource: string | ArrayBuffer;
  audioBuffer?: AudioBuffer;
  isBuiltIn: boolean;

  constructor(
    id: number,
    name: string,
    baseKey: number,
    audioSource: string | ArrayBuffer = '',
    isBuiltIn: boolean = false,
  ) {
    this.id = id;
    this.name = name;
    this.baseKey = baseKey;
    this.audioSource = audioSource;
    this.isBuiltIn = isBuiltIn;
  }
}

export const defaultInstruments: readonly PlayerInstrument[] = defaultInstrumentData.map(
  (data, id) => new PlayerInstrument(id, data.name, 45, data.audioSource, true),
);

export function loadCustomInstruments(song: Song, extraSounds: ExtraSounds) {
  const customInstruments: PlayerInstrument[] = [];

  song.instruments.loaded.forEach((ins, id) => {
    if (!ins || ins.builtIn) return;

    const soundFile = ins.meta.soundFile;
    const sound = resolveExtraSound(extraSounds, soundFile);
    if (soundFile && !sound) {
      console.warn(new MissingAudioFileError(id, ins.meta.name, soundFile));
    }

    customInstruments.push(new PlayerInstrument(id, ins.meta.name, ins.key, sound || '', false));
  });

  return customInstruments;
}
