import { triangulatePolygon } from './polygon-triangulation.js';

function validVertexIndex(index, vertexCount) {
  return Number.isInteger(index) && index >= 0 && index < vertexCount;
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function frontFacingPolyComponents(points, faces, viewDirection) {
  const direction = {
    x: Number(viewDirection?.x || 0),
    y: Number(viewDirection?.y || 0),
    z: Number(viewDirection?.z || 0)
  };
  const faceIndices = new Set();
  const vertexIndices = new Set();
  const edgeKeys = new Set();
  normalizePolyFaces(points, faces, { allowTriangles: true }).forEach((face, faceIndex) => {
    const origin = points[face[0]];
    const second = points[face[1]];
    const third = points[face[2]];
    const edgeA = {
      x: Number(second.x) - Number(origin.x),
      y: Number(second.y) - Number(origin.y),
      z: Number(second.z) - Number(origin.z)
    };
    const edgeB = {
      x: Number(third.x) - Number(origin.x),
      y: Number(third.y) - Number(origin.y),
      z: Number(third.z) - Number(origin.z)
    };
    const normal = {
      x: edgeA.y * edgeB.z - edgeA.z * edgeB.y,
      y: edgeA.z * edgeB.x - edgeA.x * edgeB.z,
      z: edgeA.x * edgeB.y - edgeA.y * edgeB.x
    };
    // Newell accumulation also handles an initial collinear run in an n-gon.
    normal.x=0;normal.y=0;normal.z=0;
    face.forEach((v,i)=>{
      const a=points[v],b=points[face[(i+1)%face.length]];
      normal.x+=(a.y-b.y)*(a.z+b.z);
      normal.y+=(a.z-b.z)*(a.x+b.x);
      normal.z+=(a.x-b.x)*(a.y+b.y);
    });
    const facing = normal.x * direction.x + normal.y * direction.y + normal.z * direction.z;
    if (facing >= -1e-8) return;
    faceIndices.add(faceIndex);
    face.forEach((start, side) => {
      const end = face[(side + 1) % face.length];
      vertexIndices.add(start);
      edgeKeys.add(edgeKey(start, end));
    });
  });
  return { faceIndices, vertexIndices, edgeKeys };
}

export function normalizePolyFaces(points, faces, { allowTriangles = true } = {}) {
  const vertexCount = Array.isArray(points) ? points.length : 0;
  const seen = new Set();
  return (Array.isArray(faces) ? faces : []).flatMap((face) => {
    if (!Array.isArray(face) || face.length < 3 || (!allowTriangles && face.length === 3)) return [];
    const normalized = face.map(Number);
    if (!normalized.every((index) => validVertexIndex(index, vertexCount))) return [];
    if (new Set(normalized).size !== normalized.length) return [];
    const key = [...normalized].sort((a, b) => a - b).join(":");
    if (seen.has(key)) return [];
    seen.add(key);
    return [normalized];
  });
}

export function appendPolyQuad(points, faces, indices) {
  return normalizePolyFaces(points, [...(faces || []), indices]);
}

export function extrudePolyBoundaryEdge(points, faces, edge, extrudedPoints) {
  if (!Array.isArray(edge) || edge.length !== 2 || !Array.isArray(extrudedPoints) || extrudedPoints.length !== 2) {
    return null;
  }
  const [start, end] = edge.map(Number);
  if (!validVertexIndex(start, points.length) || !validVertexIndex(end, points.length) || start === end) return null;
  const boundary = polyBoundaryEdges(points, faces).find(({ vertices }) => (
    edgeKey(vertices[0], vertices[1]) === edgeKey(start, end)
  ));
  if (!boundary) return null;
  const nextPoints = [...points, extrudedPoints[0], extrudedPoints[1]];
  const newVertexIndices = [points.length, points.length + 1];
  const nextFaces = appendPolyQuad(nextPoints, faces, [
    end,
    start,
    newVertexIndices[0],
    newVertexIndices[1]
  ]);
  if (nextFaces.length === normalizePolyFaces(points, faces).length) return null;
  return {
    points: nextPoints,
    faces: nextFaces,
    newVertexIndices,
    faceIndex: nextFaces.length - 1
  };
}

export function polyBoundaryEdgeLoop(points, faces, seedEdge) {
  if (!Array.isArray(seedEdge) || seedEdge.length !== 2) return null;
  const seedKey = edgeKey(Number(seedEdge[0]), Number(seedEdge[1]));
  const boundaryEdges = polyBoundaryEdges(points, faces);
  const seedIndex = boundaryEdges.findIndex((edge) => edge.key === seedKey);
  if (seedIndex < 0) return null;
  const edgesByVertex = new Map();
  boundaryEdges.forEach((edge, edgeIndex) => {
    edge.vertices.forEach((vertexIndex) => {
      const connected = edgesByVertex.get(vertexIndex) || [];
      connected.push(edgeIndex);
      edgesByVertex.set(vertexIndex, connected);
    });
  });
  const edgeIndices = [seedIndex];
  const visited = new Set(edgeIndices);
  const continuationAlignment = (previousIndex, currentIndex, nextIndex) => {
    const previous = points[previousIndex];
    const current = points[currentIndex];
    const next = points[nextIndex];
    const incoming = {
      x: Number(current?.x || 0) - Number(previous?.x || 0),
      y: Number(current?.y || 0) - Number(previous?.y || 0),
      z: Number(current?.z || 0) - Number(previous?.z || 0)
    };
    const outgoing = {
      x: Number(next?.x || 0) - Number(current?.x || 0),
      y: Number(next?.y || 0) - Number(current?.y || 0),
      z: Number(next?.z || 0) - Number(current?.z || 0)
    };
    const incomingLength = Math.hypot(incoming.x, incoming.y, incoming.z);
    const outgoingLength = Math.hypot(outgoing.x, outgoing.y, outgoing.z);
    if (incomingLength <= 1e-8 || outgoingLength <= 1e-8) return -1;
    return (
      incoming.x * outgoing.x
      + incoming.y * outgoing.y
      + incoming.z * outgoing.z
    ) / (incomingLength * outgoingLength);
  };
  const walk = (previousVertex, currentVertex) => {
    let previous = previousVertex;
    let current = currentVertex;
    while (true) {
      const candidates = (edgesByVertex.get(current) || []).filter((edgeIndex) => !visited.has(edgeIndex));
      if (candidates.length !== 1) return;
      const nextEdgeIndex = candidates[0];
      const nextEdge = boundaryEdges[nextEdgeIndex];
      const next = nextEdge.vertices[0] === current ? nextEdge.vertices[1] : nextEdge.vertices[0];
      if (continuationAlignment(previous, current, next) < 0.35) return;
      visited.add(nextEdgeIndex);
      edgeIndices.push(nextEdgeIndex);
      previous = current;
      current = next;
    }
  };
  const [seedStart, seedEnd] = boundaryEdges[seedIndex].vertices;
  walk(seedEnd, seedStart);
  walk(seedStart, seedEnd);
  const edges = edgeIndices.map((index) => boundaryEdges[index]);
  const sourceVertexIndices = [...new Set(edges.flatMap((edge) => edge.vertices))];
  return { edges, sourceVertexIndices };
}

export function extrudePolyBoundaryEdgeLoop(points, faces, seedEdge, extrudedPoints) {
  const loop = polyBoundaryEdgeLoop(points, faces, seedEdge);
  if (!loop || !Array.isArray(extrudedPoints) || extrudedPoints.length !== loop.sourceVertexIndices.length) {
    return null;
  }
  const baseFaces = normalizePolyFaces(points, faces);
  const nextPoints = [...points, ...extrudedPoints];
  const newVertexIndices = loop.sourceVertexIndices.map((_, index) => points.length + index);
  const newVertexBySource = new Map(loop.sourceVertexIndices.map((sourceIndex, index) => (
    [sourceIndex, newVertexIndices[index]]
  )));
  const addedFaces = loop.edges.map(({ vertices: [start, end] }) => [
    end,
    start,
    newVertexBySource.get(start),
    newVertexBySource.get(end)
  ]);
  const nextFaces = normalizePolyFaces(nextPoints, [...baseFaces, ...addedFaces]);
  if (nextFaces.length !== baseFaces.length + addedFaces.length) return null;
  return {
    points: nextPoints,
    faces: nextFaces,
    sourceVertexIndices: loop.sourceVertexIndices,
    newVertexIndices,
    newVertexBySource,
    edgeCount: loop.edges.length
  };
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

export function nearestPolyWeldTarget(
  points,
  point,
  { maxDistance = 0, excludedIndices = [] } = {}
) {
  const distance = Math.max(0, Number(maxDistance) || 0);
  if (!distance || !point || !Array.isArray(points)) return -1;
  const excluded = new Set((Array.isArray(excludedIndices) ? excludedIndices : []).map(Number));
  let bestIndex = -1;
  let bestDistanceSquared = distance * distance;
  points.forEach((candidate, index) => {
    if (!candidate || excluded.has(index)) return;
    const candidateDistanceSquared = squaredDistance(candidate, point);
    if (candidateDistanceSquared > bestDistanceSquared) return;
    bestDistanceSquared = candidateDistanceSquared;
    bestIndex = index;
  });
  return bestIndex;
}

export function polyEdgeLoopPlan(points, faces, seedEdge, parameter = 0.5) {
  const normalizedFaces = normalizePolyFaces(points, faces);
  if (!Array.isArray(seedEdge) || seedEdge.length !== 2) return null;
  const seedVertices = seedEdge.map(Number);
  if (
    !seedVertices.every((index) => validVertexIndex(index, points.length))
    || seedVertices[0] === seedVertices[1]
  ) return null;
  const edgeFaces = new Map();
  normalizedFaces.forEach((face, faceIndex) => {
    face.forEach((start, side) => {
      const end = face[(side + 1) % face.length];
      const key = edgeKey(start, end);
      const records = edgeFaces.get(key) || [];
      records.push({ faceIndex, side });
      edgeFaces.set(key, records);
    });
  });
  const seedKey = edgeKey(seedVertices[0], seedVertices[1]);
  const seedFaces = edgeFaces.get(seedKey);
  if (!seedFaces?.length) return null;
  const clampedParameter = Math.max(0.001, Math.min(0.999, Number(parameter) || 0.5));
  const cuts = new Map();
  const addCut = (vertices, amount) => {
    const key = edgeKey(vertices[0], vertices[1]);
    if (cuts.has(key)) return cuts.get(key);
    const start = points[vertices[0]];
    const end = points[vertices[1]];
    const cut = {
      key,
      vertices: [...vertices],
      parameter: amount,
      point: {
        x: Number(start.x) + (Number(end.x) - Number(start.x)) * amount,
        y: Number(start.y) + (Number(end.y) - Number(start.y)) * amount,
        z: Number(start.z) + (Number(end.z) - Number(start.z)) * amount
      }
    };
    cuts.set(key, cut);
    return cut;
  };
  addCut(seedVertices, clampedParameter);
  const faceCuts = new Map();
  const queue = seedFaces.map(({ faceIndex }) => ({ faceIndex, incomingKey: seedKey }));
  while (queue.length) {
    const { faceIndex, incomingKey } = queue.shift();
    if (faceCuts.has(faceIndex)) continue;
    const face = normalizedFaces[faceIndex];
    if (face.length !== 4) continue;
    const side = face.findIndex((start, index) => edgeKey(start, face[(index + 1) % 4]) === incomingKey);
    if (side < 0) continue;
    const incomingVertices = [face[side], face[(side + 1) % 4]];
    const incomingCut = cuts.get(incomingKey);
    if (!incomingCut) continue;
    const faceParameter = incomingCut.vertices[0] === incomingVertices[0]
      ? incomingCut.parameter
      : 1 - incomingCut.parameter;
    const oppositeVertices = [face[(side + 3) % 4], face[(side + 2) % 4]];
    const oppositeCut = addCut(oppositeVertices, faceParameter);
    faceCuts.set(faceIndex, {
      faceIndex,
      corners: [
        face[side],
        face[(side + 1) % 4],
        face[(side + 2) % 4],
        face[(side + 3) % 4]
      ],
      startKey: incomingKey,
      endKey: oppositeCut.key
    });
    (edgeFaces.get(oppositeCut.key) || []).forEach(({ faceIndex: nextFaceIndex }) => {
      if (nextFaceIndex !== faceIndex && !faceCuts.has(nextFaceIndex)) {
        queue.push({ faceIndex: nextFaceIndex, incomingKey: oppositeCut.key });
      }
    });
  }
  if (!faceCuts.size) return null;
  return {
    seedEdge: seedVertices,
    parameter: clampedParameter,
    cuts: [...cuts.values()],
    faceCuts: [...faceCuts.values()]
  };
}

export function polyEdgeLoopEdges(points, faces, seedEdge) {
  const normalizedFaces = normalizePolyFaces(points, faces, { allowTriangles: true });
  if (!Array.isArray(seedEdge) || seedEdge.length !== 2) return [];
  const seedVertices = seedEdge.map(Number);
  if (
    !seedVertices.every((index) => validVertexIndex(index, points.length))
    || seedVertices[0] === seedVertices[1]
  ) return [];
  const edges = new Map();
  const vertexEdges = new Map();
  normalizedFaces.forEach((face, faceIndex) => {
    face.forEach((start, side) => {
      const end = face[(side + 1) % face.length];
      const key = edgeKey(start, end);
      let record = edges.get(key);
      if (!record) {
        record = { key, vertices: [start, end], faces: [] };
        edges.set(key, record);
        // Register each unique edge only once. Incident arrays contain edge
        // records directly, avoiding sets and repeated map lookups in follow.
        let atStart = vertexEdges.get(start);
        if (!atStart) vertexEdges.set(start, atStart = []);
        atStart.push(record);
        let atEnd = vertexEdges.get(end);
        if (!atEnd) vertexEdges.set(end, atEnd = []);
        atEnd.push(record);
      }
      record.faces.push(faceIndex);
    });
  });
  const seedKey = edgeKey(seedVertices[0], seedVertices[1]);
  if (!edges.has(seedKey)) return [];
  const selected = new Map([[seedKey, [...seedVertices]]]);
  const follow = (startVertex) => {
    let vertexIndex = startVertex;
    let current = edges.get(seedKey);
    while (true) {
      const incident = vertexEdges.get(vertexIndex) || [];
      // Include the final rail into a triangle fan, but stop at its apex.
      // A four-spoke fan otherwise appears to have an "opposite" rail and
      // incorrectly carries the selection back down the other side.
      if (incident.length && incident.every(edge => edge.faces.every(
        faceIndex => normalizedFaces[faceIndex].length === 3
      ))) break;
      let next = null;
      for (const candidate of incident) {
        if (candidate === current || candidate.faces.some((faceIndex) => current.faces.includes(faceIndex))) continue;
        if (next) { next = null; break; } // Ambiguous pole: preserve the stopping rule.
        next = candidate;
      }
      if (!next || selected.has(next.key)) break;
      const nextEdge = next.vertices;
      selected.set(next.key, [...nextEdge]);
      vertexIndex = nextEdge[0] === vertexIndex ? nextEdge[1] : nextEdge[0];
      current = next;
    }
  };
  follow(seedVertices[0]);
  follow(seedVertices[1]);
  return [...selected.values()];
}

export function insertPolyEdgeLoops(points, faces, plans, { cutPointsByKey = null } = {}) {
  const normalizedFaces = normalizePolyFaces(points, faces);
  const activePlans = (Array.isArray(plans) ? plans : [plans]).filter(Boolean);
  if (!activePlans.length) return null;
  const cuts = new Map();
  const faceCuts = new Map();
  activePlans.forEach((plan) => {
    (plan.cuts || []).forEach((cut) => {
      if (!cuts.has(cut.key)) cuts.set(cut.key, cut);
    });
    (plan.faceCuts || []).forEach((cut) => {
      if (!faceCuts.has(cut.faceIndex)) faceCuts.set(cut.faceIndex, cut);
    });
  });
  if (!cuts.size || !faceCuts.size) return null;
  const nextPoints = [...points];
  const cutVertexIndices = new Map();
  cuts.forEach((cut, key) => {
    const override = cutPointsByKey instanceof Map
      ? cutPointsByKey.get(key)
      : cutPointsByKey?.[key];
    cutVertexIndices.set(key, nextPoints.length);
    nextPoints.push(override || cut.point);
  });
  const nextFaces = [];
  const faceSourceIndices = [];
  normalizedFaces.forEach((face, faceIndex) => {
    const split = faceCuts.get(faceIndex);
    if (!split) {
      nextFaces.push(face.flatMap((v,i)=>{
        const cut=cutVertexIndices.get(edgeKey(v,face[(i+1)%face.length]));
        return cut===undefined?[v]:[v,cut];
      }));
      faceSourceIndices.push(faceIndex);
      return;
    }
    const [a, b, c, d] = split.corners;
    const start = cutVertexIndices.get(split.startKey);
    const end = cutVertexIndices.get(split.endKey);
    if (!validVertexIndex(start, nextPoints.length) || !validVertexIndex(end, nextPoints.length)) {
      nextFaces.push(face);
      faceSourceIndices.push(faceIndex);
      return;
    }
    nextFaces.push([a, start, end, d], [start, b, c, end]);
    faceSourceIndices.push(faceIndex, faceIndex);
  });
  return {
    points: nextPoints,
    faces: normalizePolyFaces(nextPoints, nextFaces),
    faceSourceIndices,
    newVertexIndices: [...cutVertexIndices.values()],
    cutVertexIndices: [...cutVertexIndices].map(([key, index]) => ({ key, index }))
  };
}

export function polyBevelSupportPlans(points, faces, edges, width = 0.12) {
  const normalizedFaces = normalizePolyFaces(points, faces);
  const amount = Math.max(0.01, Math.min(0.45, Number(width) || 0.12));
  const selectedKeys = new Set((Array.isArray(edges) ? edges : []).map((edge) => (
    Array.isArray(edge) && edge.length === 2 ? edgeKey(Number(edge[0]), Number(edge[1])) : null
  )).filter(Boolean));
  const seedPlans = new Map();
  selectedKeys.forEach((selectedKey) => {
    normalizedFaces.forEach((face) => {
      if (face.length !== 4) return;
      const side = face.findIndex((start, index) => edgeKey(start, face[(index + 1) % 4]) === selectedKey);
      if (side < 0) return;
      const start = face[side];
      const neighbor = face[(side + 3) % 4];
      const seedKey = edgeKey(start, neighbor);
      if (selectedKeys.has(seedKey) || seedPlans.has(seedKey)) return;
      const plan = polyEdgeLoopPlan(points, normalizedFaces, [start, neighbor], amount);
      if (plan) seedPlans.set(seedKey, plan);
    });
  });
  return [...seedPlans.values()];
}

export function flowPolySelectedEdges(points, faces, edges, strength = 1) {
  // Flow deforms selected vertices; it must not discard triangular remesh tips.
  const normalizedFaces = normalizePolyFaces(points, faces, { allowTriangles: true });
  const selectedEdges = new Map((Array.isArray(edges) ? edges : []).flatMap((edge) => (
    Array.isArray(edge) && edge.length === 2
      ? [[edgeKey(Number(edge[0]), Number(edge[1])), edge.map(Number)]]
      : []
  )));
  const selectedVertices = new Set([...selectedEdges.values()].flat());
  const adjacency = new Map();
  const incidentFaces = new Map();
  normalizedFaces.forEach((face) => face.forEach((start, side) => {
    const end = face[(side + 1) % face.length];
    if (!adjacency.has(start)) adjacency.set(start, new Set());
    if (!adjacency.has(end)) adjacency.set(end, new Set());
    adjacency.get(start).add(end);
    adjacency.get(end).add(start);
    const key = edgeKey(start, end);
    if (!incidentFaces.has(key)) incidentFaces.set(key, []);
    incidentFaces.get(key).push(face);
  }));
  const amount = Math.max(0, Math.min(1, Number(strength) || 0));
  const nextPoints = points.map((point) => ({ ...point }));
  const movedVertexIndices = [];
  if (amount <= 0) return { points: nextPoints, faces: normalizedFaces, movedVertexIndices };
  // Follow the cross-loop rails topologically, not by spatial proximity. At
  // boundaries/poles or intersecting selections, an ambiguous fit is a no-op.
  const continuation = (previous, current) => {
    const shared = incidentFaces.get(edgeKey(previous, current)) || [];
    if (!shared.length || shared.length > 2 || shared.some(face => face.length !== 4)) return null;
    const candidates = [...(adjacency.get(current) || [])].filter(next => (
      next !== previous && !selectedVertices.has(next)
      && !shared.some(face => face.includes(next))
    ));
    return candidates.length === 1 ? candidates[0] : null;
  };
  selectedVertices.forEach(index => {
    const connected = [...(adjacency.get(index) || [])].filter(next => !selectedVertices.has(next));
    if (connected.length !== 2 || !points[index]) return;
    const [left, right] = connected;
    const outerLeft = continuation(index, left);
    const outerRight = continuation(index, right);
    if (outerLeft == null || outerRight == null) return;
    const support = [outerLeft, left, right, outerRight].map(i => points[i]);
    const a = points[left];
    const b = points[right];
    const axis = {x: b.x - a.x, y: b.y - a.y, z: b.z - a.z};
    const lengthSq = axis.x ** 2 + axis.y ** 2 + axis.z ** 2;
    if (lengthSq < 1e-16) return;
    const parameter = p => ((p.x-a.x)*axis.x + (p.y-a.y)*axis.y + (p.z-a.z)*axis.z) / lengthSq;
    const stations = support.map(parameter);
    const t = parameter(points[index]);
    if (stations[0] >= -1e-6 || stations[3] <= 1 + 1e-6 || t <= 0 || t >= 1) return;
    // Interpolate the surrounding rails with a cubic, preserving spacing along
    // the chord and reconstructing its bend instead of averaging it away.
    const target = {x: 0, y: 0, z: 0};
    support.forEach((point, i) => {
      let weight = 1;
      stations.forEach((station, j) => {
        if (i !== j) weight *= (t - station) / (stations[i] - station);
      });
      for (const axisName of ['x', 'y', 'z']) target[axisName] += point[axisName] * weight;
    });
    if (!Object.values(target).every(Number.isFinite)) return;
    const displacement = Math.hypot(target.x-points[index].x, target.y-points[index].y, target.z-points[index].z);
    if (displacement < 1e-12 || displacement > Math.sqrt(lengthSq)) return;
    nextPoints[index] = {
      x: points[index].x + (target.x - points[index].x) * amount,
      y: points[index].y + (target.y - points[index].y) * amount,
      z: points[index].z + (target.z - points[index].z) * amount
    };
    movedVertexIndices.push(index);
  });
  return { points: nextPoints, faces: normalizedFaces, movedVertexIndices };
}

export function polyProportionalWeights(
  vertexCount,
  faces,
  selectedIndices,
  { radius = 2.5, falloff = 0.65 } = {}
) {
  const count = Math.max(0, Math.floor(Number(vertexCount) || 0));
  const neighbors = Array.from({ length: count }, () => new Set());
  (Array.isArray(faces) ? faces : []).forEach((face) => {
    if (!Array.isArray(face) || face.length < 2) return;
    face.forEach((rawStart, side) => {
      const start = Number(rawStart);
      const end = Number(face[(side + 1) % face.length]);
      if (!validVertexIndex(start, count) || !validVertexIndex(end, count) || start === end) return;
      neighbors[start].add(end);
      neighbors[end].add(start);
    });
  });

  const seeds = [...new Set((Array.isArray(selectedIndices) ? selectedIndices : [])
    .map(Number)
    .filter((index) => validVertexIndex(index, count)))];
  const distances = new Array(count).fill(Infinity);
  const queue = [];
  seeds.forEach((index) => {
    distances[index] = 0;
    queue.push(index);
  });
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    neighbors[index].forEach((neighborIndex) => {
      if (distances[neighborIndex] <= distances[index] + 1) return;
      distances[neighborIndex] = distances[index] + 1;
      queue.push(neighborIndex);
    });
  }

  const influenceRadius = Math.max(0, Number(radius) || 0);
  const influenceFalloff = Math.max(0, Math.min(1, Number(falloff) || 0));
  return distances.map((distance) => {
    if (distance === 0) return 1;
    if (!Number.isFinite(distance) || distance > influenceRadius || influenceRadius <= 0) return 0;
    const linear = Math.max(0, Math.min(1, 1 - distance / influenceRadius));
    const smooth = linear * linear * (3 - 2 * linear);
    return 1 + (smooth - 1) * influenceFalloff;
  });
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

function mirroredXPoint(point) {
  return {
    x: -Number(point?.x || 0),
    y: Number(point?.y || 0),
    z: Number(point?.z || 0)
  };
}

export function polyMirrorVertexMap(points, { tolerance = 1e-5 } = {}) {
  const sourcePoints = Array.isArray(points) ? points : [];
  const toleranceSquared = Math.max(1e-12, Number(tolerance) ** 2);
  return sourcePoints.map((point) => {
    const mirrored = mirroredXPoint(point);
    let bestIndex = -1;
    let bestDistance = Infinity;
    sourcePoints.forEach((candidate, candidateIndex) => {
      const distance = squaredDistance(candidate, mirrored);
      if (distance > toleranceSquared || distance >= bestDistance) return;
      bestIndex = candidateIndex;
      bestDistance = distance;
    });
    return bestIndex;
  });
}

export function polyMirroredFaceRegions(
  points,
  faces,
  selectedFaceIndices,
  { tolerance = 1e-5 } = {}
) {
  const normalizedFaces = normalizePolyFaces(points, faces);
  const selected = [...new Set((Array.isArray(selectedFaceIndices) ? selectedFaceIndices : [])
    .map(Number)
    .filter((index) => Number.isInteger(index) && normalizedFaces[index]))];
  if (!selected.length) return [];
  const mirrorMap = polyMirrorVertexMap(points, { tolerance });
  const faceIndexByKey = new Map(normalizedFaces.map((face, faceIndex) => (
    [[...face].sort((a, b) => a - b).join(":"), faceIndex]
  )));
  const mirrored = selected.map((faceIndex) => {
    const mirroredVertices = normalizedFaces[faceIndex].map((index) => mirrorMap[index]);
    if (!mirroredVertices.every((index) => validVertexIndex(index, points.length))) return -1;
    return faceIndexByKey.get([...mirroredVertices].sort((a, b) => a - b).join(":")) ?? -1;
  });
  if (mirrored.some((index) => index < 0)) return [selected];
  const mirroredUnique = [...new Set(mirrored)];
  const selectedKey = [...selected].sort((a, b) => a - b).join(":");
  const mirroredKey = [...mirroredUnique].sort((a, b) => a - b).join(":");
  if (selectedKey === mirroredKey) return [selected];
  if (selected.some((index) => mirroredUnique.includes(index))) {
    return [[...new Set([...selected, ...mirroredUnique])]];
  }
  return [selected, mirroredUnique];
}

export function mirrorPolyTopologyAppend(
  points,
  faces,
  { vertexStart = points?.length || 0, faceStart = faces?.length || 0, tolerance = 1e-5 } = {}
) {
  const sourcePoints = Array.isArray(points) ? points : [];
  const normalizedFaces = normalizePolyFaces(sourcePoints, faces);
  const firstVertex = Math.max(0, Math.min(sourcePoints.length, Math.floor(Number(vertexStart) || 0)));
  const firstFace = Math.max(0, Math.min(normalizedFaces.length, Math.floor(Number(faceStart) || 0)));
  const workingPoints = sourcePoints.map((point) => ({
    x: Number(point?.x || 0),
    y: Number(point?.y || 0),
    z: Number(point?.z || 0)
  }));
  const sourceIndices = new Set();
  for (let index = firstVertex; index < sourcePoints.length; index += 1) sourceIndices.add(index);
  normalizedFaces.slice(firstFace).forEach((face) => face.forEach((index) => sourceIndices.add(index)));
  const toleranceSquared = Math.max(1e-12, Number(tolerance) ** 2);
  const sourceToMirror = [];
  const addedPoints = [];
  [...sourceIndices].sort((a, b) => a - b).forEach((sourceIndex) => {
    const mirrored = mirroredXPoint(workingPoints[sourceIndex]);
    let mirrorIndex = -1;
    let bestDistance = Infinity;
    workingPoints.forEach((candidate, candidateIndex) => {
      const distance = squaredDistance(candidate, mirrored);
      if (distance > toleranceSquared || distance >= bestDistance) return;
      mirrorIndex = candidateIndex;
      bestDistance = distance;
    });
    if (mirrorIndex < 0) {
      mirrorIndex = workingPoints.length;
      workingPoints.push(mirrored);
      addedPoints.push({ sourceIndex, point: mirrored });
    }
    sourceToMirror[sourceIndex] = mirrorIndex;
    if (sourceToMirror[mirrorIndex] == null) sourceToMirror[mirrorIndex] = sourceIndex;
  });
  let nextFaces = normalizedFaces;
  normalizedFaces.slice(firstFace).forEach((face) => {
    const mirroredFace = face.map((index) => sourceToMirror[index]).reverse();
    if (mirroredFace.every((index) => validVertexIndex(index, workingPoints.length))) {
      nextFaces = appendPolyQuad(workingPoints, nextFaces, mirroredFace);
    }
  });
  return { addedPoints, faces: nextFaces, sourceToMirror };
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
  const normalizedFaces = normalizePolyFaces(points, faces);
  const boundaryEdges = polyBoundaryEdges(points, normalizedFaces);
  const directedBoundaryEdge = (edge) => {
    const key = edgeKey(Number(edge[0]), Number(edge[1]));
    return boundaryEdges.find((candidate) => candidate.key === key)?.vertices || edge.map(Number);
  };
  const [a, b] = directedBoundaryEdge(firstEdge);
  const [c, d] = directedBoundaryEdge(secondEdge);
  if (new Set([a, b, c, d]).size !== 4) return normalizePolyFaces(points, faces);
  if (![a, b, c, d].every((index) => validVertexIndex(index, points.length))) {
    return normalizePolyFaces(points, faces);
  }
  const secondIsBoundary = boundaryEdges.some((edge) => edge.key === edgeKey(c, d));
  const sameSecondDirection = [b, a, c, d];
  const reversedSecondDirection = [b, a, d, c];
  const sameDistance = squaredDistance(points[a], points[c]) + squaredDistance(points[d], points[b]);
  const reversedDistance = squaredDistance(points[a], points[d]) + squaredDistance(points[c], points[b]);
  const quad = secondIsBoundary || reversedDistance <= sameDistance
    ? reversedSecondDirection
    : sameSecondDirection;
  return appendPolyQuad(points, faces, quad);
}

export function polyFillCandidate(
  points,
  faces,
  target,
  normal,
  { maxDistance = Infinity, vertexMaxDistance = maxDistance } = {}
) {
  const normalizedFaces = normalizePolyFaces(points, faces);
  const maxDistanceSquared = Number.isFinite(maxDistance) ? maxDistance * maxDistance : Infinity;
  const vertexMaxDistanceSquared = Number.isFinite(vertexMaxDistance)
    ? vertexMaxDistance * vertexMaxDistance
    : Infinity;
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

  const usedVertices = new Set(normalizedFaces.flat());
  const boundaryVertices = new Set(boundaryEdges.flatMap((edge) => edge.vertices));
  const nearbyVertices = points
    .map((point, index) => ({ index, distance: squaredDistance(point, target) }))
    .filter((entry) => (
      entry.distance <= vertexMaxDistanceSquared
      && (!usedVertices.has(entry.index) || boundaryVertices.has(entry.index))
    ))
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
  return deletePolyFacesAndOrphans(points, faces, [faceIndex]);
}

export function deletePolyFacesAndOrphans(points, faces, faceIndices) {
  const normalizedFaces = normalizePolyFaces(points, faces);
  const removedFaces = new Set((Array.isArray(faceIndices) ? faceIndices : [])
    .map(Number)
    .filter((index) => Number.isInteger(index) && index >= 0 && index < normalizedFaces.length));
  if (!removedFaces.size) {
    return {
      points: [...points],
      faces: normalizedFaces,
      removedVertexIndices: []
    };
  }
  const removedVerticesCandidates = [...removedFaces].flatMap((index) => normalizedFaces[index]);
  const remainingFaces = normalizedFaces.filter((_, index) => !removedFaces.has(index));
  const referencedVertices = new Set(remainingFaces.flat());
  const removedVertexIndices = [...new Set(removedVerticesCandidates)]
    .filter((index) => !referencedVertices.has(index))
    .sort((a, b) => a - b);
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
  return deletePolyVertices(points, faces, [vertexIndex]);
}

export function deletePolyVertices(points, faces, vertexIndices) {
  const removedVertices = new Set((Array.isArray(vertexIndices) ? vertexIndices : [])
    .map(Number)
    .filter((index) => validVertexIndex(index, points.length)));
  if (!removedVertices.size) {
    return {
      points: [...points],
      faces: normalizePolyFaces(points, faces)
    };
  }
  const indexMap = new Map();
  const nextPoints = [];
  points.forEach((point, index) => {
    if (removedVertices.has(index)) return;
    indexMap.set(index, nextPoints.length);
    nextPoints.push(point);
  });
  const nextFaces = normalizePolyFaces(points, faces)
    .filter((face) => !face.some((index) => removedVertices.has(index)))
    .map((face) => face.map((index) => indexMap.get(index)));
  return { points: nextPoints, faces: nextFaces };
}

export function weldPolyVertices(points, faces, weldPairs) {
  const parent = points.map((_, index) => index);
  const rootFor = (index) => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    let current = index;
    while (parent[current] !== current) {
      const next = parent[current];
      parent[current] = root;
      current = next;
    }
    return root;
  };

  (Array.isArray(weldPairs) ? weldPairs : []).forEach((pair) => {
    if (!Array.isArray(pair) || pair.length !== 2) return;
    const source = Number(pair[0]);
    const target = Number(pair[1]);
    if (
      !validVertexIndex(source, points.length)
      || !validVertexIndex(target, points.length)
      || source === target
    ) return;
    const sourceRoot = rootFor(source);
    const targetRoot = rootFor(target);
    if (sourceRoot === targetRoot) return;
    parent[sourceRoot] = targetRoot;
  });

  const roots = parent.map((_, index) => rootFor(index));
  const removedVertexIndices = roots
    .map((root, index) => (root === index ? -1 : index))
    .filter((index) => index >= 0);
  if (!removedVertexIndices.length) {
    return {
      points: [...points],
      faces: normalizePolyFaces(points, faces),
      removedVertexIndices: []
    };
  }

  const indexMap = new Map();
  const nextPoints = [];
  roots.forEach((root, index) => {
    if (root !== index) return;
    indexMap.set(index, nextPoints.length);
    nextPoints.push(points[index]);
  });
  const nextFaces = normalizePolyFaces(points, faces)
    .map((face) => face.map((index) => indexMap.get(roots[index])))
    .filter((face) => new Set(face).size === face.length);
  return {
    points: nextPoints,
    faces: normalizePolyFaces(nextPoints, nextFaces),
    removedVertexIndices
  };
}

export function polyMeshBuffers(points, faces, { allowTriangles = true } = {}) {
  const normalizedFaces = normalizePolyFaces(points, faces, { allowTriangles });
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
  normalizedFaces.forEach((face, faceIndex) => {
    for (const triangle of triangulatePolygon(points, face)) {
      indices.push(...triangle);
      triangleQuadIds.push(faceIndex);
    }
  });
  return {
    positions,
    uvs,
    indices,
    quadFaces: normalizedFaces,
    triangleQuadIds
  };
}
