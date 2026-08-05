function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

export function clumpMemberGuideParameter(amount, start = 0, end = 1) {
  const normalizedStart = clamp(Number(start) || 0, 0, 1);
  const normalizedEnd = clamp(Number(end ?? 1), normalizedStart, 1);
  return lerp(normalizedStart, normalizedEnd, clamp(Number(amount) || 0, 0, 1));
}

export function relaxAngleValue(current, before, after, strength) {
  const value = Number(current) || 0;
  const angularDelta = (target) => {
    const delta = (Number(target) || 0) - value;
    return Math.atan2(Math.sin(delta), Math.cos(delta));
  };
  const neighborDelta = (angularDelta(before) + angularDelta(after)) * 0.5;
  return value + neighborDelta * clamp(Number(strength) || 0, 0, 1);
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

export function normalizeEnvelopeCurve(curve, fallback, valueMinimum, valueMaximum) {
  const source = curve?.length >= 2 ? curve : fallback;
  const minimum = Number(valueMinimum);
  const maximum = Number(valueMaximum);
  const points = source.map((point) => ({
    position: clamp(Number(point.position), 0, 1),
    value: clamp(Number(point.value), minimum, maximum),
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

export function remapEnvelopeCurveRange(curve, start = 0, end = 1) {
  if (!curve?.length) return [];
  const normalizedStart = clamp(Number(start) || 0, 0, 1);
  const normalizedEnd = clamp(Number(end ?? 1), normalizedStart, 1);
  const span = normalizedEnd - normalizedStart;
  if (span <= 0.000001) {
    const value = sampleTaperCurve(curve, normalizedStart);
    return [
      { position: 0, value, interpolation: "smooth" },
      { position: 1, value, interpolation: "smooth" }
    ];
  }
  const interpolationAt = (position) => {
    const rightIndex = curve.findIndex((point) => Number(point.position) > position + 0.000001);
    const leftIndex = rightIndex < 0 ? curve.length - 1 : Math.max(0, rightIndex - 1);
    const interpolation = curve[leftIndex]?.interpolation;
    return ["linear", "smooth", "constant"].includes(interpolation) ? interpolation : "smooth";
  };
  const remapped = [{
    position: 0,
    value: sampleTaperCurve(curve, normalizedStart),
    interpolation: interpolationAt(normalizedStart)
  }];
  curve.forEach((point) => {
    const position = Number(point.position);
    if (position <= normalizedStart + 0.000001 || position >= normalizedEnd - 0.000001) return;
    remapped.push({
      position: (position - normalizedStart) / span,
      value: Number(point.value),
      interpolation: ["linear", "smooth", "constant"].includes(point.interpolation)
        ? point.interpolation
        : "smooth"
    });
  });
  remapped.push({
    position: 1,
    value: sampleTaperCurve(curve, normalizedEnd),
    interpolation: interpolationAt(normalizedEnd)
  });
  return remapped;
}

const integratedEnvelopeCache = new WeakMap();

export const TWIST_RATE_DEGREES_PER_UNIT = 90;

export function twistRateUnitsFromDegrees(value) {
  return Number(value || 0) / TWIST_RATE_DEGREES_PER_UNIT;
}

export function twistRateDegreesFromUnits(value) {
  return Number(value || 0) * TWIST_RATE_DEGREES_PER_UNIT;
}

export function sampleIntegratedEnvelopeCurve(curve, t, sampleCount = 128) {
  if (!curve?.length) return 0;
  const count = Math.max(16, Math.round(Number(sampleCount) || 128));
  const signature = `${count}|${curve.map((point) => (
    `${point.position}:${point.value}:${point.interpolation}`
  )).join("|")}`;
  let cached = integratedEnvelopeCache.get(curve);
  if (cached?.signature !== signature) {
    const cumulative = [0];
    let previous = sampleTaperCurve(curve, 0);
    for (let index = 1; index <= count; index += 1) {
      const current = sampleTaperCurve(curve, index / count);
      cumulative.push(cumulative.at(-1) + (previous + current) * 0.5 / count);
      previous = current;
    }
    cached = { signature, cumulative };
    integratedEnvelopeCache.set(curve, cached);
  }
  const scaled = clamp(Number(t), 0, 1) * count;
  const index = Math.floor(scaled);
  const nextIndex = Math.min(count, index + 1);
  return lerp(
    cached.cumulative[index],
    cached.cumulative[nextIndex],
    scaled - index
  );
}

export function sampleAsymmetricTaperCurve(
  primaryCurve,
  secondaryCurve,
  asymmetric,
  signedCoordinate,
  t
) {
  const curve = asymmetric && signedCoordinate < 0 && secondaryCurve?.length >= 2
    ? secondaryCurve
    : primaryCurve;
  return sampleTaperCurve(curve, t);
}

export function profileTopologyCenterWeight(coordinate, minimum, maximum) {
  const value = Number(coordinate);
  const min = Number(minimum);
  const max = Number(maximum);
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0;
  if (value < 0) return min < -0.000001 ? clamp(1 - value / min, 0, 1) : 0;
  if (value > 0) return max > 0.000001 ? clamp(1 - value / max, 0, 1) : 0;
  return 1;
}

export function uniformCurveParameters(segmentCount, start = 0, end = 1) {
  return Array.from({ length: segmentCount + 1 }, (_, index) => lerp(start, end, index / segmentCount));
}

export function eightWayScreenDelta(deltaX, deltaY) {
  const x = Number(deltaX) || 0;
  const y = Number(deltaY) || 0;
  const distance = Math.hypot(x, y);
  if (distance <= 0.000001) return { x: 0, y: 0 };
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(y, x) / step) * step;
  const snappedX = Math.cos(angle) * distance;
  const snappedY = Math.sin(angle) * distance;
  return {
    x: Math.abs(snappedX) < 0.000001 ? 0 : snappedX,
    y: Math.abs(snappedY) < 0.000001 ? 0 : snappedY
  };
}

export function symmetricClosedCurveParameters(
  segmentCount,
  symmetryAxisParameter = 0,
  requiredParameters = []
) {
  const count = Math.max(3, Math.round(segmentCount));
  const wrap = (value) => ((Number(value) % 1) + 1) % 1;
  const axis = wrap(symmetryAxisParameter);
  const parameters = Array.from({ length: count }, (_, index) => wrap(axis + index / count));
  requiredParameters.forEach((value) => {
    const parameter = wrap(value);
    parameters.push(parameter, wrap(axis * 2 - parameter));
  });
  return parameters
    .sort((a, b) => a - b)
    .filter((value, index, values) => (
      index === 0 || Math.abs(value - values[index - 1]) > 0.00001
    ));
}

export function curveRebuildParameters(pointCount, evenlySpaced = true, cumulativeLengths = []) {
  const count = Math.max(2, Math.floor(Number(pointCount) || 2));
  const uniform = Array.from({ length: count }, (_, index) => index / (count - 1));
  if (!evenlySpaced || cumulativeLengths.length < 2) return uniform;

  const lengths = cumulativeLengths.map(Number);
  const totalLength = lengths.at(-1);
  if (
    !Number.isFinite(totalLength)
    || totalLength <= 0
    || lengths.some((length, index) => !Number.isFinite(length) || (index > 0 && length < lengths[index - 1]))
  ) return uniform;

  const divisions = lengths.length - 1;
  return uniform.map((amount, pointIndex) => {
    if (pointIndex === 0 || pointIndex === count - 1) return amount;
    const targetLength = totalLength * amount;
    let upperIndex = 1;
    while (upperIndex < lengths.length - 1 && lengths[upperIndex] < targetLength) upperIndex += 1;
    const lowerIndex = upperIndex - 1;
    const span = Math.max(0.0000001, lengths[upperIndex] - lengths[lowerIndex]);
    const intervalAmount = (targetLength - lengths[lowerIndex]) / span;
    return (lowerIndex + intervalAmount) / divisions;
  });
}

function pointDistance(first, second) {
  return Math.hypot(
    Number(second.x) - Number(first.x),
    Number(second.y) - Number(first.y),
    Number(second.z) - Number(first.z)
  );
}

function interpolatePoint(first, second, amount) {
  return {
    x: lerp(Number(first.x), Number(second.x), amount),
    y: lerp(Number(first.y), Number(second.y), amount),
    z: lerp(Number(first.z), Number(second.z), amount)
  };
}

export function resamplePolylinePointData(points, pointCount) {
  const source = Array.isArray(points) ? points : [];
  const count = Math.max(2, Math.floor(Number(pointCount) || 2));
  if (!source.length) return Array.from({ length: count }, () => ({ x: 0, y: 0, z: 0 }));
  if (source.length === 1) {
    return Array.from({ length: count }, () => ({
      x: Number(source[0].x),
      y: Number(source[0].y),
      z: Number(source[0].z)
    }));
  }

  const cumulativeLengths = [0];
  for (let index = 1; index < source.length; index += 1) {
    cumulativeLengths.push(cumulativeLengths.at(-1) + pointDistance(source[index - 1], source[index]));
  }
  const totalLength = cumulativeLengths.at(-1);
  if (totalLength <= 0.0000001) {
    return Array.from({ length: count }, () => ({
      x: Number(source[0].x),
      y: Number(source[0].y),
      z: Number(source[0].z)
    }));
  }

  return Array.from({ length: count }, (_, outputIndex) => {
    const targetLength = totalLength * (outputIndex / (count - 1));
    let upperIndex = 1;
    while (upperIndex < cumulativeLengths.length - 1 && cumulativeLengths[upperIndex] < targetLength) {
      upperIndex += 1;
    }
    const lowerIndex = upperIndex - 1;
    const span = Math.max(0.0000001, cumulativeLengths[upperIndex] - cumulativeLengths[lowerIndex]);
    return interpolatePoint(
      source[lowerIndex],
      source[upperIndex],
      (targetLength - cumulativeLengths[lowerIndex]) / span
    );
  });
}

export function polylineMidpointPointData(points) {
  return resamplePolylinePointData(points, 3)[1];
}

export function blendRelativePolylinePointData(firstPoints, secondPoints, amount, pointCount = null) {
  const count = Math.max(
    2,
    Math.floor(Number(pointCount) || Math.max(firstPoints?.length || 0, secondPoints?.length || 0, 2))
  );
  const first = resamplePolylinePointData(firstPoints, count);
  const second = resamplePolylinePointData(secondPoints, count);
  const firstRoot = first[0];
  const secondRoot = second[0];
  const blend = clamp(Number(amount), 0, 1);
  return first.map((point, index) => ({
    x: lerp(point.x - firstRoot.x, second[index].x - secondRoot.x, blend),
    y: lerp(point.y - firstRoot.y, second[index].y - secondRoot.y, blend),
    z: lerp(point.z - firstRoot.z, second[index].z - secondRoot.z, blend)
  }));
}

function normalizedPointData(point, fallback = { x: 0, y: 0, z: 1 }) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const z = Number(point?.z);
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length) || length <= 0.0000001) return { ...fallback };
  return { x: x / length, y: y / length, z: z / length };
}

export function blendDirectionPointData(first, second, amount) {
  const firstDirection = normalizedPointData(first);
  const secondDirection = normalizedPointData(second, firstDirection);
  const blend = clamp(Number(amount), 0, 1);
  return normalizedPointData({
    x: lerp(firstDirection.x, secondDirection.x, blend),
    y: lerp(firstDirection.y, secondDirection.y, blend),
    z: lerp(firstDirection.z, secondDirection.z, blend)
  }, firstDirection);
}

function rotatePointDataBetweenNormals(point, sourceNormal, targetNormal) {
  const from = normalizedPointData(sourceNormal);
  const to = normalizedPointData(targetNormal, from);
  const dot = clamp(from.x * to.x + from.y * to.y + from.z * to.z, -1, 1);
  if (dot > 0.999999) return { x: point.x, y: point.y, z: point.z };
  if (dot < -0.999999) {
    const axis = Math.abs(from.x) < 0.8
      ? normalizedPointData({ x: 0, y: from.z, z: -from.y })
      : normalizedPointData({ x: -from.z, y: 0, z: from.x });
    const projection = point.x * axis.x + point.y * axis.y + point.z * axis.z;
    return {
      x: 2 * projection * axis.x - point.x,
      y: 2 * projection * axis.y - point.y,
      z: 2 * projection * axis.z - point.z
    };
  }
  const cross = {
    x: from.y * to.z - from.z * to.y,
    y: from.z * to.x - from.x * to.z,
    z: from.x * to.y - from.y * to.x
  };
  const inverseLength = 1 / Math.hypot(cross.x, cross.y, cross.z, 1 + dot);
  const q = {
    x: cross.x * inverseLength,
    y: cross.y * inverseLength,
    z: cross.z * inverseLength,
    w: (1 + dot) * inverseLength
  };
  const t = {
    x: 2 * (q.y * point.z - q.z * point.y),
    y: 2 * (q.z * point.x - q.x * point.z),
    z: 2 * (q.x * point.y - q.y * point.x)
  };
  return {
    x: point.x + q.w * t.x + q.y * t.z - q.z * t.y,
    y: point.y + q.w * t.y + q.z * t.x - q.x * t.z,
    z: point.z + q.w * t.z + q.x * t.y - q.y * t.x
  };
}

function tangentDirectionPointData(point, normal) {
  const axis = normalizedPointData(normal);
  const projection = point.x * axis.x + point.y * axis.y + point.z * axis.z;
  const tangent = {
    x: point.x - axis.x * projection,
    y: point.y - axis.y * projection,
    z: point.z - axis.z * projection
  };
  const length = Math.hypot(tangent.x, tangent.y, tangent.z);
  return length <= 0.0000001
    ? null
    : { x: tangent.x / length, y: tangent.y / length, z: tangent.z / length };
}

function rotatePointDataAroundAxis(point, axis, angle) {
  const direction = normalizedPointData(axis);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const projection = point.x * direction.x + point.y * direction.y + point.z * direction.z;
  return {
    x: point.x * cosine
      + (direction.y * point.z - direction.z * point.y) * sine
      + direction.x * projection * (1 - cosine),
    y: point.y * cosine
      + (direction.z * point.x - direction.x * point.z) * sine
      + direction.y * projection * (1 - cosine),
    z: point.z * cosine
      + (direction.x * point.y - direction.y * point.x) * sine
      + direction.z * projection * (1 - cosine)
  };
}

export function blendSurfaceOrientedPolylinePointData(
  firstPoints,
  secondPoints,
  firstNormal,
  secondNormal,
  targetNormal,
  amount,
  pointCount = null
) {
  const count = Math.max(
    2,
    Math.floor(Number(pointCount) || Math.max(firstPoints?.length || 0, secondPoints?.length || 0, 2))
  );
  const first = resamplePolylinePointData(firstPoints, count);
  const second = resamplePolylinePointData(secondPoints, count);
  const firstRoot = first[0];
  const secondRoot = second[0];
  const blend = clamp(Number(amount), 0, 1);
  const targetAxis = normalizedPointData(targetNormal);
  const firstMidpoint = polylineMidpointPointData(first);
  const secondMidpoint = polylineMidpointPointData(second);
  const firstDirection = tangentDirectionPointData(rotatePointDataBetweenNormals({
    x: firstMidpoint.x - firstRoot.x,
    y: firstMidpoint.y - firstRoot.y,
    z: firstMidpoint.z - firstRoot.z
  }, firstNormal, targetNormal), targetAxis);
  const secondDirection = tangentDirectionPointData(rotatePointDataBetweenNormals({
    x: secondMidpoint.x - secondRoot.x,
    y: secondMidpoint.y - secondRoot.y,
    z: secondMidpoint.z - secondRoot.z
  }, secondNormal, targetNormal), targetAxis);
  let firstDirectionRotation = 0;
  let secondDirectionRotation = 0;
  if (firstDirection && secondDirection) {
    const cross = {
      x: firstDirection.y * secondDirection.z - firstDirection.z * secondDirection.y,
      y: firstDirection.z * secondDirection.x - firstDirection.x * secondDirection.z,
      z: firstDirection.x * secondDirection.y - firstDirection.y * secondDirection.x
    };
    const signedAngle = Math.atan2(
      cross.x * targetAxis.x + cross.y * targetAxis.y + cross.z * targetAxis.z,
      clamp(
        firstDirection.x * secondDirection.x
          + firstDirection.y * secondDirection.y
          + firstDirection.z * secondDirection.z,
        -1,
        1
      )
    );
    firstDirectionRotation = signedAngle * blend;
    secondDirectionRotation = -signedAngle * (1 - blend);
  }
  return first.map((point, index) => {
    const firstOffset = rotatePointDataAroundAxis(rotatePointDataBetweenNormals({
      x: point.x - firstRoot.x,
      y: point.y - firstRoot.y,
      z: point.z - firstRoot.z
    }, firstNormal, targetNormal), targetAxis, firstDirectionRotation);
    const secondOffset = rotatePointDataAroundAxis(rotatePointDataBetweenNormals({
      x: second[index].x - secondRoot.x,
      y: second[index].y - secondRoot.y,
      z: second[index].z - secondRoot.z
    }, secondNormal, targetNormal), targetAxis, secondDirectionRotation);
    return {
      x: lerp(firstOffset.x, secondOffset.x, blend),
      y: lerp(firstOffset.y, secondOffset.y, blend),
      z: lerp(firstOffset.z, secondOffset.z, blend)
    };
  });
}

export function proximityCurveBlendAmount(point, firstRoot, secondRoot) {
  const firstDistance = pointDistance(point, firstRoot);
  const secondDistance = pointDistance(point, secondRoot);
  const totalDistance = firstDistance + secondDistance;
  return totalDistance <= 0.0000001 ? 0.5 : firstDistance / totalDistance;
}

export function evenlySpacedInteriorAmounts(count, maximum = 64) {
  const total = Math.min(
    Math.max(1, Math.round(Number(maximum) || 64)),
    Math.max(0, Math.round(Number(count) || 0))
  );
  return Array.from({ length: total }, (_, index) => (index + 1) / (total + 1));
}

export function surfaceArcBlendAmount(point, firstRoot, secondRoot, center) {
  const origin = center || { x: 0, y: 0, z: 0 };
  const direction = (value) => normalizedPointData({
    x: Number(value?.x) - Number(origin.x || 0),
    y: Number(value?.y) - Number(origin.y || 0),
    z: Number(value?.z) - Number(origin.z || 0)
  });
  const targetDirection = direction(point);
  const firstDirection = direction(firstRoot);
  const secondDirection = direction(secondRoot);
  const angleToFirst = Math.acos(clamp(
    targetDirection.x * firstDirection.x
      + targetDirection.y * firstDirection.y
      + targetDirection.z * firstDirection.z,
    -1,
    1
  ));
  const angleToSecond = Math.acos(clamp(
    targetDirection.x * secondDirection.x
      + targetDirection.y * secondDirection.y
      + targetDirection.z * secondDirection.z,
    -1,
    1
  ));
  const totalAngle = angleToFirst + angleToSecond;
  return totalAngle <= 0.0000001
    ? proximityCurveBlendAmount(point, firstRoot, secondRoot)
    : angleToFirst / totalAngle;
}

export function surfaceArcPolylinePointData(
  firstRoot,
  secondRoot,
  center,
  segmentCount = 48,
  constantAxis = null
) {
  const origin = center || { x: 0, y: 0, z: 0 };
  const relative = (point) => ({
    x: Number(point?.x) - Number(origin.x || 0),
    y: Number(point?.y) - Number(origin.y || 0),
    z: Number(point?.z) - Number(origin.z || 0)
  });
  const firstRelative = relative(firstRoot);
  const secondRelative = relative(secondRoot);
  const firstRadius = Math.hypot(firstRelative.x, firstRelative.y, firstRelative.z);
  const secondRadius = Math.hypot(secondRelative.x, secondRelative.y, secondRelative.z);
  const firstDirection = normalizedPointData(firstRelative);
  const secondDirection = normalizedPointData(secondRelative, firstDirection);
  const dot = clamp(
    firstDirection.x * secondDirection.x
      + firstDirection.y * secondDirection.y
      + firstDirection.z * secondDirection.z,
    -1,
    1
  );
  const count = Math.max(1, Math.round(Number(segmentCount) || 48));
  let oppositeAxis = null;
  if (dot < -0.999999) {
    oppositeAxis = Math.abs(firstDirection.x) < 0.8
      ? normalizedPointData({ x: 0, y: firstDirection.z, z: -firstDirection.y })
      : normalizedPointData({ x: -firstDirection.z, y: 0, z: firstDirection.x });
  }
  const angle = Math.acos(dot);
  const sine = Math.sin(angle);
  return Array.from({ length: count + 1 }, (_, index) => {
    const amount = index / count;
    let direction;
    if (dot > 0.999999) {
      direction = normalizedPointData({
        x: lerp(firstDirection.x, secondDirection.x, amount),
        y: lerp(firstDirection.y, secondDirection.y, amount),
        z: lerp(firstDirection.z, secondDirection.z, amount)
      }, firstDirection);
    } else if (oppositeAxis) {
      direction = {
        x: firstDirection.x * Math.cos(Math.PI * amount) + oppositeAxis.x * Math.sin(Math.PI * amount),
        y: firstDirection.y * Math.cos(Math.PI * amount) + oppositeAxis.y * Math.sin(Math.PI * amount),
        z: firstDirection.z * Math.cos(Math.PI * amount) + oppositeAxis.z * Math.sin(Math.PI * amount)
      };
    } else {
      const firstWeight = Math.sin((1 - amount) * angle) / sine;
      const secondWeight = Math.sin(amount * angle) / sine;
      direction = {
        x: firstDirection.x * firstWeight + secondDirection.x * secondWeight,
        y: firstDirection.y * firstWeight + secondDirection.y * secondWeight,
        z: firstDirection.z * firstWeight + secondDirection.z * secondWeight
      };
    }
    const radius = lerp(firstRadius, secondRadius, amount);
    const arcPoint = {
      x: Number(origin.x || 0) + direction.x * radius,
      y: Number(origin.y || 0) + direction.y * radius,
      z: Number(origin.z || 0) + direction.z * radius
    };
    if (["x", "y", "z"].includes(constantAxis)) {
      arcPoint[constantAxis] = (
        (Number(firstRoot?.[constantAxis]) || 0)
        + (Number(secondRoot?.[constantAxis]) || 0)
      ) * 0.5;
    }
    return arcPoint;
  });
}

export function horizontalCircleThroughPointData(firstPoint, secondPoint, preferredCenter) {
  const firstX = Number(firstPoint?.x) || 0;
  const firstZ = Number(firstPoint?.z) || 0;
  const secondX = Number(secondPoint?.x) || 0;
  const secondZ = Number(secondPoint?.z) || 0;
  const midpointX = (firstX + secondX) * 0.5;
  const midpointZ = (firstZ + secondZ) * 0.5;
  const chordX = secondX - firstX;
  const chordZ = secondZ - firstZ;
  const chordLength = Math.hypot(chordX, chordZ);
  const preferredX = Number(preferredCenter?.x) || 0;
  const preferredZ = Number(preferredCenter?.z) || 0;
  let centerX = preferredX;
  let centerZ = preferredZ;
  if (chordLength > 0.000001) {
    const perpendicularX = -chordZ / chordLength;
    const perpendicularZ = chordX / chordLength;
    const offset = (preferredX - midpointX) * perpendicularX
      + (preferredZ - midpointZ) * perpendicularZ;
    centerX = midpointX + perpendicularX * offset;
    centerZ = midpointZ + perpendicularZ * offset;
  }
  const radius = Math.hypot(firstX - centerX, firstZ - centerZ);
  const firstAngle = Math.atan2(firstZ - centerZ, firstX - centerX);
  const secondAngle = Math.atan2(secondZ - centerZ, secondX - centerX);
  const angleDelta = Math.atan2(
    Math.sin(secondAngle - firstAngle),
    Math.cos(secondAngle - firstAngle)
  );
  return {
    center: {
      x: centerX,
      y: lerp(Number(firstPoint?.y) || 0, Number(secondPoint?.y) || 0, 0.5),
      z: centerZ
    },
    radius,
    startAngle: firstAngle,
    angleDelta,
    firstY: Number(firstPoint?.y) || 0,
    secondY: Number(secondPoint?.y) || 0
  };
}

export function horizontalCirclePointData(circle, amount) {
  const blend = clamp(Number(amount), 0, 1);
  const angle = Number(circle?.startAngle || 0) + Number(circle?.angleDelta || 0) * blend;
  const radius = Math.max(0, Number(circle?.radius) || 0);
  return {
    x: Number(circle?.center?.x || 0) + Math.cos(angle) * radius,
    y: lerp(Number(circle?.firstY) || 0, Number(circle?.secondY) || 0, blend),
    z: Number(circle?.center?.z || 0) + Math.sin(angle) * radius
  };
}

export function rootCorrectionFalloff(amount, blendEnd = 0) {
  const endValue = Number(blendEnd);
  const end = clamp(Number.isFinite(endValue) ? endValue : 0, 0, 1);
  const position = clamp(Number(amount), 0, 1);
  if (end <= 0.000001) return position <= 0.000001 ? 1 : 0;
  const t = clamp(position / end, 0, 1);
  return (Math.cos(Math.PI * t) + 1) * 0.5;
}

export function cylindricalArcPointData(firstPoint, secondPoint, center, amount) {
  return horizontalCirclePointData(
    horizontalCircleThroughPointData(firstPoint, secondPoint, center),
    amount
  );
}

function truncatePolylinePointDataAtY(points, limitY) {
  const source = Array.isArray(points) ? points : [];
  if (!source.length) return [];
  const result = [{
    x: Number(source[0]?.x) || 0,
    y: Number(source[0]?.y) || 0,
    z: Number(source[0]?.z) || 0
  }];
  const targetY = Number(limitY) || 0;
  for (let index = 1; index < source.length; index += 1) {
    const previous = source[index - 1];
    const current = source[index];
    const previousY = Number(previous?.y) || 0;
    const currentY = Number(current?.y) || 0;
    if (previousY >= targetY && currentY <= targetY) {
      const span = currentY - previousY;
      const amount = Math.abs(span) <= 0.000001
        ? 1
        : clamp((targetY - previousY) / span, 0, 1);
      result.push({
        x: lerp(Number(previous?.x) || 0, Number(current?.x) || 0, amount),
        y: targetY,
        z: lerp(Number(previous?.z) || 0, Number(current?.z) || 0, amount)
      });
      return result;
    }
    if (currentY > targetY) {
      result.push({
        x: Number(current?.x) || 0,
        y: currentY,
        z: Number(current?.z) || 0
      });
    }
  }
  const lowest = source.reduce((best, point) => (
    (Number(point?.y) || 0) < (Number(best?.y) || 0) ? point : best
  ), source[0]);
  result.push({
    x: Number(lowest?.x) || 0,
    y: Number(lowest?.y) || 0,
    z: Number(lowest?.z) || 0
  });
  return result;
}

export function lowestSharedHorizontalPolylinePointData(firstPoints, secondPoints) {
  const first = Array.isArray(firstPoints) ? firstPoints : [];
  const second = Array.isArray(secondPoints) ? secondPoints : [];
  if (!first.length || !second.length) return null;
  const minimumY = (points) => points.reduce(
    (minimum, point) => Math.min(minimum, Number(point?.y) || 0),
    Number.POSITIVE_INFINITY
  );
  const limitY = Math.max(minimumY(first), minimumY(second));
  const firstLimited = truncatePolylinePointDataAtY(first, limitY);
  const secondLimited = truncatePolylinePointDataAtY(second, limitY);
  return {
    limitY,
    first: firstLimited,
    second: secondLimited,
    intersections: [
      firstLimited[firstLimited.length - 1],
      secondLimited[secondLimited.length - 1]
    ]
  };
}

export function blendCylindricalPolylinePointData(
  firstPoints,
  secondPoints,
  center,
  amount,
  pointCount = null
) {
  const count = Math.max(
    2,
    Math.floor(Number(pointCount) || Math.max(firstPoints?.length || 0, secondPoints?.length || 0, 2))
  );
  const shared = lowestSharedHorizontalPolylinePointData(firstPoints, secondPoints);
  const first = resamplePolylinePointData(shared?.first || firstPoints, count);
  const second = resamplePolylinePointData(shared?.second || secondPoints, count);
  return first.map((point, index) => cylindricalArcPointData(
    point,
    second[index],
    center,
    amount
  ));
}

export function blendSampleArrays(firstValues, secondValues, amount, sampleCount = null, fallback = 0) {
  const count = Math.max(
    1,
    Math.floor(Number(sampleCount) || Math.max(firstValues?.length || 0, secondValues?.length || 0, 1))
  );
  const blend = clamp(Number(amount), 0, 1);
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    return lerp(
      Number(sampleArray(firstValues, t, fallback)),
      Number(sampleArray(secondValues, t, fallback)),
      blend
    );
  });
}

