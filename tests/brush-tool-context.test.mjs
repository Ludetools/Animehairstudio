import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { Linter } from "eslint";
import { brushToolContext, brushStyleTransition } from "../modules/brush-tool-context.js";

test("brush contexts retain separate builder, placement and ordinary drawing controls", () => {
  for (const mode of ["strand", "brush", "mesh", "reference"]) {
    for (const tool of ["draw", "radial-draw", "procedural-draw", "move", "select", "braid"]) {
      for (const style of ["pattern", "accessory"]) {
        const context = brushToolContext(mode, tool, style);
        const builder = mode === "brush";
        const generated = ["radial-draw", "procedural-draw"].includes(tool);
        assert.equal(context.generatedDrawTool, generated);
        assert.equal(context.settingsVisible, builder || generated || tool === "draw");
        assert.equal(context.tabsVisible, builder || generated);
        assert.equal(context.activeStyle, builder ? style : tool === "procedural-draw" ? "accessory" : "pattern");
        assert.equal(context.patternEditorVisible, builder && style === "pattern");
        assert.equal(context.accessoryEditorVisible, builder && style === "accessory");
        assert.equal(context.patternPlacementVisible, tool === "radial-draw");
        assert.equal(context.accessoryPlacementVisible, tool === "procedural-draw");
        assert.equal(context.title, builder ? "Brush Builder" : {
          "radial-draw": "Procedural Brush Tool", "procedural-draw": "Accessory Brush Tool"
        }[tool] || "Draw Strand Tool");
      }
    }
  }
});

// Run the actual tab controller with UI/state effects recorded at its boundaries.
const names = new Set(["handleBrushWorkspaceTypeClick", "setBrushWorkspaceStyle"]);
const functions = [];
new Linter().verify(await readFile(new URL("../app.js", import.meta.url), "utf8"), {
  plugins: { fixture: { rules: { collect: { create(context) {
    return { FunctionDeclaration(node) {
      if (names.has(node.id?.name)) functions.push(context.sourceCode.getText(node));
    } };
  } } } } }, rules: { "fixture/collect": "error" }
});
assert.equal(functions.length, names.size);

function fixture(mode, tool) {
  const calls = [];
  const state = vm.createContext({
    showDevTestFeatures: true, proceduralDrawExperimentalEnabled: true,
    viewportEditMode: mode, activeTool: tool, brushWorkspaceStyle: "pattern", brushStyleTransition,
    setActiveTool: (value) => calls.push(["tool", value]),
    finishBrushWorkspacePatternDrag: (_event, options) => calls.push(["finish", options.cancel]),
    syncStrokeSettingsOwner: () => {},
    syncBrushWorkspaceTypeTabs: () => calls.push(["tabs"]),
    updateAttributeEditorMode: () => calls.push(["panel"]),
    scheduleBrushWorkspacePreview: () => calls.push(["preview"])
  });
  vm.runInContext(functions.join("\n"), state);
  return { state, calls, click(style) {
    state.handleBrushWorkspaceTypeClick({ target: { closest: () => ({ dataset: { brushWorkspaceStyle: style } }) } });
  } };
}

test("procedural tabs switch between placement tools without routing to Draw Strand", () => {
  for (const tool of ["radial-draw", "procedural-draw"]) {
    const f = fixture("strand", tool);
    f.click("accessory");
    f.click("pattern");
    assert.deepEqual(f.calls, [["tool", "procedural-draw"], ["tool", "radial-draw"]]);
    assert.equal(f.state.brushWorkspaceStyle, "pattern");
  }
});

test("Draw Strand and unrelated tools ignore procedural tabs and empty clicks", () => {
  for (const tool of ["draw", "move", "select", "braid"]) {
    const f = fixture("strand", tool);
    for (const style of ["pattern", "accessory", undefined, ""]) f.click(style);
    assert.deepEqual(f.calls, []);
  }
  const f = fixture("brush", "move");
  f.click(undefined);
  assert.deepEqual(f.calls, []);
});

test("builder switches finish editing before refresh without changing the viewport tool", () => {
  const f = fixture("brush", "move");
  f.click("accessory");
  assert.equal(f.state.brushWorkspaceStyle, "accessory");
  assert.deepEqual(f.calls, [["finish", false], ["tabs"], ["panel"], ["preview"]]);
  f.click("accessory");
  assert.equal(f.calls.length, 4);
  f.click("pattern");
  assert.equal(f.state.brushWorkspaceStyle, "pattern");
  assert.equal(f.state.activeTool, "move");
  assert.equal(f.calls.length, 8);
});
