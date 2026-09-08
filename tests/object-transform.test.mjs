import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_OBJECT_TRANSFORM,
  normalizeObjectTransform,
  restoredObjectTransform
} from "../modules/object-transform.js";

test("object transforms normalize missing and invalid values without sharing defaults", () => {
  const normalized = normalizeObjectTransform({
    location: { x: "1.5", y: Number.NaN },
    rotation: { z: -30 },
    scale: { x: -2, y: 0.25 }
  });
  assert.deepEqual(normalized, {
    location: { x: 1.5, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: -30 },
    scale: { x: -0.95, y: 0.25, z: 0 }
  });
  normalized.location.x = 99;
  assert.equal(EMPTY_OBJECT_TRANSFORM.location.x, 0);
});

test("legacy back-hair snapshots hide the internal Y offset in authored translation", () => {
  const legacy = restoredObjectTransform({
    modelingMeshType: "back-hair",
    objectTransform: { location: { y: 0 } }
  }, { backHairMeshInternalYOffset: 0.2 });
  assert.equal(legacy.location.y, -0.2);

  const current = restoredObjectTransform({
    modelingMeshType: "back-hair",
    backHairMeshUsesInternalOffset: true,
    objectTransform: { location: { y: 0 } }
  }, { backHairMeshInternalYOffset: 0.2 });
  assert.equal(current.location.y, 0);

  const strand = restoredObjectTransform({
    modelingMeshType: null,
    objectTransform: { location: { y: 0.4 } }
  }, { backHairMeshInternalYOffset: 0.2 });
  assert.equal(strand.location.y, 0.4);
});
