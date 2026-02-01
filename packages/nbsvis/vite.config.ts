import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets';
import { resolve } from 'pathe';
import { defineConfig, UserConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }: UserConfig) => {
  return {
    plugins: [
      dts({
        insertTypesEntry: true,
      }),
      // inline assets in dev mode, use lib-assets in production mode
      // libAssetsPlugin currently does not regenerate assets in --watch mode:
      // https://github.com/laynezh/vite-plugin-lib-assets/issues/62
      mode == 'production' && libAssetsPlugin(),
    ],
    build: {
      target: 'ESNext',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'esbuild' : false,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'nbsvis',
        fileName: 'nbsvis',
        formats: ['es'], // TODO: umd, cjs (remove top-level await)
      },
      rollupOptions: {
        external: ['pixi.js'],
      },
    },
  } satisfies UserConfig;
});
