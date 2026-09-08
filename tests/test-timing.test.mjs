import assert from "node:assert/strict";
import test from "node:test";

import { parseTestTimings } from "../scripts/test-timing.mjs";

test("slow-test timing parser reads Node spec reporter output", () => {
  assert.deepEqual(parseTestTimings([
    "✔ fast contract (12.5ms)",
    "✔ slow contract (1250.75ms)"
  ].join("\n")), [
    { name: "fast contract", duration: 12.5 },
    { name: "slow contract", duration: 1250.75 }
  ]);
});

test("slow-test timing parser also accepts TAP output", () => {
  assert.deepEqual(parseTestTimings([
    "# Subtest: settings contract",
    "ok 1 - settings contract",
    "  ---",
    "  duration_ms: 42.25",
    "  ..."
  ].join("\n")), [
    { name: "settings contract", duration: 42.25 }
  ]);
});
