import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { flowPolySelectedEdges, normalizePolyFaces } from '../modules/poly-topology.js';

function fixture() {
  return {
    points: [[0,0,0],[1,0,1],[2,0,0],[0,1,0],[1,1,1],[2,1,0],
      [100,0,0],[101,0,0],[100.5,1,0]].map(([x,y,z]) => ({x,y,z})),
    faces: [[0,1,4,3],[1,2,5,4],[6,7,8]]
  };
}

function curvedStrip(curve) {
  const points = [-2,-1,0,1,2].flatMap(t => [0,1].map(z => ({...curve(t), z})));
  const faces = Array.from({length: 4}, (_, i) => [2*i,2*i+2,2*i+3,2*i+1]);
  return {points, faces};
}

test('Edge Flow reconstructs a bent rail instead of flattening it', () => {
  const {points, faces} = curvedStrip(t => ({x:t, y:t*t*0.2}));
  const smooth = flowPolySelectedEdges(points, faces, [[4,5]], 1);
  points.forEach((point, i) => assert.ok(Math.hypot(smooth.points[i].x-point.x, smooth.points[i].y-point.y) < 1e-10));
  points[4].y = 0.3;
  points[5].y = 0.3;
  const original = structuredClone(points);
  for (const strength of [0, 0.5, 1]) {
    const result = flowPolySelectedEdges(points, faces, [[4,5]], strength);
    assert.ok(Math.abs(result.points[4].y - 0.3*(1-strength)) < 1e-10);
    assert.ok(Math.abs(result.points[5].y - 0.3*(1-strength)) < 1e-10);
    points.forEach((point, i) => { if (i !== 4 && i !== 5) assert.deepEqual(result.points[i], point); });
    assert.deepEqual(result.faces, faces);
  }
  assert.deepEqual(points, original);
});

test('Edge Flow follows a circular bend closely without the old midpoint shrinkage', () => {
  const {points, faces} = curvedStrip(t => ({x:Math.cos(t*0.4), y:Math.sin(t*0.4)}));
  const result = flowPolySelectedEdges(points, faces, [[4,5]], 1);
  const radius = Math.hypot(result.points[4].x, result.points[4].y);
  assert.ok(Math.abs(radius-1) < 0.02, `curvature fit radius ${radius}`);
  assert.ok(radius > Math.cos(0.4) + 0.05, 'must reconstruct the bend, not its chord');
});

test('Edge Flow preserves distant tip triangles and moves only selected edge vertices', () => {
  const {points, faces} = fixture();
  const original = JSON.stringify({points, faces});
  for (const strength of [0, 0.5, 1]) {
    const result = flowPolySelectedEdges(points, faces, [[1,4]], strength);
    assert.deepEqual(result.faces, faces);
    assert.deepEqual(result.points.slice(6), points.slice(6));
    points.forEach((point, index) => {
      if (![1,4].includes(index)) assert.deepEqual(result.points[index], point);
    });
    assert.deepEqual(result.movedVertexIndices, []); // No outer loops to infer curvature.
  }
  assert.equal(JSON.stringify({points, faces}), original);
});

test('Mesh commit preserves remesh tip triangles through the rebuild boundary', () => {
  const {points, faces} = fixture();
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const source = app.slice(app.indexOf('function commitMeshOperationTopology('), app.indexOf('function meshBevelSelectedEdges('));
  // Execute the production commit with rendering/UI doubles. The rebuild spy
  // checks its input; this does not verify GPU rendering or live pointer edits.
  class Vector3 {
    constructor(x,y,z) { Object.assign(this, {x,y,z}); }
  }
  let rebuilds = 0;
  const context = vm.createContext({
    THREE: {Vector3}, normalizePolyFaces,
    rebuildHairShell(lock) {
      rebuilds++;
      assert.deepEqual(lock.hairShellBaseFaces, faces);
    },
    clearHairShellFaceSelection() {}, clearHairShellComponentSelection() {},
    renderLockList() {}, syncActiveMirror() {}, updateCount() {}, syncMeshOperationsPanel() {},
    restoreMeshEdgeSelection(lock, edges) { assert.deepEqual(edges, [[1,4]]); }
  });
  vm.runInContext(source, context);
  const lock = {geometryType: 'hair-shell'};
  context.commitMeshOperationTopology(lock, points, faces, [[1,4]]);
  assert.equal(rebuilds, 1);
  assert.equal(lock.hairShellTopologyEdited, true);
  assert.deepEqual(JSON.parse(JSON.stringify(lock.hairShellBaseFaces)), faces);
});
