import {
  polyMirroredFaceRegions,
  polyMirrorVertexMap
} from "./poly-topology.js?v=20260903-2";

function pointCoordinates(point) {
  return [Number(point?.x) || 0, Number(point?.y) || 0, Number(point?.z) || 0];
}

export function mirroredComponentVertexIndices(points, indices, { enabled = true, tolerance = 1e-5 } = {}) {
  if (!enabled || !Array.isArray(points) || !Array.isArray(indices) || !indices.length) return [];
  const selected = new Set(indices);
  const mirrorMap = polyMirrorVertexMap(points, { tolerance });
  return [...new Set(indices.map((index) => mirrorMap[index]).filter((index) => (
    Number.isInteger(index) && index >= 0 && !selected.has(index)
  )))];
}

export function mirroredComponentFaceIndices(
  points,
  faces,
  faceIndices,
  { enabled = true, tolerance = 1e-5 } = {}
) {
  if (!enabled || !Array.isArray(faceIndices) || !faceIndices.length) return [];
  const regions = polyMirroredFaceRegions(points, faces, faceIndices, { tolerance });
  return regions.length === 2 ? regions[1] : [];
}

export function meshComponentOverlayBuffers(points, components, type) {
  const sourcePoints = Array.isArray(points) ? points : [];
  const validComponents = (Array.isArray(components) ? components : []).filter((vertices) => (
    Array.isArray(vertices)
      && vertices.length >= 2
      && vertices.every((index) => Number.isInteger(index) && sourcePoints[index])
  ));
  const positions = [];
  const indices = [];
  const outlinePositions = [];
  validComponents.forEach((vertices) => {
    const start = positions.length / 3;
    vertices.forEach((index) => positions.push(...pointCoordinates(sourcePoints[index])));
    if (type === "face") {
      for (let index = 1; index < vertices.length - 1; index += 1) {
        indices.push(start, start + index, start + index + 1);
      }
    }
    const sideCount = type === "face" ? vertices.length : 1;
    for (let side = 0; side < sideCount; side += 1) {
      outlinePositions.push(
        ...pointCoordinates(sourcePoints[vertices[side]]),
        ...pointCoordinates(sourcePoints[vertices[(side + 1) % vertices.length]])
      );
    }
  });
  return { positions, indices, outlinePositions, componentCount: validComponents.length };
}

export function meshTopologyEdgePositions(points, faces) {
  const sourcePoints = Array.isArray(points) ? points : [];
  const positions = [];
  const seen = new Set();
  (Array.isArray(faces) ? faces : []).forEach((face) => {
    if (!Array.isArray(face)) return;
    face.forEach((start, side) => {
      const end = face[(side + 1) % face.length];
      if (!sourcePoints[start] || !sourcePoints[end]) return;
      const key = start < end ? `${start}:${end}` : `${end}:${start}`;
      if (seen.has(key)) return;
      seen.add(key);
      positions.push(...pointCoordinates(sourcePoints[start]), ...pointCoordinates(sourcePoints[end]));
    });
  });
  return positions;
}
