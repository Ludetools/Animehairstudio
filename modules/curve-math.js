function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function smoothstep(value, minimum, maximum) {
  const amount = clamp((value - minimum) / (maximum - minimum), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

export function legacyTaperCurve(shape = {}) {
  const rootTaper = clamp(Number(shape.rootTaper ?? 0), 0, 1);
  const rootEnd = clamp(Number(shape.rootTaperEnd ?? 0.2), 0.02, 0.6);
  const tipTaper = clamp(Number(shape.taper ?? 1), 0, 1);
  const tipStart = clamp(Number(shape.taperStart ?? 0.42), rootEnd, 0.95);
  return [
    { position: 0, value: 1 - rootTaper, interpolation: "smooth" },
    { position: rootEnd, value: 1, interpolation: "smooth" },
    { position: tipStart, value: 1, interpolation: "smooth" },
    { position: 1, value: 1 - tipTaper, interpolation: "smooth" }
  ];
}

export function normalizeTaperCurve(curve, fallback = {}, valueMaximum = 1.5) {
  const source = curve?.length >= 2 ? curve : legacyTaperCurve(fallback);
  const points = source.map((point) => ({
    position: clamp(Number(point.position), 0, 1),
    value: clamp(Number(point.value), 0, valueMaximum),
    interpolation: ["linear", "smooth", "constant"].includes(point.interpolation) ? point.interpolation : "smooth"
  })).sort((left, right) => left.position - right.position);
  points[0].position = 0;
  points.at(-1).position = 1;
  return points;
}

const tangentCache = new WeakMap();

export function smoothTaperTangents(curve) {
  const signature = curve.map((point) => `${point.position}:${point.value}`).join("|");
  const cached = tangentCache.get(curve);
  if (cached?.signature === signature) return cached.tangents;
  const intervals = curve.slice(0, -1).map((point, index) => Math.max(0.0001, curve[index + 1].position - point.position));
  const slopes = intervals.map((interval, index) => (curve[index + 1].value - curve[index].value) / interval);
  const tangents = curve.map((point, index) => {
    if (index === 0) return slopes[0] || 0;
    if (index === curve.length - 1) return slopes.at(-1) || 0;
    const before = slopes[index - 1];
    const after = slopes[index];
    if (!before || !after || Math.sign(before) !== Math.sign(after)) return 0;
    const beforeWeight = 2 * intervals[index] + intervals[index - 1];
    const afterWeight = intervals[index] + 2 * intervals[index - 1];
    return (beforeWeight + afterWeight) / (beforeWeight / before + afterWeight / after);
  });
  tangentCache.set(curve, { signature, tangents });
  return tangents;
}

export function sampleTaperCurve(curve, t) {
  if (!curve?.length) return 1;
  const clampedT = clamp(t, 0, 1);
  const rightIndex = curve.findIndex((point) => point.position >= clampedT);
  if (rightIndex <= 0) return curve[0].value;
  if (rightIndex < 0) return curve.at(-1).value;
  const left = curve[rightIndex - 1];
  const right = curve[rightIndex];
  const span = Math.max(0.0001, right.position - left.position);
  let amount = clamp((clampedT - left.position) / span, 0, 1);
  if (left.interpolation === "constant") amount = 0;
  if (left.interpolation === "smooth") {
    const tangents = smoothTaperTangents(curve);
    const amount2 = amount * amount;
    const amount3 = amount2 * amount;
    const value = (2 * amount3 - 3 * amount2 + 1) * left.value
      + (amount3 - 2 * amount2 + amount) * span * tangents[rightIndex - 1]
      + (-2 * amount3 + 3 * amount2) * right.value
      + (amount3 - amount2) * span * tangents[rightIndex];
    return clamp(value, Math.min(left.value, right.value), Math.max(left.value, right.value));
  }
  return lerp(left.value, right.value, amount);
}

export function uniformCurveParameters(segmentCount, start = 0, end = 1) {
  return Array.from({ length: segmentCount + 1 }, (_, index) => lerp(start, end, index / segmentCount));
}

export function adaptiveCurveParameters(sampler, segmentLimit, aggression, start = 0, end = 1, minimumSegments = 4) {
  const maximum = Math.max(minimumSegments, Math.round(segmentLimit));
  const amount = clamp(Number(aggression ?? 0.5), 0, 1);
  if (amount <= 0.001 || maximum <= minimumSegments) return uniformCurveParameters(maximum, start, end);
  const probeCount = Math.max(48, maximum * 4);
  const interval = (end - start) / probeCount;
  const weights = [];
  let curvatureTotal = 0;
  for (let index = 0; index < probeCount; index += 1) {
    const before = sampler.getTangent(start + interval * index).normalize();
    const after = sampler.getTangent(start + interval * (index + 1)).normalize();
    const angleRate = before.angleTo(after) / Math.max(0.0001, interval);
    const curvature = smoothstep(angleRate, 0.2, 3.2);
    curvatureTotal += curvature;
    weights.push(lerp(1, 0.1, amount) + curvature * (0.5 + amount * 4.5));
  }
  const averageCurvature = curvatureTotal / probeCount;
  const retainedRatio = lerp(1, 0.22 + Math.sqrt(averageCurvature) * 0.5, amount);
  const segmentCount = clamp(Math.round(maximum * retainedRatio), minimumSegments, maximum);
  const cumulative = [0];
  weights.forEach((weight) => cumulative.push(cumulative.at(-1) + weight));
  const totalWeight = cumulative.at(-1);
  const parameters = [start];
  let probeIndex = 1;
  for (let segment = 1; segment < segmentCount; segment += 1) {
    const target = totalWeight * (segment / segmentCount);
    while (probeIndex < cumulative.length - 1 && cumulative[probeIndex] < target) probeIndex += 1;
    const beforeWeight = cumulative[probeIndex - 1];
    const span = Math.max(0.0001, cumulative[probeIndex] - beforeWeight);
    const alpha = (target - beforeWeight) / span;
    parameters.push(lerp(start, end, (probeIndex - 1 + alpha) / probeCount));
  }
  parameters.push(end);
  return parameters;
}

export function sampleArray(values, t, fallback = 0) {
  if (!values?.length) return fallback;
  if (values.length === 1) return values[0];
  const scaled = clamp(t, 0, 1) * (values.length - 1);
  const index = Math.floor(scaled);
  const next = Math.min(values.length - 1, index + 1);
  return lerp(values[index], values[next], scaled - index);
}

export function sampleScale(scales, t, axis) {
  if (!scales?.length) return 1;
  if (scales.length === 1) return scales[0][axis] || 1;
  const scaled = clamp(t, 0, 1) * (scales.length - 1);
  const index = Math.floor(scaled);
  const next = Math.min(scales.length - 1, index + 1);
  return lerp(scales[index][axis] || 1, scales[next][axis] || 1, scaled - index);
}
