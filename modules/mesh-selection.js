function polyEdgeKey(edge) {
  return [...edge].sort((a, b) => a - b).join(":");
}

function mergeSelection(currentValues, matchedValues, mode, key = (value) => value) {
  const current = new Map(currentValues.map((value) => [key(value), value]));
  if (mode === "replace") current.clear();
  matchedValues.forEach((value) => {
    if (mode === "remove") current.delete(key(value));
    else current.set(key(value), value);
  });
  return [...current.values()];
}

// Batch transition shared by rectangle selection and edge-loop selection.
// The adapter supplies the initial selection and resolves mesh identity/mode.
export function meshComponentSelectionAfterMatches({
  type, faces = [], current = null, matches, selectionMode
}) {
  const faceIndices = type === "face"
    ? mergeSelection(current?.faceIndices || [], matches.faceIndices, selectionMode)
    : null;
  const edgeVertices = type === "edge"
    ? mergeSelection(current?.edgeVertices || [], matches.edges, selectionMode, polyEdgeKey).map((edge) => [...edge])
    : null;
  const indices = type === "face"
    ? [...new Set(faceIndices.flatMap((faceIndex) => faces[faceIndex] || []))]
    : type === "edge"
      ? [...new Set(edgeVertices.flat())]
      : mergeSelection(current?.indices || [], matches.vertexIndices, selectionMode);
  return { indices, faceIndices, edgeVertices };
}

// Pure click-selection transition. Picking, gesture capture, derived overlays,
// mirrors and history remain owned by the application coordinator.
// null means ignore the gesture; component:null means clear the selection.
export function meshComponentSelectionAfterPick({
  lockId, faces, requestedType, target, component = null, controlPoints = [], modifiers = {}
}) {
  if (!target || !["vertex", "edge", "face"].includes(requestedType)) return null;
  const selectedFaceIndices = new Set(
    requestedType === "face" && component?.lockId === lockId
      ? component.faceIndices || []
      : []
  );
  let selectedIndices;
  let selectedEdgeVertices = [];
  if (requestedType === "face") {
    if (modifiers.ctrlKey && !modifiers.shiftKey) selectedFaceIndices.add(target.index);
    else if (modifiers.shiftKey && !modifiers.ctrlKey) selectedFaceIndices.delete(target.index);
    else if (!modifiers.ctrlKey && !modifiers.shiftKey) {
      selectedFaceIndices.clear();
      selectedFaceIndices.add(target.index);
    } else return null;
    selectedIndices = new Set(
      [...selectedFaceIndices].flatMap((faceIndex) => faces[faceIndex] || [])
    );
  } else {
    const targetIndices = target.type === "vertex" ? [target.index] : target.vertices;
    const currentEdges = requestedType === "edge"
      && component?.lockId === lockId
      && component.type === "edge"
      ? component.edgeVertices || []
      : [];
    const selectedEdges = new Map(currentEdges.map((edge) => [polyEdgeKey(edge), [...edge]]));
    selectedIndices = new Set(
      controlPoints
        .filter((point) => point.type === "strand" && point.lockId === lockId)
        .map((point) => point.pointIndex)
    );
    if (modifiers.ctrlKey && !modifiers.shiftKey) {
      targetIndices.forEach((index) => selectedIndices.add(index));
      if (requestedType === "edge") selectedEdges.set(polyEdgeKey(target.vertices), [...target.vertices]);
    } else if (modifiers.shiftKey && !modifiers.ctrlKey) {
      targetIndices.forEach((index) => selectedIndices.delete(index));
      if (requestedType === "edge") selectedEdges.delete(polyEdgeKey(target.vertices));
    }
    else if (!modifiers.ctrlKey && !modifiers.shiftKey) {
      selectedIndices.clear();
      targetIndices.forEach((index) => selectedIndices.add(index));
      if (requestedType === "edge") {
        selectedEdges.clear();
        selectedEdges.set(polyEdgeKey(target.vertices), [...target.vertices]);
      }
    } else return null;
    if (requestedType === "edge") {
      selectedEdgeVertices = [...selectedEdges.values()];
      selectedIndices = new Set(selectedEdgeVertices.flat());
    }
  }
  const nextControlPoints = [...selectedIndices].map((pointIndex) => ({
    type: "strand",
    lockId: lockId,
    pointIndex
  }));
  const nextComponent = selectedIndices.size
    ? {
        lockId: lockId,
        type: requestedType,
        indices: [...selectedIndices],
        faceIndices: requestedType === "face" ? [...selectedFaceIndices] : null,
        edgeVertices: requestedType === "edge" ? selectedEdgeVertices : null,
        handle: null
      }
    : null;
  return { controlPoints: nextControlPoints, component: nextComponent };
}
