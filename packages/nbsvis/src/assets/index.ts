import { Assets } from 'pixi.js';

// Dynamically import all assets in the current folder and subfolders
const assets = import.meta.glob('./**/*', { eager: true, query: '?url', import: 'default' });

// Export the assets as named exports
export const assetPaths = Object.fromEntries(
  Object.entries(assets).map(([key, value]) => [key.replace('./', ''), value as string]),
);

// Optionally, export individual assets if needed
export default assetPaths;

export const noteBlockTexture = await Assets.load(assetPaths['img/note_block_grayscale.png']);

export const whiteKeyTexture = await Assets.load(assetPaths['img/key_white.png']);
export const blackKeyTexture = await Assets.load(assetPaths['img/key_black.png']);
