// Curves are sampled root-to-tip at matching parameters. Compare the whole
// curve, not just roots (which often converge at the crown).
export function orderStrandLatticeCurves(curves) {
  const ordered = [...curves].sort((a, b) => {
    for (let row = 0; row < Math.min(a.length, b.length); row += 1) {
      for (const axis of ['x', 'y', 'z']) {
        const delta = a[row][axis] - b[row][axis];
        if (delta) return delta;
      }
    }
    return a.length - b.length;
  });
  const count = ordered.length;
  if (count < 3) return ordered;
  const distances = ordered.map(a => ordered.map(b => {
    const rows = Math.min(a.length, b.length);
    let sum = 0;
    for (let row = 0; row < rows; row += 1) {
      sum += Math.hypot(a[row].x-b[row].x, a[row].y-b[row].y, a[row].z-b[row].z);
    }
    return sum / Math.max(1, rows);
  }));
  let best = null, bestLength = Infinity;
  // Try every starting curve so a middle-first selection cannot force a fold.
  for (let start = 0; start < count; start += 1) {
    const path = [start], remaining = new Set(ordered.map((_, i) => i));
    remaining.delete(start);
    while (remaining.size) {
      const last = path.at(-1);
      let next = null;
      for (const candidate of remaining) {
        if (next === null || distances[last][candidate] < distances[last][next]) next = candidate;
      }
      path.push(next);remaining.delete(next);
    }
    const length = path.slice(1).reduce((sum, index, i) => sum + distances[path[i]][index], 0);
    if (length < bestLength - 1e-10) { best = path; bestLength = length; }
  }
  return best.map(index => ordered[index]);
}

export function curveSurfacePointVisible(lock, pointIndex, controllerIndex) {
  return lock.geometryType !== 'curve-surface' || Boolean(lock.curveSurfaceLoft)
    || (controllerIndex !== null && Math.floor(pointIndex / lock.curveSurfaceRows) === controllerIndex);
}
