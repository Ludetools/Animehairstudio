function cloneOptionalRecord(value) {
  return value ? { ...value } : null;
}

function normalizeVisibilityRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, visible]) => [key, visible !== false])
  );
}

export function createProjectSelectionSnapshot({
  selectedId,
  selectedStrandIds = [],
  clumpViewportSelection,
  selectedGuideId,
  selectedReferenceImageId,
  activeCurveLatticeGuideId,
  selectedStrandGroup,
  selectedPoint,
  selectedCurveSurfaceController,
  selectedCurveLatticePoint,
  selectedControlPoints = [],
  pendingPlacedLockId
} = {}) {
  return {
    selectedId,
    selectedStrandIds: [...selectedStrandIds],
    clumpViewportSelection,
    selectedGuideId,
    selectedReferenceImageId,
    activeCurveLatticeGuideId,
    selectedStrandGroup,
    selectedPoint: cloneOptionalRecord(selectedPoint),
    selectedCurveSurfaceController: cloneOptionalRecord(selectedCurveSurfaceController),
    selectedCurveLatticePoint: cloneOptionalRecord(selectedCurveLatticePoint),
    selectedControlPoints: selectedControlPoints.map((point) => ({ ...point })),
    pendingPlacedLockId
  };
}

export function projectSnapshotLocks(locks, duplicatePlacement = null) {
  return locks.filter((lock) => (
    !lock.proceduralDuplicatePreview
    && lock.id !== duplicatePlacement?.lockId
    && !duplicatePlacement?.lockIds?.includes(lock.id)
  ));
}

export function createProjectRestorePlan(state, {
  regionIds = [],
  layerIds = []
} = {}) {
  return {
    counters: {
      lockIndex: state.lockIndex,
      referenceImageIndex: state.referenceImageIndex || 1,
      greasePencilStrokeIndex: state.greasePencilStrokeIndex || 1,
      hairMaterialIndex: state.hairMaterialIndex || 1
    },
    visibility: {
      strandRegions: [...(state.visibleStrandRegions || regionIds)],
      strandLayers: [...(state.visibleStrandLayers || layerIds)],
      capsuleGuides: state.capsuleGuidesVisible !== false,
      curveLatticeGuides: state.curveLatticeGuidesVisible !== false,
      references: state.referencesVisible !== false,
      headMesh: state.headMeshVisible !== false,
      bodyMesh: state.bodyMeshVisible !== false,
      importedMeshes: normalizeVisibilityRecord(state.importedMeshVisibility)
    },
    resources: {
      hairMaterials: state.hairMaterials?.length ? state.hairMaterials : null
    },
    scene: {
      locks: state.locks,
      guides: state.guides,
      referenceImages: state.referenceImages || [],
      greasePencilStrokes: state.greasePencilStrokes || [],
      selectionSets: state.selectionSets || []
    },
    strandSelection: {
      activeId: state.selectedId,
      selectedIds: state.selectedStrandIds,
      validIds: state.locks.map((lock) => lock.id)
    },
    selection: {
      clumpViewport: Boolean(state.clumpViewportSelection),
      guideId: state.selectedGuideId,
      referenceImageId: state.selectedReferenceImageId || null,
      activeCurveLatticeGuideId: state.activeCurveLatticeGuideId || null,
      strandGroup: state.selectedStrandGroup || null,
      point: cloneOptionalRecord(state.selectedPoint),
      curveSurfaceController: cloneOptionalRecord(state.selectedCurveSurfaceController),
      curveLatticePoint: cloneOptionalRecord(state.selectedCurveLatticePoint),
      controlPoints: (state.selectedControlPoints || []).map((point) => ({ ...point })),
      pendingPlacedLockId: state.pendingPlacedLockId
    }
  };
}
