export const HAIRSTYLE_PRESET_REGION_SCOPES = Object.freeze([
  Object.freeze({
    id: "front-bangs",
    label: "Front Bangs",
    regionIds: Object.freeze(["bangs"])
  }),
  Object.freeze({
    id: "side-bangs",
    label: "Side Bangs",
    regionIds: Object.freeze(["side-bangs-left", "side-bangs-right"])
  }),
  Object.freeze({
    id: "sides",
    label: "Sides",
    regionIds: Object.freeze(["side-left", "side-right"])
  }),
  Object.freeze({
    id: "back",
    label: "Back",
    regionIds: Object.freeze(["back"])
  })
]);

const HAIRSTYLE_PRESET_PREVIEW_VIEWS = Object.freeze({
  full: Object.freeze({ x: -0.62, y: -0.16, z: -0.77, padding: 1.06 }),
  "front-bangs": Object.freeze({ x: 0, y: -0.06, z: -1, padding: 1.08 }),
  "side-bangs": Object.freeze({ x: -1, y: -0.06, z: 0, padding: 1.08 }),
  sides: Object.freeze({ x: -1, y: -0.06, z: 0, padding: 1.08 }),
  back: Object.freeze({ x: 0, y: -0.06, z: 1, padding: 1.08 })
});

export function hairstylePresetPreviewView(scopeId = "full") {
  return { ...(HAIRSTYLE_PRESET_PREVIEW_VIEWS[scopeId] || HAIRSTYLE_PRESET_PREVIEW_VIEWS.full) };
}

