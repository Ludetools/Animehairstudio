// Joint-local linear blend skinning, selected by closest rest segment.
export const MAX_HAIR_BINDING_BLEND = 3;
export function hairJointWeightColors(bindings, joint, rootWeight = 0) {
  const stops = [[0.04,0.10,0.55], [0,0.75,0.9], [1,0.85,0.05], [0.95,0.06,0.03]];
  return bindings.flatMap(binding => {
    if (joint < 0) return [0.18,0.20,0.24];
    const weight = Math.max(0, Math.min(1, binding.indices.reduce((sum, index, i) =>
      sum + (index === joint ? binding.weights[i] : 0), 0))) * (1 - Math.max(0, Math.min(1, rootWeight)));
    const scaled = weight * 3, index = Math.min(2, Math.floor(scaled)), t = scaled - index;
    return stops[index].map((value, axis) => value + (stops[index + 1][axis] - value) * t);
  });
}

export function automaticHairWeights(points, joints, blend = 1) {
  blend = Number.isFinite(blend) ? Math.max(0, Math.min(MAX_HAIR_BINDING_BLEND, blend)) : 1;
  if (joints.length < 2 || !joints.every(p => p.length === 3 && p.every(Number.isFinite))) throw new Error('Invalid rest chain.');
  if (!joints.slice(1).some((p, i) => p.some((v, a) => Math.abs(v - joints[i][a]) > 1e-7))) throw new Error('The rest chain has no length.');
  const lengths = joints.slice(1).map((p, i) => Math.hypot(...p.map((v, axis) => v - joints[i][axis])));
  const transitionWeight = (joint, distance) => {
    const span = Math.min(lengths[joint - 1], lengths[joint]) * blend;
    const t = span > 1e-7 ? Math.max(0, Math.min(1, (distance + 0.1 * span) / (0.25 * span))) : Number(distance > 0);
    return t * t * (3 - 2 * t);
  };
  return points.map(point => {
    if (!point.every(Number.isFinite)) throw new Error('Invalid mesh vertex.');
    let best = Infinity, index = 0, parameter = 0;
    for (let i = 0; i < joints.length - 1; i++) {
      const a = joints[i], d = joints[i + 1].map((v, axis) => v - a[axis]);
      const lengthSq = d.reduce((sum, v) => sum + v * v, 0);
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

export function skinHairPoints(points, weights, matrices, direction = false, rootWeight = 0, rootMatrix = null) {
  rootWeight = Number.isFinite(rootWeight) ? Math.max(0, Math.min(1, rootWeight)) : 0;
  return points.map((point, index) => {
    const binding = weights[index];
    const result = [0, 0, 0];
    binding.indices.forEach((joint, influence) => {
      const m = matrices[joint], w = binding.weights[influence];
      for (let axis = 0; axis < 3; axis++) result[axis] += w * (m[axis] * point[0] + m[axis + 4] * point[1] + m[axis + 8] * point[2] + (direction ? 0 : m[axis + 12]));
    });
    return result.map((value, axis) => {
      const root = rootMatrix ? rootMatrix[axis] * point[0] + rootMatrix[axis + 4] * point[1] + rootMatrix[axis + 8] * point[2] + (direction ? 0 : rootMatrix[axis + 12]) : point[axis];
      return value * (1 - rootWeight) + root * rootWeight;
    });
  });
}
