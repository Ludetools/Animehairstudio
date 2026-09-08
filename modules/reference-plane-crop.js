export function referencePlaneCropGeometryData(aspect = 1, crop = {}) {
  const safeAspect = Math.max(0.05, Number(aspect) || 1);
  const left = Math.max(0, Math.min(1, Number(crop.left ?? 0)));
  const top = Math.max(0, Math.min(1, Number(crop.top ?? 0)));
  const right = Math.max(left, Math.min(1, Number(crop.right ?? 1)));
  const bottom = Math.max(top, Math.min(1, Number(crop.bottom ?? 1)));
  const width = 3 * safeAspect;
  const height = 3;
  const xMin = -width * 0.5 + width * left;
  const xMax = -width * 0.5 + width * right;
  const yMax = height * 0.5 - height * top;
  const yMin = height * 0.5 - height * bottom;
  const center = {
    x: (xMin + xMax) * 0.5,
    y: (yMin + yMax) * 0.5,
    z: 0
  };

  return {
    center,
    bounds: {
      xMin: xMin - center.x,
      xMax: xMax - center.x,
      yMin: yMin - center.y,
      yMax: yMax - center.y
    },
    positions: [
      xMin - center.x, yMax - center.y, 0,
      xMax - center.x, yMax - center.y, 0,
      xMin - center.x, yMin - center.y, 0,
      xMax - center.x, yMin - center.y, 0
    ],
    uvs: [
      left, 1 - top,
      right, 1 - top,
      left, 1 - bottom,
      right, 1 - bottom
    ],
    indices: [0, 2, 1, 2, 3, 1]
  };
}

export function referencePlanePointFromCropCoordinate(aspect = 1, x = 0.5, y = 0.5) {
  const safeAspect = Math.max(0.05, Number(aspect) || 1);
  return {
    x: (Math.max(0, Math.min(1, Number(x) || 0)) - 0.5) * 3 * safeAspect,
    y: (0.5 - Math.max(0, Math.min(1, Number(y) || 0))) * 3,
    z: 0
  };
}

export function referencePlaneCropCoordinateFromPoint(aspect = 1, point = {}) {
  const safeAspect = Math.max(0.05, Number(aspect) || 1);
  return {
    x: Math.max(0, Math.min(1, Number(point.x || 0) / (3 * safeAspect) + 0.5)),
    y: Math.max(0, Math.min(1, 0.5 - Number(point.y || 0) / 3))
  };
}

export function normalizeReferenceFlipPivotX(crop = {}, pivotX = null) {
  const left = Math.max(0, Math.min(1, Number(crop.left ?? 0)));
  const right = Math.max(left, Math.min(1, Number(crop.right ?? 1)));
  const fallbackPivot = (left + right) * 0.5;
  return pivotX == null || !Number.isFinite(Number(pivotX))
    ? fallbackPivot
    : Math.max(0, Math.min(1, Number(pivotX)));
}

export function referenceCropHorizontalFlipOffset(crop = {}, pivotX = null) {
  return normalizeReferenceFlipPivotX(crop, pivotX) * 2;
}
