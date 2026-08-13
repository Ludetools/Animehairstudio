import test from "node:test";
import assert from "node:assert/strict";

import { relativeEditValue } from "../modules/multi-edit.js";

test("relative multi-edit preserves differences between strand dimensions", () => {
  assert.ok(Math.abs(relativeEditValue(0.5, 0.3, 0.2) - 0.4) < 1e-9);
  assert.ok(Math.abs(relativeEditValue(0.16, 0.3, 0.2) - 0.06) < 1e-9);
});

test("relative multi-edit clamps dimensions without changing valid deltas", () => {
  assert.equal(relativeEditValue(0.05, 0.3, 0.1, { min: 0.01 }), 0.01);
  assert.equal(relativeEditValue(2.9, 0.3, 0.5, { max: 3 }), 3);
});
