function vector(point) {
  return {
    x: Number(point?.x || 0),
    y: Number(point?.y || 0),
    z: Number(point?.z || 0)
  };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export const DEFAULT_HAIR_SHELL_EXTRUSION_WIDTH_CURVE = Object.freeze([
  Object.freeze({ position: 0, value: 1, interpolation: "smooth" }),
  Object.freeze({ position: 0.43, value: 0.95, interpolation: "smooth" }),
  Object.freeze({ position: 0.68, value: 0.8, interpolation: "smooth" }),
  Object.freeze({ position: 0.89, value: 0.4, interpolation: "smooth" }),
  Object.freeze({ position: 1, value: 0, interpolation: "smooth" })
]);

export const DEFAULT_HAIR_SHELL_EXTRUSION_DEPTH_CURVE = Object.freeze([
  Object.freeze({ position: 0, value: 1, interpolation: "smooth" }),
  Object.freeze({ position: 0.59, value: 0.83, interpolation: "smooth" }),
  Object.freeze({ position: 1, value: 0, interpolation: "smooth" })
]);

function normalizeExtrusionCurve(curve, fallback = DEFAULT_HAIR_SHELL_EXTRUSION_WIDTH_CURVE) {
  const source = Array.isArray(curve) && curve.length >= 2 ? curve : fallback;
  const normalized = source.map((point, index) => ({
    position: Math.max(0, Math.min(1, finiteNumber(point?.position, index / Math.max(1, source.length - 1)))),
    value: Math.max(0, Math.min(3, finiteNumber(point?.value, 1))),
    interpolation: point?.interpolation === "linear" ? "linear" : "smooth"
  })).sort((left, right) => left.position - right.position);
  normalized[0].position = 0;
  normalized.at(-1).position = 1;
  return normalized;
}

function sampleExtrusionCurve(curve, parameter) {
  const points = normalizeExtrusionCurve(curve);
  const t = Math.max(0, Math.min(1, finiteNumber(parameter, 0)));
  let upper = points.findIndex((point) => point.position >= t);
  if (upper <= 0) return points[0].value;
  if (upper < 0) return points.at(-1).value;
  const before = points[upper - 1];
  const after = points[upper];
  const span = Math.max(1e-8, after.position - before.position);
  let amount = (t - before.position) / span;
  if (before.interpolation !== "linear") amount = amount * amount * (3 - 2 * amount);
  return before.value + (after.value - before.value) * amount;
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(point, amount) {
  return { x: point.x * amount, y: point.y * amount, z: point.z * amount };
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

function normalize(point, fallback = { x: 0, y: 1, z: 0 }) {
  const length = Math.hypot(point.x, point.y, point.z);
  return length > 1e-8 ? scale(point, 1 / length) : vector(fallback);
}

function average(points) {
  return scale(points.reduce((sum, point) => add(sum, point), { x: 0, y: 0, z: 0 }), 1 / points.length);
}

function rotateBetween(value, fromDirection, toDirection) {
  const from = normalize(fromDirection);
  const to = normalize(toDirection, from);
  const axis = cross(from, to);
  const axisLength = Math.hypot(axis.x, axis.y, axis.z);
  const cosine = Math.max(-1, Math.min(1, dot(from, to)));
  if (axisLength < 1e-8) {
    if (cosine > 0) return vector(value);
    const helper = Math.abs(from.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const halfTurnAxis = normalize(cross(from, helper));
    return add(scale(value, -1), scale(halfTurnAxis, 2 * dot(halfTurnAxis, value)));
  }
  const unitAxis = scale(axis, 1 / axisLength);
  const sine = axisLength;
  return add(
    add(scale(value, cosine), scale(cross(unitAxis, value), sine)),
    scale(unitAxis, dot(unitAxis, value) * (1 - cosine))
  );
}

function rotateAroundAxis(value, axis, angle) {
  const unitAxis = normalize(axis);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return add(
    add(scale(value, cosine), scale(cross(unitAxis, value), sine)),
    scale(unitAxis, dot(unitAxis, value) * (1 - cosine))
  );
}

function extrusionProfileAxes(offsets, tangent) {
  const normal = normalize(tangent);
  let widthAxis = offsets.length >= 2
    ? subtract(offsets[1], offsets[0])
    : { x: 1, y: 0, z: 0 };
  widthAxis = subtract(widthAxis, scale(normal, dot(widthAxis, normal)));
  widthAxis = normalize(widthAxis, Math.abs(normal.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 });
  let depthAxis = normalize(cross(normal, widthAxis));
  const depthHint = offsets.length >= 4
    ? subtract(offsets.at(-1), offsets[0])
    : offsets.find((offset) => Math.abs(dot(offset, depthAxis)) > 1e-6);
  if (depthHint && dot(depthAxis, depthHint) < 0) depthAxis = scale(depthAxis, -1);
  return { widthAxis, depthAxis };
}

function extrusionProfileAxesFromHint(offsets, tangent, hint = null) {
  if (!hint?.widthAxis || !hint?.depthAxis) return extrusionProfileAxes(offsets, tangent);
  const normal = normalize(tangent);
  let widthAxis = subtract(vector(hint.widthAxis), scale(normal, dot(vector(hint.widthAxis), normal)));
  widthAxis = normalize(widthAxis, extrusionProfileAxes(offsets, tangent).widthAxis);
  let depthAxis = normalize(cross(normal, widthAxis));
  if (dot(depthAxis, vector(hint.depthAxis)) < 0) depthAxis = scale(depthAxis, -1);
  return { widthAxis, depthAxis };
}

function cross2d(origin, a, b) {
  return (a.x - origin.x) * (b.z - origin.z) - (a.z - origin.z) * (b.x - origin.x);
}

function convexProfileHull(points) {
  const sorted = [...points].sort((left, right) => left.x - right.x || left.z - right.z);
  if (sorted.length <= 2) return sorted;
  const lower = [];
  sorted.forEach((point) => {
    while (lower.length >= 2 && cross2d(lower.at(-2), lower.at(-1), point) <= 1e-8) lower.pop();
    lower.push(point);
  });
  const upper = [];
  [...sorted].reverse().forEach((point) => {
    while (upper.length >= 2 && cross2d(upper.at(-2), upper.at(-1), point) <= 1e-8) upper.pop();
    upper.push(point);
  });
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function normalizedProfilePoints(points) {
  if (!Array.isArray(points) || points.length < 3) return [];
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minZ = Math.min(...points.map((point) => point.z));
  const maxZ = Math.max(...points.map((point) => point.z));
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  const halfWidth = Math.max(1e-8, (maxX - minX) * 0.5);
  const halfDepth = Math.max(1e-8, (maxZ - minZ) * 0.5);
  return points.map((point) => ({
    x: (point.x - centerX) / halfWidth,
    z: (point.z - centerZ) / halfDepth,
    interpolation: point.interpolation === "linear" ? "linear" : "smooth"
  }));
}

function profileRayRadius(profile, direction) {
  let radius = 0;
  profile.forEach((start, index) => {
    const end = profile[(index + 1) % profile.length];
    const edge = { x: end.x - start.x, z: end.z - start.z };
    const denominator = direction.x * edge.z - direction.z * edge.x;
    if (Math.abs(denominator) < 1e-8) return;
    const rayAmount = (start.x * edge.z - start.z * edge.x) / denominator;
    const edgeAmount = (start.x * direction.z - start.z * direction.x) / denominator;
    if (rayAmount >= 0 && edgeAmount >= -1e-8 && edgeAmount <= 1 + 1e-8) {
      radius = Math.max(radius, rayAmount);
    }
  });
  return radius;
}

function sampledProfilePolygon(profile, smoothSteps = 8) {
  if (!Array.isArray(profile) || profile.length < 3) return [];
  return profile.flatMap((current, index) => {
    const next = profile[(index + 1) % profile.length];
    const linear = current.interpolation === "linear" || next.interpolation === "linear";
    if (linear) return [{ x: current.x, z: current.z }];
    const previous = profile[(index - 1 + profile.length) % profile.length];
    const after = profile[(index + 2) % profile.length];
    return Array.from({ length: smoothSteps }, (_, step) => {
      const amount = step / smoothSteps;
      const amount2 = amount * amount;
      const amount3 = amount2 * amount;
      const sampleAxis = (axis) => 0.5 * (
        2 * current[axis]
        + (-previous[axis] + next[axis]) * amount
        + (2 * previous[axis] - 5 * current[axis] + 4 * next[axis] - after[axis]) * amount2
        + (-previous[axis] + 3 * current[axis] - 3 * next[axis] + after[axis]) * amount3
      );
      return { x: sampleAxis("x"), z: sampleAxis("z") };
    });
  });
}

function extrusionProfileDeformer(offsets, tangent, widthAxis, depthAxis, sweepProfile) {
  const projected = offsets.map((offset) => ({
    x: dot(offset, widthAxis),
    z: dot(offset, depthAxis)
  }));
  const sourceProfile = normalizedProfilePoints(convexProfileHull(projected));
  const targetProfile = normalizedProfilePoints(sampledProfilePolygon(sweepProfile));
  if (sourceProfile.length < 3 || targetProfile.length < 3) return (offset) => offset;
  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minZ = Math.min(...projected.map((point) => point.z));
  const maxZ = Math.max(...projected.map((point) => point.z));
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  const halfWidth = Math.max(1e-8, (maxX - minX) * 0.5);
  const halfDepth = Math.max(1e-8, (maxZ - minZ) * 0.5);
  return (offset) => {
    const alongWidth = dot(offset, widthAxis);
    const alongDepth = dot(offset, depthAxis);
    const normalizedPoint = {
      x: (alongWidth - centerX) / halfWidth,
      z: (alongDepth - centerZ) / halfDepth
    };
    const length = Math.hypot(normalizedPoint.x, normalizedPoint.z);
    if (length < 1e-8) return offset;
    const direction = { x: normalizedPoint.x / length, z: normalizedPoint.z / length };
    const sourceRadius = profileRayRadius(sourceProfile, direction);
    const targetRadius = profileRayRadius(targetProfile, direction);
    if (sourceRadius < 1e-8 || targetRadius < 1e-8) return offset;
    const ratio = targetRadius / sourceRadius;
    return add(
      add(
        scale(widthAxis, centerX + (alongWidth - centerX) * ratio),
        scale(depthAxis, centerZ + (alongDepth - centerZ) * ratio)
      ),
      scale(tangent, dot(offset, tangent))
    );
  };
}

export function hairShellExtrusionProfileForFaces(points, faces, faceIndices) {
  const region = faceRegionData(points, faces, faceIndices);
  if (!region) return null;
  const offsets = region.vertexIndices.map((index) => subtract(vector(points[index]), region.center));
  const { widthAxis, depthAxis } = extrusionProfileAxes(offsets, region.normal);
  const projected = offsets.map((offset) => ({
    x: dot(offset, widthAxis),
    z: dot(offset, depthAxis)
  }));
  return normalizedProfilePoints(convexProfileHull(projected)).map((point) => ({
    ...point,
    interpolation: "linear"
  }));
}

function shapedExtrusionOffset(offset, tangent, widthAxis, depthAxis, settings, parameter) {
  const width = Math.max(0.005, settings.widthScale * sampleExtrusionCurve(settings.taperCurve, parameter));
  const depth = Math.max(0.005, settings.depthScale * sampleExtrusionCurve(settings.depthCurve, parameter));
  const pointRotation = sampleExtrusionPointRotation(settings.pointRotations, parameter);
  const angle = (settings.profileRotation + settings.twist * parameter + pointRotation) * Math.PI / 180;
  const rotatedWidth = rotateAroundAxis(widthAxis, tangent, angle);
  const rotatedDepth = rotateAroundAxis(depthAxis, tangent, angle);
  return add(
    add(
      scale(rotatedWidth, dot(offset, widthAxis) * width),
      scale(rotatedDepth, dot(offset, depthAxis) * depth)
    ),
    scale(tangent, dot(offset, tangent))
  );
}

function sampleExtrusionPointRotation(pointRotations, parameter) {
  if (!Array.isArray(pointRotations) || !pointRotations.length) return 0;
  if (pointRotations.length === 1) return finiteNumber(pointRotations[0], 0);
  const scaled = Math.max(0, Math.min(1, finiteNumber(parameter, 0))) * (pointRotations.length - 1);
  const lower = Math.floor(scaled);
  const upper = Math.min(pointRotations.length - 1, lower + 1);
  const amount = scaled - lower;
  return finiteNumber(pointRotations[lower], 0)
    + (finiteNumber(pointRotations[upper], 0) - finiteNumber(pointRotations[lower], 0)) * amount;
}

export function hairShellFaceCenter(points, face) {
  return average(face.map((index) => vector(points[index])));
}

export function hairShellFaceNormal(points, face) {
  const a = vector(points[face[0]]);
  const b = vector(points[face[1]]);
  const c = vector(points[face[2]]);
  return normalize(cross(subtract(b, a), subtract(c, a)));
}

export function canExtrudeHairShellFace(baseFaces, extrusions, faceIndex) {
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= baseFaces.length) return false;
  return !(extrusions || []).some((extrusion) => (
    extrusionFaceIndices(extrusion).includes(faceIndex)
  ));
}

export function extrusionFaceIndices(extrusion = {}) {
  const source = Array.isArray(extrusion.faceIndices) && extrusion.faceIndices.length
    ? extrusion.faceIndices
    : [extrusion.faceIndex];
  return [...new Set(source.map(Number).filter(Number.isInteger))];
}

function faceEdgeKey(start, end) {
  return start < end ? `${start}:${end}` : `${end}:${start}`;
}

export function connectedHairShellFaceRegion(baseFaces, faceIndices) {
  const indices = [...new Set((faceIndices || []).map(Number).filter(Number.isInteger))];
  if (!indices.length || indices.some((index) => baseFaces?.[index]?.length !== 4)) return false;
  const selected = new Set(indices);
  const visited = new Set([indices[0]]);
  const queue = [indices[0]];
  while (queue.length) {
    const faceIndex = queue.shift();
    const face = baseFaces[faceIndex];
    for (let side = 0; side < face.length; side += 1) {
      const key = faceEdgeKey(face[side], face[(side + 1) % face.length]);
      indices.forEach((candidateIndex) => {
        if (visited.has(candidateIndex) || !selected.has(candidateIndex)) return;
        const candidate = baseFaces[candidateIndex];
        if (candidate.some((vertex, edge) => (
          faceEdgeKey(vertex, candidate[(edge + 1) % candidate.length]) === key
        ))) {
          visited.add(candidateIndex);
          queue.push(candidateIndex);
        }
      });
    }
  }
  return visited.size === indices.length;
}

function faceRegionData(basePoints, baseFaces, faceIndices) {
  const indices = [...new Set((faceIndices || []).map(Number).filter(Number.isInteger))];
  if (!connectedHairShellFaceRegion(baseFaces, indices)) return null;
  const faces = indices.map((index) => baseFaces[index]);
  if (faces.some((face) => !face.every((index) => basePoints?.[index]))) return null;
  const vertexIndices = [...new Set(faces.flat())];
  const center = average(vertexIndices.map((index) => vector(basePoints[index])));
  const normal = normalize(faces.reduce(
    (sum, face) => add(sum, hairShellFaceNormal(basePoints, face)),
    { x: 0, y: 0, z: 0 }
  ));
  const edgeCounts = new Map();
  faces.forEach((face) => face.forEach((start, side) => {
    const end = face[(side + 1) % face.length];
    const key = faceEdgeKey(start, end);
    const record = edgeCounts.get(key) || { count: 0, start, end };
    record.count += 1;
    edgeCounts.set(key, record);
  }));
  const boundaryEdges = [...edgeCounts.values()].filter((edge) => edge.count === 1);
  return { indices, faces, vertexIndices, center, normal, boundaryEdges };
}

function regionFaceSideLabels(baseFaces, region) {
  const selected = new Set(region.indices);
  const labelsByFace = new Map();
  region.indices.forEach((seedFaceIndex) => {
    if (labelsByFace.has(seedFaceIndex)) return;
    labelsByFace.set(seedFaceIndex, [0, 1, 2, 3]);
    const queue = [seedFaceIndex];
    while (queue.length) {
      const faceIndex = queue.shift();
      const face = baseFaces[faceIndex];
      const labels = labelsByFace.get(faceIndex);
      face.forEach((start, side) => {
        const key = faceEdgeKey(start, face[(side + 1) % face.length]);
        region.indices.forEach((candidateIndex) => {
          if (candidateIndex === faceIndex || !selected.has(candidateIndex) || labelsByFace.has(candidateIndex)) return;
          const candidate = baseFaces[candidateIndex];
          const candidateSide = candidate.findIndex((candidateStart, candidateEdge) => (
            faceEdgeKey(candidateStart, candidate[(candidateEdge + 1) % candidate.length]) === key
          ));
          if (candidateSide < 0) return;
          const sharedLabel = (labels[side] + 2) % 4;
          const labelOffset = (sharedLabel - candidateSide + 4) % 4;
          labelsByFace.set(candidateIndex, Array.from(
            { length: 4 },
            (_, localSide) => (localSide + labelOffset) % 4
          ));
          queue.push(candidateIndex);
        });
      });
    }
  });
  return labelsByFace;
}

export function subdivideHairShellVerticalLoops(
  basePoints,
  baseFaces,
  requestedLoops = 0,
  seedFaceIndices = null
) {
  const loops = Math.max(0, Math.min(6, Math.round(finiteNumber(requestedLoops, 0))));
  const points = (basePoints || []).map(vector);
  const sourceFaces = (baseFaces || []).map((face) => [...face]);
  if (!loops) {
    return {
      points,
      faces: sourceFaces,
      faceSources: sourceFaces.map((_, faceIndex) => faceIndex),
      faceChildren: sourceFaces.map((_, faceIndex) => [faceIndex])
    };
  }
  const divisions = loops + 1;
  const quadIndices = sourceFaces.flatMap((face, faceIndex) => face.length === 4 ? [faceIndex] : []);
  const labelsByFace = regionFaceSideLabels(sourceFaces, { indices: quadIndices });
  const edgeOwners = new Map();
  sourceFaces.forEach((face, faceIndex) => face.forEach((start, side) => {
    const key = faceEdgeKey(start, face[(side + 1) % face.length]);
    const owners = edgeOwners.get(key) || [];
    owners.push(faceIndex);
    edgeOwners.set(key, owners);
  }));
  const subdividedFaces = new Set(
    (Array.isArray(seedFaceIndices) ? seedFaceIndices : quadIndices)
      .map(Number)
      .filter((faceIndex) => sourceFaces[faceIndex]?.length === 4)
  );
  const queue = [...subdividedFaces];
  while (queue.length) {
    const faceIndex = queue.shift();
    const face = sourceFaces[faceIndex];
    const labels = labelsByFace.get(faceIndex);
    face.forEach((start, side) => {
      if (![0, 2].includes(labels[side])) return;
      const key = faceEdgeKey(start, face[(side + 1) % face.length]);
      (edgeOwners.get(key) || []).forEach((neighborIndex) => {
        if (neighborIndex === faceIndex || subdividedFaces.has(neighborIndex)) return;
        if (sourceFaces[neighborIndex]?.length !== 4) return;
        subdividedFaces.add(neighborIndex);
        queue.push(neighborIndex);
      });
    });
  }
  const edgePoints = new Map();
  const edgePoint = (start, end, step) => {
    if (step === 0) return start;
    if (step === divisions) return end;
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    const canonicalStep = start === low ? step : divisions - step;
    const key = `${low}:${high}:${canonicalStep}/${divisions}`;
    if (!edgePoints.has(key)) {
      edgePoints.set(key, points.length);
      points.push(add(
        vector(basePoints[low]),
        scale(subtract(vector(basePoints[high]), vector(basePoints[low])), canonicalStep / divisions)
      ));
    }
    return edgePoints.get(key);
  };
  const faces = [];
  const faceSources = [];
  const faceChildren = sourceFaces.map(() => []);
  sourceFaces.forEach((face, faceIndex) => {
    if (face.length !== 4 || !subdividedFaces.has(faceIndex)) {
      faceChildren[faceIndex].push(faces.length);
      faces.push([...face]);
      faceSources.push(faceIndex);
      return;
    }
    const sideStarts = Array(4);
    labelsByFace.get(faceIndex).forEach((label, localSide) => {
      sideStarts[label] = face[localSide];
    });
    for (let column = 0; column < divisions; column += 1) {
      faceChildren[faceIndex].push(faces.length);
      faces.push([
        edgePoint(sideStarts[0], sideStarts[1], column),
        edgePoint(sideStarts[0], sideStarts[1], column + 1),
        edgePoint(sideStarts[3], sideStarts[2], column + 1),
        edgePoint(sideStarts[3], sideStarts[2], column)
      ]);
      faceSources.push(faceIndex);
    }
  });
  return { points, faces, faceSources, faceChildren };
}

function easedRegionEnds(baseFaces, region, easeDirection) {
  const sideLabel = {
    top: 0,
    right: 1,
    bottom: 2,
    left: 3
  }[easeDirection];
  if (!Number.isInteger(sideLabel)) return [];
  const selected = new Set(region.indices);
  const labelsByFace = regionFaceSideLabels(baseFaces, region);
  const candidates = region.boundaryEdges.flatMap((edge) => {
    const key = faceEdgeKey(edge.start, edge.end);
    const ownerFaceIndex = region.indices.find((faceIndex) => {
      const face = baseFaces[faceIndex];
      return face.some((start, side) => (
        labelsByFace.get(faceIndex)?.[side] === sideLabel
        && faceEdgeKey(start, face[(side + 1) % face.length]) === key
      ));
    });
    if (!Number.isInteger(ownerFaceIndex)) return [];
    const supportFaceIndex = baseFaces.findIndex((face, faceIndex) => (
      !selected.has(faceIndex)
      && face?.length === 4
      && face.some((start, side) => (
        faceEdgeKey(start, face[(side + 1) % face.length]) === key
      ))
    ));
    if (supportFaceIndex < 0) return [];
    return [{ ...edge, ownerFaceIndex, supportFaceIndex }];
  });
  const usedSupportFaces = new Set();
  return candidates.filter(({ supportFaceIndex }) => {
    if (usedSupportFaces.has(supportFaceIndex)) return false;
    usedSupportFaces.add(supportFaceIndex);
    return true;
  });
}

function easedRegionChains(baseFaces, region, easeDirection, easeSpan) {
  const selected = new Set(region.indices);
  const usedFaces = new Set(region.indices);
  return easedRegionEnds(baseFaces, region, easeDirection).map((seed) => {
    const chain = [];
    let faceIndex = seed.supportFaceIndex;
    let nearStart = seed.start;
    let nearEnd = seed.end;
    while (chain.length < easeSpan && Number.isInteger(faceIndex) && !usedFaces.has(faceIndex)) {
      const face = baseFaces[faceIndex];
      const sharedEdgeIndex = face?.findIndex((start, side) => (
        faceEdgeKey(start, face[(side + 1) % face.length]) === faceEdgeKey(nearStart, nearEnd)
      ));
      if (face?.length !== 4 || sharedEdgeIndex < 0) break;
      const start = face[sharedEdgeIndex];
      const end = face[(sharedEdgeIndex + 1) % 4];
      const farEnd = face[(sharedEdgeIndex + 2) % 4];
      const farStart = face[(sharedEdgeIndex + 3) % 4];
      chain.push({ faceIndex, start, end, farEnd, farStart });
      usedFaces.add(faceIndex);
      const farEdgeKey = faceEdgeKey(farEnd, farStart);
      faceIndex = baseFaces.findIndex((candidate, candidateIndex) => (
        !selected.has(candidateIndex)
        && !usedFaces.has(candidateIndex)
        && candidate?.length === 4
        && candidate.some((candidateStart, side) => (
          faceEdgeKey(candidateStart, candidate[(side + 1) % candidate.length]) === farEdgeKey
        ))
      ));
      nearStart = farEnd;
      nearEnd = farStart;
    }
    return { ...seed, chain };
  }).filter(({ chain }) => chain.length);
}

function compactTopologyFace(face) {
  const compact = face.filter((pointIndex, index) => pointIndex !== face[(index + face.length - 1) % face.length]);
  return compact.length >= 3 ? compact : null;
}

export function extrudeHairShellFaceTopology(
  basePoints,
  baseFaces,
  faceIndexOrIndices,
  distance = 0.2,
  options = {}
) {
  const points = (basePoints || []).map(vector);
  const faces = (baseFaces || []).map((face) => [...face]);
  const faceIndices = Array.isArray(faceIndexOrIndices) ? faceIndexOrIndices : [faceIndexOrIndices];
  const region = faceRegionData(points, faces, faceIndices);
  const amount = finiteNumber(distance, 0.2);
  if (!region || Math.abs(amount) < 1e-8) return null;
  const selectedPointNormalSums = new Map();
  region.indices.forEach((faceIndex) => {
    let faceNormal = hairShellFaceNormal(points, faces[faceIndex]);
    if (dot(faceNormal, region.normal) < 0) faceNormal = scale(faceNormal, -1);
    faces[faceIndex].forEach((pointIndex) => {
      selectedPointNormalSums.set(
        pointIndex,
        add(selectedPointNormalSums.get(pointIndex) || { x: 0, y: 0, z: 0 }, faceNormal)
      );
    });
  });
  const selectedPointNormals = new Map([...selectedPointNormalSums].map(([pointIndex, normalSum]) => (
    [pointIndex, normalize(normalSum, region.normal)]
  )));
  const capIndices = new Map();
  region.vertexIndices.forEach((pointIndex) => {
    const index = points.length;
    points.push(add(points[pointIndex], scale(selectedPointNormals.get(pointIndex) || region.normal, amount)));
    capIndices.set(pointIndex, index);
  });
  const easeSpan = Math.max(1, Math.min(8, Math.round(finiteNumber(options.easeSpan, 1))));
  const easedChains = options.easeEnd
    ? easedRegionChains(faces, region, options.easeDirection, easeSpan)
    : [];
  const easedPointNormalSums = new Map();
  easedChains.forEach((easedChain) => {
    const railNormals = new Map([
      [easedChain.start, selectedPointNormals.get(easedChain.start) || region.normal],
      [easedChain.end, selectedPointNormals.get(easedChain.end) || region.normal]
    ]);
    const chainPointNormals = new Map();
    easedChain.chain.forEach(({ start, end, farEnd, farStart }) => {
      const startNormal = railNormals.get(start) || region.normal;
      const endNormal = railNormals.get(end) || region.normal;
      chainPointNormals.set(start, startNormal);
      chainPointNormals.set(farStart, startNormal);
      chainPointNormals.set(end, endNormal);
      chainPointNormals.set(farEnd, endNormal);
      railNormals.set(farStart, startNormal);
      railNormals.set(farEnd, endNormal);
    });
    chainPointNormals.forEach((sourceNormal, pointIndex) => {
      easedPointNormalSums.set(
        pointIndex,
        add(easedPointNormalSums.get(pointIndex) || { x: 0, y: 0, z: 0 }, sourceNormal)
      );
    });
  });
  region.indices.forEach((faceIndex) => {
    faces[faceIndex] = faces[faceIndex].map((pointIndex) => capIndices.get(pointIndex));
  });
  const easedEndpointCounts = new Map();
  easedChains.forEach(({ start, end }) => [start, end].forEach((pointIndex) => {
    easedEndpointCounts.set(pointIndex, (easedEndpointCounts.get(pointIndex) || 0) + 1);
  }));
  const easedPointIndices = new Map();
  const easedPointIndex = (pointIndex, factor) => {
    if (factor <= 1e-8) return pointIndex;
    if (factor >= 1 - 1e-8 && capIndices.has(pointIndex)) return capIndices.get(pointIndex);
    const key = `${pointIndex}:${factor.toFixed(6)}`;
    if (!easedPointIndices.has(key)) {
      easedPointIndices.set(key, points.length);
      const sourceNormal = normalize(easedPointNormalSums.get(pointIndex) || region.normal, region.normal);
      points.push(add(points[pointIndex], scale(sourceNormal, amount * factor)));
    }
    return easedPointIndices.get(key);
  };
  easedChains.forEach((easedChain) => {
    const first = easedChain.chain[0];
    const startOuter = easedEndpointCounts.get(first.start) === 1;
    const endOuter = easedEndpointCounts.get(first.end) === 1;
    easedChain.chain.forEach((step, stepIndex) => {
      const span = easedChain.chain.length;
      const nearFactor = 1 - (stepIndex / span);
      const farFactor = 1 - ((stepIndex + 1) / span);
      const nearStartIndex = easedPointIndex(step.start, nearFactor);
      const nearEndIndex = easedPointIndex(step.end, nearFactor);
      const farEndIndex = easedPointIndex(step.farEnd, farFactor);
      const farStartIndex = easedPointIndex(step.farStart, farFactor);
      faces[step.faceIndex] = [nearStartIndex, nearEndIndex, farEndIndex, farStartIndex];
      if (startOuter) {
        const sideFace = compactTopologyFace([step.start, nearStartIndex, farStartIndex, step.farStart]);
        if (sideFace) faces.push(sideFace);
      }
      if (endOuter) {
        const sideFace = compactTopologyFace([step.end, step.farEnd, farEndIndex, nearEndIndex]);
        if (sideFace) faces.push(sideFace);
      }
    });
  });
  const easedEdgeKeys = new Set(easedChains.map(({ start, end }) => faceEdgeKey(start, end)));
  region.boundaryEdges.forEach(({ start, end }) => {
    if (easedEdgeKeys.has(faceEdgeKey(start, end))) return;
    faces.push([start, end, capIndices.get(end), capIndices.get(start)]);
  });
  return {
    points,
    faces,
    faceIndex: region.indices[0],
    faceIndices: region.indices,
    normal: region.normal,
    easedEnd: easedChains[0] ? {
      start: easedChains[0].start,
      end: easedChains[0].end,
      supportFaceIndex: easedChains[0].supportFaceIndex
    } : null,
    easedEdges: easedChains.map(({ start, end, supportFaceIndex, chain }) => ({
      start,
      end,
      supportFaceIndex,
      span: chain.length
    })),
    easedSpan: easedChains.reduce((maximum, { chain }) => Math.max(maximum, chain.length), 0)
  };
}

export function remapHairShellExtrusions(
  sourcePoints,
  sourceFaces,
  targetPoints,
  targetFaces,
  extrusions = []
) {
  if (sourceFaces?.length !== targetFaces?.length) return [];
  return extrusions.flatMap((extrusion) => {
    const faceIndices = extrusionFaceIndices(extrusion);
    const sourceCenter = hairShellFaceRegionCenter(sourcePoints, sourceFaces, faceIndices);
    const targetCenter = hairShellFaceRegionCenter(targetPoints, targetFaces, faceIndices);
    const sourceNormal = hairShellFaceRegionNormal(sourcePoints, sourceFaces, faceIndices);
    const targetNormal = hairShellFaceRegionNormal(targetPoints, targetFaces, faceIndices);
    if (!sourceCenter || !targetCenter || !sourceNormal || !targetNormal) return [];
    return [{
      ...extrusion,
      faceIndex: faceIndices[0],
      faceIndices,
      curvePoints: (extrusion.curvePoints || []).map((point) => add(
        targetCenter,
        rotateBetween(subtract(vector(point), sourceCenter), sourceNormal, targetNormal)
      ))
    }];
  });
}

function sampledCurvePoints(curvePoints, requestedLoops) {
  const source = (curvePoints || []).map(vector);
  if (source.length < 2) return source;
  const distances = [0];
  for (let index = 1; index < source.length; index += 1) {
    distances.push(distances[index - 1] + Math.hypot(
      source[index].x - source[index - 1].x,
      source[index].y - source[index - 1].y,
      source[index].z - source[index - 1].z
    ));
  }
  const total = distances.at(-1);
  if (total < 1e-8) return [source[0], source.at(-1)];
  const loops = Math.max(2, Math.min(48, Math.round(Number(requestedLoops) || source.length - 1)));
  return Array.from({ length: loops + 1 }, (_, sampleIndex) => {
    const target = total * sampleIndex / loops;
    let segment = 0;
    while (segment < distances.length - 2 && distances[segment + 1] < target) segment += 1;
    const span = Math.max(1e-8, distances[segment + 1] - distances[segment]);
    const amount = (target - distances[segment]) / span;
    return add(source[segment], scale(subtract(source[segment + 1], source[segment]), amount));
  });
}

export function normalizeHairShellExtrusionSettings(extrusion = {}, index = 0) {
  const {
    triangleSide: _legacyTriangleSide,
    taper: _legacyTaper,
    tipScale: _legacyTipScale,
    radialSegments: _legacyRadialSegments,
    ...settings
  } = extrusion || {};
  const faceIndices = extrusionFaceIndices(extrusion);
  return {
    ...settings,
    faceIndex: faceIndices[0],
    faceIndices,
    name: typeof extrusion.name === "string" && extrusion.name.trim()
      ? extrusion.name.trim().slice(0, 60)
      : `Curve Extrusion ${index + 1}`,
    loops: Math.max(2, Math.min(48, Math.round(finiteNumber(extrusion.loops, 8)))),
    verticalLoops: Math.max(0, Math.min(6, Math.round(finiteNumber(extrusion.verticalLoops, 0)))),
    widthScale: Math.max(0.05, Math.min(3, finiteNumber(extrusion.widthScale, 1))),
    depthScale: Math.max(0.05, Math.min(3, finiteNumber(extrusion.depthScale, 1))),
    profileRotation: Math.max(-180, Math.min(180, finiteNumber(extrusion.profileRotation, 0))),
    twist: Math.max(-720, Math.min(720, finiteNumber(extrusion.twist, 0))),
    pointRotations: Array.from(
      { length: Math.max(0, extrusion.curvePoints?.length || extrusion.pointRotations?.length || 0) },
      (_, pointIndex) => Math.max(-720, Math.min(720, finiteNumber(extrusion.pointRotations?.[pointIndex], 0)))
    ),
    sweepProfile: Array.isArray(extrusion.sweepProfile) && extrusion.sweepProfile.length >= 3
      ? extrusion.sweepProfile.map((point) => ({
          x: Math.max(-3, Math.min(3, finiteNumber(point?.x, 0))),
          z: Math.max(-3, Math.min(3, finiteNumber(point?.z, 0))),
          interpolation: point?.interpolation === "linear" ? "linear" : "smooth"
        }))
      : null,
    taperCurve: normalizeExtrusionCurve(
      extrusion.taperCurve || extrusion.widthCurve,
      DEFAULT_HAIR_SHELL_EXTRUSION_WIDTH_CURVE
    ),
    depthCurve: normalizeExtrusionCurve(
      extrusion.depthCurve,
      DEFAULT_HAIR_SHELL_EXTRUSION_DEPTH_CURVE
    ),
    taperCurveSecondary: normalizeExtrusionCurve(
      extrusion.taperCurve || extrusion.widthCurve,
      DEFAULT_HAIR_SHELL_EXTRUSION_WIDTH_CURVE
    ),
    depthCurveSecondary: normalizeExtrusionCurve(
      extrusion.depthCurve,
      DEFAULT_HAIR_SHELL_EXTRUSION_DEPTH_CURVE
    ),
    asymmetricWidthCurve: false,
    asymmetricDepthCurve: false,
    rootTriangle: extrusion.rootTriangle !== false
  };
}

export function hairShellExtrusionCurveFrames(points, faces, extrusion = {}) {
  const settings = normalizeHairShellExtrusionSettings(extrusion);
  const region = faceRegionData(points, faces, settings.faceIndices);
  const curvePoints = (extrusion.curvePoints || []).map(vector);
  if (!region || !curvePoints.length) return [];
  const offsets = region.vertexIndices.map((index) => subtract(vector(points[index]), region.center));
  let previousTangent = normalize(region.normal);
  let { widthAxis, depthAxis } = extrusionProfileAxes(offsets, previousTangent);
  return curvePoints.map((point, pointIndex) => {
    const tangent = pointIndex === 0
      ? previousTangent
      : normalize(subtract(
          curvePoints[Math.min(curvePoints.length - 1, pointIndex + 1)],
          curvePoints[Math.max(0, pointIndex - 1)]
        ), previousTangent);
    widthAxis = rotateBetween(widthAxis, previousTangent, tangent);
    depthAxis = rotateBetween(depthAxis, previousTangent, tangent);
    previousTangent = tangent;
    const parameter = curvePoints.length <= 1 ? 0 : pointIndex / (curvePoints.length - 1);
    const angle = (
      settings.profileRotation
      + settings.twist * parameter
      + finiteNumber(settings.pointRotations[pointIndex], 0)
    ) * Math.PI / 180;
    const width = normalize(rotateAroundAxis(widthAxis, tangent, angle));
    const normal = normalize(rotateAroundAxis(depthAxis, tangent, angle));
    return { point, tangent, width, normal };
  });
}

export function hairShellFaceRegionCenter(points, faces, faceIndices) {
  return faceRegionData(points, faces, faceIndices)?.center || null;
}

export function hairShellFaceRegionNormal(points, faces, faceIndices) {
  return faceRegionData(points, faces, faceIndices)?.normal || null;
}

// Side 3 remains the fallback when the stroke has no usable direction across the root face.
export const HAIR_SHELL_ROOT_SUPPORT_SIDE = 2;

export function hairShellRootSupportSide(
  points,
  rootRing,
  curvePoints,
  allowedSides = null
) {
  if (!Array.isArray(rootRing) || rootRing.length !== 4) return HAIR_SHELL_ROOT_SUPPORT_SIDE;
  const center = hairShellFaceCenter(points, rootRing);
  const normal = hairShellFaceNormal(points, rootRing);
  let surfaceDirection = null;
  for (const point of curvePoints || []) {
    const direction = subtract(vector(point), center);
    const projected = subtract(direction, scale(normal, dot(direction, normal)));
    if (Math.hypot(projected.x, projected.y, projected.z) > 1e-6) {
      surfaceDirection = normalize(projected);
      break;
    }
  }
  const candidates = Array.isArray(allowedSides) && allowedSides.length
    ? allowedSides
    : [0, 1, 2, 3];
  if (!surfaceDirection) {
    return candidates.includes(HAIR_SHELL_ROOT_SUPPORT_SIDE)
      ? HAIR_SHELL_ROOT_SUPPORT_SIDE
      : candidates[0];
  }
  return candidates.reduce((bestSide, side) => {
    const next = (side + 1) % rootRing.length;
    const edgeDirection = subtract(average([
      vector(points[rootRing[side]]),
      vector(points[rootRing[next]])
    ]), center);
    const score = dot(normalize(edgeDirection), surfaceDirection);
    if (bestSide === null || score < bestSide.score) return { side, score };
    return bestSide;
  }, null)?.side ?? HAIR_SHELL_ROOT_SUPPORT_SIDE;
}

function faceEdgeIndex(face, edgeStart, edgeEnd) {
  if (!Array.isArray(face)) return -1;
  return face.findIndex((vertex, index) => {
    const next = face[(index + 1) % face.length];
    return (vertex === edgeStart && next === edgeEnd) || (vertex === edgeEnd && next === edgeStart);
  });
}

function appendExtrusionRows({
  points,
  faces,
  faceSources = null,
  rootRing,
  centers,
  rootNormal,
  profileAxes = null,
  settings
}) {
  let previousRing = [...rootRing];
  let previousTangent = normalize(rootNormal);
  const rootCenter = average(rootRing.map((index) => points[index]));
  let profileOffsets = rootRing.map((index) => subtract(points[index], rootCenter));
  let { widthAxis, depthAxis } = extrusionProfileAxesFromHint(
    profileOffsets,
    previousTangent,
    profileAxes
  );
  const deformProfile = extrusionProfileDeformer(
    profileOffsets,
    previousTangent,
    widthAxis,
    depthAxis,
    settings.sweepProfile
  );
  profileOffsets = profileOffsets.map(deformProfile);
  const appendFace = (face) => {
    faces.push(face);
    faceSources?.push(null);
  };

  for (let row = 1; row < centers.length; row += 1) {
    const tangent = normalize(subtract(
      centers[Math.min(centers.length - 1, row + 1)],
      centers[Math.max(0, row - 1)]
    ), previousTangent);
    profileOffsets = profileOffsets.map((offset) => rotateBetween(offset, previousTangent, tangent));
    widthAxis = rotateBetween(widthAxis, previousTangent, tangent);
    depthAxis = rotateBetween(depthAxis, previousTangent, tangent);
    previousTangent = tangent;
    const parameter = row / (centers.length - 1);
    const ring = profileOffsets.map((offset) => {
      const pointIndex = points.length;
      points.push(add(centers[row], shapedExtrusionOffset(
        offset,
        tangent,
        widthAxis,
        depthAxis,
        settings,
        parameter
      )));
      return pointIndex;
    });
    for (let side = 0; side < 4; side += 1) {
      const next = (side + 1) % 4;
      appendFace([previousRing[side], previousRing[next], ring[next], ring[side]]);
    }
    previousRing = ring;
  }

  appendFace([...previousRing]);
}

function appendRegionExtrusionRows({
  points,
  faces,
  faceSources = null,
  baseFaces,
  region,
  centers,
  profileAxes = null,
  settings
}) {
  const rootCenter = region.center;
  let previousTangent = normalize(region.normal);
  const offsets = new Map(region.vertexIndices.map((index) => [
    index,
    subtract(points[index], rootCenter)
  ]));
  let { widthAxis, depthAxis } = extrusionProfileAxesFromHint(
    [...offsets.values()],
    previousTangent,
    profileAxes
  );
  const deformProfile = extrusionProfileDeformer(
    [...offsets.values()],
    previousTangent,
    widthAxis,
    depthAxis,
    settings.sweepProfile
  );
  offsets.forEach((offset, index) => offsets.set(index, deformProfile(offset)));
  let previous = new Map(region.vertexIndices.map((index) => [index, index]));
  const appendFace = (face) => {
    faces.push(face);
    faceSources?.push(null);
  };
  for (let row = 1; row < centers.length; row += 1) {
    const tangent = normalize(subtract(
      centers[Math.min(centers.length - 1, row + 1)],
      centers[Math.max(0, row - 1)]
    ), previousTangent);
    offsets.forEach((offset, index) => offsets.set(index, rotateBetween(offset, previousTangent, tangent)));
    widthAxis = rotateBetween(widthAxis, previousTangent, tangent);
    depthAxis = rotateBetween(depthAxis, previousTangent, tangent);
    previousTangent = tangent;
    const parameter = row / (centers.length - 1);
    const current = new Map();
    region.vertexIndices.forEach((index) => {
      const pointIndex = points.length;
      points.push(add(centers[row], shapedExtrusionOffset(
        offsets.get(index),
        tangent,
        widthAxis,
        depthAxis,
        settings,
        parameter
      )));
      current.set(index, pointIndex);
    });
    region.boundaryEdges.forEach(({ start, end }) => {
      appendFace([previous.get(start), previous.get(end), current.get(end), current.get(start)]);
    });
    previous = current;
  }
  region.indices.forEach((faceIndex) => {
    appendFace(baseFaces[faceIndex].map((index) => previous.get(index)));
  });
}

export function buildHairShellRegionExtrusionPreviewTopology(
  basePoints,
  baseFaces,
  faceIndices,
  curvePoints,
  requestedLoops,
  extrusionSettings = {}
) {
  const region = faceRegionData(basePoints, baseFaces, faceIndices);
  if (!region) return { points: [], faces: [] };
  const centers = sampledCurvePoints(curvePoints, requestedLoops);
  if (centers.length < 2) return { points: [], faces: [] };
  centers[0] = region.center;
  const points = (basePoints || []).map(vector);
  const faces = [];
  appendRegionExtrusionRows({
    points,
    faces,
    baseFaces,
    region,
    centers,
    settings: normalizeHairShellExtrusionSettings({ ...extrusionSettings, loops: requestedLoops })
  });
  return { points, faces };
}

export function buildHairShellExtrusionPreviewTopology(
  basePoints,
  baseFace,
  curvePoints,
  requestedLoops,
  extrusionSettings = {}
) {
  if (
    !Array.isArray(baseFace)
    || baseFace.length !== 4
    || !baseFace.every((index) => basePoints?.[index])
  ) return { points: [], faces: [] };

  const rootPoints = baseFace.map((index) => vector(basePoints[index]));
  const rootRing = [0, 1, 2, 3];
  const rootCenter = hairShellFaceCenter(rootPoints, rootRing);
  const rootNormal = hairShellFaceNormal(rootPoints, rootRing);
  const centers = sampledCurvePoints(curvePoints, requestedLoops);
  if (centers.length < 2) return { points: [], faces: [] };
  centers[0] = rootCenter;

  const points = rootPoints.map(vector);
  const faces = [];
  const settings = normalizeHairShellExtrusionSettings({
    ...extrusionSettings,
    loops: requestedLoops
  });
  appendExtrusionRows({
    points,
    faces,
    rootRing,
    centers,
    rootNormal,
    settings
  });
  return { points, faces };
}

export function buildHairShellTopology(basePoints, baseFaces, extrusions = []) {
  const normalizedExtrusions = (extrusions || []).map((extrusion, index) => (
    normalizeHairShellExtrusionSettings(extrusion, index)
  ));
  const verticalLoops = normalizedExtrusions.reduce(
    (maximum, extrusion) => Math.max(maximum, extrusion.verticalLoops),
    0
  );
  const loopSeedFaces = normalizedExtrusions.flatMap((extrusion) => extrusion.faceIndices);
  const subdivided = subdivideHairShellVerticalLoops(
    basePoints,
    baseFaces,
    verticalLoops,
    loopSeedFaces
  );
  const workingPoints = subdivided.points;
  const workingFaces = subdivided.faces;
  const points = workingPoints.map(vector);
  const faces = [];
  const faceSources = [];
  const validExtrusions = normalizedExtrusions.filter((extrusion) => (
    extrusion.faceIndices.length
    && connectedHairShellFaceRegion(baseFaces, extrusion.faceIndices)
    && Array.isArray(extrusion?.curvePoints)
    && extrusion.curvePoints.length >= 2
  )).map((extrusion) => {
    const sourceRegion = faceRegionData(basePoints, baseFaces, extrusion.faceIndices);
    const sourceOffsets = sourceRegion?.vertexIndices.map((index) => (
      subtract(vector(basePoints[index]), sourceRegion.center)
    )) || [];
    const profileAxes = sourceRegion
      ? extrusionProfileAxes(sourceOffsets, sourceRegion.normal)
      : null;
    const faceIndices = extrusion.faceIndices.flatMap(
      (faceIndex) => subdivided.faceChildren[faceIndex] || []
    );
    return { ...extrusion, faceIndex: faceIndices[0], faceIndices, profileAxes };
  });
  const extrudedFaces = new Set(validExtrusions.flatMap((extrusion) => extrusion.faceIndices));
  const rootSupports = new Map();
  const supportEdgeSplits = new Map();
  validExtrusions.forEach((extrusion) => {
    if (!extrusion.rootTriangle || extrusion.faceIndices.length !== 1) return;
    const rootRing = workingFaces?.[Number(extrusion.faceIndex)];
    if (!Array.isArray(rootRing) || rootRing.length !== 4) return;
    const candidates = rootRing.flatMap((edgeStart, side) => {
      const edgeEnd = rootRing[(side + 1) % rootRing.length];
      const supportFaceIndex = workingFaces.findIndex((face, faceIndex) => (
        faceIndex !== Number(extrusion.faceIndex)
        && !extrudedFaces.has(faceIndex)
        && faceEdgeIndex(face, edgeStart, edgeEnd) >= 0
        && !rootSupports.has(faceIndex)
      ));
      return supportFaceIndex >= 0 ? [{ side, edgeStart, edgeEnd, supportFaceIndex }] : [];
    });
    if (!candidates.length) return;
    const supportSide = hairShellRootSupportSide(
      workingPoints,
      rootRing,
      extrusion.curvePoints,
      candidates.map((candidate) => candidate.side)
    );
    const { edgeStart, edgeEnd, supportFaceIndex } = candidates.find(
      (candidate) => candidate.side === supportSide
    ) || candidates[0];
    const supportFace = workingFaces[supportFaceIndex];
    const supportEdgeIndex = faceEdgeIndex(supportFace, edgeStart, edgeEnd);
    const farNext = supportFace[(supportEdgeIndex + 2) % 4];
    const farPrevious = supportFace[(supportEdgeIndex + 3) % 4];
    const splitKey = faceEdgeKey(farNext, farPrevious);
    let midpointIndex = supportEdgeSplits.get(splitKey);
    if (midpointIndex === undefined) {
      midpointIndex = points.length;
      points.push(average([vector(workingPoints[farNext]), vector(workingPoints[farPrevious])]));
      supportEdgeSplits.set(splitKey, midpointIndex);
    }
    const support = { edgeStart, edgeEnd, midpointIndex };
    rootSupports.set(supportFaceIndex, support);
  });
  workingFaces.forEach((face, faceIndex) => {
    if (extrudedFaces.has(faceIndex)) return;
    const support = rootSupports.get(faceIndex);
    const edgeIndex = support ? faceEdgeIndex(face, support.edgeStart, support.edgeEnd) : -1;
    if (edgeIndex < 0 || face.length !== 4) {
      faces.push([...face]);
      faceSources.push(subdivided.faceSources[faceIndex]);
      return;
    }
    const start = face[edgeIndex];
    const end = face[(edgeIndex + 1) % 4];
    const farNext = face[(edgeIndex + 2) % 4];
    const farPrevious = face[(edgeIndex + 3) % 4];
    faces.push(
      [support.midpointIndex, end, farNext],
      [support.midpointIndex, start, end],
      [support.midpointIndex, farPrevious, start]
    );
    const sourceFaceIndex = subdivided.faceSources[faceIndex];
    faceSources.push(sourceFaceIndex, sourceFaceIndex, sourceFaceIndex);
  });

  validExtrusions.forEach((extrusion) => {
    if (extrusion.faceIndices.length > 1) {
      const region = faceRegionData(workingPoints, workingFaces, extrusion.faceIndices);
      if (!region) return;
      const centers = sampledCurvePoints(extrusion.curvePoints, extrusion.loops);
      centers[0] = region.center;
      appendRegionExtrusionRows({
        points,
        faces,
        faceSources,
        baseFaces: workingFaces,
        region,
        centers,
        profileAxes: extrusion.profileAxes,
        settings: extrusion
      });
      return;
    }
    const faceIndex = Number(extrusion.faceIndex);
    const rootRing = workingFaces[faceIndex];
    if (!Array.isArray(rootRing) || rootRing.length !== 4) return;
    const rootCenter = hairShellFaceCenter(workingPoints, rootRing);
    const rootNormal = hairShellFaceNormal(workingPoints, rootRing);
    const centers = sampledCurvePoints(extrusion.curvePoints, extrusion.loops);
    centers[0] = rootCenter;
    appendExtrusionRows({
      points,
      faces,
      faceSources,
      rootRing,
      centers,
      rootNormal,
      profileAxes: extrusion.profileAxes,
      settings: extrusion
    });
  });

  // Propagate each support's far-edge split to its neighbour. Keep triangles
  // and quads: the renderer intentionally rejects n-gons. Splitting an edge
  // without updating its neighbour would leave a T-junction in exports.
  let welded = faces.map((face, index) => ({ face, source: faceSources[index] }));
  supportEdgeSplits.forEach((midpoint, key) => {
    welded = welded.flatMap(({ face, source }) => {
      const side = face.findIndex((start, index) => faceEdgeKey(start, face[(index + 1) % face.length]) === key);
      if (side < 0) return [{ face, source }];
      const ordered = [...face.slice(side), ...face.slice(0, side)];
      return [
        { face: [ordered[0], midpoint, ordered.at(-1)], source },
        { face: [midpoint, ...ordered.slice(1)], source }
      ];
    });
  });
  return { points, faces: welded.map(({ face }) => face), faceSources: welded.map(({ source }) => source) };
}
