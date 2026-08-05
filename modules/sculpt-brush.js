export function sculptBrushWeight(distance, radius, falloff = 0.5) {
  const safeRadius = Math.max(0.0001, Number(radius) || 0);
  const normalizedDistance = Math.max(0, Number(distance) || 0) / safeRadius;
  if (normalizedDistance >= 1) return 0;
  const softness = Math.min(1, Math.max(0, Number(falloff) || 0));
  const innerRadius = 1 - softness;
  if (normalizedDistance <= innerRadius || softness === 0) return 1;
  const t = (normalizedDistance - innerRadius) / Math.max(0.0001, softness);
  const inverse = 1 - t;
  return inverse * inverse * (3 - 2 * inverse);
}

export function smoothSculptPointDeltas(points, weights, strength = 1, rate = 0.04, options = {}) {
  const source = Array.isArray(points) ? points : [];
  const influence = Math.min(1, Math.max(0, Number(strength) || 0));
  const smoothingRate = Math.min(1, Math.max(0, Number(rate) || 0));
  const preserveTip = Boolean(options.preserveTip);
  return source.map((point, index) => {
    const delta = { x: 0, y: 0, z: 0 };
    if (index === 0 || (preserveTip && index === source.length - 1) || source.length < 2) return delta;
    const weight = Math.min(1, Math.max(0, Number(weights?.[index]) || 0));
    const amount = weight * influence * smoothingRate;
    if (amount <= 0) return delta;
    const previous = source[index - 1];
    const next = source[index + 1];
    const target = next
      ? {
          x: (previous.x + next.x) * 0.5,
          y: (previous.y + next.y) * 0.5,
          z: (previous.z + next.z) * 0.5
        }
      : previous;
    delta.x = (target.x - point.x) * amount;
    delta.y = (target.y - point.y) * amount;
    delta.z = (target.z - point.z) * amount;
    return delta;
  });
}

export function proportionalSculptWeights(weights, radius = 2.5, falloff = 0.65, options = {}) {
  const source = Array.isArray(weights) ? weights : [];
  const influenceRadius = Math.max(0, Number(radius) || 0);
  const softness = Math.min(1, Math.max(0, Number(falloff) || 0));
  const preserveRoot = options.preserveRoot !== false;
  return source.map((directWeight, targetIndex) => {
    if (preserveRoot && targetIndex === 0) return 0;
    let weight = Math.min(1, Math.max(0, Number(directWeight) || 0));
    source.forEach((originWeight, originIndex) => {
      const seed = Math.min(1, Math.max(0, Number(originWeight) || 0));
      if (seed <= 0) return;
      const distance = Math.abs(targetIndex - originIndex);
      if (distance > influenceRadius) return;
      if (distance === 0) {
        weight = Math.max(weight, seed);
        return;
      }
      const linear = Math.min(1, Math.max(
        0,
        1 - distance / Math.max(0.001, influenceRadius)
      ));
      const smooth = linear * linear * (3 - 2 * linear);
      const neighborWeight = seed * (1 + (smooth - 1) * softness);
      weight = Math.max(weight, neighborWeight);
    });
    return weight;
  });
}

export function cameraFacingPlaneNormal(viewPosition) {
  const x = Number(viewPosition?.x) || 0;
  const y = Number(viewPosition?.y) || 0;
  const z = Number(viewPosition?.z) || 0;
  const length = Math.hypot(x, y, z);
  if (length < 0.0001) return { x: 0, y: 0, z: 1 };
  return {
    x: x / length,
    y: y / length,
    z: z / length
  };
}

export function inflateSculptPointScale(pointScale, weight, strength, strokeDistance, radius) {
  const influence = Math.min(1, Math.max(0, Number(weight) || 0));
  const normalizedStroke = Math.min(
    1,
    Math.max(0, Number(strokeDistance) || 0) / Math.max(1, Number(radius) || 0)
  );
  const amount = normalizedStroke
    * Math.max(0, Number(strength) || 0)
    * influence;
  return {
    x: Math.max(0.18, (Number(pointScale?.x) || 1) + amount),
    z: Math.max(0.18, (Number(pointScale?.z) || 1) + amount)
  };
}

export function pointInCameraFacingHalfSpace(point, planeNormal, planeOffset = 0, tolerance = 0.0001) {
  const normal = cameraFacingPlaneNormal(planeNormal);
  const dot = (Number(point?.x) || 0) * normal.x
    + (Number(point?.y) || 0) * normal.y
    + (Number(point?.z) || 0) * normal.z;
  return dot - (Number(planeOffset) || 0) >= -Math.abs(Number(tolerance) || 0);
}
