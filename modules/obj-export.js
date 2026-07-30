export function orderedFanBoundary(edges) {
  if (!edges.length) return [];
  const nextByVertex = new Map(edges.map(([from, to]) => [from, to]));
  const boundary = [edges[0][0]];
  let next = edges[0][1];
  while (next !== boundary[0] && boundary.length <= edges.length) {
    boundary.push(next);
    next = nextByVertex.get(next);
    if (next === undefined) return [];
  }
  return next === boundary[0] && boundary.length === edges.length ? boundary : [];
}

export function hairFaceIndices(geometry) {
  const indexAttribute = geometry.getIndex();
  if (!indexAttribute) return [];
  const index = indexAttribute.array;
  const quadFaces = geometry.userData.quadFaces;
  if (Array.isArray(quadFaces) && quadFaces.length) {
    return quadFaces.map((face) => [...face]);
  }
  const sideTriangleCount = Math.min(Number(geometry.userData.sideTriangleCount || 0), Math.floor(index.length / 3));
  const faces = [];
  let cursor = 0;
  for (let triangle = 0; triangle + 1 < sideTriangleCount; triangle += 2) {
    const a = index[cursor];
    const c = index[cursor + 1];
    const b = index[cursor + 2];
    const secondB = index[cursor + 3];
    const secondC = index[cursor + 4];
    const d = index[cursor + 5];
    if (b === secondB && c === secondC) {
      faces.push([a, c, d, b]);
    } else {
      faces.push([a, c, b], [secondB, secondC, d]);
    }
    cursor += 6;
  }
  const capEdges = new Map();
  for (; cursor + 2 < index.length; cursor += 3) {
    const center = index[cursor];
    if (!capEdges.has(center)) capEdges.set(center, []);
    capEdges.get(center).push([index[cursor + 1], index[cursor + 2]]);
  }
  capEdges.forEach((edges, center) => {
    const boundary = orderedFanBoundary(edges);
    if (boundary.length >= 3) {
      faces.push(boundary);
      return;
    }
    edges.forEach(([a, b]) => {
      faces.push([center, a, b]);
    });
  });
  return faces;
}

export function exportHairFaces(geometry, vertexOffset, uvOffset) {
  const hasUvs = Boolean(geometry.getAttribute("uv"));
  const faceVertex = (vertex) => hasUvs
    ? `${vertex + vertexOffset}/${vertex + uvOffset}`
    : `${vertex + vertexOffset}`;
  return hairFaceIndices(geometry)
    .map((face) => `f ${face.map(faceVertex).join(" ")}\n`)
    .join("");
}

export function exportCurvePolyline(points, vertexOffset) {
  if (!points?.length || points.length < 2) return { text: "", vertexCount: 0 };
  let text = points.map((point) => (
    `v ${Number(point.x).toFixed(5)} ${Number(point.y).toFixed(5)} ${Number(point.z).toFixed(5)}\n`
  )).join("");
  const indices = points.map((_, index) => vertexOffset + index);
  text += `l ${indices.join(" ")}\n`;
  return { text, vertexCount: points.length };
}
