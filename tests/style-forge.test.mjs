import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_STYLE_FORGE_SETTINGS,
  normalizeStyleForgeSettings,
  selectStyleForgeRootCandidates,
  styleForgeVariation
} from "../modules/style-forge.js";

test("Style Forge settings normalize to safe generator ranges", () => {
  assert.deepEqual(normalizeStyleForgeSettings({}), DEFAULT_STYLE_FORGE_SETTINGS);
  assert.equal(normalizeStyleForgeSettings({ strandCount: 100 }).strandCount, 64);
  assert.equal(normalizeStyleForgeSettings({ gravity: -2 }).gravity, 0);
  assert.equal(normalizeStyleForgeSettings({ smoothing: 4 }).smoothing, 1);
});

test("Style Forge root selection keeps every scalp region represented", () => {
  const candidates = [
    { key: "a", point: [0, 0, 0], targetRegion: "bangs" },
    { key: "b", point: [1, 0, 0], targetRegion: "back" },
    { key: "c", point: [-1, 0, 0], targetRegion: "side-left" },
    { key: "d", point: [0, 0, 1], targetRegion: "bangs" },
    { key: "e", point: [0, 0, -1], targetRegion: "back" }
  ];
  const selected = selectStyleForgeRootCandidates(candidates, 3);
  assert.deepEqual(new Set(selected.map((item) => item.targetRegion)), new Set(["back", "bangs", "side-left"]));
});

test("Style Forge variation is stable for the same seed", () => {
  assert.deepEqual(styleForgeVariation(4, { seed: 22 }), styleForgeVariation(4, { seed: 22 }));
  assert.notDeepEqual(styleForgeVariation(4, { seed: 22 }), styleForgeVariation(5, { seed: 22 }));
});
