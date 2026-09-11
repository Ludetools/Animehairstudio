// Build a flyaway from the parent's flow without changing its authored samples.
export function accessoryStrandPoints({ sample, root, start, lift, count = 6 }) {
  const t0 = Math.max(0, Math.min(0.95, start));
  const end = t0 + (1 - t0) * 0.55;
  const origin = sample(t0);
  const size = Math.max(3, Math.round(count));
  return Array.from({ length: size }, (_, index) => {
    const t = index / (size - 1);
    const source = sample(t0 + (end - t0) * t);
    const bow = t * t * (3 - 2 * t);
    return Object.fromEntries(['x', 'y', 'z'].map(axis => [axis,
      root[axis] + source[axis] - origin[axis] + lift[axis] * bow
    ]));
  });
}
