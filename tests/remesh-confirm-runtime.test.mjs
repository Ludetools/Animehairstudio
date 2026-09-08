import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { effectiveRemeshMethod } from '../modules/remesh-method.js';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('function tryConfirmAutoRemeshStrands()'), app.indexOf('function applyStandardExtrudeTopology('));
const normalizeSource = app.slice(app.indexOf('function normalizeAdaptiveRemeshSettings('), app.indexOf('function autoRemeshSourceLocks('));
const meshClassification = app.slice(app.indexOf('function isModelingMesh('), app.indexOf('const IMPORTED_MESH_OUTLINER_KEY'));
function fixture() {
  const operation = {sourceIds: [1, 2], latestOutput: {acceptable: true, method: 'curve-union-v2', points: [{clone: () => ({})}], faces: [[0, 1, 2]]}};
  const state = {
    autoRemeshStrandsOperation: operation, autoRemeshStatus: {},
    autoRemeshMethodInput: {value: 'curve-union-v2'}, autoRemeshAdaptiveInput: {checked: false},
    autoRemeshHideOriginalsInput: {checked: true}, effectiveRemeshMethod,
    locks: [1, 2].map(id => ({id, geometryType: 'strand', materialId: 'hair'})),
    pushUndoState() {}, addLock() { throw new Error('fixture mesh creation failure'); },
    scheduleAutoRemeshPreview() { state.scheduled = true; }, console: {error() {}}
  };
  vm.createContext(state);
  vm.runInContext(source, state);
  return state;
}

test('Remesh confirmation reports mesh creation exceptions instead of silently failing', () => {
  const state = fixture();
  assert.equal(state.tryConfirmAutoRemeshStrands(), false);
  assert.match(state.autoRemeshStatus.textContent, /Could not confirm remesh: fixture mesh creation failure/);
  assert.ok(state.autoRemeshStrandsOperation.latestOutput, 'retain preview for diagnosis');
});

test('Remesh confirmation explains missing sources and regenerates a mismatched method', () => {
  const state = fixture();
  state.locks = [];
  assert.equal(state.tryConfirmAutoRemeshStrands(), false);
  assert.match(state.autoRemeshStatus.textContent, /original strands are no longer available/);
  state.autoRemeshMethodInput.value = 'legacy';
  assert.equal(state.tryConfirmAutoRemeshStrands(), false);
  assert.equal(state.scheduled, true);
  assert.match(state.autoRemeshStatus.textContent, /method changed/);
});

test('Remesh confirmation explains pending and ended sessions', () => {
  const state = fixture();
  state.autoRemeshStrandsOperation.pending = true;
  assert.equal(state.tryConfirmAutoRemeshStrands(), false);
  assert.match(state.autoRemeshStatus.textContent, /not ready/);
  state.autoRemeshStrandsOperation = null;
  assert.equal(state.tryConfirmAutoRemeshStrands(), false);
  assert.match(state.autoRemeshStatus.textContent, /session has ended/);
});

test('Remesh settings accept explicit null from non-adaptive objects and project round trips', () => {
  const state = vm.createContext({THREE: {MathUtils: {clamp: (x, min, max) => Math.max(min, Math.min(max, x))}}});
  vm.runInContext(normalizeSource, state);
  const defaults = {axialLoops: 16, flowSmoothing: 0.55, tipSeparation: 0};
  for (const value of [undefined, null, {}, JSON.parse('{"settings":null}').settings]) {
    assert.deepEqual(JSON.parse(JSON.stringify(state.normalizeAdaptiveRemeshSettings(value))), defaults);
  }
  assert.equal(state.normalizeAdaptiveRemeshSettings({flowSmoothing: 0}).flowSmoothing, 0);
});

