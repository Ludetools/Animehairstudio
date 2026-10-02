// Joint-local linear blend skinning, selected by closest rest segment.
export const MAX_HAIR_BINDING_BLEND = 3;
export function hairJointWeightColors(bindings, joint, rootWeight = 0) {
  const stops = [[0.04,0.10,0.55], [0,0.75,0.9], [1,0.85,0.05], [0.95,0.06,0.03]];
  const colors = [];
  // Pack directly rather than allocating a temporary RGB array per vertex.
  // forEach retains flatMap's sparse-input visitation and output ordering.
  bindings.forEach(binding => {
    if (joint < 0) { colors.push(0.18,0.20,0.24); return; }
    const weight = Math.max(0, Math.min(1, binding.indices.reduce((sum, index, i) =>
      sum + (index === joint ? binding.weights[i] : 0), 0))) * (1 - Math.max(0, Math.min(1, rootWeight)));
    const scaled = weight * 3, index = Math.min(2, Math.floor(scaled)), t = scaled - index;
    const from = stops[index], to = stops[index + 1];
    for (let axis = 0; axis < 3; axis++) colors.push(from[axis] + (to[axis] - from[axis]) * t);
  });
  return colors;
}

export function automaticHairWeights(points, joints, blend = 1) {
  blend = Number.isFinite(blend) ? Math.max(0, Math.min(MAX_HAIR_BINDING_BLEND, blend)) : 1;
  if (joints.length < 2 || !joints.every(p => p.length === 3 && p.every(Number.isFinite))) throw new Error('Invalid rest chain.');
  if (!joints.slice(1).some((p, i) => p.some((v, a) => Math.abs(v - joints[i][a]) > 1e-7))) throw new Error('The rest chain has no length.');
  const lengths = joints.slice(1).map((p, i) => Math.hypot(...p.map((v, axis) => v - joints[i][axis])));
  // Rest segments are shared by every vertex in this binding pass. Build them
  // once, without caching across rest-chain or Binding Blend edits.
  const segments = joints.slice(0, -1).map((a, i) => {
    const delta = joints[i + 1].map((v, axis) => v - a[axis]);
    return { origin: a, delta, lengthSq: delta.reduce((sum, v) => sum + v * v, 0) };
  });
  const transitionWeight = (joint, distance) => {
    const span = Math.min(lengths[joint - 1], lengths[joint]) * blend;
    const t = span > 1e-7 ? Math.max(0, Math.min(1, (distance + 0.1 * span) / (0.25 * span))) : Number(distance > 0);
    return t * t * (3 - 2 * t);
  };
  return points.map(point => {
    if (!point.every(Number.isFinite)) throw new Error('Invalid mesh vertex.');
    let best = Infinity, index = 0, parameter = 0;
    for (let i = 0; i < segments.length; i++) {
      const { origin: a, delta: d, lengthSq } = segments[i];
      if (lengthSq < 1e-14) continue;
      const t = Math.max(0, Math.min(1, d.reduce((sum, v, axis) => sum + v * (point[axis] - a[axis]), 0) / lengthSq));
      const distance = point.reduce((sum, v, axis) => sum + (v - a[axis] - t * d[axis]) ** 2, 0);
      if (distance < best) {
        best = distance; index = i; parameter = t;
      }
    }
    // Shift the short blend rootward: 10% before / 15% after the joint at
    // 100% blend (30% / 45% at 300%), using the shorter neighboring bone. Both sides
    // share the same physical span so unequal bone lengths remain continuous.
    if (index < lengths.length - 1) {
      const incoming = transitionWeight(index + 1, (parameter - 1) * lengths[index]);
      if (incoming > 0) return {indices: [index, index + 1], weights: [1 - incoming, incoming]};
    }
    const weight = index > 0 ? transitionWeight(index, parameter * lengths[index]) : 0;
    // The terminal endpoint is still not an influencing bone.
    return index === 0
      ? {indices: [0, 1], weights: [1, 0]}
      : {indices: [index - 1, index], weights: [1 - weight, weight]};
  });
}

// Optional caller-owned scratch output avoids per-vertex allocations in preview.
// It must not alias authored points; omitting it retains the detached-result API.
export function skinHairPoints(points, weights, matrices, direction = false, rootWeight = 0, rootMatrix = null, target = []) {
  rootWeight = Number.isFinite(rootWeight) ? Math.max(0, Math.min(1, rootWeight)) : 0;
  const chainWeight = 1 - rootWeight;
  target.length = points.length;
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const x = point[0], y = point[1], z = point[2];
    const binding = weights[index];
    const result = target[index] || (target[index] = [0, 0, 0]);
    let rx = 0, ry = 0, rz = 0;
    for (let influence = 0; influence < binding.indices.length; influence++) {
      const joint = binding.indices[influence];
      const m = matrices[joint], w = binding.weights[influence];
      // Fixed XYZ components keep the original arithmetic order without an
      // inner axis loop for every influence of every vertex.
      rx += w * (m[0] * x + m[4] * y + m[8] * z + (direction ? 0 : m[12]));
      ry += w * (m[1] * x + m[5] * y + m[9] * z + (direction ? 0 : m[13]));
      rz += w * (m[2] * x + m[6] * y + m[10] * z + (direction ? 0 : m[14]));
    }
    result[0] = rx; result[1] = ry; result[2] = rz;
    for (let axis = 0; axis < 3; axis++) {
      const root = rootMatrix ? rootMatrix[axis] * x + rootMatrix[axis + 4] * y + rootMatrix[axis + 8] * z + (direction ? 0 : rootMatrix[axis + 12]) : point[axis];
      result[axis] = result[axis] * chainWeight + root * rootWeight;
    }
  }
  return target;
}
