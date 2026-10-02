function uniqueStrandIds(ids, validIds = null, validLookup = null) {
  const valid = validLookup || (validIds ? new Set(validIds) : null);
  return [...new Set((ids || []).filter((id) => (
    typeof id === "string" && id && (!valid || valid.has(id))
  )))];
}

export function nextSelectionSetName(selectionSets = []) {
  const usedNames = new Set(selectionSets.map((set) => String(set?.name || "").trim()));
  let index = 1;
  while (usedNames.has(`Selection Set ${index}`)) index += 1;
  return `Selection Set ${index}`;
}

// Keep authored member order and duplicates; do not normalize selectable IDs.
// Preview objects are valid selection targets (unlike visibility-toggle targets).
export function existingSelectionSetIds(selectionSet, objects) {
  if (selectionSet.strandIds.length < 2) {
    return selectionSet.strandIds.filter(id => objects.some(object => object.id === id));
  }
  const validIds = new Set();
  objects.forEach(object => validIds.add(object.id));
  // some() used strict equality and skipped sparse scene entries, unlike a
  // Set made directly from objects.map(). NaN must still never match.
  return selectionSet.strandIds.filter(id => id === id && validIds.has(id));
}

// Compare against a render-local scene ID index without allocating a filtered
// member array. Count duplicates as before; this is not set-equality checking.
export function selectionSetMatchesSelection(selectionSet, selectedIds, validIds) {
  let memberCount = 0, allSelected = true;
  selectionSet.strandIds.forEach(id => {
    // The former scene some() comparison used ===, unlike Set's NaN equality.
    if (id === id && validIds.has(id)) {
      memberCount++;
      if (!selectedIds.has(id)) allSelected = false;
    }
  });
  return memberCount > 0 && memberCount === selectedIds.size && allSelected;
}

// Borrow all matching display objects in scene order, including duplicate IDs.
// Invert membership once per refresh instead of scanning the scene per set.
// Preview duplicates remain selectable but are not visibility-toggle targets.
export function selectionSetObjectsInSceneOrder(selectionSets, objects) {
  if (selectionSets.length === 1 && 0 in selectionSets) {
    const memberIds = new Set(selectionSets[0].strandIds);
    return [objects.filter(object => memberIds.has(object.id) && !object.proceduralDuplicatePreview)];
  }
  const destinations = new Map();
  const members = selectionSets.map(selectionSet => {
    const result = [];
    for (const id of new Set(selectionSet.strandIds)) {
      let targets = destinations.get(id);
      if (!targets) destinations.set(id, targets = []);
      targets.push(result);
    }
    return result;
  });
  if (!destinations.size) return members;
  objects.forEach(object => {
    const targets = destinations.get(object.id);
    if (targets && !object.proceduralDuplicatePreview) {
      for (const result of targets) result.push(object);
    }
  });
  return members;
}

export function normalizeSelectionSets(selectionSets = [], validIds = null) {
  const seenIds = new Set();
  let validLookup = null;
  // Build only when a record needs filtering, and never retain across calls.
  // One-shot/custom iterables keep the original per-record consumption path.
  const reusableValidIds = Array.isArray(validIds) || validIds instanceof Set;
  return selectionSets.flatMap((set, index) => {
    if (!set || typeof set !== "object") return [];
    if (reusableValidIds && !validLookup) validLookup = new Set(validIds);
    const strandIds = uniqueStrandIds(set.strandIds, validIds, validLookup);
    if (!strandIds.length) return [];
    const id = typeof set.id === "string" && set.id && !seenIds.has(set.id)
      ? set.id
      : `selection-set-${index + 1}`;
    seenIds.add(id);
    const name = typeof set.name === "string" && set.name.trim()
      ? set.name.trim().slice(0, 60)
      : `Selection Set ${index + 1}`;
    return [{ id, name, strandIds }];
  });
}

export function createSelectionSetRecord(selectionSets, strandIds, id) {
  const members = uniqueStrandIds(strandIds);
  if (members.length < 2 || typeof id !== "string" || !id) return null;
  return {
    id,
    name: nextSelectionSetName(selectionSets),
    strandIds: members
  };
}

export function updateSelectionSetMembers(selectionSet, strandIds, mode, validIds = null) {
  if (!selectionSet || typeof selectionSet !== "object") return null;
  const validLookup = Array.isArray(validIds) || validIds instanceof Set ? new Set(validIds) : null;
  const current = uniqueStrandIds(selectionSet.strandIds, validIds, validLookup);
  const requested = uniqueStrandIds(strandIds, validIds, validLookup);
  const requestedSet = new Set(requested);
  const currentSet = mode === "remove" ? null : new Set(current);
  const nextMembers = mode === "remove"
    ? current.filter((id) => !requestedSet.has(id))
    : [...current, ...requested.filter((id) => !currentSet.has(id))];
  return {
    ...selectionSet,
    strandIds: nextMembers
  };
}
