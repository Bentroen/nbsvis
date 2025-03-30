import { Song } from '@encode42/nbs.js';

import { ExtraSounds } from './song';

export const defaultInstrumentData = [
  { name: 'Harp', audioSource: 'assets/sounds/harp.ogg' },
  { name: 'Double Bass', audioSource: 'assets/sounds/dbass.ogg' },
  { name: 'Bass Drum', audioSource: 'assets/sounds/bdrum.ogg' },
  { name: 'Snare Drum', audioSource: 'assets/sounds/sdrum.ogg' },
  { name: 'Click', audioSource: 'assets/sounds/click.ogg' },
  { name: 'Guitar', audioSource: 'assets/sounds/guitar.ogg' },
  { name: 'Flute', audioSource: 'assets/sounds/flute.ogg' },
  { name: 'Bell', audioSource: 'assets/sounds/bell.ogg' },
  { name: 'Chime', audioSource: 'assets/sounds/icechime.ogg' },
  { name: 'Xylophone', audioSource: 'assets/sounds/xylobone.ogg' },
  { name: 'Iron Xylophone', audioSource: 'assets/sounds/iron_xylophone.ogg' },
  { name: 'Cow Bell', audioSource: 'assets/sounds/cow_bell.ogg' },
  { name: 'Didgeridoo', audioSource: 'assets/sounds/didgeridoo.ogg' },
  { name: 'Bit', audioSource: 'assets/sounds/bit.ogg' },
  { name: 'Banjo', audioSource: 'assets/sounds/banjo.ogg' },
  { name: 'Pling', audioSource: 'assets/sounds/pling.ogg' },
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

const defaultInstruments: Array<PlayerInstrument> = defaultInstrumentData.map(
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

export function loadInstruments(song: Song, extraSounds: ExtraSounds) {
  const customInstruments = loadCustomInstruments(song, extraSounds);
  const allInstruments = defaultInstruments.concat(customInstruments);
  console.debug('All instruments created.');
  return allInstruments;
}
