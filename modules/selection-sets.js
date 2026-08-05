function uniqueStrandIds(ids, validIds = null) {
  const valid = validIds ? new Set(validIds) : null;
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

export function normalizeSelectionSets(selectionSets = [], validIds = null) {
  const seenIds = new Set();
  return selectionSets.flatMap((set, index) => {
    if (!set || typeof set !== "object") return [];
    const strandIds = uniqueStrandIds(set.strandIds, validIds);
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
  const current = uniqueStrandIds(selectionSet.strandIds, validIds);
  const requested = uniqueStrandIds(strandIds, validIds);
  const requestedSet = new Set(requested);
  const nextMembers = mode === "remove"
    ? current.filter((id) => !requestedSet.has(id))
    : [...current, ...requested.filter((id) => !current.includes(id))];
  return {
    ...selectionSet,
    strandIds: nextMembers
  };
}