function cloneProjectData(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanPresetBaseName(name) {
  return String(name || "")
    .trim()
    .replace(/\.(?:ahs|animehair\.json|json)$/i, "")
    || "Untitled Hair Preset";
}

export function hairstylePresetExportScopes({
  name,
  locks = [],
  includeFull = true,
  includedRegionScopeIds = []
} = {}) {
  const baseName = cleanPresetBaseName(name);
  const scopes = [];
  if (includeFull) {
    scopes.push({
      id: "full",
      label: "Full Hairstyle",
      title: baseName,
      fileBaseName: baseName,
      regionIds: null,
      lockIds: locks.map((lock) => lock.id)
    });
  }
  const includedRegionIds = new Set(Array.isArray(includedRegionScopeIds) ? includedRegionScopeIds : []);
  HAIRSTYLE_PRESET_REGION_SCOPES.forEach((scope) => {
    if (!includedRegionIds.has(scope.id)) return;
    const regionIds = new Set(scope.regionIds);
    const scopedLocks = locks.filter((lock) => regionIds.has(lock.scalpRegion || "unassigned"));
    if (!scopedLocks.length) return;
    scopes.push({
      ...scope,
      title: `${baseName} - ${scope.label}`,
      fileBaseName: `${baseName}-${scope.id}`,
      regionIds: [...scope.regionIds],
      lockIds: scopedLocks.map((lock) => lock.id)
    });
  });
  return scopes;
}

export function stateForHairstylePresetScope(state, scope) {
  const regionIds = Array.isArray(scope?.regionIds) ? new Set(scope.regionIds) : null;
  const source = state || {};
  const scopedLocks = regionIds
    ? (source.locks || []).filter((lock) => regionIds.has(lock.scalpRegion || "unassigned"))
    : (source.locks || []);
  const next = cloneProjectData({
    ...source,
    locks: scopedLocks,
    guides: [],
    referenceImages: [],
    greasePencilStrokes: []
  });

  const retainedIds = new Set(next.locks.map((lock) => lock.id));
  const retainedClumpIds = new Set(next.locks
    .filter((lock) => lock.clumpGuide && lock.clumpId)
    .map((lock) => lock.clumpId));
  next.locks = next.locks.map((lock) => {
    const retainClump = lock.clumpId && retainedClumpIds.has(lock.clumpId);
    return {
      ...lock,
      mirrorPartnerId: retainedIds.has(lock.mirrorPartnerId) ? lock.mirrorPartnerId : null,
      branchParentId: retainedIds.has(lock.branchParentId) ? lock.branchParentId : null,
      clumpId: retainClump ? lock.clumpId : null,
      clumpGuideId: retainClump && retainedIds.has(lock.clumpGuideId) ? lock.clumpGuideId : null,
      clumpGuide: retainClump && Boolean(lock.clumpGuide),
      adaptiveRemeshSourceIds: Array.isArray(lock.adaptiveRemeshSourceIds)
        ? lock.adaptiveRemeshSourceIds.filter((id) => retainedIds.has(id))
        : lock.adaptiveRemeshSourceIds
    };
  });
  next.selectionSets = (next.selectionSets || [])
    .map((set) => ({
      ...set,
      strandIds: (set.strandIds || []).filter((id) => retainedIds.has(id))
    }))
    .filter((set) => set.strandIds.length);
  next.selectedId = retainedIds.has(next.selectedId) ? next.selectedId : null;
  next.selectedStrandIds = (next.selectedStrandIds || []).filter((id) => retainedIds.has(id));
  next.pendingPlacedLockId = null;

  return next;
}

function samePresetResource(left, right) {
  if (!left || !right) return false;
  const { id: leftId, ...leftValue } = left;
  const { id: rightId, ...rightValue } = right;
  return JSON.stringify(leftValue) === JSON.stringify(rightValue);
}

export function mergeRegionalHairstylePresetState(currentState, presetState, {
  regionIds = [],
  createId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
} = {}) {
  const current = cloneProjectData(currentState || {});
  const incoming = cloneProjectData(presetState || {});
  const targetRegions = new Set(regionIds);
  const removedIds = new Set((current.locks || [])
    .filter((lock) => targetRegions.has(lock.scalpRegion || "unassigned"))
    .map((lock) => lock.id));
  const preservedLocks = (current.locks || [])
    .filter((lock) => !removedIds.has(lock.id));
  const preservedIds = new Set(preservedLocks.map((lock) => lock.id));
  const normalizedPreservedLocks = preservedLocks.map((lock) => {
    const clumpGuideRetained = !lock.clumpGuideId || preservedIds.has(lock.clumpGuideId);
    return {
      ...lock,
      mirrorPartnerId: preservedIds.has(lock.mirrorPartnerId) ? lock.mirrorPartnerId : null,
      branchParentId: preservedIds.has(lock.branchParentId) ? lock.branchParentId : null,
      clumpId: clumpGuideRetained ? lock.clumpId : null,
      clumpGuideId: clumpGuideRetained ? lock.clumpGuideId : null,
      clumpGuide: clumpGuideRetained && Boolean(lock.clumpGuide),
      adaptiveRemeshSourceIds: Array.isArray(lock.adaptiveRemeshSourceIds)
        ? lock.adaptiveRemeshSourceIds.filter((id) => preservedIds.has(id))
        : lock.adaptiveRemeshSourceIds
    };
  });

  const incomingLocks = (incoming.locks || [])
    .filter((lock) => !targetRegions.size || targetRegions.has(lock.scalpRegion || "unassigned"));
  const idMap = new Map(incomingLocks.map((lock) => [lock.id, createId("lock", lock.id)]));
  const clumpIdMap = new Map();
  incomingLocks.forEach((lock) => {
    if (lock.clumpId && !clumpIdMap.has(lock.clumpId)) clumpIdMap.set(lock.clumpId, createId("clump", lock.clumpId));
  });

  const currentMaterials = [...(current.hairMaterials || [])];
  const incomingMaterials = new Map((incoming.hairMaterials || []).map((material) => [material.id, material]));
  const materialMap = new Map();
  [...new Set(incomingLocks.map((lock) => lock.materialId).filter(Boolean))].forEach((materialId) => {
    const incomingMaterial = incomingMaterials.get(materialId);
    const existingMaterial = currentMaterials.find((material) => material.id === materialId);
    const equivalentMaterial = incomingMaterial
      ? currentMaterials.find((material) => samePresetResource(material, incomingMaterial))
      : null;
    if (!incomingMaterial) {
      materialMap.set(materialId, materialId);
      return;
    }
    if (equivalentMaterial) {
      materialMap.set(materialId, equivalentMaterial.id);
      return;
    }
    if (!existingMaterial) {
      currentMaterials.push(incomingMaterial);
      materialMap.set(materialId, materialId);
      return;
    }
    const nextMaterialId = `preset-material-${createId("material", materialId)}`;
    currentMaterials.push({ ...incomingMaterial, id: nextMaterialId });
    materialMap.set(materialId, nextMaterialId);
  });

  const remappedLocks = incomingLocks.map((lock) => ({
    ...lock,
    id: idMap.get(lock.id),
    materialId: materialMap.get(lock.materialId) || lock.materialId,
    mirrorPartnerId: idMap.get(lock.mirrorPartnerId) || null,
    branchParentId: idMap.get(lock.branchParentId) || null,
    clumpId: clumpIdMap.get(lock.clumpId) || null,
    clumpGuideId: idMap.get(lock.clumpGuideId) || null,
    adaptiveRemeshSourceIds: Array.isArray(lock.adaptiveRemeshSourceIds)
      ? lock.adaptiveRemeshSourceIds.map((id) => idMap.get(id)).filter(Boolean)
      : lock.adaptiveRemeshSourceIds
  }));
  const mergedIds = new Set([...normalizedPreservedLocks, ...remappedLocks].map((lock) => lock.id));
  const preservedSelectionSets = (current.selectionSets || [])
    .map((set) => ({ ...set, strandIds: (set.strandIds || []).filter((id) => mergedIds.has(id)) }))
    .filter((set) => set.strandIds.length);
  const incomingSelectionSets = (incoming.selectionSets || [])
    .map((set) => ({
      ...set,
      id: createId("selection-set", set.id),
      strandIds: (set.strandIds || []).map((id) => idMap.get(id)).filter(Boolean)
    }))
    .filter((set) => set.strandIds.length);

  return {
    ...current,
    lockIndex: Math.max(Number(current.lockIndex) || 1, Number(incoming.lockIndex) || 1),
    hairMaterialIndex: Math.max(Number(current.hairMaterialIndex) || 1, Number(incoming.hairMaterialIndex) || 1),
    hairMaterials: currentMaterials,
    locks: [...normalizedPreservedLocks, ...remappedLocks],
    selectionSets: [...preservedSelectionSets, ...incomingSelectionSets],
    visibleStrandRegions: [...new Set([...(current.visibleStrandRegions || []), ...targetRegions])],
    selectedId: null,
    selectedStrandIds: [],
    selectedPoint: null,
    selectedControlPoints: [],
    selectedCurveSurfaceController: null,
    pendingPlacedLockId: null,
    clumpViewportSelection: false
  };
}
