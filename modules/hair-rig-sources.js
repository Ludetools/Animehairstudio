// Read-only source classification. A procedural draw guide takes precedence;
// otherwise only a procedural brush clump replaces the object as rig source.
export function hairRigSourceForObject(object, clumpGuide) {
  const candidate = object?.proceduralDrawGuide || object?.clumpGuide ? object : clumpGuide;
  return candidate?.proceduralDrawGuide ? candidate
    : clumpGuide?.proceduralBrushGuide ? clumpGuide : object;
}

// Resolver lifetime is one source/selection refresh, never scene state.
// Build lazily so scenes without clumps do not pay for a guide index.
export function createHairRigSourceResolver(objects) {
  let guides = null;
  return object => {
    let guide = null;
    if (object?.clumpId) {
      if (!guides) {
        guides = new Map();
        objects.forEach(item => {
          if (item.clumpId && item.clumpGuide && !guides.has(item.clumpId)) guides.set(item.clumpId, item);
        });
      }
      guide = guides.get(object.clumpId) || null;
    }
    return hairRigSourceForObject(object, guide);
  };
}
