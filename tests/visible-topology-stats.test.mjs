import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('function topologyStatsForLock('), app.indexOf('function normalizeBraidDimensions('));
function lock(vertices, indices, visible = true, parent = null) {
  return {mesh: {visible, parent, geometry: {
    getAttribute: () => ({count: vertices}), getIndex: () => indices == null ? null : {count: indices}
  }}};
}

test('Viewport totals count only visible authored meshes, respecting hidden ancestors', () => {
  const parent = {visible: false};
  const state = vm.createContext({locks: [lock(12, 18), lock(9, null, false), lock(6, 12, true, parent), {}], viewportTotalStats: {}});
  vm.runInContext(source, state);
  state.updateViewportTotalTopologyStats();
  assert.equal(state.viewportTotalStats.textContent, '12 verts / 6 tris');
  state.locks[1].mesh.visible = true;
  parent.visible = true;
  state.updateViewportTotalTopologyStats();
  assert.equal(state.viewportTotalStats.textContent, '27 verts / 13 tris');
  state.locks.forEach(item => { if (item.mesh) item.mesh.visible = false; });
  state.updateViewportTotalTopologyStats();
  assert.equal(state.viewportTotalStats.textContent, '0 verts / 0 tris');
});

test('Visibility filtering affects viewport totals without changing selected-object or group stats', () => {
  const hidden = lock(9, null, false);
  const state = vm.createContext({locks: [hidden], viewportTotalStats: {}, viewportSelectedStats: {}, strandTopologyStats: {}, groupTopologyStats: {},
    getSelectedLock: () => hidden, selectedLocksInOrder: () => [hidden], selectedStrandGroup: 'unassigned'});
  vm.runInContext(source, state);
  state.updateTopologyStats();
  assert.equal(state.viewportTotalStats.textContent, '0 verts / 0 tris');
  assert.equal(state.viewportSelectedStats.textContent, '9 verts / 3 tris');
  assert.equal(state.groupTopologyStats.textContent, '9 verts / 3 tris');
});
