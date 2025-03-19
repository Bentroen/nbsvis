import { fromArrayBuffer } from '@encode42/nbs.js';

export async function loadSong(url: string) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return fromArrayBuffer(arrayBuffer);
}
