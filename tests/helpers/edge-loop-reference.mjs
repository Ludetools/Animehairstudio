// Frozen pre-optimisation oracle. Do not update to mirror production changes.
import { normalizePolyFaces } from "../../modules/poly-topology.js";
function validVertexIndex(index, count) { return Number.isInteger(index) && index >= 0 && index < count; }
function edgeKey(a, b) { return a < b ? `${a}:${b}` : `${b}:${a}`; }
export function referenceEdgeLoopEdges(points, faces, seedEdge) {
  const normalizedFaces = normalizePolyFaces(points, faces);
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
      const record = edges.get(key) || { key, vertices: [start, end], faces: [] };
      record.faces.push(faceIndex);
      edges.set(key, record);
      [start, end].forEach((vertexIndex) => {
        const connected = vertexEdges.get(vertexIndex) || new Set();
        connected.add(key);
        vertexEdges.set(vertexIndex, connected);
      });
    });
  });
  const seedKey = edgeKey(seedVertices[0], seedVertices[1]);
  if (!edges.has(seedKey)) return [];
  const selected = new Map([[seedKey, [...seedVertices]]]);
  const follow = (startVertex) => {
    let vertexIndex = startVertex;
    let currentKey = seedKey;
    while (true) {
      const currentFaces = new Set(edges.get(currentKey)?.faces || []);
      const candidates = [...(vertexEdges.get(vertexIndex) || [])].filter((candidateKey) => (
        candidateKey !== currentKey
        && !(edges.get(candidateKey)?.faces || []).some((faceIndex) => currentFaces.has(faceIndex))
      ));
      if (candidates.length !== 1) break;
      const nextKey = candidates[0];
      if (selected.has(nextKey)) break;
      const nextEdge = edges.get(nextKey)?.vertices;
      if (!nextEdge) break;
      selected.set(nextKey, [...nextEdge]);
      vertexIndex = nextEdge[0] === vertexIndex ? nextEdge[1] : nextEdge[0];
      currentKey = nextKey;
    }
  };
  follow(seedVertices[0]);
  follow(seedVertices[1]);
  return [...selected.values()];
}
