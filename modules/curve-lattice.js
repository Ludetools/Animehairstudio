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
