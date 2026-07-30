export function uvCoordinateBounds(points, minimumSpan = 1) {
  const valid = (Array.isArray(points) ? points : []).filter((point) => (
    Array.isArray(point)
    && Number.isFinite(Number(point[0]))
    && Number.isFinite(Number(point[1]))
  ));
  if (!valid.length) return { minU: 0, maxU: 1, minV: 0, maxV: 1 };
  let minU = Math.min(...valid.map((point) => Number(point[0])));
  let maxU = Math.max(...valid.map((point) => Number(point[0])));
  let minV = Math.min(...valid.map((point) => Number(point[1])));
  let maxV = Math.max(...valid.map((point) => Number(point[1])));
  const spanU = Math.max(maxU - minU, minimumSpan);
  const spanV = Math.max(maxV - minV, minimumSpan);
  const centerU = (minU + maxU) / 2;
  const centerV = (minV + maxV) / 2;
  minU = centerU - spanU / 2;
  maxU = centerU + spanU / 2;
  minV = centerV - spanV / 2;
  maxV = centerV + spanV / 2;
  return { minU, maxU, minV, maxV };
}

export function uvViewTransform(bounds, width, height, padding = 28) {
  const drawableWidth = Math.max(1, Number(width) - padding * 2);
  const drawableHeight = Math.max(1, Number(height) - padding * 2);
  const spanU = Math.max(0.000001, bounds.maxU - bounds.minU);
  const spanV = Math.max(0.000001, bounds.maxV - bounds.minV);
  const scale = Math.min(drawableWidth / spanU, drawableHeight / spanV);
  const contentWidth = spanU * scale;
  const contentHeight = spanV * scale;
  const offsetX = (Number(width) - contentWidth) / 2;
  const offsetY = (Number(height) - contentHeight) / 2;
  return {
    scale,
    project(u, v) {
      return [
        offsetX + (Number(u) - bounds.minU) * scale,
        offsetY + (bounds.maxV - Number(v)) * scale
      ];
    }
  };
}
