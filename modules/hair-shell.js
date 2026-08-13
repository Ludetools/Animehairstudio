function vector(point) {
  return {
    x: Number(point?.x || 0),
    y: Number(point?.y || 0),
    z: Number(point?.z || 0)
  };
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

export function hairShellFaceCenter(points, face) {
  return average(face.map((index) => vector(points[index])));
}

export function hairShellFaceNormal(points, face) {
  const a = vector(points[face[0]]);
  const b = vector(points[face[1]]);
  const c = vector(points[face[2]]);
  return normalize(cross(subtract(b, a), subtract(c, a)));
}

export function hairShellFacesShareEdge(firstFace, secondFace) {
  if (!Array.isArray(firstFace) || !Array.isArray(secondFace)) return false;
  const shared = firstFace.filter((index) => secondFace.includes(index));
  return shared.length >= 2;
}

export function canExtrudeHairShellFace(baseFaces, extrusions, faceIndex) {
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= baseFaces.length) return false;
  return !(extrusions || []).some((extrusion) => {
    const existingIndex = Number(extrusion?.faceIndex);
    return existingIndex === faceIndex
      || hairShellFacesShareEdge(baseFaces[existingIndex], baseFaces[faceIndex]);
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

export function buildHairShellTopology(basePoints, baseFaces, extrusions = []) {
  const points = (basePoints || []).map(vector);
  const faces = [];
  const faceSources = [];
  const validExtrusions = (extrusions || []).filter((extrusion) => (
    Number.isInteger(Number(extrusion?.faceIndex))
    && Array.isArray(extrusion?.curvePoints)
    && extrusion.curvePoints.length >= 2
  ));
  const extrudedFaces = new Set(validExtrusions.map((extrusion) => Number(extrusion.faceIndex)));
  (baseFaces || []).forEach((face, faceIndex) => {
    if (extrudedFaces.has(faceIndex)) return;
    faces.push([...face]);
    faceSources.push(faceIndex);
  });

  validExtrusions.forEach((extrusion) => {
    const faceIndex = Number(extrusion.faceIndex);
    const rootRing = baseFaces[faceIndex];
    if (!Array.isArray(rootRing) || rootRing.length !== 4) return;
    const rootCenter = hairShellFaceCenter(basePoints, rootRing);
    const rootNormal = hairShellFaceNormal(basePoints, rootRing);
    const centers = sampledCurvePoints(extrusion.curvePoints, extrusion.loops);
    centers[0] = rootCenter;
    let previousRing = [...rootRing];
    let previousTangent = normalize(subtract(centers[1], centers[0]), rootNormal);
    let offsets = rootRing.map((index) => subtract(vector(basePoints[index]), rootCenter));

    for (let row = 1; row < centers.length; row += 1) {
      const tangent = normalize(subtract(
        centers[Math.min(centers.length - 1, row + 1)],
        centers[Math.max(0, row - 1)]
      ), previousTangent);
      offsets = offsets.map((offset) => rotateBetween(offset, previousTangent, tangent));
      previousTangent = tangent;
      const parameter = row / (centers.length - 1);
      const taper = Math.max(0.055, Math.pow(1 - parameter, 0.72));
      const ring = offsets.map((offset) => {
        const index = points.length;
        points.push(add(centers[row], scale(offset, taper)));
        return index;
      });
      for (let side = 0; side < 4; side += 1) {
        const next = (side + 1) % 4;
        faces.push([previousRing[side], previousRing[next], ring[next], ring[side]]);
        faceSources.push(null);
      }
      previousRing = ring;
    }
    faces.push([...previousRing]);
    faceSources.push(null);
  });

  return { points, faces, faceSources };
}
