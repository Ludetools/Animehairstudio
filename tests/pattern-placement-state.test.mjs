import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { Linter } from "eslint";

const names = new Set(["patternPlacementShapeDefaults", "activeCreationShapeDefaults",
  "activeProceduralBrushCreationSettings", "applyProceduralBrushToolPreset",
  "creationPresetSnapshot", "presetNumber", "clonePresetShape", "cloneShapePresetValue"]);
const functions = [];
let twistHandler;
new Linter().verify(await readFile(new URL("../app.js", import.meta.url), "utf8"), {
  plugins: { fixture: { rules: { collect: { create(context) {
    return {
      FunctionDeclaration(node) {
        if (names.has(node.id?.name)) functions.push(context.sourceCode.getText(node));
      },
      CallExpression(node) {
        if (node.callee.object?.name === "twistNumberInput"
          && node.callee.property?.name === "addEventListener" && node.arguments[0]?.value === "input")
          twistHandler = context.sourceCode.getText(node.arguments[1]);
      }
    };
  } } } } }, rules: { "fixture/collect": "error" }
});
assert.equal(functions.length, names.size);
assert.ok(twistHandler);

function fixture() {
  const curves = { taperCurve: [{ position: 0, value: 1 }], depthCurve: [{ position: 0, value: 0.5 }],
    twistCurve: [{ position: 0, value: 0 }], sweepProfile: [{ x: 0, y: 1 }] };
  curves.taperCurveSecondary = structuredClone(curves.taperCurve);
  curves.depthCurveSecondary = structuredClone(curves.depthCurve);
  const defaults = { width: 0.16, depth: 0.24, twist: 0, ...curves };
  const presets = {
    a: { value: { ...structuredClone(defaults), twist: 2 } },
    b: { value: { width: 0.3, depth: 0.4 } }
  };
  const state = vm.createContext({
    strandCreationDefaults: structuredClone(defaults), patternPlacementBaseDefaults: structuredClone(defaults),
    brushWorkspaceCreationDefaults: structuredClone(defaults), accessoryBrushCreationDefaults: structuredClone(defaults),
    patternPlacementSource: null, patternPlacementDefaults: null, activeProceduralBrushPreset: null,
    viewportEditMode: "strand", activeTool: "radial-draw",
    normalizeHairLayer: () => "mid", normalizeClumpBrushTemplate: () => null,
    proceduralBrushToolPresetForValue: (key) => presets[key], radialDrawPatternPresetInput: {},
    syncActivePatternBrushCurveStep: () => {}, syncProceduralBrushToolSettingVisibility: () => {},
    updatePlacementStatus: () => {}, syncCreationShapeInputs: () => {}, getSelectedLock: () => null,
    creationToolActive: () => true, twistNumberInput: { value: "0" },
    inputs: { twist: { min: "-10", max: "10" } },
    THREE: { MathUtils: { clamp: (x, min, max) => Math.max(min, Math.min(max, x)) } }
  });
  vm.runInContext(functions.join("\n") + `\nvar editTwist = ${twistHandler};`, state);
  return { state, presets, defaults };
}

test("pattern placement edits and reset input target only its working defaults", () => {
  const { state, presets, defaults } = fixture();
  state.applyProceduralBrushToolPreset("a");
  state.twistNumberInput.value = "5";
  state.editTwist();
  assert.equal(state.activeCreationShapeDefaults().twist, 5);
  assert.equal(state.activeProceduralBrushCreationSettings().twist, 5);
  state.activeTool = "draw";
  assert.equal(state.activeCreationShapeDefaults(), state.strandCreationDefaults);
  assert.equal(state.activeCreationShapeDefaults().twist, 0);
  state.activeTool = "procedural-draw";
  assert.equal(state.activeCreationShapeDefaults(), state.accessoryBrushCreationDefaults);
  state.activeTool = "radial-draw";
  assert.equal(state.activeCreationShapeDefaults().twist, 5);
  // Slider reset dispatches the same input edit with the HTML default value.
  state.twistNumberInput.value = "0";
  state.editTwist();
  assert.equal(state.activeProceduralBrushCreationSettings().twist, 0);
  assert.deepEqual(state.strandCreationDefaults, defaults);
  assert.deepEqual(state.brushWorkspaceCreationDefaults, defaults);
  assert.equal(presets.a.value.twist, 2);
});

test("preset reapply resets only placement overrides and missing fields use a stable fallback", () => {
  const { state, presets } = fixture();
  state.applyProceduralBrushToolPreset("a");
  const target = state.activeCreationShapeDefaults();
  target.taperCurve[0].value = 0.2;
  target.twist = 9;
  state.strandCreationDefaults.depthCurve[0].value = 99;
  state.applyProceduralBrushToolPreset("a");
  assert.equal(state.activeCreationShapeDefaults().twist, 2);
  assert.equal(state.activeCreationShapeDefaults().taperCurve[0].value, 1);
  assert.equal(presets.a.value.taperCurve[0].value, 1);
  state.applyProceduralBrushToolPreset("b");
  assert.equal(state.activeProceduralBrushCreationSettings().depthCurve[0].value, 0.5);
  const current = state.activeCreationShapeDefaults();
  assert.equal(state.applyProceduralBrushToolPreset("missing"), false);
  assert.equal(state.activeCreationShapeDefaults(), current);
  state.viewportEditMode = "brush";
  assert.equal(state.activeCreationShapeDefaults(), state.brushWorkspaceCreationDefaults);
});
