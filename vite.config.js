import path from 'node:path';
import process from 'node:process';

import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demo',
  publicDir: '../public',
  build: {
    rollupOptions: {
      input: {
        app: './demo/index.html',
      },
    },
  },
  resolve: {
    alias: { '/src': path.resolve(process.cwd(), 'src') },
  },
});
