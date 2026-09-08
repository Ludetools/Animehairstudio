import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { Linter } from "eslint";
import { meshOperationReasons } from '../modules/editing-context.js';
import { polyBoundaryEdges, polyEdgeLoopEdges } from "../modules/poly-topology.js";
import { meshComponentSelectionAfterPick, meshComponentSelectionAfterMatches } from "../modules/mesh-selection.js";

// Execute the production controllers, not regex claims about their source.
// Browser rendering/raycasting is deliberately replaced by a deterministic
// fixture; this covers orchestration, not pointer accuracy or visual appearance.
const names = new Set([
  "setMeshEditMode", "refreshSelectionModeVisuals", "clearHairShellComponentSelection",
  "syncMeshOperationsPanel", "meshTopologyOperationAllowed", "meshOperationTopology",
  "selectedMeshEdgeOperationContext", "meshEditModeActive", "componentEditModeActive",
  "syncPolyEditObjectKinds", "selectPolyMeshComponentAtEvent",
  "selectMeshEdgeLoopAtEvent", "selectMeshComponentsInMarquee"
]);
const functions = [];
new Linter().verify(await readFile(new URL("../app.js", import.meta.url), "utf8"), {
  plugins: { fixture: { rules: { collect: { create(context) {
    return { FunctionDeclaration(node) {
      if (names.has(node.id?.name)) functions.push(context.sourceCode.getText(node));
    } };
  } } } } }, rules: { "fixture/collect": "error" }
});
assert.equal(functions.length, names.size);

function fixture(source = functions.join("\n")) {
  const lock = { id: 1, geometryType: "poly", mesh: { visible: true }, points: [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }
  ], polyFaces: [[0, 1, 2, 3]], curveObjects: {
    handles: [], edgePickers: [{ visible: false }], visibleEdgeLines: [{ visible: false }]
  } };
  const state = {
    document: { querySelector: () => ({ classList: { toggle() {} } }) },
    meshOperationReasons,
    meshComponentSelectionAfterPick, meshComponentSelectionAfterMatches, polyEdgeLoopEdges,
    renderer: { domElement: { getBoundingClientRect: () => ({}) } },
    selectionMarqueeBounds: () => ({}),
    meshComponentMarqueeMatches: () => ({ vertexIndices: [0, 1], edges: [[0, 1]], faceIndices: [0] }),
    MESH_EDIT_MODES: ["object", "vert", "edge", "face", "curve"],
    viewportEditMode: "mesh", meshEditMode: "object", activeTool: "select",
    selectedId: lock.id, locks: [lock], guides: [], selectedPolyMeshComponent: null,
    selectedControlPoints: [], selectedHairShellComponent: null, hairShellComponentOverlayGroup: null,
    transformControls: { detach() {} }, getSelectedLock: () => lock, isModelingMesh: () => true,
    meshOperationsPanel: { classList: { toggle() {} } }, meshOperationsStatus: {},
    meshBevelButton: { setAttribute() {} }, meshBridgeButton: { setAttribute() {} }, meshEdgeFlowButton: { setAttribute() {} }, polyBoundaryEdges,
    polyEdgeKey: (edge) => [...edge].sort((a, b) => a - b).join(":"),
    strandWorkspaceActive: () => false,
    polyTargetAtEvent: () => lock.curveObjects.edgePickers[0].visible
      ? { type: "edge", vertices: [0, 1] } : null
  };
  for (const name of ["activeHandleEdit", "activeHairShellCurveEdit", "activeStrandObjectTransform",
    "activeGuideObjectTransform", "activeHairShellComponentEdit", "selectedPoint",
    "selectedCurveLatticePoint", "selectedSurfaceObjectAnchorId", "selectedHairShellCurvePoint"]) state[name] = null;
  for (const name of ["cancelMeshBevelPreview", "clearHairShellFaceSelection", "updateHairShellComponentOverlays",
    "updateSelectedPointLabel", "updateViewPlaneGrid", "updateViewportToolVisibility", "syncMoveCurveControls",
    "updateTaperMeshPoints", "updatePlacementStatus", "syncStrandObjectTransformPanel",
    "syncViewportSelectionModeControl", "syncTransformSpaceControls", "syncStandardExtrudeSettingsPanel",
    "syncHairShellExtrusionControls", "attachStrandObjectTransform", "selectPolyBrushComponent",
    "beginSelectionMarquee"]) state[name] = () => {};
  state.clearMultiPointSelection = () => { state.selectedControlPoints = []; state.selectedPolyMeshComponent = null; };
  state.setActiveTool = (tool) => { state.activeTool = tool; };
  const context = vm.createContext(state);
  vm.runInContext(source, context);
  state.updateCurveObjects = (item) => context.syncPolyEditObjectKinds(item);
  state.refreshPolyMeshComponentSelection = () => context.syncMeshOperationsPanel();
  return { context, lock };
}

