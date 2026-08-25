import { addExtraSound, ExtraSounds, resolveExtraSound } from './song';

function bufferWithMarker(marker: number): ArrayBuffer {
  const bytes = new Uint8Array([marker]);
  return bytes.buffer;
}

describe('extraSounds', () => {
  it('resolves zip sounds relative to the sounds/ root', () => {
    const extraSounds: ExtraSounds = {};
    const data = bufferWithMarker(1);
    addExtraSound(extraSounds, 'sounds/minecraft/block/pling.ogg', data);

    expect(resolveExtraSound(extraSounds, 'sounds/minecraft/block/pling.ogg')).toBe(data);
    expect(resolveExtraSound(extraSounds, 'minecraft/block/pling.ogg')).toBe(data);
    expect(resolveExtraSound(extraSounds, 'pling.ogg')).toBeUndefined();
  });

  it('does not match a nested file by basename', () => {
    const extraSounds: ExtraSounds = {};
    const nested = bufferWithMarker(1);
    const flat = bufferWithMarker(2);
    addExtraSound(extraSounds, 'sounds/custom/pling.ogg', nested);
    addExtraSound(extraSounds, 'sounds/pling.ogg', flat);

    expect(resolveExtraSound(extraSounds, 'custom/pling.ogg')).toBe(nested);
    expect(resolveExtraSound(extraSounds, 'pling.ogg')).toBe(flat);
  });

  it('returns undefined when the sound is missing', () => {
    expect(resolveExtraSound({}, 'missing.ogg')).toBeUndefined();
    expect(resolveExtraSound({ 'other.ogg': bufferWithMarker(1) }, '')).toBeUndefined();
  });
});
