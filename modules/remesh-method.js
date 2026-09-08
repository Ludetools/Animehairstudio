export function effectiveRemeshMethod(method = 'curve-union-v2', adaptive = false) {
  return adaptive || method === 'legacy' ? 'legacy' : method === 'curve-union-v3' ? 'curve-union-v3' : 'curve-union-v2';
}

// Reject unusable data, not the upstream heuristic quality grade.
export function remeshOutputAcceptable(method, mesh) {
  const vertices = mesh?.vertices;
  const faces = mesh?.objFaces || mesh?.faces;
  return (method !== 'curve-union-v3' || mesh?.curveUnionV3ExportSafe === true)
    && Array.isArray(vertices) && vertices.length >= 3
    && vertices.every(point => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite))
    && Array.isArray(faces) && faces.length > 0
    && faces.every(face => Array.isArray(face) && face.length >= 3
      && new Set(face).size >= 3
      && face.every(index => Number.isInteger(index) && index >= 0 && index < vertices.length));
}

export function remeshQualityChecksPassed(method, mesh) {
  if (method === 'curve-union-v3') return mesh?.curveUnionV3ExportSafe === true;
  return method !== 'curve-union-v2' || mesh?.curveUnionV2ExportSafe === true;
}
