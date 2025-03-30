import libAssetsPlugin from '@laynezh/vite-plugin-lib-assets';
import { resolve } from 'pathe';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
    libAssetsPlugin({
      include: './assets/**',
      name: '[name].[ext]',
    }),
  ],
  //assetsInclude: './assets/**',
  build: {
    target: 'esnext',
    emitAssets: true,
    assetsDir: 'assets',
    assetsInlineLimit: 0,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'nbsvis',
      fileName: 'nbsvis',
      formats: ['es'], // TODO: umd, cjs (remove top-level await)
    },
  },
});
