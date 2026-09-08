// Preview-only center curves. Recipe and generated scene objects never own this state.
export function bundlePreviewPaths(mode = 'straight', width = .35) {
  const kinds = mode === 'compare' ? ['straight', 'curved'] : [mode === 'curved' ? 'curved' : 'straight'];
  const gap = Math.max(1.4, (Number(width) || .35) * 4);
  return kinds.map((kind, index) => {
    const points = Array.from({ length: 17 }, (_, i) => {
      const t = i / 16;
      return [kind === 'curved' ? .55 * Math.sin(t * Math.PI * 1.6) : 0, -2.8 * t, 0];
    });
    // Keep both test strokes the same length so only the bend changes.
    const length = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(...p.map((v, axis) => v - points[i][axis])), 0);
    const offset = kinds.length === 2 ? (index - .5) * gap : 0;
    return { kind, points: points.map(([x, y, z]) => [x * 2.8 / length + offset, y * 2.8 / length + 1.4, z]) };
  });
}
