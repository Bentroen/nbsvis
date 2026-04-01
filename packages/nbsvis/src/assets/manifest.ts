// Dynamically import all assets in the current folder and subfolders
const assets = import.meta.glob('./**/*', { eager: true, query: '?url', import: 'default' });

// Export the assets as named exports
export const assetPaths = Object.fromEntries(
  Object.entries(assets).map(([key, value]) => [key.replace('./', ''), value as string]),
);

// Optionally, export individual assets if needed
export default assetPaths;
