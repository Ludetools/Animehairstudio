function validVertexIndex(index, vertexCount) {
  return Number.isInteger(index) && index >= 0 && index < vertexCount;
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function normalizePolyFaces(points, faces) {
  const vertexCount = Array.isArray(points) ? points.length : 0;
  const seen = new Set();
  return (Array.isArray(faces) ? faces : []).flatMap((face) => {
    if (!Array.isArray(face) || face.length !== 4) return [];
    const normalized = face.map(Number);
    if (!normalized.every((index) => validVertexIndex(index, vertexCount))) return [];
    if (new Set(normalized).size !== 4) return [];
    const key = [...normalized].sort((a, b) => a - b).join(":");
    if (seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });
}

export function appendPolyQuad(points, faces, indices) {
  return normalizePolyFaces(points, [...(faces || []), indices]);
}

export function polyBoundaryEdges(points, faces) {
  const normalizedFaces = normalizePolyFaces(points, faces);
  const edges = new Map();
  normalizedFaces.forEach((face, faceIndex) => {
    face.forEach((start, index) => {
      const end = face[(index + 1) % face.length];
      const key = edgeKey(start, end);
      const record = edges.get(key) || { key, vertices: [start, end], faces: [] };
      record.faces.push(faceIndex);
      edges.set(key, record);
    });
  });
  return [...edges.values()].filter((edge) => edge.faces.length === 1);
}

export function relaxPolyPoints(
  points,
  faces,
  center,
  { radius = Infinity, strength = 0.22 } = {}
) {
  const normalizedFaces = normalizePolyFaces(points, faces);
  const neighbors = points.map(() => new Set());
  const boundaryNeighbors = points.map(() => new Set());
  const edgeCounts = new Map();
  normalizedFaces.forEach((face) => {
    face.forEach((start, index) => {
      const end = face[(index + 1) % face.length];
      neighbors[start].add(end);
      neighbors[end].add(start);
      const key = edgeKey(start, end);
      const record = edgeCounts.get(key) || { vertices: [start, end], count: 0 };
      record.count += 1;
      edgeCounts.set(key, record);
    });
  });
  edgeCounts.forEach(({ vertices: [start, end], count }) => {
    if (count !== 1) return;
    boundaryNeighbors[start].add(end);
    boundaryNeighbors[end].add(start);
  });

  const finiteRadius = Number.isFinite(radius) ? Math.max(1e-6, Number(radius)) : Infinity;
  const clampedStrength = Math.max(0, Math.min(1, Number(strength) || 0));
  const nextPoints = points.map((point) => ({ ...point }));
  const movedVertexIndices = [];
  points.forEach((point, index) => {
    const distance = Math.sqrt(squaredDistance(point, center));
    if (distance > finiteRadius) return;
    const activeNeighbors = boundaryNeighbors[index].size >= 2
      ? boundaryNeighbors[index]
      : neighbors[index];
    if (activeNeighbors.size < 2) return;
    const average = [...activeNeighbors].reduce((sum, neighborIndex) => {
      const neighbor = points[neighborIndex];
      sum.x += Number(neighbor?.x || 0);
      sum.y += Number(neighbor?.y || 0);
      sum.z += Number(neighbor?.z || 0);
      return sum;
    }, { x: 0, y: 0, z: 0 });
    average.x /= activeNeighbors.size;
    average.y /= activeNeighbors.size;
    average.z /= activeNeighbors.size;
    const normalizedDistance = Number.isFinite(finiteRadius) ? distance / finiteRadius : 0;
    const falloff = 1 - normalizedDistance * normalizedDistance;
    const amount = clampedStrength * Math.max(0, falloff);
    const next = {
      x: Number(point?.x || 0) + (average.x - Number(point?.x || 0)) * amount,
      y: Number(point?.y || 0) + (average.y - Number(point?.y || 0)) * amount,
      z: Number(point?.z || 0) + (average.z - Number(point?.z || 0)) * amount
    };
    if (squaredDistance(next, point) <= 1e-14) return;
    nextPoints[index] = next;
    movedVertexIndices.push(index);
  });
  return { points: nextPoints, movedVertexIndices };
}

function squaredDistance(a, b) {
  const dx = Number(a?.x || 0) - Number(b?.x || 0);
  const dy = Number(a?.y || 0) - Number(b?.y || 0);
  const dz = Number(a?.z || 0) - Number(b?.z || 0);
  return dx * dx + dy * dy + dz * dz;
}

function midpoint(a, b) {
  return {
    x: (Number(a?.x || 0) + Number(b?.x || 0)) * 0.5,
    y: (Number(a?.y || 0) + Number(b?.y || 0)) * 0.5,
    z: (Number(a?.z || 0) + Number(b?.z || 0)) * 0.5
  };
}

function orderedVerticesAroundTarget(points, indices, target, normal) {
  const normalizedNormal = {
    x: Number(normal?.x || 0),
    y: Number(normal?.y || 1),
    z: Number(normal?.z || 0)
  };
  const normalLength = Math.hypot(normalizedNormal.x, normalizedNormal.y, normalizedNormal.z) || 1;
  normalizedNormal.x /= normalLength;
  normalizedNormal.y /= normalLength;
  normalizedNormal.z /= normalLength;
  const reference = Math.abs(normalizedNormal.y) < 0.9
    ? { x: 0, y: 1, z: 0 }
    : { x: 1, y: 0, z: 0 };
  const tangent = {
    x: reference.y * normalizedNormal.z - reference.z * normalizedNormal.y,
    y: reference.z * normalizedNormal.x - reference.x * normalizedNormal.z,
    z: reference.x * normalizedNormal.y - reference.y * normalizedNormal.x
  };
  const tangentLength = Math.hypot(tangent.x, tangent.y, tangent.z) || 1;
  tangent.x /= tangentLength;
  tangent.y /= tangentLength;
  tangent.z /= tangentLength;
  const bitangent = {
    x: normalizedNormal.y * tangent.z - normalizedNormal.z * tangent.y,
    y: normalizedNormal.z * tangent.x - normalizedNormal.x * tangent.z,
    z: normalizedNormal.x * tangent.y - normalizedNormal.y * tangent.x
  };
  return [...indices].sort((first, second) => {
    const a = points[first];
    const b = points[second];
    const ax = Number(a?.x || 0) - Number(target?.x || 0);
    const ay = Number(a?.y || 0) - Number(target?.y || 0);
    const az = Number(a?.z || 0) - Number(target?.z || 0);
    const bx = Number(b?.x || 0) - Number(target?.x || 0);
    const by = Number(b?.y || 0) - Number(target?.y || 0);
    const bz = Number(b?.z || 0) - Number(target?.z || 0);
    const angleA = Math.atan2(
      ax * bitangent.x + ay * bitangent.y + az * bitangent.z,
      ax * tangent.x + ay * tangent.y + az * tangent.z
    );
    const angleB = Math.atan2(
      bx * bitangent.x + by * bitangent.y + bz * bitangent.z,
      bx * tangent.x + by * tangent.y + bz * tangent.z
    );
    return angleA - angleB;
  });
}

export function bridgePolyEdges(points, faces, firstEdge, secondEdge) {
  if (!Array.isArray(firstEdge) || !Array.isArray(secondEdge)) return normalizePolyFaces(points, faces);
  const [a, b] = firstEdge.map(Number);
  const [c, d] = secondEdge.map(Number);
  if (new Set([a, b, c, d]).size !== 4) return normalizePolyFaces(points, faces);
  if (![a, b, c, d].every((index) => validVertexIndex(index, points.length))) {
    return normalizePolyFaces(points, faces);
  }
  const straight = squaredDistance(points[a], points[d]) + squaredDistance(points[b], points[c]);
  const crossed = squaredDistance(points[a], points[c]) + squaredDistance(points[b], points[d]);
  const quad = straight <= crossed ? [a, b, c, d] : [a, b, d, c];
  return appendPolyQuad(points, faces, quad);
}

export function polyFillCandidate(points, faces, target, normal, { maxDistance = Infinity } = {}) {
  const normalizedFaces = normalizePolyFaces(points, faces);
  const maxDistanceSquared = Number.isFinite(maxDistance) ? maxDistance * maxDistance : Infinity;
  const boundaryEdges = polyBoundaryEdges(points, normalizedFaces);
  let bestBridge = null;
  for (let first = 0; first < boundaryEdges.length; first += 1) {
    for (let second = first + 1; second < boundaryEdges.length; second += 1) {
      const firstEdge = boundaryEdges[first].vertices;
      const secondEdge = boundaryEdges[second].vertices;
      if (new Set([...firstEdge, ...secondEdge]).size !== 4) continue;
      const firstMidpoint = midpoint(points[firstEdge[0]], points[firstEdge[1]]);
      const secondMidpoint = midpoint(points[secondEdge[0]], points[secondEdge[1]]);
      if (
        squaredDistance(firstMidpoint, target) > maxDistanceSquared
        || squaredDistance(secondMidpoint, target) > maxDistanceSquared
      ) continue;
      const bridgedFaces = bridgePolyEdges(points, normalizedFaces, firstEdge, secondEdge);
      if (bridgedFaces.length === normalizedFaces.length) continue;
      const score = squaredDistance(firstMidpoint, target) + squaredDistance(secondMidpoint, target);
      if (!bestBridge || score < bestBridge.score) {
        bestBridge = {
          kind: "bridge",
          edges: [firstEdge, secondEdge],
          faces: bridgedFaces,
          score
        };
      }
    }
  }
  if (bestBridge) return bestBridge;

  const nearbyVertices = points
    .map((point, index) => ({ index, distance: squaredDistance(point, target) }))
    .filter((entry) => entry.distance <= maxDistanceSquared)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);
  let bestQuad = null;
  for (let a = 0; a < nearbyVertices.length - 3; a += 1) {
    for (let b = a + 1; b < nearbyVertices.length - 2; b += 1) {
      for (let c = b + 1; c < nearbyVertices.length - 1; c += 1) {
        for (let d = c + 1; d < nearbyVertices.length; d += 1) {
          const entries = [nearbyVertices[a], nearbyVertices[b], nearbyVertices[c], nearbyVertices[d]];
          const orderedVertices = orderedVerticesAroundTarget(
            points,
            entries.map((entry) => entry.index),
            target,
            normal
          );
          const filledFaces = appendPolyQuad(points, normalizedFaces, orderedVertices);
          if (filledFaces.length === normalizedFaces.length) continue;
          const score = entries.reduce((sum, entry) => sum + entry.distance, 0);
          if (!bestQuad || score < bestQuad.score) {
            bestQuad = {
              kind: "quad",
              vertices: orderedVertices,
              faces: filledFaces,
              score
            };
          }
        }
      }
    }
  }
  return bestQuad;
}

export function deletePolyFace(points, faces, faceIndex) {
  return normalizePolyFaces(points, faces).filter((_, index) => index !== faceIndex);
}

export function deletePolyFaceAndOrphans(points, faces, faceIndex) {
  const normalizedFaces = normalizePolyFaces(points, faces);
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= normalizedFaces.length) {
    return {
      points: [...points],
      faces: normalizedFaces,
      removedVertexIndices: []
    };
  }
  const removedFace = normalizedFaces[faceIndex];
  const remainingFaces = normalizedFaces.filter((_, index) => index !== faceIndex);
  const referencedVertices = new Set(remainingFaces.flat());
  const removedVertexIndices = removedFace.filter((index) => !referencedVertices.has(index));
  const removedVertices = new Set(removedVertexIndices);
  const indexMap = new Map();
  const nextPoints = [];
  points.forEach((point, index) => {
    if (removedVertices.has(index)) return;
    indexMap.set(index, nextPoints.length);
    nextPoints.push(point);
  });
  const nextFaces = remainingFaces.map((face) => face.map((index) => indexMap.get(index)));
  return {
    points: nextPoints,
    faces: nextFaces,
    removedVertexIndices
  };
}

