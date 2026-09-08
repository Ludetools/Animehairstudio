import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { Linter } from "eslint";
import { createStrokeSettingsState, switchStrokeSettingsOwner, strokeSettingsOwner } from "../modules/brush-settings-state.js";

test("stroke values are isolated across drawing, placement and builder owners", () => {
  const defaults = { size: "1", curveStep: "0.38", autoShowScalp: true };
  const state = createStrokeSettingsState(defaults);
  let current = { size: "2", curveStep: "0.2", autoShowScalp: false };
  const draw = { ...current };
  const owners = ["pattern", "accessory", "builder:pattern", "builder:accessory"];
  owners.forEach((owner, index) => {
    current = switchStrokeSettingsOwner(state, owner, current);
    assert.deepEqual(current, defaults);
    current.size = String(index + 3);
  });
  current = switchStrokeSettingsOwner(state, "draw", current);
  assert.deepEqual(current, draw);
  owners.forEach((owner, index) => {
    current = switchStrokeSettingsOwner(state, owner, current);
    assert.equal(current.size, String(index + 3));
  });
  assert.equal(switchStrokeSettingsOwner(state, state.owner, current), null);
  assert.deepEqual(defaults, { size: "1", curveStep: "0.38", autoShowScalp: true });
  assert.equal(strokeSettingsOwner("strand", "draw"), "draw");
  assert.equal(strokeSettingsOwner("strand", "radial-draw"), "pattern");
  assert.equal(strokeSettingsOwner("strand", "procedural-draw"), "accessory");
  assert.equal(strokeSettingsOwner("brush", "move", "accessory"), "builder:accessory");
});

const functions = [];
const names = new Set(["applyCreationToolSettings", "activeStrandShapeTarget", "applyCreationPresetSnapshot",
  "readStrokeSettingsControls", "syncStrokeSettingsOwner"]);
new Linter().verify(await readFile(new URL("../app.js", import.meta.url), "utf8"), {
  plugins: { fixture: { rules: { collect: { create(context) {
    return { FunctionDeclaration(node) {
      if (names.has(node.id?.name)) functions.push(context.sourceCode.getText(node));
    } };
  } } } } }, rules: { "fixture/collect": "error" }
});
assert.equal(functions.length, names.size);

test("restoring shared controls updates readouts without dispatching scene edits", () => {
  const state = { strokeSettingsOwner, switchStrokeSettingsOwner,
    viewportEditMode: "strand", activeTool: "draw", brushWorkspaceStyle: "pattern" };
  state.strokeSettingsControls = {};
  for (const [key, inputName, outputName] of [
    ["size", "drawToolSizeInput", "drawToolSizeValue"],
    ["smoothing", "drawStrandSmoothingInput", "drawStrandSmoothingValue"],
    ["curveStep", "drawStrandCurveStepInput", "drawStrandCurveStepValue"],
    ["scalpOffset", "drawStrandScalpOffsetInput", "drawStrandScalpOffsetValue"],
    ["normalInfluence", "drawSurfaceNormalInfluenceInput", "drawSurfaceNormalInfluenceValue"]
  ]) {
    state[inputName] = { value: "1", type: "range", dispatchEvent: () => assert.fail("not an edit") };
    state[outputName] = {};
    state.strokeSettingsControls[key] = state[inputName];
  }
  vm.createContext(state);
  vm.runInContext(functions.join("\n"), state);
  state.strokeSettingsState = createStrokeSettingsState(state.readStrokeSettingsControls());
  state.drawToolSizeInput.value = "2";
  state.activeTool = "radial-draw";
  state.syncStrokeSettingsOwner();
  assert.equal(state.drawToolSizeInput.value, "1");
  state.drawToolSizeInput.value = "3";
  state.activeTool = "draw";
  state.syncStrokeSettingsOwner();
  assert.equal(state.drawToolSizeInput.value, "2");
  assert.equal(state.drawToolSizeValue.textContent, "2.00");
});

test("legacy Draw Strand preset fields cannot rewrite the pattern builder", () => {
  const calls = [];
  const state = {
    normalizedLiveSurfaceSelection: () => ({ surface: "scalp" }),
    drawSurfaceDynamicEnabled: () => false,
    applyPresetControl: (control, value) => calls.push([control.id, value]),
    brushWorkspacePatternSections: { body: ["authored"] },
    brushWorkspaceRootPatternEnabled: true,
    brushWorkspaceTipPatternEnabled: true,
    setBrushWorkspacePatternSection: () => assert.fail("must not reset the builder"),
    scheduleBrushWorkspacePreview: () => assert.fail("must not refresh the builder")
  };
  for (const id of ["drawBrushPresetInput", "drawToolSizeInput", "drawStrandSmoothingInput",
    "drawStrandCurveStepInput", "drawStrandScalpOffsetInput", "drawSurfaceNormalInfluenceInput",
    "drawStrandSurfaceInput", "drawSurfaceDynamicButton", "drawAutoShowScalpInput", "drawContinueFromTipInput"])
    state[id] = { id, value: "custom:mine" };
  vm.createContext(state);
  vm.runInContext(functions.join("\n"), state);
  state.applyCreationToolSettings("strand", {
    toolSize: 2, brushPattern: "braid", brushStrandCount: 3,
    brushStrandPatternPoints: [], brushRootPatternEnabled: false
  }, { preserveBrushPresetSelection: true });
  assert.deepEqual(state.brushWorkspacePatternSections, { body: ["authored"] });
  assert.equal(state.brushWorkspaceRootPatternEnabled, true);
  assert.equal(state.brushWorkspaceTipPatternEnabled, true);
  assert.ok(calls.some(([id, value]) => id === "drawToolSizeInput" && value === 2));
  assert.ok(calls.every(([id]) => !id.startsWith("brushWorkspace")));
});

test("builder shape edits and copied preset curves do not alias Draw Strand defaults", () => {
  const draw = { taperCurve: [{ position: 0, value: 1 }] };
  const builder = {};
  const state = vm.createContext({
    viewportEditMode: "brush", strandCreationDefaults: draw,
    activeCreationShapeDefaults: () => builder,
    cloneShapePresetValue: (value) => value.map((point) => ({ ...point }))
  });
  vm.runInContext(functions.join("\n"), state);
  state.applyCreationPresetSnapshot(builder, draw, "strand");
  assert.equal(state.activeStrandShapeTarget(), builder);
  state.activeStrandShapeTarget().taperCurve[0].value = 0.2;
  assert.equal(draw.taperCurve[0].value, 1);
});
