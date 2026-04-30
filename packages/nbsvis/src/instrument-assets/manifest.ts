const assets = import.meta.glob('./sounds/**/*', { eager: true, query: '?url', import: 'default' });

export const instrumentAssetPaths = Object.fromEntries(
  Object.entries(assets).map(([key, value]) => [key.replace('./', ''), value as string]),
);

export default instrumentAssetPaths;
