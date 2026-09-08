const EPSILON = 1e-6;

function finitePoint(point) {
  return point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
}

function normalizeContour(points) {
  const contour = (Array.isArray(points) ? points : [])
    .filter(finitePoint)
    .map((point) => ({ x: Number(point.x), y: Number(point.y) }));
  if (contour.length < 3) throw new Error("Each silhouette needs at least three points.");
  return contour;
}

function contourBounds(contour) {
  return contour.reduce((bounds, point) => ({
    minX: Math.min(bounds.minX, point.x),
    maxX: Math.max(bounds.maxX, point.x),
    minY: Math.min(bounds.minY, point.y),
    maxY: Math.max(bounds.maxY, point.y)
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

export function resampleClosedSilhouette(points, count = 16) {
  const contour = normalizeContour(points);
  const sampleCount = Math.max(3, Math.round(Number(count) || 16));
  const lengths = [];
  let perimeter = 0;
  for (let index = 0; index < contour.length; index += 1) {
    const a = contour[index];
    const b = contour[(index + 1) % contour.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    lengths.push(length);
    perimeter += length;
  }
  if (perimeter <= EPSILON) throw new Error("The silhouette needs a visible perimeter.");
  const result = [];
  let edgeIndex = 0;
  let edgeStartDistance = 0;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const targetDistance = perimeter * sampleIndex / sampleCount;
    while (
      edgeIndex < lengths.length - 1
      && edgeStartDistance + lengths[edgeIndex] < targetDistance
    ) {
      edgeStartDistance += lengths[edgeIndex];
      edgeIndex += 1;
    }
    const a = contour[edgeIndex];
    const b = contour[(edgeIndex + 1) % contour.length];
    const amount = lengths[edgeIndex] <= EPSILON
      ? 0
      : (targetDistance - edgeStartDistance) / lengths[edgeIndex];
    result.push({
      x: a.x + (b.x - a.x) * amount,
      y: a.y + (b.y - a.y) * amount
    });
  }
  return result;
}

export function silhouetteIntervalAtY(points, y) {
  const contour = normalizeContour(points);
  const intersections = [];
  for (let index = 0; index < contour.length; index += 1) {
    const a = contour[index];
    const b = contour[(index + 1) % contour.length];
    if (Math.abs(a.y - b.y) <= EPSILON) continue;
    const low = Math.min(a.y, b.y);
    const high = Math.max(a.y, b.y);
    if (y < low || y >= high) continue;
    const amount = (y - a.y) / (b.y - a.y);
    intersections.push(a.x + (b.x - a.x) * amount);
  }
  intersections.sort((a, b) => a - b);
  if (intersections.length < 2) return null;
  return { min: intersections[0], max: intersections[intersections.length - 1] };
}

export function mirrorSilhouetteInterval(interval, centerX = 0) {
  if (!interval) return null;
  const center = Number(centerX) || 0;
  const mirroredMin = center * 2 - interval.max;
  const mirroredMax = center * 2 - interval.min;
  return {
    min: Math.min(interval.min, mirroredMin),
    max: Math.max(interval.max, mirroredMax)
  };
}

function superellipseCoordinate(value, exponent) {
  if (Math.abs(value) <= EPSILON) return 0;
  return Math.sign(value) * Math.pow(Math.abs(value), 2 / exponent);
}

export function createSilhouetteVolumeGrid({
  sidePoints,
  backPoints,
  lengthSegments = 24,
  radialSegments = 12,
  roundness = 3.2,
  mirrorBackX = false,
  mirrorCenterX = 0
} = {}) {
  const side = normalizeContour(sidePoints);
  const back = normalizeContour(backPoints);
  const sideBounds = contourBounds(side);
  const backBounds = contourBounds(back);
  const minY = Math.max(sideBounds.minY, backBounds.minY);
  const maxY = Math.min(sideBounds.maxY, backBounds.maxY);
  if (!(maxY - minY > EPSILON)) throw new Error("The side and back silhouettes do not overlap vertically.");

  const rows = Math.max(2, Math.round(Number(lengthSegments) || 24));
  const around = Math.max(4, Math.round(Number(radialSegments) || 12));
  const evenAround = around % 2 === 0 ? around : around + 1;
  const exponent = Math.max(1, Number(roundness) || 3.2);
  const height = maxY - minY;
  const points = [];
  const sections = [];

  for (let row = 0; row <= rows; row += 1) {
    const amount = row / rows;
    const y = maxY - height * amount;
    const inset = Math.min(height * 0.0001, height / (rows * 20));
    const sampleY = row === 0 ? y - inset : row === rows ? y + inset : y;
    const sideInterval = silhouetteIntervalAtY(side, sampleY);
    const authoredBackInterval = silhouetteIntervalAtY(back, sampleY);
    const backInterval = mirrorBackX
      ? mirrorSilhouetteInterval(authoredBackInterval, mirrorCenterX)
      : authoredBackInterval;
    if (!sideInterval || !backInterval) {
      throw new Error("The silhouettes must each form one closed outline across their shared height.");
    }
    const centerX = (backInterval.min + backInterval.max) * 0.5;
    const centerZ = (sideInterval.min + sideInterval.max) * 0.5;
    const halfWidth = Math.max(EPSILON, (backInterval.max - backInterval.min) * 0.5);
    const halfDepth = Math.max(EPSILON, (sideInterval.max - sideInterval.min) * 0.5);
    sections.push({ y, centerX, centerZ, halfWidth, halfDepth });
    for (let column = 0; column < evenAround; column += 1) {
      const angle = column / evenAround * Math.PI * 2;
      const localX = superellipseCoordinate(Math.cos(angle), exponent) * halfWidth;
      const localZ = superellipseCoordinate(Math.sin(angle), exponent) * halfDepth;
      points.push({ x: centerX + localX, y, z: centerZ + localZ });
    }
  }

  const faces = [];
  for (let row = 0; row < rows; row += 1) {
    const upper = row * evenAround;
    const lower = (row + 1) * evenAround;
    for (let column = 0; column < evenAround; column += 1) {
      const next = (column + 1) % evenAround;
      faces.push([upper + column, upper + next, lower + next, lower + column]);
    }
  }
  const top = Array.from({ length: evenAround }, (_, index) => evenAround - 1 - index);
  const bottomStart = rows * evenAround;
  const bottom = Array.from({ length: evenAround }, (_, index) => bottomStart + index);
  faces.push(top, bottom);

  return { points, faces, sections, radialSegments: evenAround, lengthSegments: rows };
}
