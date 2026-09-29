export function effectiveRemeshMethod(method = 'curve-union-v2', adaptive = false) {
  return adaptive || method === 'legacy' ? 'legacy' : method === 'boolean' ? 'boolean' : method === 'curve-union-v3' ? 'curve-union-v3' : 'curve-union-v2';
}

export function remeshSourceSupported(lock, method = 'boolean') {
  if (!lock || lock.proceduralParentHidden || lock.proceduralDrawGuide || lock.radialDrawGuide || lock.liveSurfaceGuide || lock.clumpGuide) return false;
  return lock.geometryType === 'strand' || (method === 'boolean'
    && (lock.geometryType === 'braid' || (lock.geometryType === 'curve-surface' && Boolean(lock.curveSurfaceLoft))));
}

// Reject unusable data, not the upstream heuristic quality grade.
export function remeshOutputAcceptable(method, mesh) {
  const vertices = mesh?.vertices;
  const faces = mesh?.objFaces || mesh?.faces;
  return (method !== 'curve-union-v3' || mesh?.curveUnionV3ExportSafe === true)
    && (method !== 'boolean' || mesh?.cutStitchExportSafe === true
      || (mesh?.surfaceCutStitchSafe === true && mesh?.surfaceCutStitchAudit?.shapePreserved === true && Boolean(mesh?.meshBake)))
    && Array.isArray(vertices) && vertices.length >= 3
    && vertices.every(point => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite))
    && Array.isArray(faces) && faces.length > 0
    && faces.every(face => Array.isArray(face) && face.length >= 3
      && new Set(face).size >= 3
      && face.every(index => Number.isInteger(index) && index >= 0 && index < vertices.length));
}

export function remeshQualityChecksPassed(method, mesh) {
  if (method === 'boolean') return remeshOutputAcceptable(method, mesh);
  if (method === 'curve-union-v3') return mesh?.curveUnionV3ExportSafe === true;
  return method !== 'curve-union-v2' || mesh?.curveUnionV2ExportSafe === true;
}
