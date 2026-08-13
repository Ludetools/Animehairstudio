function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(a, b) {
  return Math.hypot(Number(b.x) - Number(a.x), Number(b.z) - Number(a.z));
}

export function resampleClosedProfilePoints(profilePoints, sampleCount = 10) {
  const points = (profilePoints || [])
    .map((point) => ({ x: Number(point?.x) || 0, z: Number(point?.z) || 0 }))
    .filter((point, index, source) => (
      index === 0 || distance(source[index - 1], point) > 0.000001
    ));
  if (points.length > 2 && distance(points[0], points.at(-1)) <= 0.000001) points.pop();
  if (points.length < 3) return [];

  const segmentLengths = points.map((point, index) => distance(point, points[(index + 1) % points.length]));
  const perimeter = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (perimeter <= 0.000001) return [];

  const count = clamp(Math.round(Number(sampleCount) || 10), 6, 16);
  const samples = [];
  for (let sampleIndex = 0; sampleIndex < count; sampleIndex += 1) {
    let remaining = perimeter * sampleIndex / count;
    let segmentIndex = 0;
    while (segmentIndex < segmentLengths.length - 1 && remaining > segmentLengths[segmentIndex]) {
      remaining -= segmentLengths[segmentIndex];
      segmentIndex += 1;
    }
    const start = points[segmentIndex];
    const end = points[(segmentIndex + 1) % points.length];
    const amount = segmentLengths[segmentIndex] <= 0.000001 ? 0 : remaining / segmentLengths[segmentIndex];
    samples.push({
      x: start.x + (end.x - start.x) * amount,
      z: start.z + (end.z - start.z) * amount
    });
  }

  return samples;
}