test('Confirming a second non-adaptive remesh survives the undo snapshot of the first', () => {
  const state = fixture();
  state.THREE = {MathUtils: {clamp: (x, min, max) => Math.max(min, Math.min(max, x))}};
  vm.runInContext(normalizeSource, state);
  state.locks.push({id: 3, modelingMeshType: 'auto-remesh', adaptiveRemesh: false, adaptiveRemeshSettings: null});
  state.pushUndoState = () => {
    state.saved = state.locks.filter(lock => lock.modelingMeshType === 'auto-remesh')
      .map(lock => state.normalizeAdaptiveRemeshSettings(lock.adaptiveRemeshSettings));
  };
  state.addLock = () => ({id: 4});
  state.nextAutoRemeshName = () => 'Auto Remesh 2';
  state.autoRemeshOpen = new Map();
  state.autoRemeshStrandsPanel = {classList: {add() {}}};
  for (const name of ['disposeAutoRemeshPreviewMesh', 'applyDisplayVisibilityFilters', 'updateCount', 'selectLock', 'requestShadowMapRefresh']) state[name] = () => {};
  assert.equal(state.tryConfirmAutoRemeshStrands(), true, state.autoRemeshStatus.textContent);
  assert.equal(state.saved[0].flowSmoothing, 0.55);
  assert.equal(state.autoRemeshStrandsOperation, null);
});

test('Static remesh results enter Meshes with editable topology; adaptive results remain in Strands', () => {
  for (const adaptive of [false, true]) {
    const state = fixture();
    vm.runInContext(meshClassification, state);
    state.autoRemeshAdaptiveInput.checked = adaptive;
    if (adaptive) state.autoRemeshStrandsOperation.latestOutput.method = 'legacy';
    state.autoRemeshSettings = () => ({axialLoops: 16});
    state.addLock = (group, data) => {
      const lock = {id: 3, ...data};
      state.locks.push(lock);
      return lock;
    };
    state.nextAutoRemeshName = () => 'Auto Remesh 1';
    state.autoRemeshOpen = new Map();
    state.autoRemeshStrandsPanel = {classList: {add() {}}};
    for (const name of ['disposeAutoRemeshPreviewMesh', 'applyDisplayVisibilityFilters', 'updateCount', 'requestShadowMapRefresh']) state[name] = () => {};
    state.selectLock = id => { state.selected = id; };
    assert.equal(state.tryConfirmAutoRemeshStrands(), true, state.autoRemeshStatus.textContent);
    const result = state.locks.at(-1);
    assert.equal(state.selected, result.id);
    assert.equal(state.isModelingMesh(result), !adaptive);
    assert.equal(state.modelingMeshLocks().includes(result), !adaptive);
    assert.equal(result.geometryType, 'hair-shell');
    assert.deepEqual([...result.hairShellBaseFaces[0]], [0, 1, 2]);
    assert.equal(state.isModelingMesh(JSON.parse(JSON.stringify(result))), !adaptive);
    state.getSelectedLock = () => result;
    state.meshEditModeActive = mode => mode === 'edge';
    state.selectedHairShellComponent = {lockId: result.id, type: 'edge', indices: [0, 1]};
    vm.runInContext(app.slice(app.indexOf('function selectedMeshEdgeOperationContext('), app.indexOf('function mirroredMeshOperationEdges(')), state);
    const context = state.selectedMeshEdgeOperationContext();
    if (adaptive) assert.equal(context, null);
    else {
      assert.equal(context.lock, result);
      assert.deepEqual([...context.edges[0]], [0, 1]);
      assert.equal(state.meshOperationTopology(result).faces, result.hairShellBaseFaces);
    }
  }
});

test('Older static remesh records are editable without schema migration', () => {
  const state = vm.createContext({locks: []});
  vm.runInContext(meshClassification, state);
  assert.equal(state.isModelingMesh({modelingMeshType: 'auto-remesh', geometryType: 'hair-shell'}), true);
  assert.equal(state.isModelingMesh({geometryType: 'strand'}), false);
  assert.equal(state.isModelingMesh({geometryType: 'poly'}), true);
  assert.match(app, /if \(isModelingMesh\(lock\) && lock\.modelingMeshType !== "auto-remesh"\) return false/);
});
