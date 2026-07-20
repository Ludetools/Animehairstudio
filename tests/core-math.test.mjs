import assert from "node:assert/strict";
import test from "node:test";
import {
  closestPointsOnSegments,
  findSpatialCollisionPairs,
  solvePulledStrand
} from "../modules/strand-constraints.js";
import {
  adaptiveCurveParameters,
  normalizeTaperCurve,
  sampleArray,
  sampleTaperCurve
} from "../modules/curve-math.js";
import { exportHairFaces, orderedFanBoundary } from "../modules/obj-export.js";
import { createHairProject, projectFileName, validateHairProject } from "../modules/project-schema.js";
import { BoundedHistory } from "../modules/history.js";

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  copy(value) { return this.set(value.x, value.y, value.z); }
  add(value) { this.x += value.x; this.y += value.y; this.z += value.z; return this; }
  sub(value) { this.x -= value.x; this.y -= value.y; this.z -= value.z; return this; }
  addScaledVector(value, scale) { this.x += value.x * scale; this.y += value.y * scale; this.z += value.z * scale; return this; }
  multiplyScalar(scale) { this.x *= scale; this.y *= scale; this.z *= scale; return this; }
  dot(value) { return this.x * value.x + this.y * value.y + this.z * value.z; }
  lengthSq() { return this.dot(this); }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() { const length = this.length(); return length > 0 ? this.multiplyScalar(1 / length) : this; }
  distanceToSquared(value) { return this.clone().sub(value).lengthSq(); }
  distanceTo(value) { return Math.sqrt(this.distanceToSquared(value)); }
  angleTo(value) {
    const denominator = Math.sqrt(this.lengthSq() * value.lengthSq());
    if (!denominator) return Math.PI / 2;
    return Math.acos(Math.min(1, Math.max(-1, this.dot(value) / denominator)));
  }
}

const point = (x, y = 0, z = 0) => new Vector3(x, y, z);
const closeTo = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test("pull keeps the root fixed and preserves rigid segment lengths", () => {
  const source = [point(0), point(1), point(2), point(3)];
  const result = solvePulledStrand(source, 3, point(2, 1.5), 0);
  closeTo(result[0].distanceTo(source[0]), 0);
  for (let index = 1; index < result.length; index += 1) closeTo(result[index - 1].distanceTo(result[index]), 1, 1e-3);
});

test("pull elasticity stretches later links more than links near the root", () => {
  const source = [point(0), point(1), point(2), point(3)];
  const result = solvePulledStrand(source, 3, point(5), 0.6);
  const lengths = result.slice(1).map((value, index) => value.distanceTo(result[index]));
  assert.ok(lengths[2] > lengths[1]);
  assert.ok(lengths[1] > lengths[0]);
});

test("pulling a middle point carries the untouched tail", () => {
  const source = [point(0), point(1), point(2), point(3)];
  const result = solvePulledStrand(source, 2, point(1.5, 1), 0.2);
  const moved = result[2].clone().sub(source[2]);
  const tailMoved = result[3].clone().sub(source[3]);
  closeTo(moved.distanceTo(tailMoved), 0);
});

test("segment closest points find a crossing", () => {
  const closest = closestPointsOnSegments(point(-1), point(1), point(0, -1), point(0, 1));
  closeTo(closest.pointA.distanceTo(point(0, 0)), 0);
  closeTo(closest.pointB.distanceTo(point(0, 0)), 0);
});

test("collision broad phase excludes same strands and same clumps", () => {
  const bounds = (id, clumpId = null) => ({
    lock: { id, clumpId }, min: point(0, 0, 0), max: point(0.2, 0.2, 0.2)
  });
  assert.deepEqual(findSpatialCollisionPairs([bounds("a"), bounds("a")]), []);
  assert.deepEqual(findSpatialCollisionPairs([bounds("a", "c"), bounds("b", "c")]), []);
  assert.deepEqual(findSpatialCollisionPairs([bounds("a"), bounds("b")]), [[0, 1]]);
});

test("curve normalization clamps, sorts, and anchors endpoints", () => {
  const curve = normalizeTaperCurve([
    { position: 0.8, value: 2, interpolation: "wat" },
    { position: 0.2, value: -1, interpolation: "linear" }
  ]);
  assert.equal(curve[0].position, 0);
  assert.equal(curve.at(-1).position, 1);
  assert.equal(curve[0].value, 0);
  assert.equal(curve.at(-1).value, 1.5);
  assert.equal(curve.at(-1).interpolation, "smooth");
});

test("smooth taper interpolation stays between neighboring controls", () => {
  const curve = normalizeTaperCurve([
    { position: 0, value: 0.2, interpolation: "smooth" },
    { position: 0.5, value: 1, interpolation: "smooth" },
    { position: 1, value: 0, interpolation: "smooth" }
  ]);
  for (let index = 0; index <= 100; index += 1) {
    const value = sampleTaperCurve(curve, index / 100);
    assert.ok(value >= 0 && value <= 1);
  }
});

test("adaptive density keeps ordered endpoints", () => {
  const sampler = { getTangent: (t) => point(1, Math.sin(t * Math.PI) * 0.5, 0) };
  const parameters = adaptiveCurveParameters(sampler, 24, 0.8);
  assert.equal(parameters[0], 0);
  assert.equal(parameters.at(-1), 1);
  assert.ok(parameters.length >= 5 && parameters.length <= 25);
  assert.ok(parameters.every((value, index) => index === 0 || value > parameters[index - 1]));
  closeTo(sampleArray([0, 10], 0.25), 2.5);
});

test("OBJ side triangles reconstruct as a quad and preserve UV indices", () => {
  const geometry = {
    userData: { sideTriangleCount: 2 },
    getIndex: () => ({ array: [0, 2, 1, 1, 2, 3] }),
    getAttribute: (name) => name === "uv" ? {} : null
  };
  assert.equal(exportHairFaces(geometry, 1, 1), "f 1/1 3/3 4/4 2/2\n");
  assert.deepEqual(orderedFanBoundary([[1, 2], [2, 3], [3, 1]]), [1, 2, 3]);
});

test("project files have stable names, metadata, and validation", () => {
  assert.equal(projectFileName(" Braided Bob! "), "braided-bob.animehair.json");
  const project = createHairProject({
    name: "Braided Bob",
    state: { locks: [{ scalpRegion: "bangs" }], guides: [], pendingPlacedLockId: "temporary" },
    strandGroups: [{ id: "bangs" }, { id: "unassigned" }],
    savedAt: "2026-07-19T00:00:00.000Z"
  });
  assert.equal(project.metadata.groupCounts.bangs, 1);
  assert.equal(project.state.pendingPlacedLockId, null);
  assert.equal(validateHairProject(project), project);
  assert.throws(() => validateHairProject({ format: "other", version: 1 }), /Unsupported/);
});

test("undo history stays bounded and returns newest snapshots first", () => {
  const history = new BoundedHistory(2);
  history.push("first");
  history.push("second");
  history.push("third");
  assert.equal(history.length, 2);
  assert.equal(history.pop(), "third");
  assert.equal(history.pop(), "second");
  assert.equal(history.pop(), undefined);
});
