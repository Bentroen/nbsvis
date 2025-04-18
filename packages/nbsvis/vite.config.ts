import { resolve } from 'pathe';
import { defineConfig, UserConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }: UserConfig) => {
  return {
    plugins: [
      dts({
        insertTypesEntry: true,
      }),
    ],
    build: {
      target: 'ESNext',
      sourcemap: mode === 'development',
      minify: mode === 'production' ? 'terser' : false,
      lib: {
        entry: resolve(__dirname, 'src/main.ts'),
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
