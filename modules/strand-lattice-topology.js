import { resampleCurveLatticePointData } from './curve-lattice.js';
import { DEFAULT_CURVE_SURFACE_ROWS } from './curve-surface.js';

function optionalLoopCount(value, max = Number.MAX_SAFE_INTEGER) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.max(2, Math.min(max, Math.round(Number(value))));
}

function legacyCount(value, fallback) {
  const number = Number(value);
  return Math.round(Number.isFinite(number) && number ? number : fallback);
}

// Null means the pre-existing renderer's resolution. Retain that fallback for
// older projects, including lofts with unusually many source controllers.
export function strandLatticeTopologyFields(data) {
  const applicable = data?.geometryType === 'curve-surface' && data.curveSurfaceLoft;
  return {
    curveSurfaceTopologyRows: applicable ? optionalLoopCount(data.curveSurfaceTopologyRows, 257) : null,
    // Older lofts could have more than 128 source curves. Preserve their mesh
    // density even after reducing the control cage; new UI edits cap at 128.
    curveSurfaceTopologyColumns: applicable ? optionalLoopCount(data.curveSurfaceTopologyColumns) : null
  };
}

export function strandLatticeTopologyValues(data) {
  const fields = strandLatticeTopologyFields(data);
  const legacyRows = Math.max(
    legacyCount(data?.lengthSegments, 26) + 1,
    legacyCount(data?.curveSurfaceRows, DEFAULT_CURVE_SURFACE_ROWS)
  );
  return {
    rows: fields.curveSurfaceTopologyRows ?? Math.max(5, Math.min(257, legacyRows)),
    columns: fields.curveSurfaceTopologyColumns ?? optionalLoopCount(data?.curveSurfaceColumns) ?? 2
  };
}

// Subdivide the existing ruled surface rather than changing its control cage or
// rounding its shape. Longitudinal curve sampling remains in the scene adapter.
export function resampleStrandLatticeRenderGrid(grid, columns) {
  if (columns === grid.columns) return grid;
  if (!Number.isSafeInteger(columns) || columns < 2) return grid;
  const points = resampleCurveLatticePointData(grid.points, grid.columns, grid.rows, columns, grid.rows);
  return points.length ? { ...grid, columns, points } : grid;
}