export function blendTaperCurves(firstCurve, secondCurve, amount) {
  const first = normalizeTaperCurve(firstCurve);
  const second = normalizeTaperCurve(secondCurve);
  const positions = [...new Set([
    ...first.map((point) => point.position),
    ...second.map((point) => point.position)
  ])].sort((left, right) => left - right);
  const blend = clamp(Number(amount), 0, 1);
  return positions.map((position) => ({
    position,
    value: lerp(sampleTaperCurve(first, position), sampleTaperCurve(second, position), blend),
    interpolation: blend < 0.5
      ? first.findLast((point) => point.position <= position)?.interpolation || "smooth"
      : second.findLast((point) => point.position <= position)?.interpolation || "smooth"
  }));
}

export function blendEnvelopeCurves(firstCurve, secondCurve, amount, fallback, valueMinimum, valueMaximum) {
  const first = normalizeEnvelopeCurve(firstCurve, fallback, valueMinimum, valueMaximum);
  const second = normalizeEnvelopeCurve(secondCurve, fallback, valueMinimum, valueMaximum);
  const positions = [...new Set([
    ...first.map((point) => point.position),
    ...second.map((point) => point.position)
  ])].sort((left, right) => left - right);
  const blend = clamp(Number(amount), 0, 1);
  return positions.map((position) => ({
    position,
    value: lerp(sampleTaperCurve(first, position), sampleTaperCurve(second, position), blend),
    interpolation: blend < 0.5
      ? first.findLast((point) => point.position <= position)?.interpolation || "smooth"
      : second.findLast((point) => point.position <= position)?.interpolation || "smooth"
  }));
}

