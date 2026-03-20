import path from 'path';

import { defineConfig, normalizePath, UserConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/',
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/@nbsvis/core/dist/assets/*.js')),
          dest: 'assets',
        },
        {
          src: normalizePath(
            path.resolve(__dirname, 'node_modules/coi-serviceworker/coi-serviceworker.js'),
          ),
          dest: '',
        },
      ],
    }),
  ],
  server: {
    headers: {
      // for SharedArrayBuffer support
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    fs: {
      allow: ['..'], // allow serving from parent dirs (monorepo)
    },
  },
  build: {
    target: 'esnext',
  },
  preview: {
    headers: {
      // for SharedArrayBuffer support
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
} satisfies UserConfig);
