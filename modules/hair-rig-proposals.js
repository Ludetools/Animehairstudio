import {createHairRig, mirroredRigSourceGroups} from './hair-rig.js';

// Builds detached proposals only: no bindings, scene objects, history or UI state.
export function buildHairRigProposals({sources, selectedIds, existingRigs, previous = [],
  autoMirror = true, settings, makeId = () => crypto.randomUUID()}) {
  const groups = autoMirror ? mirroredRigSourceGroups(selectedIds, sources) : [selectedIds];
  const created = [];
  let skippedMirror = false;
  for (const [index, ids] of groups.entries()) {
    if (index > 0 && existingRigs.some(rig => rig.sourceIds?.some(id => ids.includes(id)))) {
      skippedMirror = true;
      continue;
    }
    const original = previous.find(rig => rig.sourceIds.length === ids.length
      && rig.sourceIds.every(id => ids.includes(id)));
    created.push(createHairRig(sources.filter(source => ids.includes(source.id)), {
      ...settings,
      id: original?.id || makeId(),
      existingNames: [...existingRigs, ...created].flatMap(rig => rig.boneNames || [])
    }));
  }
  return {created, skippedMirror};
}
