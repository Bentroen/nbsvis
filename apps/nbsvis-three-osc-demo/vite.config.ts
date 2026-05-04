import path from 'path';

import { defineConfig, normalizePath, UserConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/',
  plugins: [
    viteStaticCopy({
      targets: [
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
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    fs: {
      allow: ['..'],
    },
  },
  build: {
    target: 'esnext',
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
} satisfies UserConfig);
