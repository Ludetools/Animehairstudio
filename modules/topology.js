export function parseObjFaceVertexCounts(content) {
  return String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("f "))
    .map((line) => line.split(/\s+/).length - 1)
    .filter((count) => count >= 3);
}

export function fanTriangleEdgeMasks(vertexCount) {
  const count = Math.max(3, Math.round(Number(vertexCount) || 3));
  return Array.from({ length: count - 2 }, (_, triangleIndex) => {
    const fanIndex = triangleIndex + 1;
    return [
      1,
      fanIndex === count - 2 ? 1 : 0,
      fanIndex === 1 ? 1 : 0
    ];
  });
}

function triangleAreaSquared(positions, a, b, c) {
  const ax = Number(positions[a * 3]) || 0;
  const ay = Number(positions[a * 3 + 1]) || 0;
  const az = Number(positions[a * 3 + 2]) || 0;
  const abx = (Number(positions[b * 3]) || 0) - ax;
  const aby = (Number(positions[b * 3 + 1]) || 0) - ay;
  const abz = (Number(positions[b * 3 + 2]) || 0) - az;
  const acx = (Number(positions[c * 3]) || 0) - ax;
  const acy = (Number(positions[c * 3 + 1]) || 0) - ay;
  const acz = (Number(positions[c * 3 + 2]) || 0) - az;
  const crossX = aby * acz - abz * acy;
  const crossY = abz * acx - abx * acz;
  const crossZ = abx * acy - aby * acx;
  return crossX * crossX + crossY * crossY + crossZ * crossZ;
}

export function quadCellTopology(positions, face, collapseTolerance = 1e-12) {
  if (!Array.isArray(face) || face.length !== 4) {
    return { faces: [], triangleEdgeMasks: [[0, 0, 0], [0, 0, 0]] };
  }
  const [a, b, c, d] = face;
  const firstTriangle = [a, b, d];
  const secondTriangle = [d, b, c];
  const threshold = Math.max(0, Number(collapseTolerance) || 0);
  const firstValid = triangleAreaSquared(positions, ...firstTriangle) > threshold;
  const secondValid = triangleAreaSquared(positions, ...secondTriangle) > threshold;
  if (firstValid && secondValid) {
    return {
      faces: [[...face]],
      triangleEdgeMasks: [[0, 1, 1], [1, 1, 0]]
    };
  }
  return {
    faces: [
      ...(firstValid ? [firstTriangle] : []),
      ...(secondValid ? [secondTriangle] : [])
    ],
    triangleEdgeMasks: [
      firstValid ? [1, 1, 1] : [0, 0, 0],
      secondValid ? [1, 1, 1] : [0, 0, 0]
    ]
  };
}

export function triangleEdgeMasksFromFaces(triangleIndices, faces) {
  const indices = Array.from(triangleIndices || []);
  if (!Array.isArray(faces) || !faces.length || indices.length < 3) return [];
  const edgeKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
  const boundaryEdges = new Set();
  faces.forEach((face) => {
    if (!Array.isArray(face) || face.length < 3) return;
    face.forEach((vertex, index) => {
      boundaryEdges.add(edgeKey(vertex, face[(index + 1) % face.length]));
    });
  });
  const masks = [];
  for (let index = 0; index + 2 < indices.length; index += 3) {
    const a = indices[index];
    const b = indices[index + 1];
    const c = indices[index + 2];
    masks.push([
      boundaryEdges.has(edgeKey(b, c)) ? 1 : 0,
      boundaryEdges.has(edgeKey(c, a)) ? 1 : 0,
      boundaryEdges.has(edgeKey(a, b)) ? 1 : 0
    ]);
  }
  return masks;
}