export function curvePointRemovalPlan(pointCount, pointIndex, neighborRadius = 2) {
  const count = Math.max(0, Math.floor(Number(pointCount)));
  const index = Math.floor(Number(pointIndex));
  if (count <= 2 || index <= 0 || index >= count) return null;

  const parameters = Array.from(
    { length: count - 1 },
    (_, outputIndex) => (outputIndex < index ? outputIndex : outputIndex + 1) / (count - 1)
  );
  if (index === count - 1) {
    return { removedIndex: index, shortenedTip: true, parameters };
  }

  const radius = Math.max(1, Math.floor(Number(neighborRadius) || 2));
  const sourceStart = Math.max(0, index - radius);
  const sourceEnd = Math.min(count - 1, index + radius);
  const outputStart = sourceStart;
  const outputEnd = sourceEnd - 1;
  const outputSpan = Math.max(1, outputEnd - outputStart);
  for (let outputIndex = outputStart; outputIndex <= outputEnd; outputIndex += 1) {
    parameters[outputIndex] = lerp(
      sourceStart / (count - 1),
      sourceEnd / (count - 1),
      (outputIndex - outputStart) / outputSpan
    );
  }
  return { removedIndex: index, shortenedTip: false, parameters };
}

export function curvePointInsertionPlan(pointCount, parameter) {
  const count = Math.max(0, Math.floor(Number(pointCount)));
  const t = clamp(Number(parameter), 0.001, 0.999);
  if (count < 2 || !Number.isFinite(t)) return null;

  const segmentIndex = Math.min(count - 2, Math.floor(t * (count - 1)));
  const insertionIndex = segmentIndex + 1;
  const parameters = Array.from({ length: count }, (_, index) => index / (count - 1));
  parameters.splice(insertionIndex, 0, t);

  const previousIndex = insertionIndex - 1;
  if (previousIndex > 0) {
    parameters[previousIndex] = lerp(parameters[previousIndex - 1], t, 0.5);
  }
  const nextIndex = insertionIndex + 1;
  if (nextIndex < parameters.length - 1) {
    parameters[nextIndex] = lerp(t, parameters[nextIndex + 1], 0.5);
  }
  return { insertionIndex, parameter: t, parameters };
}

