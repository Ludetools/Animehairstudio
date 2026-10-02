// Transient pose session ownership. Source geometry/materials are always borrowed;
// adapters must register each geometry clone immediately, before further setup.
const IDENTITY = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

export function createHairPosePreview({rigs, locks, group, createEntries}) {
  const preview = {rigs: new Map(), meshes: [], undo: [], redo: [], group, ownedGeometries: new Set()};
  const sources = new Map();
  for (const lock of locks) if (!sources.has(lock.id)) sources.set(lock.id, lock);
  const owners = new Set();
  try {
    for (const rig of rigs) {
      preview.rigs.set(rig.id, {id: rig.id, joints: rig.joints.map(point => [...point]),
        matrices: rig.joints.map(() => [...IDENTITY])});
      for (const id of rig.boundStrandIds || []) {
        const lock = sources.get(id);
        if (!lock?.mesh?.geometry?.attributes.position) continue;
        if (owners.has(id)) throw new Error('A strand belongs to multiple chains. Unbind the conflicting chain first.');
        owners.add(id);
        preview.meshes.push(...createEntries(lock, rig, preview));
      }
    }
    if (!preview.meshes.length) throw new Error('Bind a chain to source strands first.');
    return preview;
  } catch (error) {
    disposeHairPosePreview(preview);
    throw error;
  }
}

export function disposeHairPosePreview(preview) {
  if (!preview || preview.disposed) return;
  preview.disposed = true;
  const geometries = new Set(preview.ownedGeometries);
  const materials = new Set();
  for (const entry of preview.meshes) {
    geometries.add(entry.clone.geometry);
    if (entry.weightMaterial) materials.add(entry.weightMaterial);
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  preview.ownedGeometries?.clear();
  preview.group.clear?.();
  preview.meshes.length = 0;
  preview.rigs?.clear();
  if (preview.undo) preview.undo.length = 0;
  if (preview.redo) preview.redo.length = 0;
}
