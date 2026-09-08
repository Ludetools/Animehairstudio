import assert from "node:assert/strict";
import {
  BACK_HAIR_MESH_INTERNAL_Y_OFFSET,
  backHairMeshTopologySummary,
  createBackHairMeshData
} from "../modules/back-hair-mesh.js";
import {
  buildHairShellTopology,
  HAIR_SHELL_ROOT_SUPPORT_SIDE,
  hairShellFaceCenter,
  hairShellFaceNormal
} from "../modules/hair-shell.js";
import { polyMeshBuffers } from "../modules/poly-topology.js";
import { exportHairFaces } from "../modules/obj-export.js";

const summary = backHairMeshTopologySummary();
assert.deepEqual(summary, {
  vertexCount: 206,
  faceCount: 204,
  quadCount: 204,
  boundaryEdgeCount: 0,
  nonManifoldEdgeCount: 0
});
assert.deepEqual(backHairMeshTopologySummary({ thickness: 0 }), {
  vertexCount: 103,
  faceCount: 88,
  quadCount: 88,
  boundaryEdgeCount: 28,
  nonManifoldEdgeCount: 0
});

const base = createBackHairMeshData();
const open = createBackHairMeshData({ thickness: 0 });
const farFit = createBackHairMeshData({ thickness: 0, headFit: 0 });
const closeFit = createBackHairMeshData({ thickness: 0, headFit: 1 });
const midFit = createBackHairMeshData({ thickness: 0, headFit: 0.5 });
const wider = createBackHairMeshData({ width: 1.25 });
assert.equal(BACK_HAIR_MESH_INTERNAL_Y_OFFSET, 0.2);
assert.equal(base.faceZones.length, base.faces.length);
const directedEdges = new Map();
base.faces.forEach((face) => face.forEach((a, index) => {
  const b = face[(index + 1) % face.length];
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  directedEdges.set(key, (directedEdges.get(key) || 0) + (a < b ? 1 : -1));
}));
assert.ok([...directedEdges.values()].every((directionSum) => directionSum === 0));