export function adaptiveCurveParameters(
  sampler,
  segmentLimit,
  aggression,
  start = 0,
  end = 1,
  minimumSegments = 4,
  profileSampler = null,
  symmetricDistribution = false,
  additionalDetailSampler = null
) {
  const maximum = Math.max(minimumSegments, Math.round(segmentLimit));
  const amount = clamp(Number(aggression ?? 0.5), 0, 1);
  if (
    (amount <= 0.001 || maximum <= minimumSegments)
    && !additionalDetailSampler
  ) return uniformCurveParameters(maximum, start, end);
  const probeCount = Math.max(48, maximum * 4);
  const interval = (end - start) / probeCount;
  const baseWeights = [];
  const additionalWeights = [];
  let baseDetailTotal = 0;
  let additionalDetailTotal = 0;
  const sampleProfile = (t) => {
    const value = Number(profileSampler?.(t));
    return Number.isFinite(value) ? value : 0;
  };
  for (let index = 0; index < probeCount; index += 1) {
    const beforeT = start + interval * index;
    const afterT = start + interval * (index + 1);
    const before = sampler.getTangent(beforeT).normalize();
    const after = sampler.getTangent(afterT).normalize();
    const angleRate = before.angleTo(after) / Math.max(0.0001, interval);
    const curvature = smoothstep(angleRate, 0.2, 3.2);
    let profileDetail = 0;
    if (profileSampler) {
      const middleT = (beforeT + afterT) * 0.5;
      const beforeProfile = sampleProfile(beforeT);
      const middleProfile = sampleProfile(middleT);
      const afterProfile = sampleProfile(afterT);
      const slope = Math.abs(afterProfile - beforeProfile) / Math.max(0.0001, interval);
      const bend = Math.abs(afterProfile - middleProfile * 2 + beforeProfile)
        / Math.max(0.0001, interval * interval);
      profileDetail = Math.max(
        smoothstep(slope, 0.25, 3),
        smoothstep(bend, 0.5, 12)
      );
    }
    const middleT = (beforeT + afterT) * 0.5;
    const additionalDetail = Math.max(
      0,
      Number(additionalDetailSampler?.(beforeT, middleT, afterT, interval)) || 0
    );
    baseDetailTotal += Math.max(curvature, profileDetail);
    additionalDetailTotal += additionalDetail;
    baseWeights.push(
      lerp(1, 0.1, amount)
      + curvature * (0.5 + amount * 4.5)
      + profileDetail * (0.4 + amount * 4)
    );
    additionalWeights.push(additionalDetail);
  }
  const averageDetail = baseDetailTotal / probeCount;
  const retainedRatio = lerp(1, 0.22 + Math.sqrt(averageDetail) * 0.5, amount);
  const baseSegmentCount = clamp(Math.round(maximum * retainedRatio), minimumSegments, maximum);
  const additionalSegmentCount = Math.max(0, Math.ceil(additionalDetailTotal - 0.000001));
  let distributionWeights = baseWeights;
  if (additionalSegmentCount > 0 && additionalDetailTotal > 0.000001) {
    const featherRadius = Math.max(3, Math.round(probeCount * 0.06));
    let featheredAdditionalWeights = additionalWeights.map((weight, index) => {
      let weightedTotal = 0;
      let kernelTotal = 0;
      for (let offset = -featherRadius; offset <= featherRadius; offset += 1) {
        const sampleIndex = index + offset;
        if (sampleIndex < 0 || sampleIndex >= additionalWeights.length) continue;
        const kernelWeight = featherRadius + 1 - Math.abs(offset);
        weightedTotal += additionalWeights[sampleIndex] * kernelWeight;
        kernelTotal += kernelWeight;
      }
      return weightedTotal / Math.max(1, kernelTotal);
    });
    const featheredTotal = featheredAdditionalWeights.reduce((total, weight) => total + weight, 0);
    const featherScale = additionalDetailTotal / Math.max(0.0001, featheredTotal);
    featheredAdditionalWeights = featheredAdditionalWeights.map((weight) => weight * featherScale);
    const symmetricBaseWeights = symmetricDistribution
      ? baseWeights.map((weight, index) => (
        (weight + baseWeights[baseWeights.length - 1 - index]) * 0.5
      ))
      : baseWeights;
    const baseWeightTotal = symmetricBaseWeights.reduce((total, weight) => total + weight, 0);
    distributionWeights = symmetricBaseWeights.map((weight, index) => (
      weight / Math.max(0.0001, baseWeightTotal) * baseSegmentCount
      + featheredAdditionalWeights[index]
    ));
  }
  const segmentCount = baseSegmentCount + additionalSegmentCount;
  const weightedParameter = (weights, fraction) => {
    const cumulative = [0];
    weights.forEach((weight) => cumulative.push(cumulative.at(-1) + weight));
    const target = cumulative.at(-1) * fraction;
    let probeIndex = 1;
    while (probeIndex < cumulative.length - 1 && cumulative[probeIndex] < target) probeIndex += 1;
    const beforeWeight = cumulative[probeIndex - 1];
    const span = Math.max(0.0001, cumulative[probeIndex] - beforeWeight);
    const alpha = (target - beforeWeight) / span;
    return lerp(start, end, (probeIndex - 1 + alpha) / probeCount);
  };
  const parameters = [
    start,
    ...Array.from(
      { length: Math.max(0, segmentCount - 1) },
      (_, index) => weightedParameter(distributionWeights, (index + 1) / segmentCount)
    ),
    end
  ];
  if (symmetricDistribution && additionalSegmentCount === 0) {
    const midpoint = (start + end) * 0.5;
    for (let index = 1; index < Math.floor(parameters.length / 2); index += 1) {
      const oppositeIndex = parameters.length - 1 - index;
      const pairedDistance = (
        (parameters[index] - start)
        + (end - parameters[oppositeIndex])
      ) * 0.5;
      parameters[index] = start + pairedDistance;
      parameters[oppositeIndex] = end - pairedDistance;
    }
    if (parameters.length % 2 === 1) parameters[Math.floor(parameters.length / 2)] = midpoint;
  }
  return parameters;
}