test("direct object-to-edge entry enables picking and selects an edge without a vertex-mode detour", () => {
  const { context, lock } = fixture();
  context.setMeshEditMode("edge");
  assert.equal(lock.curveObjects.edgePickers[0].visible, true);
  assert.match(context.meshOperationsStatus.textContent, /^Select one or more edges\./);
  assert.equal(context.meshBevelButton.title, 'Select one or more edges to bevel.');
  assert.equal(context.selectPolyMeshComponentAtEvent({ button: 0 }, lock), true);
  assert.equal(context.selectedPolyMeshComponent.type, "edge");
  assert.deepEqual(Array.from(context.selectedPolyMeshComponent.indices), [0, 1]);
  assert.match(context.meshOperationsStatus.textContent, /^1 edge selected\./);
  assert.equal(context.meshBridgeButton.title, 'Select exactly two separate boundary edges to bridge.');
  context.selectPolyMeshComponentAtEvent({ button: 0, shiftKey: true }, lock);
  assert.equal(context.selectedPolyMeshComponent, null);
  context.setMeshEditMode("object");
  assert.equal(lock.curveObjects.edgePickers[0].visible, false);
  context.setMeshEditMode("edge");
  context.setMeshEditMode("edge");
  assert.equal(context.selectPolyMeshComponentAtEvent({ button: 0, altKey: true }, lock), false);
  assert.equal(context.selectPolyMeshComponentAtEvent({ button: 0 }, lock), true);
});

test("leaving extrusion face mode restores the selection tool", () => {
  const { context } = fixture();
  context.meshEditMode = "face";
  context.activeTool = "standard-extrude";
  context.setMeshEditMode("edge");
  assert.equal(context.activeTool, "select");
});

test("the runtime fixture detects the original undefined panel-helper regression", () => {
  const mutated = functions.join("\n").replace(
    "const topologyAllowed = meshTopologyOperationAllowed(context.lock)",
    "const topologyAllowed = missingTopologyHelper(context.lock)"
  );
  const { context } = fixture(mutated);
  assert.throws(() => context.setMeshEditMode("edge"), /missingTopologyHelper/);
});

test("edge-loop selection and subtraction run through the production adapter", () => {
  const { context, lock } = fixture();
  context.setMeshEditMode("edge");
  let consumed = 0;
  const event = { button: 0, preventDefault() { consumed++; }, stopImmediatePropagation() { consumed++; } };
  assert.equal(context.selectMeshEdgeLoopAtEvent(event), true);
  assert.deepEqual(Array.from(context.selectedPolyMeshComponent.indices),
    [...new Set(polyEdgeLoopEdges(lock.points, lock.polyFaces, [0, 1]).flat())]);
  assert.equal(context.selectMeshEdgeLoopAtEvent({ ...event, shiftKey: true }), true);
  assert.equal(context.selectedPolyMeshComponent, null);
  assert.equal(consumed, 4);
});

for (const mode of ["vert", "edge", "face"]) {
  test(`polygon marquee adapter retains ${mode} selection mode`, () => {
    const { context } = fixture();
    context.setMeshEditMode(mode);
    assert.equal(context.selectMeshComponentsInMarquee({ selectionMode: "replace" }), true);
    assert.equal(context.selectedPolyMeshComponent.type, mode === "vert" ? "vertex" : mode);
    assert.deepEqual(Array.from(context.selectedPolyMeshComponent.indices), mode === "face" ? [0, 1, 2, 3] : [0, 1]);
    context.selectMeshComponentsInMarquee({ selectionMode: "remove" });
    assert.equal(context.selectedPolyMeshComponent, null);
  });
}

test("hair-shell marquee uses its separate face-selection source", () => {
  const { context, lock } = fixture();
  lock.geometryType = "hair-shell";
  lock.hairShellBasePoints = lock.points;
  lock.hairShellBaseFaces = lock.polyFaces;
  context.meshEditMode = "face";
  context.selectedHairShellFaceIndices = () => [0];
  context.meshComponentMarqueeMatches = () => ({ vertexIndices: [], edges: [], faceIndices: [] });
  let selected;
  context.showHairShellFaceSelection = (_lock, faces) => { assert.deepEqual(Array.from(faces), [0]); };
  context.selectHairShellComponent = (_lock, mode, indices) => { selected = { mode, indices: Array.from(indices) }; };
  context.selectMeshComponentsInMarquee({ selectionMode: "add" });
  assert.deepEqual(selected, { mode: "face", indices: [0, 1, 2, 3] });
});
