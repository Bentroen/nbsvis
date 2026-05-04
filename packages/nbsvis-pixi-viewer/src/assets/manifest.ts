const assets = import.meta.glob('./img/**/*', { eager: true, query: '?url', import: 'default' });

export const viewerImagePaths = Object.fromEntries(
  Object.entries(assets).map(([key, value]) => [key.replace('./', ''), value as string]),
);

export default viewerImagePaths;