export function twistCurveDensityDetail(
  curve,
  beforeT,
  middleT,
  afterT,
  strength = 1,
  referenceSegmentCount = 1
) {
  const influence = clamp(Number(strength) || 0, 0, 1);
  if (influence <= 0.0001 || !curve?.length) return 0;
  const before = sampleTaperCurve(curve, beforeT);
  const middle = sampleTaperCurve(curve, middleT);
  const after = sampleTaperCurve(curve, afterT);
  const span = Math.max(0, Number(afterT) - Number(beforeT));
  const averageMagnitude = (
    Math.abs(before)
    + Math.abs(middle) * 4
    + Math.abs(after)
  ) / 6;
  const referenceDensity = Math.max(1, Number(referenceSegmentCount) || 1);
  const normalizedMagnitude = averageMagnitude / 180;
  const softenedMagnitude = normalizedMagnitude <= 1
    ? Math.sqrt(normalizedMagnitude)
    : normalizedMagnitude;
  const supplementalDensityRatio = softenedMagnitude * 2;
  return influence * supplementalDensityRatio * referenceDensity * span;
}

export function twistCurveDisplayRange(curve, defaultRange = 180, maximumRange = 720) {
  const baseline = Math.max(1, Math.abs(Number(defaultRange) || 180));
  const maximum = Math.max(baseline, Math.abs(Number(maximumRange) || 720));
  const authoredMaximum = Array.isArray(curve)
    ? curve.reduce((largest, point) => Math.max(largest, Math.abs(Number(point?.value) || 0)), 0)
    : 0;
  return clamp(Math.max(baseline, authoredMaximum), baseline, maximum);
}

