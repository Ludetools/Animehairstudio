export const EMPTY_OBJECT_TRANSFORM = Object.freeze({
  location: Object.freeze({ x: 0, y: 0, z: 0 }),
  rotation: Object.freeze({ x: 0, y: 0, z: 0 }),
  scale: Object.freeze({ x: 0, y: 0, z: 0 })
});

export function normalizeObjectTransform(value) {
  const normalized = {};
  ["location", "rotation", "scale"].forEach((group) => {
    normalized[group] = {};
    ["x", "y", "z"].forEach((axis) => {
      const number = Number(value?.[group]?.[axis]);
      normalized[group][axis] = Number.isFinite(number)
        ? number
        : EMPTY_OBJECT_TRANSFORM[group][axis];
    });
  });
  ["x", "y", "z"].forEach((axis) => {
    normalized.scale[axis] = Math.max(-0.95, normalized.scale[axis]);
  });
  return normalized;
}

export function restoredObjectTransform(snapshot, { backHairMeshInternalYOffset = 0 } = {}) {
  const transform = normalizeObjectTransform(snapshot?.objectTransform);
  if (
    snapshot?.modelingMeshType === "back-hair"
    && snapshot?.backHairMeshUsesInternalOffset !== true
  ) {
    transform.location.y -= Number(backHairMeshInternalYOffset) || 0;
  }
  return transform;
}
