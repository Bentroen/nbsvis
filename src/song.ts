import { Song, fromArrayBuffer } from '@encode42/nbs.js';
import JSZIP from 'jszip';

const isZipFile = (buffer: ArrayBuffer) => {
  const view = new Uint8Array(buffer);
  return view[0] === 0x50 && view[1] === 0x4b && view[2] === 0x03 && view[3] === 0x04;
};

export type ExtraSounds = {
  data: ArrayBuffer;
  tone: number;
};

export const loadSong = async (
  url: string,
): Promise<{
  extraSounds: ExtraSounds[];
  song: Song;
}> => {
  const response = await fetch(url);
  let arrayBuffer = await response.arrayBuffer();
  const extraSounds: ExtraSounds[] = [];
  let song: Song;
  if (isZipFile(arrayBuffer)) {
    console.debug('Loading zip file');
    const zip = await JSZIP.loadAsync(arrayBuffer);
    // get the song file song.nbs on the root of the zip
    const songFile = zip.file('song.nbs');
    if (songFile) {
      arrayBuffer = await songFile.async('arraybuffer');
    }
    // parse the song file
    song = await fromArrayBuffer(arrayBuffer);
    // get the extra sounds
    // get all files in the sounds folder
    const soundFiles = Object.keys(zip.files).filter((file) => file.startsWith('sounds/'));
    // the files don't have a .ogg extension but they are ogg files
    for (const file of soundFiles) {
      const data = await zip.file(file)?.async('arraybuffer');
      if (data) {
        const fileName = file.split('/')[1];
        const tone = song.instruments.loaded.find((i) => i.meta.soundFile === fileName)?.key || 45;
        const extra = { data, tone };
        console.debug('extra sound', extra);
        extraSounds.push(extra);
      }
    }

    arrayBuffer = (await zip.file('song.nbs')?.async('arraybuffer')) || arrayBuffer;
  } else {
    console.debug('Loading nbs file');
    song = await fromArrayBuffer(arrayBuffer);
  }

  return {
    extraSounds,
    song,
  };
};
