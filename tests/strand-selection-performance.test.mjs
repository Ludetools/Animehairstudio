import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('function refreshStrandCurveSelectionVisuals()'), app.indexOf('function resetGuideSelectionVisuals()'));
function fixture() {
  const preset = JSON.parse(readFileSync(new URL('../assets/presets/layered-side-bun.ahs', import.meta.url), 'utf8'));
  const calls = [];
  const state = {locks: preset.state.locks.map(lock => ({...lock, curveObjects: {group: {visible: true}}})),
    component: true, sculpt: false, selectedId: null,
    strandWorkspaceActive: () => true, componentEditModeActive: () => state.component,
    sculptBrushToolActive: () => state.sculpt, adaptiveRemeshCurveSourceVisible: lock => Boolean(lock.adaptiveSource),
    activeAdaptiveRemeshResult: () => null, adaptiveRemeshSourceLocks: () => [], syncLockedStrandWireVisual() {},
    updateCurveObjects: (lock, options) => { calls.push(lock.id); lock.curveObjects.group.visible = options.visible; }};
  vm.createContext(state);
  vm.runInContext(source, state);
  return {state, calls};
}
test('Layered Side Bun selection rebuilds one strand helper instead of every strand', () => {
  const {state, calls} = fixture();
  state.selectedId = state.locks[0].id;
  state.refreshStrandCurveSelectionVisuals();
  assert.deepEqual(calls, [state.selectedId]);
  assert.equal(state.locks.filter(lock => lock.curveObjects.group.visible).length, 1);
  calls.length = 0;
  state.selectedId = state.locks[1].id;
  state.refreshStrandCurveSelectionVisuals();
  assert.deepEqual(calls, [state.selectedId]);
  assert.equal(state.locks[0].curveObjects.group.visible, false);
});
test('Selection optimisation retains adaptive and sculpt refreshes and object-mode hiding', () => {
  const {state, calls} = fixture();
  state.selectedId = state.locks[0].id;
  state.locks[1].adaptiveSource = true;
  state.refreshStrandCurveSelectionVisuals();
  assert.equal(calls.length, 2);
  calls.length = 0;
  state.sculpt = true;
  state.refreshStrandCurveSelectionVisuals();
  assert.equal(calls.length, state.locks.length);
  calls.length = 0;
  state.sculpt = false;
  state.component = false;
  state.refreshStrandCurveSelectionVisuals();
  assert.equal(calls.length, 0);
  assert.ok(state.locks.every(lock => !lock.curveObjects.group.visible));
});
