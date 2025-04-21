import { UserConfig } from 'vite';

export default {
  base: process.env.VITE_BASE_URL || '/',
  build: {
    target: 'esnext',
  },
} satisfies UserConfig;
