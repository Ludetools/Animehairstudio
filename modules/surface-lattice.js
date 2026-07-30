export const DEFAULT_SURFACE_LATTICE_COLUMNS = 3;
export const DEFAULT_SURFACE_LATTICE_ROWS = 3;
export const MAX_SURFACE_LATTICE_CONTROL_POINTS = 11;

export function normalizeSurfaceLatticeCount(value, fallback = 3) {
  const rounded = Math.round(Number(value) || fallback);
  const clamped = Math.max(3, Math.min(MAX_SURFACE_LATTICE_CONTROL_POINTS, rounded));
  return clamped % 2 === 0
    ? Math.min(MAX_SURFACE_LATTICE_CONTROL_POINTS, clamped + 1)
    : clamped;
}

function surfaceLatticePointOrder(columns, rows) {
  const columnCount = normalizeSurfaceLatticeCount(columns);
  const rowCount = normalizeSurfaceLatticeCount(rows);
  const root = Math.floor(columnCount / 2);
  const tip = (rowCount - 1) * columnCount + root;
  const order = [root];
  for (let index = 0; index < columnCount * rowCount; index += 1) {
    if (index !== root && index !== tip) order.push(index);
  }
  order.push(tip);
  return order;
}

export function surfaceLatticePointIndex(
  row,
  column,
  columns = DEFAULT_SURFACE_LATTICE_COLUMNS,
  rows = DEFAULT_SURFACE_LATTICE_ROWS
) {
  const columnCount = normalizeSurfaceLatticeCount(columns);
  const rowCount = normalizeSurfaceLatticeCount(rows);
  if (row < 0 || row >= rowCount || column < 0 || column >= columnCount) return -1;
  const rowMajorIndex = row * columnCount + column;
  return surfaceLatticePointOrder(columnCount, rowCount).indexOf(rowMajorIndex);
}

export function mirroredSurfaceLatticePointIndex(
  pointIndex,
  columns = DEFAULT_SURFACE_LATTICE_COLUMNS,
  rows = DEFAULT_SURFACE_LATTICE_ROWS
) {
  const columnCount = normalizeSurfaceLatticeCount(columns);
  const rowCount = normalizeSurfaceLatticeCount(rows);
  const order = surfaceLatticePointOrder(columnCount, rowCount);
  const rowMajorIndex = order[pointIndex];
  if (rowMajorIndex === undefined) return -1;
  const row = Math.floor(rowMajorIndex / columnCount);
  const column = rowMajorIndex % columnCount;
  return surfaceLatticePointIndex(
    row,
    columnCount - 1 - column,
    columnCount,
    rowCount
  );
}

function pointComponent(point, key) {
  return Number(point?.[key] || 0);
}