const extrusionFaceIndex = 0;
const extrusionFace = base.faces[extrusionFaceIndex];
const extrusionCenter = hairShellFaceCenter(base.points, extrusionFace);
const extrusionNormal = hairShellFaceNormal(base.points, extrusionFace);
const extruded = buildHairShellTopology(base.points, base.faces, [{
  faceIndex: extrusionFaceIndex,
  loops: 4,
  curvePoints: [
    extrusionCenter,
    {
      x: extrusionCenter.x + extrusionNormal.x,
      y: extrusionCenter.y + extrusionNormal.y,
      z: extrusionCenter.z + extrusionNormal.z
    }
  ]
}]);
// Four quad rings plus one parent-support point; the support does not run
// along the sweep anymore (covered independently in core-math).
assert.equal(extruded.points.length, base.points.length + 4 * 4 + 1);
assert.equal(extruded.faces.length, base.faces.length - 1 + 2 + 4 * 4 + 1 + 1);
assert.equal(extruded.faces.filter((face) => face.length === 3).length, 4);
const supportEdge = [
  extrusionFace[HAIR_SHELL_ROOT_SUPPORT_SIDE],
  extrusionFace[(HAIR_SHELL_ROOT_SUPPORT_SIDE + 1) % extrusionFace.length]
];
const supportFaceIndex = base.faces.findIndex((face, faceIndex) => (
  faceIndex !== extrusionFaceIndex
  && face.some((vertex, index) => {
    const next = face[(index + 1) % face.length];
    return supportEdge.includes(vertex) && supportEdge.includes(next);
  })
));
const rootSupportFaces = extruded.faces.filter((_, index) => extruded.faceSources[index] === supportFaceIndex);
assert.equal(rootSupportFaces.length, 3);
assert.ok(rootSupportFaces.every((face) => face.length === 3));
assert.ok(rootSupportFaces.every((face) => face.includes(base.points.length)));
const flatRootSupportMidpoint = {
  x: (base.points[supportEdge[0]].x + base.points[supportEdge[1]].x) / 2,
  y: (base.points[supportEdge[0]].y + base.points[supportEdge[1]].y) / 2,
  z: (base.points[supportEdge[0]].z + base.points[supportEdge[1]].z) / 2
};
const distanceFromRootCenter = (point) => Math.hypot(
  point.x - extrusionCenter.x,
  point.y - extrusionCenter.y,
  point.z - extrusionCenter.z
);
assert.ok(
  distanceFromRootCenter(extruded.points[base.points.length])
    > distanceFromRootCenter(flatRootSupportMidpoint)
);
assert.ok(extruded.faces.filter((_, index) => extruded.faceSources[index] === null)
  .every((face) => face.length === 4 && !face.includes(base.points.length)),
"Parent support must not create a rail on the sweep");
const extrudedWithoutRootSupport = buildHairShellTopology(base.points, base.faces, [{
  faceIndex: extrusionFaceIndex,
  loops: 4,
  rootTriangle: false,
  curvePoints: [
    extrusionCenter,
    {
      x: extrusionCenter.x + extrusionNormal.x,
      y: extrusionCenter.y + extrusionNormal.y,
      z: extrusionCenter.z + extrusionNormal.z
    }
  ]
}]);
assert.equal(extrudedWithoutRootSupport.faces.filter((face) => face.length === 3).length, 0);
assert.ok(extrudedWithoutRootSupport.faces.every((face) => face.length === 4));
const extrusionEdges = new Map();
extruded.faces.forEach((face) => face.forEach((start, index) => {
  const end = face[(index + 1) % face.length];
  const key = start < end ? `${start}:${end}` : `${end}:${start}`;
  extrusionEdges.set(key, (extrusionEdges.get(key) || 0) + 1);
}));
assert.ok([...extrusionEdges.values()].every((uses) => uses === 2));
const extrusionDirections = new Map();
extruded.faces.forEach((face) => face.forEach((start, index) => {
  const end = face[(index + 1) % face.length];
  const key = start < end ? `${start}:${end}` : `${end}:${start}`;
  extrusionDirections.set(key, (extrusionDirections.get(key) || 0) + (start < end ? 1 : -1));
}));
assert.ok([...extrusionDirections.values()].every((sum) => sum === 0), "Shared edges must retain opposite winding");
const renderBuffers = polyMeshBuffers(extruded.points, extruded.faces, { allowTriangles: true });
assert.equal(renderBuffers.quadFaces.length, extruded.faces.length, "Rendering must not discard any welded faces");
assert.ok([...renderBuffers.positions, ...renderBuffers.uvs].every(Number.isFinite));
for (let offset = 0; offset < renderBuffers.indices.length; offset += 3) {
  const [a, b, c] = renderBuffers.indices.slice(offset, offset + 3).map((index) => extruded.points[index]);
  const u = [b.x - a.x, b.y - a.y, b.z - a.z];
  const v = [c.x - a.x, c.y - a.y, c.z - a.z];
  assert.ok(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) > 1e-10,
    "The welded support must not introduce zero-area render triangles");
}
const exported = exportHairFaces({
  getIndex: () => ({ array: renderBuffers.indices }),
  getAttribute: () => null,
  userData: { quadFaces: extruded.faces }
}, 1, 1);
const exportedFaces = exported.trim().split("\n").map((line) => line.split(" ").slice(1).map((index) => Number(index) - 1));
assert.deepEqual(exportedFaces, extruded.faces, "OBJ must preserve the welded face indices and winding");
assert.ok(wider.points[6].x > base.points[6].x);
assert.equal(wider.points[6].y, base.points[6].y);
assert.equal(wider.points[6].z, base.points[6].z);
assert.deepEqual(closeFit.faces, open.faces);
assert.ok(closeFit.points.some((point, index) => Math.hypot(
  point.x - farFit.points[index].x,
  point.y - farFit.points[index].y,
  point.z - farFit.points[index].z
) > 0.1));
midFit.points.forEach((point, index) => {
  assert.ok(Math.abs(point.x - (farFit.points[index].x + closeFit.points[index].x) * 0.5) < 0.000001);
  assert.ok(Math.abs(point.y - (farFit.points[index].y + closeFit.points[index].y) * 0.5) < 0.000001);
  assert.ok(Math.abs(point.z - (farFit.points[index].z + closeFit.points[index].z) * 0.5) < 0.000001);
});
assert.deepEqual(base.points.slice(0, open.points.length), open.points);
const center = open.points.reduce((sum, point) => ({
  x: sum.x + point.x / open.points.length,
  y: sum.y + point.y / open.points.length,
  z: sum.z + point.z / open.points.length
}), { x: 0, y: 0, z: 0 });
let outwardProjection = 0;
for (let index = 0; index < open.points.length; index += 1) {
  const inner = base.points[index];
  const outer = base.points[index + open.points.length];
  const offset = {
    x: outer.x - inner.x,
    y: outer.y - inner.y,
    z: outer.z - inner.z
  };
  assert.ok(Math.abs(Math.hypot(offset.x, offset.y, offset.z) - 0.1) < 0.000001);
  outwardProjection += offset.x * (inner.x - center.x)
    + offset.y * (inner.y - center.y)
    + offset.z * (inner.z - center.z);
}
assert.ok(outwardProjection > 0);

for (const point of base.points) {
  const mirror = base.points.find((candidate) => (
    Math.abs(candidate.x + point.x) < 0.00001
    && Math.abs(candidate.y - point.y) < 0.00001
    && Math.abs(candidate.z - point.z) < 0.00001
  ));
  assert.ok(mirror, `Missing mirrored vertex for ${JSON.stringify(point)}`);
}

const shaped = createBackHairMeshData({ crownHeight: 1.2, napeLength: 1.2, lowerFlare: 0.2 });
assert.ok(Math.max(...shaped.points.map((point) => point.y)) > Math.max(...base.points.map((point) => point.y)));
assert.ok(Math.min(...shaped.points.map((point) => point.y)) < Math.min(...base.points.map((point) => point.y)));
assert.ok(Math.max(...shaped.points.map((point) => Math.abs(point.x))) > Math.max(...base.points.map((point) => Math.abs(point.x))));

console.log("back-hair-mesh tests passed");
