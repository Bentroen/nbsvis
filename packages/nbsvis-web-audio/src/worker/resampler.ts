export type ResamplerFn = (buffer: Float32Array, pos: number) => number;

export const nearestNeighborResample: ResamplerFn = (buffer: Float32Array, pos: number): number => {
  const i = Math.round(pos);
  return buffer[Math.min(i, buffer.length - 1)];
};

export const linearResample: ResamplerFn = (buffer: Float32Array, pos: number): number => {
  const i0 = Math.floor(pos);
  const i1 = Math.min(i0 + 1, buffer.length - 1);
  const t = pos - i0;

  return buffer[i0] * (1 - t) + buffer[i1] * t;
};

/*
 * Catmull-Rom cubic interpolation resampler
 */
export const cubicResample: ResamplerFn = (buffer: Float32Array, pos: number): number => {
  const i1 = Math.floor(pos);
  const t = pos - i1;

  const i0 = Math.max(0, i1 - 1);
  const i2 = Math.min(buffer.length - 1, i1 + 1);
  const i3 = Math.min(buffer.length - 1, i1 + 2);

  const y0 = buffer[i0];
  const y1 = buffer[i1];
  const y2 = buffer[i2];
  const y3 = buffer[i3];

  const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
  const b = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
  const c = -0.5 * y0 + 0.5 * y2;
  const d = y1;

  return ((a * t + b) * t + c) * t + d;
};
