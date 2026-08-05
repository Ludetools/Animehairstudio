export function mirrorSelectionTargets(selectedLocks, partnerFor) {
  const mirrorable = [];
  const decouple = [];
  const seenPairs = new Set();

  for (const lock of selectedLocks || []) {
    if (!lock?.id) continue;
    const partner = partnerFor?.(lock) || null;
    if (!partner?.id || partner.id === lock.id) {
      mirrorable.push(lock);
      continue;
    }
    const pairKey = [String(lock.id), String(partner.id)].sort().join(":");
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);
    decouple.push(lock);
  }

  return { mirrorable, decouple };
}