export function twistCurveHandleDistancePerDegree(referenceExtent, displayRange = 180) {
  const extent = Math.max(0.04, Math.abs(Number(referenceExtent) || 0));
  const range = Math.max(1, Math.abs(Number(displayRange) || 180));
  return extent * 0.625 / range;
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

export function upperProfileArcIndices(points) {
  if (!points?.length) return [];
  if (points.length === 1) return [0];

  let leftIndex = 0;
  let rightIndex = 0;
  points.forEach((point, index) => {
    const x = Number(point.x);
    const height = Number(point.z ?? point.y ?? 0);
    const leftX = Number(points[leftIndex].x);
    const leftHeight = Number(points[leftIndex].z ?? points[leftIndex].y ?? 0);
    const rightX = Number(points[rightIndex].x);
    const rightHeight = Number(points[rightIndex].z ?? points[rightIndex].y ?? 0);
    if (x < leftX || (x === leftX && height < leftHeight)) leftIndex = index;
    if (x > rightX || (x === rightX && height < rightHeight)) rightIndex = index;
  });
  if (leftIndex === rightIndex) return points.map((_, index) => index);

  const cyclicPath = (start, end, step) => {
    const indices = [start];
    let index = start;
    while (index !== end && indices.length <= points.length) {
      index = (index + step + points.length) % points.length;
      indices.push(index);
    }
    return indices;
  };
  const forward = cyclicPath(rightIndex, leftIndex, 1);
  const backward = cyclicPath(rightIndex, leftIndex, -1);
  const averageHeight = (indices) => indices.reduce(
    (total, index) => total + Number(points[index].z ?? points[index].y ?? 0),
    0
  ) / indices.length;
  return averageHeight(forward) >= averageHeight(backward) ? forward : backward;
}
