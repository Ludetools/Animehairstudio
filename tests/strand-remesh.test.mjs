import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSweep,
  unionSweeps,
  validateTopology
} from "../modules/strand-remesh.js";

globalThis.requestAnimationFrame ??= (callback) => setTimeout(callback, 0);

function strand(name, x) {
  return {
    name,
    geometryType: "strand",
    scalpRegion: "back",
    width: 0.22,
    depth: 0.16,
    lengthSegments: 12,
    points: [
      { x, y: 1.0, z: 0 },
      { x: x * 0.75, y: 0.5, z: 0.08 },
      { x: x * 0.4, y: 0.0, z: 0.14 },
      { x: 0, y: -0.5, z: 0.18 }
    ],
    taperCurve: [
      { position: 0, value: 1, interpolation: "smooth" },
      { position: 1, value: 0.2, interpolation: "smooth" }
    ],
    depthCurve: [
      { position: 0, value: 1, interpolation: "smooth" },
      { position: 1, value: 0.2, interpolation: "smooth" }
    ],
    sweepProfile: [
      { x: -1, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 }
    ]
  };
}

test("buildSweep converts AHS strand profiles into framed sweeps", () => {
  const sweep = buildSweep(strand("Left", -0.08), {});
  assert.equal(sweep.name, "Left");
  assert.equal(sweep.profile.length, 4);
  assert.ok(sweep.frames.length >= 5);
  assert.ok(sweep.frames.every((frame) => frame.width > 0 && frame.depth > 0));
});

test("unionSweeps creates one remeshed topology from overlapping strands", async () => {
  const sweeps = [buildSweep(strand("Left", -0.08), {}), buildSweep(strand("Right", 0.08), {})];
  const mesh = await unionSweeps(sweeps, 12, 0.55, () => {}, { topologyStrategy: "balanced" });
  assert.ok(mesh.vertices.length > 0);
  assert.ok((mesh.objFaces || mesh.faces).length > 0);
  assert.equal(mesh.remeshedGroups, 1);
  const validation = validateTopology(mesh);
  assert.equal(validation.nonManifoldEdges, 0);
  const signedVolume = (mesh.objFaces || mesh.faces).reduce((total, face) => {
    let faceVolume = 0;
    for (let index = 1; index < face.length - 1; index += 1) {
      const a = mesh.vertices[face[0]];
      const b = mesh.vertices[face[index]];
      const c = mesh.vertices[face[index + 1]];
      faceVolume += (
        a[0] * (b[1] * c[2] - b[2] * c[1])
        + a[1] * (b[2] * c[0] - b[0] * c[2])
        + a[2] * (b[0] * c[1] - b[1] * c[0])
      ) / 6;
    }
    return total + faceVolume;
  }, 0);
  assert.ok(signedVolume > 0, "closed remesh faces should use outward winding");
});

test("unionSweeps accepts tip separation while preserving valid outward topology", async () => {
  const sweeps = [buildSweep(strand("Left", -0.08), {}), buildSweep(strand("Right", 0.08), {})];
  const mesh = await unionSweeps(sweeps, 12, 0.55, () => {}, {
    topologyStrategy: "balanced",
    tipSeparation: 0
  });
  assert.equal(mesh.jointRows.length, 1);
  assert.equal(validateTopology(mesh).nonManifoldEdges, 0);
});

test("updated Curve Union builds the source-loop fork layout for multi-strand groups", async () => {
  const sweeps = [-0.12, -0.04, 0.04, 0.12].map((x, index) => (
    buildSweep(strand(`Strand ${index + 1}`, x), {})
  ));
  const mesh = await unionSweeps(sweeps, 12, 0.55, () => {}, {
    topologyStrategy: "balanced",
    tipSeparation: 0
  });
  const validation = validateTopology(mesh);
  assert.equal(mesh.topologyMode, "balanced-fork-layout");
  assert.equal(mesh.crotchJoinMode, "two-sided-crotch-edge");
  assert.equal(mesh.sourceLoopForks, mesh.forkPanels);
  assert.equal(validation.boundaryEdges, 0);
  assert.equal(validation.nonManifoldEdges, 0);
  assert.equal(validation.ngons, 0);
});
