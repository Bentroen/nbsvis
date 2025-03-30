import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  rootDir: 'src',
  preset: 'ts-jest',
  moduleFileExtensions: ['js', 'ts', 'json'],
  modulePaths: ['<rootDir>/src'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**', '!**/*.d.ts'],
};

export default config;
