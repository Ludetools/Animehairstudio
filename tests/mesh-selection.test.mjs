import assert from "node:assert/strict";
import test from "node:test";
import { meshComponentSelectionAfterPick as pick } from "../modules/mesh-selection.js";
import { meshComponentSelectionAfterMatches as batch } from "../modules/mesh-selection.js";

const faces = [[0, 1, 2, 3], [1, 4, 5, 2]];
const args = { lockId: 7, faces };
function apply(type, target, previous = {}, modifiers = {}) {
  return pick({ ...args, requestedType: type, target, component: previous.component,
    controlPoints: previous.controlPoints, modifiers });
}

for (const type of ["vertex", "edge", "face"]) {
  test(`${type} selection replaces, adds and removes without mutating its input`, () => {
    const first = type === "vertex" ? { type, index: 0 } : type === "edge" ? { type, vertices: [0, 1] } : { type, index: 0 };
    const second = type === "vertex" ? { type, index: 4 } : type === "edge" ? { type, vertices: [1, 2] } : { type, index: 1 };
    const initial = apply(type, first);
    const saved = structuredClone(initial);
    const added = apply(type, second, initial, { ctrlKey: true });
    assert.deepEqual(initial, saved);
    assert.equal(added.component.type, type);
    const removed = apply(type, first, added, { shiftKey: true });
    assert.deepEqual(removed, apply(type, second));
    assert.deepEqual(apply(type, second, initial), apply(type, second));
    assert.equal(apply(type, second, removed, { shiftKey: true }).component, null);
    assert.equal(apply(type, second, initial, { shiftKey: true, ctrlKey: true }), null);
    assert.deepEqual(initial, saved);
  });
}

test("edge identity ignores orientation and retains shared vertices after subtraction", () => {
  const initial = apply("edge", { type: "edge", vertices: [0, 1] });
  const duplicate = apply("edge", { type: "edge", vertices: [1, 0] }, initial, { ctrlKey: true });
  assert.equal(duplicate.component.edgeVertices.length, 1);
  const adjacent = apply("edge", { type: "edge", vertices: [1, 2] }, initial, { ctrlKey: true });
  const remaining = apply("edge", { type: "edge", vertices: [1, 0] }, adjacent, { shiftKey: true });
  assert.deepEqual(remaining.component.indices, [1, 2]);
  assert.deepEqual(remaining.component.edgeVertices, [[1, 2]]);
});

test("another mesh's selection does not leak into additive component picking", () => {
  for (const type of ["vertex", "edge", "face"]) {
    const target = type === "edge" ? { type, vertices: [0, 1] } : { type, index: 0 };
    const other = pick({ ...args, lockId: 99, requestedType: type, target });
    assert.deepEqual(apply(type, target, other, { ctrlKey: true }), apply(type, target));
  }
});

test("missing picks and unsupported modes do not change state", () => {
  assert.equal(pick({ ...args, requestedType: "edge", target: null }), null);
  assert.equal(pick({ ...args, requestedType: "object", target: { index: 0 } }), null);
});

for (const type of ["vertex", "vert", "edge", "face"]) {
  test(`${type} batch selection preserves type, subtraction and empty-drag semantics`, () => {
    const matches = { vertexIndices: [1, 2], edges: [[1, 2]], faceIndices: [1] };
    const current = { indices: [0, 1, 2, 3], edgeVertices: [[0, 1], [1, 2]], faceIndices: [0, 1] };
    const snapshot = structuredClone({ matches, current });
    const replaced = batch({ type, faces, matches, current, selectionMode: "replace" });
    assert.deepEqual(replaced.indices, type === "face" ? [1, 4, 5, 2] : [1, 2]);
    const removed = batch({ type, faces, matches, current, selectionMode: "remove" });
    assert.deepEqual(removed.indices, type === "face" ? [0, 1, 2, 3] : type === "edge" ? [0, 1] : [0, 3]);
    const empty = { vertexIndices: [], edges: [], faceIndices: [] };
    assert.deepEqual(batch({ type, faces, current, matches: empty, selectionMode: "replace" }).indices, []);
    assert.deepEqual(batch({ type, faces, current, matches: empty, selectionMode: "add" }),
      batch({ type, faces, current, matches: empty, selectionMode: "remove" }));
    assert.deepEqual({ matches, current }, snapshot);
  });
}

test("batch edge selection deduplicates reversed edges and owns its result arrays", () => {
  const current = { edgeVertices: [[0, 1]] };
  const matches = { edges: [[1, 0], [1, 2], [2, 3]] };
  const result = batch({ type: "edge", current, matches, selectionMode: "add" });
  assert.deepEqual(result.edgeVertices, [[1, 0], [1, 2], [2, 3]]);
  assert.deepEqual(result.indices, [1, 0, 2, 3]);
  result.edgeVertices[0][0] = 99;
  assert.deepEqual(matches.edges[0], [1, 0]);
  assert.deepEqual(current.edgeVertices, [[0, 1]]);
});
