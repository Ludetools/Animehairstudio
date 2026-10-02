/**
 * Prepare read-only outliner membership for one refresh. Lists borrow scene
 * objects, preserve scene order and repeated appearances, and never persist on
 * authored state. DOM callbacks and visibility remain the renderer's concern.
 */
export function buildOutlinerHierarchy(objects, {
  groups, layers, selectedIds, isModelingMesh, normalizeHairLayer
}) {
  const indicesById = new Map();
  const objectsByClump = new Map();
  const retainedIds = new Set();
  const unusualResults = [];
  objects.forEach((object, index) => {
    if (!indicesById.has(object.id)) indicesById.set(object.id, []);
    indicesById.get(object.id).push(index);
    if (object.clumpId) {
      if (!objectsByClump.has(object.clumpId)) objectsByClump.set(object.clumpId, []);
      objectsByClump.get(object.clumpId).push(object);
    }
    if (object.modelingMeshType === "auto-remesh") {
      if (Array.isArray(object.adaptiveRemeshSourceIds)) {
        for (const id of object.adaptiveRemeshSourceIds) retainedIds.add(id);
      } else if (object.adaptiveRemeshSourceIds != null) {
        // Preserve legacy includes semantics for unusual source lists rather
        // than silently treating them as ordinary arrays.
        unusualResults.push(object);
      }
    }
  });

  const clumps = new Map();
  const remeshes = new Map();
  const rootMembers = new Map();
  function clumpMembersFor(guide) {
    if (!guide?.clumpGuide || !guide.clumpId) return [];
    if (!clumps.has(guide)) {
      clumps.set(guide, (objectsByClump.get(guide.clumpId) || [])
        .filter((object) => object.id !== guide.id));
    }
    return clumps.get(guide);
  }
  function remeshSourcesFor(result) {
    if (result?.modelingMeshType !== "auto-remesh") return [];
    if (!remeshes.has(result)) {
      const indices = [];
      new Set(result.adaptiveRemeshSourceIds || []).forEach((id) => {
        for (const index of indicesById.get(id) || []) indices.push(index);
      });
      indices.sort((a, b) => a - b);
      remeshes.set(result, indices.map((index) => objects[index]));
    }
    return remeshes.get(result);
  }
  function membersFor(root) {
    if (!rootMembers.has(root)) {
      rootMembers.set(root, root.modelingMeshType === "auto-remesh"
        ? [root, ...remeshSourcesFor(root)]
        : root.clumpGuide ? [root, ...clumpMembersFor(root)] : [root]);
    }
    return rootMembers.get(root);
  }

  const rootsByRegion = new Map();
  objects.forEach((object) => {
    // Non-adaptive remesh results still have a folder here and an editable
    // entry in Meshes; other modeling meshes are not outliner roots.
    if (isModelingMesh(object) && object.modelingMeshType !== "auto-remesh") return;
    if (object.proceduralDuplicatePreview || (object.clumpId && !object.clumpGuide)) return;
    if (retainedIds.has(object.id) || unusualResults.some((result) =>
      result.adaptiveRemeshSourceIds?.includes(object.id))) return;
    const region = object.scalpRegion || "unassigned";
    if (!rootsByRegion.has(region)) rootsByRegion.set(region, []);
    rootsByRegion.get(region).push(object);
  });

  const preparedGroups = groups.map((group) => {
    const roots = rootsByRegion.get(group.id) || [];
    const members = roots.flatMap(membersFor);
    const rootsByLayer = new Map();
    roots.forEach((root) => {
      const layer = normalizeHairLayer(root.hairLayer);
      if (!rootsByLayer.has(layer)) rootsByLayer.set(layer, []);
      rootsByLayer.get(layer).push(root);
    });
    const preparedLayers = layers.flatMap((layer) => {
      const layerRoots = rootsByLayer.get(layer.id);
      if (!layerRoots?.length) return [];
      const layerMembers = layerRoots.flatMap(membersFor);
      // Layer disclosure has always checked both memberships independently,
      // even for a legacy object carrying both remesh and clump-guide flags.
      const hasSelection = layerRoots.some((root) => selectedIds.has(root.id)
        || (root.clumpId && clumpMembersFor(root).some((object) => selectedIds.has(object.id)))
        || (root.modelingMeshType === "auto-remesh"
          && remeshSourcesFor(root).some((object) => selectedIds.has(object.id))));
      return [{ layer, roots: layerRoots, members: layerMembers, hasSelection }];
    });
    return { group, roots, members, layers: preparedLayers,
      hasSelection: members.some((object) => selectedIds.has(object.id)) };
  });
  return { groups: preparedGroups, clumpMembersFor, remeshSourcesFor };
}
