import type { Song } from '@encode42/nbs.js';

import { loadCustomInstruments } from './instrument';

jest.mock('./assets', () => ({
  __esModule: true,
  default: {},
}));

function fakeInstrument(options: {
  builtIn: boolean;
  id: number;
  name: string;
  soundFile: string;
  key?: number;
}) {
  return {
    builtIn: options.builtIn,
    id: options.id,
    key: options.key ?? 45,
    meta: { name: options.name, soundFile: options.soundFile },
  };
}

function fakeSong(loaded: Array<ReturnType<typeof fakeInstrument> | undefined>): Song {
  return { instruments: { loaded } } as unknown as Song;
}

describe('loadCustomInstruments', () => {
  it('keeps NBS instrument IDs instead of compacting customs after the builtins', () => {
    const loaded: Array<ReturnType<typeof fakeInstrument> | undefined> = [];
    for (let id = 0; id < 20; id++) {
      loaded[id] = fakeInstrument({
        builtIn: true,
        id,
        name: `BuiltIn ${id}`,
        soundFile: '',
      });
    }
    loaded[20] = fakeInstrument({
      builtIn: false,
      id: 20,
      name: 'Custom A',
      soundFile: 'custom_a.ogg',
    });
    loaded[21] = fakeInstrument({
      builtIn: false,
      id: 21,
      name: 'Custom B',
      soundFile: 'folder/custom_b.ogg',
    });

    const extraSounds = {
      'custom_a.ogg': new Uint8Array([1]).buffer,
      'folder/custom_b.ogg': new Uint8Array([2]).buffer,
    };

    const customs = loadCustomInstruments(fakeSong(loaded), extraSounds);

    expect(customs.map((ins) => ins.id)).toEqual([20, 21]);
    expect(customs[0].audioSource).toBe(extraSounds['custom_a.ogg']);
    expect(customs[1].audioSource).toBe(extraSounds['folder/custom_b.ogg']);
  });

  it('skips holes and built-in instruments', () => {
    const loaded: Array<ReturnType<typeof fakeInstrument> | undefined> = [];
    loaded[15] = fakeInstrument({
      builtIn: true,
      id: 15,
      name: 'Pling',
      soundFile: 'pling.ogg',
    });
    loaded[16] = undefined;
    loaded[17] = fakeInstrument({
      builtIn: false,
      id: 17,
      name: 'Custom',
      soundFile: 'custom.ogg',
    });

    const extraSounds = { 'custom.ogg': new Uint8Array([3]).buffer };
    const customs = loadCustomInstruments(fakeSong(loaded), extraSounds);

    expect(customs).toHaveLength(1);
    expect(customs[0].id).toBe(17);
  });

  it('warns when the sample is missing from extraSounds but keeps the instrument silent', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const loaded: Array<ReturnType<typeof fakeInstrument> | undefined> = [];
    loaded[16] = fakeInstrument({
      builtIn: false,
      id: 16,
      name: 'Custom',
      soundFile: 'missing.ogg',
    });

    const customs = loadCustomInstruments(fakeSong(loaded), {});

    expect(customs).toHaveLength(1);
    expect(customs[0].audioSource).toBe('');
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'MissingAudioFileError',
        message: 'Missing audio file "missing.ogg" for instrument 16 (Custom)',
      }),
    );
    warn.mockRestore();
  });
});
