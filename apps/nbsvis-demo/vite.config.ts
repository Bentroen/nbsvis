import { defineConfig, UserConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/',
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@nbsvis/core/dist/assets/mixer-processor-*.js',
          dest: 'assets',
        },
      ],
    }),
  ],
  build: {
    target: 'esnext',
  },
} satisfies UserConfig);
