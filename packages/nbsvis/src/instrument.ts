import { Song } from '@encode42/nbs.js';

import banjo from './assets/sounds/banjo.ogg';
import bdrum from './assets/sounds/bdrum.ogg';
import bell from './assets/sounds/bell.ogg';
import bit from './assets/sounds/bit.ogg';
import click from './assets/sounds/click.ogg';
import cow_bell from './assets/sounds/cow_bell.ogg';
import dbass from './assets/sounds/dbass.ogg';
import didgeridoo from './assets/sounds/didgeridoo.ogg';
import flute from './assets/sounds/flute.ogg';
import guitar from './assets/sounds/guitar.ogg';
import harp from './assets/sounds/harp.ogg';
import icechime from './assets/sounds/icechime.ogg';
import iron_xylophone from './assets/sounds/iron_xylophone.ogg';
import pling from './assets/sounds/pling.ogg';
import sdrum from './assets/sounds/sdrum.ogg';
import xylobone from './assets/sounds/xylobone.ogg';
import { ExtraSounds } from './song';

export const defaultInstrumentData = [
  { name: 'Harp', audioSource: harp },
  { name: 'Double Bass', audioSource: dbass },
  { name: 'Bass Drum', audioSource: bdrum },
  { name: 'Snare Drum', audioSource: sdrum },
  { name: 'Click', audioSource: click },
  { name: 'Guitar', audioSource: guitar },
  { name: 'Flute', audioSource: flute },
  { name: 'Bell', audioSource: bell },
  { name: 'Chime', audioSource: icechime },
  { name: 'Xylophone', audioSource: xylobone },
  { name: 'Iron Xylophone', audioSource: iron_xylophone },
  { name: 'Cow Bell', audioSource: cow_bell },
  { name: 'Didgeridoo', audioSource: didgeridoo },
  { name: 'Bit', audioSource: bit },
  { name: 'Banjo', audioSource: banjo },
  { name: 'Pling', audioSource: pling },
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
