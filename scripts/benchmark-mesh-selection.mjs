import { performance } from "node:perf_hooks";
import { meshComponentSelectionAfterMatches } from "../modules/mesh-selection.js";
import { polyEdgeLoopEdges } from "../modules/poly-topology.js";
import { referenceEdgeLoopEdges } from "../tests/helpers/edge-loop-reference.mjs";
import assert from "node:assert/strict";

// Reproducible CPU baseline only: excludes Three.js, picking and GPU rendering.
// Timing is diagnostic, never a pass/fail threshold on another machine.
function grid(size) {
  const points = [];
  const faces = [];
  for (let row = 0; row <= size; row++) {
    for (let column = 0; column <= size; column++) points.push({ x: column, y: row, z: 0 });
  }
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const a = row * (size + 1) + column;
      faces.push([a, a + 1, a + size + 2, a + size + 1]);
    }
  }
  return { points, faces };
}

function medianTime(operation) {
  operation();
  const samples = Array.from({ length: 5 }, () => {
    const start = performance.now();
    operation();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return samples[2].toFixed(3);
}

console.log(`Mesh selection CPU baseline (${process.version}); median of 5 warmed runs, milliseconds.`);
for (const size of [16, 64, 128]) {
  const { points, faces } = grid(size);
  const matches = { faceIndices: faces.map((_, index) => index) };
  const seed = Math.floor(size / 2) * (size + 1) + Math.floor(size / 2);
  const marquee = medianTime(() => meshComponentSelectionAfterMatches({
    type: "face", faces, matches, selectionMode: "replace"
  }));
  const loop = medianTime(() => polyEdgeLoopEdges(points, faces, [seed, seed + 1]));
  const reference = medianTime(() => referenceEdgeLoopEdges(points, faces, [seed, seed + 1]));
  assert.deepEqual(polyEdgeLoopEdges(points, faces, [seed, seed + 1]), referenceEdgeLoopEdges(points, faces, [seed, seed + 1]));
  console.log(`${faces.length} quads: select-all face merge ${marquee} ms; edge-loop ${loop} ms (reference ${reference} ms)`);
}
