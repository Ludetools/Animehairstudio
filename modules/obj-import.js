export function polygonOnlyObjSource(source) {
  if (typeof source !== "string" || source.length === 0) return source || "";

  // OBJLoader assigns one primitive type to each o/g section. A loose line or
  // point record placed after polygon faces can therefore reclassify the whole
  // section as LineSegments or Points. Head references are polygon surfaces, so
  // discard those unrelated primitives before parsing while preserving every
  // face and structural record verbatim.
  return source.replace(/^[\t ]*[lp](?:[\t ]+.*?)?[\t ]*(?=\r?$)/gm, "");
}
