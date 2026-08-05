const EPSILON = 1e-8;

function vector(point = {}) {
  return {
    x: Number(point.x) || 0,
    y: Number(point.y) || 0,
    z: Number(point.z) || 0
  };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(a, amount) {
  return { x: a.x * amount, y: a.y * amount, z: a.z * amount };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function length(a) {
  return Math.hypot(a.x, a.y, a.z);
}

function normalize(a, fallback = { x: 0, y: -1, z: 0 }) {
  const magnitude = length(a);
  return magnitude > EPSILON ? scale(a, 1 / magnitude) : vector(fallback);
}

function lerp(a, b, amount) {
  return add(scale(a, 1 - amount), scale(b, amount));
}

function rotateAroundAxis(value, axis, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return add(
    add(scale(value, cosine), scale(cross(axis, value), sine)),
    scale(axis, dot(axis, value) * (1 - cosine))
  );
}

function cleanPolyline(points) {
  const result = [];
  (points || []).forEach((point) => {
    const next = vector(point);
    if (!result.length || length(subtract(next, result.at(-1))) > EPSILON) result.push(next);
  });
  return result;
}

export function polylineLength(points) {
  const clean = cleanPolyline(points);
  let total = 0;
  for (let index = 1; index < clean.length; index += 1) {
    total += length(subtract(clean[index], clean[index - 1]));
  }
  return total;
}

export function resamplePolyline(points, count) {
  const clean = cleanPolyline(points);
  const sampleCount = Math.max(2, Math.round(Number(count) || 2));
  if (!clean.length) return [];
  if (clean.length === 1) return Array.from({ length: sampleCount }, () => ({ ...clean[0] }));
  const cumulative = [0];
  for (let index = 1; index < clean.length; index += 1) {
    cumulative.push(cumulative.at(-1) + length(subtract(clean[index], clean[index - 1])));
  }
  const total = cumulative.at(-1);
  if (total <= EPSILON) return Array.from({ length: sampleCount }, () => ({ ...clean[0] }));
  let segment = 1;
  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    const distance = total * sampleIndex / (sampleCount - 1);
    while (segment < cumulative.length - 1 && cumulative[segment] < distance) segment += 1;
    const startDistance = cumulative[segment - 1];
    const segmentLength = Math.max(EPSILON, cumulative[segment] - startDistance);
    return lerp(clean[segment - 1], clean[segment], (distance - startDistance) / segmentLength);
  });
}

function fallbackNormal(tangent) {
  const axes = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 }
  ].sort((a, b) => Math.abs(dot(a, tangent)) - Math.abs(dot(b, tangent)));
  return normalize(subtract(axes[0], scale(tangent, dot(axes[0], tangent))));
}

export function parallelTransportFrames(points, count = 65, preferredNormal = null) {
  const centers = resamplePolyline(points, count);
  if (centers.length < 2) return [];
  const tangents = centers.map((point, index) => normalize(subtract(
    centers[Math.min(centers.length - 1, index + 1)],
    centers[Math.max(0, index - 1)]
  )));
  const requestedNormal = preferredNormal ? vector(preferredNormal) : fallbackNormal(tangents[0]);
  let normal = normalize(
    subtract(requestedNormal, scale(tangents[0], dot(requestedNormal, tangents[0]))),
    fallbackNormal(tangents[0])
  );
  return centers.map((center, index) => {
    const tangent = tangents[index];
    if (index > 0) {
      const previousTangent = tangents[index - 1];
      const axisValue = cross(previousTangent, tangent);
      const axisLength = length(axisValue);
      if (axisLength > EPSILON) {
        normal = rotateAroundAxis(
          normal,
          scale(axisValue, 1 / axisLength),
          Math.atan2(axisLength, Math.max(-1, Math.min(1, dot(previousTangent, tangent))))
        );
      }
      normal = normalize(
        subtract(normal, scale(tangent, dot(normal, tangent))),
        fallbackNormal(tangent)
      );
    }
    const side = normalize(cross(normal, tangent));
    normal = normalize(cross(tangent, side));
    return { center, tangent, side, normal };
  });
}

function interpolatedFrame(frames, amount) {
  const scaledIndex = Math.max(0, Math.min(1, amount)) * (frames.length - 1);
  const lower = Math.floor(scaledIndex);
  const upper = Math.min(frames.length - 1, lower + 1);
  const blend = scaledIndex - lower;
  const center = lerp(frames[lower].center, frames[upper].center, blend);
  const tangent = normalize(lerp(frames[lower].tangent, frames[upper].tangent, blend));
  let normal = normalize(lerp(frames[lower].normal, frames[upper].normal, blend));
  normal = normalize(subtract(normal, scale(tangent, dot(normal, tangent))), fallbackNormal(tangent));
  const side = normalize(cross(normal, tangent));
  normal = normalize(cross(tangent, side));
  return { center, tangent, side, normal };
}

export function sampleCapsuleRadialProfile(profile, amount) {
  const points = (profile || [])
    .map((point) => ({ t: Math.max(0, Math.min(1, Number(point.t) || 0)), value: Math.max(0, Number(point.value) || 0) }))
    .sort((a, b) => a.t - b.t);
  if (!points.length) return 1;
  const t = Math.max(0, Math.min(1, Number(amount) || 0));
  if (t <= points[0].t) return points[0].value;
  if (t >= points.at(-1).t) return points.at(-1).value;
  const upperIndex = points.findIndex((point) => point.t >= t);
  const lower = points[upperIndex - 1];
  const upper = points[upperIndex];
  const span = Math.max(EPSILON, upper.t - lower.t);
  const local = (t - lower.t) / span;
  const smooth = local * local * (3 - 2 * local);
  return lower.value + (upper.value - lower.value) * smooth;
}

export function scaleCapsuleRadialLoops(points, loops, factor) {
  const result = (points || []).map(vector);
  const amount = Math.max(0, Number(factor) || 0);
  (loops || []).forEach((loop) => {
    const indices = [...new Set(loop || [])]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < result.length);
    if (!indices.length) return;
    const center = indices.reduce((sum, index) => add(sum, result[index]), { x: 0, y: 0, z: 0 });
    const inverseCount = 1 / indices.length;
    center.x *= inverseCount;
    center.y *= inverseCount;
    center.z *= inverseCount;
    indices.forEach((index) => {
      result[index] = add(center, scale(subtract(result[index], center), amount));
    });
  });
  return result;
}

export function curveDeformedCapsulePoints({
  centerline,
  cagePoints,
  guideLength,
  preferredNormal = null,
  radialProfile = null,
  capAtEnd = false,
  frameSamples = 65
}) {
  const frames = parallelTransportFrames(centerline, Math.max(17, frameSamples), preferredNormal);
  const lengthValue = Math.max(EPSILON, Number(guideLength) || polylineLength(centerline));
  if (!frames.length) return [];
  return (cagePoints || []).map((point) => {
    const source = vector(point);
    const baseAmount = Math.max(0, Math.min(1, (lengthValue * 0.5 - source.y) / lengthValue));
    const amount = capAtEnd ? 1 - baseAmount : baseAmount;
    const radialScale = sampleCapsuleRadialProfile(radialProfile, amount);
    const frame = interpolatedFrame(frames, amount);
    return add(frame.center, add(
      scale(frame.side, source.x * radialScale),
      scale(frame.normal, source.z * radialScale)
    ));
  });
}
