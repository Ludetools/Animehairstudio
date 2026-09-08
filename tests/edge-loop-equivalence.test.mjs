import assert from "node:assert/strict";
import test from "node:test";
import { polyEdgeLoopEdges } from "../modules/poly-topology.js";
import { referenceEdgeLoopEdges } from "./helpers/edge-loop-reference.mjs";

function compare(points, faces, seeds) {
  const before = structuredClone({ points, faces });
  for (const seed of seeds) {
    assert.deepEqual(polyEdgeLoopEdges(points, faces, seed), referenceEdgeLoopEdges(points, faces, seed),
      `Ordered loop differs for seed ${JSON.stringify(seed)}`);
  }
  assert.deepEqual({ points, faces }, before, "Selection must not mutate authored topology");
}

test("optimised loops match the original on open grids and closed periodic surfaces", () => {
  for (const wrap of [false, true]) {
    const size = 6;
    const points = Array.from({ length: size * size }, (_, index) => ({ x: index % size, y: Math.floor(index / size), z: 0 }));
    const at = (x, y) => (y % size) * size + x % size;
    const faces = [];
    for (let y = 0; y < size - (wrap ? 0 : 1); y++) {
      for (let x = 0; x < size - (wrap ? 0 : 1); x++) faces.push([at(x, y), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1)]);
    }
    const seeds = faces.flatMap((face) => face.flatMap((a, index) => [[a, face[(index + 1) % 4]], [face[(index + 1) % 4], a]]));
    compare(points, faces, seeds);
    // Reusing the same array after editing must not reuse stale adjacency.
    faces.splice(5, 3);
    compare(points, faces, seeds);
  }
});

test("optimised quad loops retain filtering and pole/nonmanifold behaviour", () => {
  let state = 12345;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  const points = Array.from({ length: 12 }, (_, x) => ({ x, y: 0, z: 0 }));
  for (let sample = 0; sample < 30; sample++) {
    const faces = Array.from({ length: 12 }, () => Array.from({ length: 4 }, () => (random() >>> 8) % 12));
    // Triangle traversal now intentionally differs from the quad-only reference;
    // mixed quad/triangle fans are covered by edge-loop-tips.test.mjs.
    faces.push([...faces[0]].reverse(), faces[1].map(String), [0, 1], [0, 1, 2, 999], [0, 0, 2, 3], null);
    const seeds = points.flatMap((_, a) => points.map((_, b) => [a, b]));
    compare(points, faces, [...seeds, null, [], [0], ["0", "1"], [0, NaN], [-1, 0], [0, 100]]);
  }
});