function catmullRomComponent(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function catmullRomDerivativeComponent(p0, p1, p2, p3, t) {
  const t2 = t * t;
  return 0.5 * (
    (-p0 + p2)
    + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t
    + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2
  );
}

function sampleCatmullRomLine(points, t) {
  const lastIndex = Math.max(1, points.length - 1);
  const clamped = Math.max(0, Math.min(1, Number(t) || 0));
  const scaled = clamped * lastIndex;
  const index = Math.min(lastIndex - 1, Math.floor(scaled));
  const localT = index === lastIndex ? 1 : scaled - index;
  const p0 = points[Math.max(0, index - 1)] || points[0];
  const p1 = points[index] || points[0];
  const p2 = points[Math.min(lastIndex, index + 1)] || points.at(-1);
  const p3 = points[Math.min(lastIndex, index + 2)] || points.at(-1);
  const point = {};
  const tangent = {};
  ["x", "y", "z"].forEach((key) => {
    const values = [p0, p1, p2, p3].map((pointValue) => pointComponent(pointValue, key));
    point[key] = catmullRomComponent(...values, localT);
    tangent[key] = catmullRomDerivativeComponent(...values, localT) * lastIndex;
  });
  return { point, tangent };
}

export function sampleSurfaceLattice(
  points,
  u,
  v,
  columns = DEFAULT_SURFACE_LATTICE_COLUMNS,
  rows = DEFAULT_SURFACE_LATTICE_ROWS
) {
  const columnCount = normalizeSurfaceLatticeCount(columns);
  const rowCount = normalizeSurfaceLatticeCount(rows);
  const rowSamples = Array.from({ length: rowCount }, (_, row) => {
    const rowPoints = Array.from(
      { length: columnCount },
      (_, column) => points?.[surfaceLatticePointIndex(row, column, columnCount, rowCount)]
    );
    return sampleCatmullRomLine(rowPoints, u);
  });
  const vertical = sampleCatmullRomLine(rowSamples.map((sample) => sample.point), v);
  const horizontal = sampleCatmullRomLine(rowSamples.map((sample) => sample.tangent), v);
  return {
    point: vertical.point,
    tangentU: horizontal.point,
    tangentV: vertical.tangent
  };
}

export function createSurfaceLatticePointData({
  columns = DEFAULT_SURFACE_LATTICE_COLUMNS,
  rows = DEFAULT_SURFACE_LATTICE_ROWS,
  width = 1.5,
  height = 1.4,
  centerX = 0,
  centerY = 0.75,
  z = 1.05
} = {}) {
  const columnCount = normalizeSurfaceLatticeCount(columns);
  const rowCount = normalizeSurfaceLatticeCount(rows);
  const points = new Array(columnCount * rowCount);
  for (let row = 0; row < rowCount; row += 1) {
    const v = row / (rowCount - 1);
    for (let column = 0; column < columnCount; column += 1) {
      const u = column / (columnCount - 1);
      points[surfaceLatticePointIndex(row, column, columnCount, rowCount)] = {
        x: centerX - width * 0.5 + width * u,
        y: centerY + height * 0.5 - height * v,
        z
      };
    }
  }
  return points;
}

export function createLoftSurfaceLatticePointData({
  horizontalPoints,
  verticalPoints,
  columns = DEFAULT_SURFACE_LATTICE_COLUMNS,
  rows = DEFAULT_SURFACE_LATTICE_ROWS
} = {}) {
  const columnCount = normalizeSurfaceLatticeCount(columns);
  const rowCount = normalizeSurfaceLatticeCount(rows);
  if (!Array.isArray(horizontalPoints) || horizontalPoints.length < 2) return [];
  if (!Array.isArray(verticalPoints) || verticalPoints.length < 2) return [];
  const verticalCenter = sampleCatmullRomLine(verticalPoints, 0.5).point;
  const points = new Array(columnCount * rowCount);
  for (let row = 0; row < rowCount; row += 1) {
    const vertical = sampleCatmullRomLine(verticalPoints, row / (rowCount - 1)).point;
    for (let column = 0; column < columnCount; column += 1) {
      const horizontal = sampleCatmullRomLine(horizontalPoints, column / (columnCount - 1)).point;
      points[surfaceLatticePointIndex(row, column, columnCount, rowCount)] = {
        x: horizontal.x + vertical.x - verticalCenter.x,
        y: horizontal.y + vertical.y - verticalCenter.y,
        z: horizontal.z + vertical.z - verticalCenter.z
      };
    }
  }
  return points;
}

export function resampleSurfaceLatticePointData(
  points,
  columns,
  rows,
  nextColumns,
  nextRows
) {
  const sourceColumns = normalizeSurfaceLatticeCount(columns);
  const sourceRows = normalizeSurfaceLatticeCount(rows);
  const targetColumns = normalizeSurfaceLatticeCount(nextColumns);
  const targetRows = normalizeSurfaceLatticeCount(nextRows);
  if (!Array.isArray(points) || points.length !== sourceColumns * sourceRows) return [];
  const sampled = new Array(targetColumns * targetRows);
  for (let row = 0; row < targetRows; row += 1) {
    const v = row / (targetRows - 1);
    for (let column = 0; column < targetColumns; column += 1) {
      const u = column / (targetColumns - 1);
      sampled[surfaceLatticePointIndex(row, column, targetColumns, targetRows)] = sampleSurfaceLattice(
        points,
        u,
        v,
        sourceColumns,
        sourceRows
      ).point;
    }
  }
  return sampled;
}

export function surfaceLatticeWireSegments(
  points,
  columns = DEFAULT_SURFACE_LATTICE_COLUMNS,
  rows = DEFAULT_SURFACE_LATTICE_ROWS
) {
  const columnCount = normalizeSurfaceLatticeCount(columns);
  const rowCount = normalizeSurfaceLatticeCount(rows);
  const segments = [];
  const horizontalSegments = Math.max(12, (columnCount - 1) * 8);
  const verticalSegments = Math.max(12, (rowCount - 1) * 8);
  for (let row = 0; row < rowCount; row += 1) {
    const v = row / (rowCount - 1);
    for (let segment = 0; segment < horizontalSegments; segment += 1) {
      segments.push(
        sampleSurfaceLattice(points, segment / horizontalSegments, v, columnCount, rowCount).point,
        sampleSurfaceLattice(points, (segment + 1) / horizontalSegments, v, columnCount, rowCount).point
      );
    }
  }
  for (let column = 0; column < columnCount; column += 1) {
    const u = column / (columnCount - 1);
    for (let segment = 0; segment < verticalSegments; segment += 1) {
      segments.push(
        sampleSurfaceLattice(points, u, segment / verticalSegments, columnCount, rowCount).point,
        sampleSurfaceLattice(points, u, (segment + 1) / verticalSegments, columnCount, rowCount).point
      );
    }
  }
  return segments;
}
