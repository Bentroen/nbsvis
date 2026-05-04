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
      mode == 'production' && libAssetsPlugin(),
    ],
    build: {
      target: 'ESNext',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'esbuild' : false,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'nbsvisWebAudio',
        fileName: 'index',
        formats: ['es'],
      },
      rollupOptions: {},
    },
  } satisfies UserConfig;
});