export function deletePolyEdge(points, faces, edge) {
  if (!Array.isArray(edge) || edge.length !== 2) return normalizePolyFaces(points, faces);
  const target = edgeKey(Number(edge[0]), Number(edge[1]));
  return normalizePolyFaces(points, faces).filter((face) => (
    !face.some((start, index) => edgeKey(start, face[(index + 1) % face.length]) === target)
  ));
}

export function deletePolyVertex(points, faces, vertexIndex) {
  if (!validVertexIndex(vertexIndex, points.length)) {
    return {
      points: [...points],
      faces: normalizePolyFaces(points, faces)
    };
  }
  const nextPoints = points.filter((_, index) => index !== vertexIndex);
  const nextFaces = normalizePolyFaces(points, faces)
    .filter((face) => !face.includes(vertexIndex))
    .map((face) => face.map((index) => index > vertexIndex ? index - 1 : index));
  return { points: nextPoints, faces: nextFaces };
}

export function polyMeshBuffers(points, faces) {
  const normalizedFaces = normalizePolyFaces(points, faces);
  const positions = points.flatMap((point) => [
    Number(point?.x || 0),
    Number(point?.y || 0),
    Number(point?.z || 0)
  ]);
  const extents = ["x", "y", "z"].map((axis) => {
    const values = points.map((point) => Number(point?.[axis] || 0));
    return {
      axis,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 1
    };
  }).sort((a, b) => (b.max - b.min) - (a.max - a.min));
  const [uAxis, vAxis] = extents;
  const uSpan = Math.max(1e-6, uAxis.max - uAxis.min);
  const vSpan = Math.max(1e-6, vAxis.max - vAxis.min);
  const uvs = points.flatMap((point) => [
    (Number(point?.[uAxis.axis] || 0) - uAxis.min) / uSpan,
    (Number(point?.[vAxis.axis] || 0) - vAxis.min) / vSpan
  ]);
  const indices = [];
  const triangleQuadIds = [];
  normalizedFaces.forEach(([a, b, c, d], faceIndex) => {
    indices.push(a, b, c, a, c, d);
    triangleQuadIds.push(faceIndex, faceIndex);
  });
  return {
    positions,
    uvs,
    indices,
    quadFaces: normalizedFaces,
    triangleQuadIds
  };
}
