import { Assets, Texture } from 'pixi.js';

import viewerImagePaths from './manifest';

export type ViewAssetDescriptor<T = unknown> = {
  id: string;
  load: () => Promise<T>;
};

async function loadNearestTexture(path: string): Promise<Texture> {
  const texture = await Assets.load(path);
  texture.source.scaleMode = 'nearest';
  return texture;
}

export const viewerAssets = {
  noteBlockTexture: {
    id: 'texture.note.block.grayscale',
    load: () => loadNearestTexture(viewerImagePaths['img/note_block_grayscale.png']),
  } satisfies ViewAssetDescriptor<Texture>,
  whiteKeyTexture: {
    id: 'texture.piano.key.white',
    load: () => loadNearestTexture(viewerImagePaths['img/key_white.png']),
  } satisfies ViewAssetDescriptor<Texture>,
  blackKeyTexture: {
    id: 'texture.piano.key.black',
    load: () => loadNearestTexture(viewerImagePaths['img/key_black.png']),
  } satisfies ViewAssetDescriptor<Texture>,
};
