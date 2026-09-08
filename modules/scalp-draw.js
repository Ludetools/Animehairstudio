const EPSILON = 1e-8;

function finitePoint(point) {
  return point
    && Number.isFinite(Number(point.x))
    && Number.isFinite(Number(point.y))
    && Number.isFinite(Number(point.z));
}

export function resampleOpenScalpBoundary(points, count = 24) {
  const source = (Array.isArray(points) ? points : [])
    .filter(finitePoint)
    .map((point) => ({ x: Number(point.x), y: Number(point.y), z: Number(point.z) }));
  if (source.length < 2) throw new Error("Draw a longer scalp boundary.");
  const sampleCount = Math.max(2, Math.round(Number(count) || 24));
  const lengths = [];
  let total = 0;
  for (let index = 0; index < source.length - 1; index += 1) {
    const a = source[index];
    const b = source[index + 1];
    const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    lengths.push(length);
    total += length;
  }
  if (total <= EPSILON) throw new Error("Draw a boundary with visible length.");
  const result = [];
  let edgeIndex = 0;
  let edgeStart = 0;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const target = total * sampleIndex / (sampleCount - 1);
    while (edgeIndex < lengths.length - 1 && edgeStart + lengths[edgeIndex] < target) {
      edgeStart += lengths[edgeIndex];
      edgeIndex += 1;
    }
    const a = source[edgeIndex];
    const b = source[edgeIndex + 1];
    const amount = lengths[edgeIndex] <= EPSILON ? 0 : (target - edgeStart) / lengths[edgeIndex];
    result.push({
      x: a.x + (b.x - a.x) * amount,
      y: a.y + (b.y - a.y) * amount,
      z: a.z + (b.z - a.z) * amount
    });
  }
  return result;
}

export function createMirroredScalpGrid(boundaryPoints, {
  centerX = 0,
  widthSegments = 8,
  headCenter = null,
  insidePoint = null
} = {}) {
  const boundary = (Array.isArray(boundaryPoints) ? boundaryPoints : []).filter(finitePoint);
  if (boundary.length < 2) throw new Error("The scalp boundary needs at least two points.");
  const across = Math.max(1, Math.round(Number(widthSegments) || 8));
  const center = Number(centerX) || 0;
  const origin = finitePoint(headCenter) ? headCenter : null;
  const inside = finitePoint(insidePoint) && origin
    ? normalizePoint(subtractPoint(insidePoint, origin))
    : null;
  const useLongArc = inside ? chooseLongScalpArc(boundary, center, origin, inside) : false;
  const points = [];
  boundary.forEach((point) => {
    const mirroredX = center * 2 - Number(point.x);
    const mirrored = { x: mirroredX, y: Number(point.y), z: Number(point.z) };
    for (let column = 0; column <= across; column += 1) {
      const amount = column / across;
      points.push(origin && inside
        ? interpolateScalpArc(mirrored, point, origin, amount, useLongArc)
        : {
            x: mirroredX + (Number(point.x) - mirroredX) * amount,
            y: Number(point.y),
            z: Number(point.z)
          });
    }
  });
  const faces = [];
  const columns = across + 1;
  for (let row = 0; row < boundary.length - 1; row += 1) {
    for (let column = 0; column < across; column += 1) {
      const upper = row * columns + column;
      const lower = (row + 1) * columns + column;
      faces.push([upper, upper + 1, lower + 1, lower]);
    }
  }
  return { points, faces, rows: boundary.length, columns };
}

function subtractPoint(point, origin) {
  return {
    x: Number(point.x) - Number(origin.x),
    y: Number(point.y) - Number(origin.y),
    z: Number(point.z) - Number(origin.z)
  };
}

function pointLength(point) {
  return Math.hypot(point.x, point.y, point.z);
}

function normalizePoint(point) {
  const length = pointLength(point);
  if (length <= EPSILON) return { x: 0, y: 0, z: 1 };
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}

function pointDot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function pointCross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function rotatePointAroundAxis(point, axis, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const cross = pointCross(axis, point);
  const dot = pointDot(axis, point);
  return {
    x: point.x * cosine + cross.x * sine + axis.x * dot * (1 - cosine),
    y: point.y * cosine + cross.y * sine + axis.y * dot * (1 - cosine),
    z: point.z * cosine + cross.z * sine + axis.z * dot * (1 - cosine)
  };
}

function scalpArcData(start, end, origin) {
  const startOffset = subtractPoint(start, origin);
  const endOffset = subtractPoint(end, origin);
  const startRadius = pointLength(startOffset);
  const endRadius = pointLength(endOffset);
  const startDirection = normalizePoint(startOffset);
  const endDirection = normalizePoint(endOffset);
  const axisValue = pointCross(startDirection, endDirection);
  const axisLength = pointLength(axisValue);
  if (axisLength <= EPSILON) return null;
  const axis = normalizePoint(axisValue);
  const angle = Math.acos(Math.max(-1, Math.min(1, pointDot(startDirection, endDirection))));
  return { startDirection, startRadius, endRadius, axis, angle };
}

function chooseLongScalpArc(boundary, centerX, origin, insideDirection) {
  let best = null;
  boundary.forEach((point) => {
    const mirrored = { x: centerX * 2 - Number(point.x), y: Number(point.y), z: Number(point.z) };
    const arc = scalpArcData(mirrored, point, origin);
    if (!arc) return;
    const shortMidpoint = rotatePointAroundAxis(arc.startDirection, arc.axis, arc.angle * 0.5);
    const longMidpoint = rotatePointAroundAxis(arc.startDirection, arc.axis, -(Math.PI * 2 - arc.angle) * 0.5);
    const shortScore = pointDot(shortMidpoint, insideDirection);
    const longScore = pointDot(longMidpoint, insideDirection);
    const score = Math.max(shortScore, longScore);
    if (!best || score > best.score) best = { score, useLong: longScore > shortScore };
  });
  return Boolean(best?.useLong);
}

function interpolateScalpArc(start, end, origin, amount, useLongArc) {
  if (amount <= 0) return { x: Number(start.x), y: Number(start.y), z: Number(start.z) };
  if (amount >= 1) return { x: Number(end.x), y: Number(end.y), z: Number(end.z) };
  const arc = scalpArcData(start, end, origin);
  if (!arc) {
    return {
      x: Number(start.x) + (Number(end.x) - Number(start.x)) * amount,
      y: Number(start.y) + (Number(end.y) - Number(start.y)) * amount,
      z: Number(start.z) + (Number(end.z) - Number(start.z)) * amount
    };
  }
  const totalAngle = useLongArc ? -(Math.PI * 2 - arc.angle) : arc.angle;
  const direction = rotatePointAroundAxis(arc.startDirection, arc.axis, totalAngle * amount);
  const radius = arc.startRadius + (arc.endRadius - arc.startRadius) * amount;
  return {
    x: Number(origin.x) + direction.x * radius,
    y: Number(origin.y) + direction.y * radius,
    z: Number(origin.z) + direction.z * radius
  };
}

export function scalpQuadWireEdges(faces) {
  const edges = [];
  const seen = new Set();
  (Array.isArray(faces) ? faces : []).forEach((face) => {
    if (!Array.isArray(face) || face.length !== 4) return;
    for (let index = 0; index < 4; index += 1) {
      const a = Number(face[index]);
      const b = Number(face[(index + 1) % 4]);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) continue;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push([a, b]);
    }
  });
  return edges;
}
