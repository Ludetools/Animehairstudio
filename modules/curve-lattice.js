export const DEFAULT_CURVE_LATTICE_PLANE = Object.freeze({
  columns: 3,
  rows: 3,
  width: 1.5,
  height: 1.4,
  centerX: 0,
  centerY: 0.75,
  z: 1.05
});

export function flatCurveLatticePointData({
  columns = DEFAULT_CURVE_LATTICE_PLANE.columns,
  rows = DEFAULT_CURVE_LATTICE_PLANE.rows,
  width = DEFAULT_CURVE_LATTICE_PLANE.width,
  height = DEFAULT_CURVE_LATTICE_PLANE.height,
  centerX = DEFAULT_CURVE_LATTICE_PLANE.centerX,
  centerY = DEFAULT_CURVE_LATTICE_PLANE.centerY,
  z = DEFAULT_CURVE_LATTICE_PLANE.z
} = {}) {
  const points = [];
  const columnCount = Math.max(2, Math.round(Number(columns) || DEFAULT_CURVE_LATTICE_PLANE.columns));
  const rowCount = Math.max(2, Math.round(Number(rows) || DEFAULT_CURVE_LATTICE_PLANE.rows));

  for (let row = 0; row < rowCount; row += 1) {
    const v = row / (rowCount - 1);
    const y = centerY + height * 0.5 - height * v;
    for (let column = 0; column < columnCount; column += 1) {
      const u = column / (columnCount - 1);
      const x = centerX - width * 0.5 + width * u;
      points.push({ x, y, z });
    }
  }

  return points;
}

function interpolatePoint(a, b, amount) {
  return {
    x: a.x + (b.x - a.x) * amount,
    y: a.y + (b.y - a.y) * amount,
    z: a.z + (b.z - a.z) * amount
  };
}

export function resampleCurveLatticePointData(points, columns, rows, nextColumns, nextRows) {
  const sourceColumns = Math.max(2, Math.round(Number(columns)));
  const sourceRows = Math.max(2, Math.round(Number(rows)));
  const targetColumns = Math.max(2, Math.round(Number(nextColumns)));
  const targetRows = Math.max(2, Math.round(Number(nextRows)));
  if (!Array.isArray(points) || points.length !== sourceColumns * sourceRows) return [];

  const sampled = [];
  for (let row = 0; row < targetRows; row += 1) {
    const sourceY = (row / (targetRows - 1)) * (sourceRows - 1);
    const rowLow = Math.floor(sourceY);
    const rowHigh = Math.min(sourceRows - 1, rowLow + 1);
    const rowBlend = sourceY - rowLow;
    for (let column = 0; column < targetColumns; column += 1) {
      const sourceX = (column / (targetColumns - 1)) * (sourceColumns - 1);
      const columnLow = Math.floor(sourceX);
      const columnHigh = Math.min(sourceColumns - 1, columnLow + 1);
      const columnBlend = sourceX - columnLow;
      const top = interpolatePoint(
        points[rowLow * sourceColumns + columnLow],
        points[rowLow * sourceColumns + columnHigh],
        columnBlend
      );
      const bottom = interpolatePoint(
        points[rowHigh * sourceColumns + columnLow],
        points[rowHigh * sourceColumns + columnHigh],
        columnBlend
      );
      sampled.push(interpolatePoint(top, bottom, rowBlend));
    }
  }
  return sampled;
}

export function resampleCurveLatticeLineData(points, nextCount) {
  const targetCount = Math.max(2, Math.round(Number(nextCount)));
  if (!Array.isArray(points) || points.length < 2) return [];
  return Array.from({ length: targetCount }, (_, index) => {
    const source = (index / (targetCount - 1)) * (points.length - 1);
    const lower = Math.floor(source);
    const upper = Math.min(points.length - 1, lower + 1);
    return interpolatePoint(points[lower], points[upper], source - lower);
  });
}

export function curveLatticeLoopPointIndices(columns, rows, axis, loopIndex) {
  const columnCount = Math.max(2, Math.round(Number(columns)));
  const rowCount = Math.max(2, Math.round(Number(rows)));
  const index = Math.round(Number(loopIndex));
  if (axis === "horizontal" && index >= 0 && index < rowCount) {
    return Array.from({ length: columnCount }, (_, column) => index * columnCount + column);
  }
  if (axis === "vertical" && index >= 0 && index < columnCount) {
    return Array.from({ length: rowCount }, (_, row) => row * columnCount + index);
  }
  return [];
}

function finitePointData(point) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const z = Number(point?.z);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? { x, y, z }
    : null;
}

function pointDataCenter(points) {
  const center = points.reduce((result, point) => ({
    x: result.x + point.x,
    y: result.y + point.y,
    z: result.z + point.z
  }), { x: 0, y: 0, z: 0 });
  const divisor = Math.max(1, points.length);
  return {
    x: center.x / divisor,
    y: center.y / divisor,
    z: center.z / divisor
  };
}

function stableCoordinate(value) {
  const rounded = Number(value.toFixed(12));
  return Math.abs(rounded) < 1e-12 ? 0 : rounded;
}

export function curveLatticePresetValue({ columns, rows, points } = {}) {
  const columnCount = Math.max(2, Math.min(12, Math.round(Number(columns) || 3)));
  const rowCount = Math.max(2, Math.min(12, Math.round(Number(rows) || 3)));
  const normalizedPoints = Array.isArray(points) ? points.map(finitePointData) : [];
  if (normalizedPoints.some((point) => !point) || normalizedPoints.length !== columnCount * rowCount) {
    return null;
  }
  const center = pointDataCenter(normalizedPoints);
  return {
    columns: columnCount,
    rows: rowCount,
    points: normalizedPoints.map((point) => ({
      x: stableCoordinate(point.x - center.x),
      y: stableCoordinate(point.y - center.y),
      z: stableCoordinate(point.z - center.z)
    }))
  };
}

export function curveLatticePresetPoints(value, targetPoints = []) {
  const preset = curveLatticePresetValue(value);
  if (!preset) return [];
  const validTargets = Array.isArray(targetPoints)
    ? targetPoints.map(finitePointData).filter(Boolean)
    : [];
  const center = validTargets.length ? pointDataCenter(validTargets) : { x: 0, y: 0, z: 0 };
  return preset.points.map((point) => ({
    x: stableCoordinate(point.x + center.x),
    y: stableCoordinate(point.y + center.y),
    z: stableCoordinate(point.z + center.z)
  }));
}

export function curveLatticePresetMatches(value, columns, rows, points, epsilon = 0.0001) {
  const preset = curveLatticePresetValue(value);
  const current = curveLatticePresetValue({ columns, rows, points });
  if (!preset || !current || preset.columns !== current.columns || preset.rows !== current.rows) return false;
  return preset.points.every((point, index) => (
    Math.abs(point.x - current.points[index].x) <= epsilon
    && Math.abs(point.y - current.points[index].y) <= epsilon
    && Math.abs(point.z - current.points[index].z) <= epsilon
  ));
}

export function normalizeCurveLatticePresetLibrary(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.flatMap((preset) => {
    const id = typeof preset?.id === "string" ? preset.id.trim().slice(0, 100) : "";
    const name = typeof preset?.name === "string" ? preset.name.trim().slice(0, 60) : "";
    const normalizedValue = curveLatticePresetValue(preset?.value);
    if (!id || !name || !normalizedValue || ids.has(id)) return [];
    ids.add(id);
    return [{ id, name, value: normalizedValue }];
  });
}

export function removeCurveLatticePreset(library, id) {
  return normalizeCurveLatticePresetLibrary(library).filter((preset) => preset.id !== id);
}
