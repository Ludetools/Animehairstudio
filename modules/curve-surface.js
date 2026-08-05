export const DEFAULT_CURVE_SURFACE_ROWS = 11;
export const DEFAULT_CURVE_SURFACE_STRIP_WIDTH = 0.22;
export const DEFAULT_CURVE_SURFACE_CONTROL_POINT_STEP = 0.3;
export const MAX_CURVE_SURFACE_CONTROL_POINTS = 48;

function pointValue(point, axis) {
  return Number(point?.[axis] || 0);
}

function clonePoint(point) {
  return {
    x: pointValue(point, "x"),
    y: pointValue(point, "y"),
    z: pointValue(point, "z")
  };
}

function interpolatePoint(a, b, amount) {
  return {
    x: pointValue(a, "x") + (pointValue(b, "x") - pointValue(a, "x")) * amount,
    y: pointValue(a, "y") + (pointValue(b, "y") - pointValue(a, "y")) * amount,
    z: pointValue(a, "z") + (pointValue(b, "z") - pointValue(a, "z")) * amount
  };
}

function pointDistance(a, b) {
  return Math.hypot(
    pointValue(a, "x") - pointValue(b, "x"),
    pointValue(a, "y") - pointValue(b, "y"),
    pointValue(a, "z") - pointValue(b, "z")
  );
}

export function curveSurfaceLineLength(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += pointDistance(points[index - 1], points[index]);
  }
  return length;
}

/**
 * Derives a stable left-to-right direction at every Curve Surface controller
 * point. Neighboring curves define the local surface span, so a surface that
 * wraps in depth produces lateral-facing normals instead of retaining the
 * drawing plane's original fixed direction.
 */
export function curveSurfaceControllerSideDirections(
  controllerCurves,
  fallbackSide = { x: 1, y: 0, z: 0 }
) {
  const curves = Array.isArray(controllerCurves)
    ? controllerCurves.filter((curve) => Array.isArray(curve) && curve.length >= 2)
    : [];
  if (!curves.length) return [];
  const fallback = normalizedDirection(fallbackSide, { x: 1, y: 0, z: 0 });
  const lastController = curves.length - 1;

  return curves.map((curve, controllerIndex) => curve.map((point, row) => {
    const previous = curve[Math.max(0, row - 1)] || point;
    const next = curve[Math.min(curve.length - 1, row + 1)] || point;
    const tangent = normalizedDirection({
      x: pointValue(next, "x") - pointValue(previous, "x"),
      y: pointValue(next, "y") - pointValue(previous, "y"),
      z: pointValue(next, "z") - pointValue(previous, "z")
    }, { x: 0, y: 1, z: 0 });
    const leftCurve = curves[Math.max(0, controllerIndex - 1)];
    const rightCurve = curves[Math.min(lastController, controllerIndex + 1)];
    const left = leftCurve[Math.min(row, leftCurve.length - 1)] || point;
    const right = rightCurve[Math.min(row, rightCurve.length - 1)] || point;
    let side = {
      x: pointValue(right, "x") - pointValue(left, "x"),
      y: pointValue(right, "y") - pointValue(left, "y"),
      z: pointValue(right, "z") - pointValue(left, "z")
    };
    const sideAlongTangent = side.x * tangent.x + side.y * tangent.y + side.z * tangent.z;
    side = {
      x: side.x - tangent.x * sideAlongTangent,
      y: side.y - tangent.y * sideAlongTangent,
      z: side.z - tangent.z * sideAlongTangent
    };
    const fallbackAlongTangent = fallback.x * tangent.x + fallback.y * tangent.y + fallback.z * tangent.z;
    const projectedFallback = {
      x: fallback.x - tangent.x * fallbackAlongTangent,
      y: fallback.y - tangent.y * fallbackAlongTangent,
      z: fallback.z - tangent.z * fallbackAlongTangent
    };
    side = normalizedDirection(side, normalizedDirection(projectedFallback, fallback));
    if (side.x * fallback.x + side.y * fallback.y + side.z * fallback.z < 0) {
      side = { x: -side.x, y: -side.y, z: -side.z };
    }
    return side;
  }));
}

/**
 * Chooses one shared controller resolution from the longest authored curve.
 * A fixed world-space step keeps short surfaces simple while allowing longer
 * surfaces to gain enough editable points without changing mesh resolution.
 */
export function curveSurfaceControlPointCount(
  curves,
  {
    step = DEFAULT_CURVE_SURFACE_CONTROL_POINT_STEP,
    min = 3,
    max = MAX_CURVE_SURFACE_CONTROL_POINTS
  } = {}
) {
  const longest = Array.isArray(curves)
    ? curves.reduce((length, curve) => Math.max(length, curveSurfaceLineLength(curve)), 0)
    : 0;
  const spacing = Math.max(0.001, Number(step) || DEFAULT_CURVE_SURFACE_CONTROL_POINT_STEP);
  const minimum = Math.max(2, Math.round(Number(min) || 3));
  const maximum = Math.max(minimum, Math.round(Number(max) || MAX_CURVE_SURFACE_CONTROL_POINTS));
  return Math.min(maximum, Math.max(minimum, Math.ceil(longest / spacing) + 1));
}

/** Resample a stroke by distance along the polyline, rather than by input event count. */
export function resampleCurveSurfaceLine(points, count = DEFAULT_CURVE_SURFACE_ROWS) {
  const targetCount = Math.max(2, Math.round(Number(count) || DEFAULT_CURVE_SURFACE_ROWS));
  if (!Array.isArray(points) || points.length < 2) return [];
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distances.push(distances.at(-1) + pointDistance(points[index - 1], points[index]));
  }
  const totalDistance = distances.at(-1);
  if (totalDistance < 0.000001) return Array.from({ length: targetCount }, () => clonePoint(points[0]));
  let segment = 0;
  return Array.from({ length: targetCount }, (_, index) => {
    const targetDistance = (index / (targetCount - 1)) * totalDistance;
    while (segment < distances.length - 2 && distances[segment + 1] < targetDistance) segment += 1;
    const span = Math.max(0.000001, distances[segment + 1] - distances[segment]);
    return interpolatePoint(points[segment], points[segment + 1], (targetDistance - distances[segment]) / span);
  });
}

function normalizedDirection(point, fallback) {
  const length = Math.hypot(point.x, point.y, point.z);
  if (length < 0.000001) return { ...fallback };
  return { x: point.x / length, y: point.y / length, z: point.z / length };
}

function offsetPoint(point, direction, distance) {
  return {
    x: pointValue(point, "x") + direction.x * distance,
    y: pointValue(point, "y") + direction.y * distance,
    z: pointValue(point, "z") + direction.z * distance
  };
}

function endpointDistance(curve, reference) {
  return pointDistance(curve[0], reference[0]) + pointDistance(curve.at(-1), reference.at(-1));
}

export function orientCurveSurfaceLine(points, reference, count = DEFAULT_CURVE_SURFACE_ROWS) {
  const sampled = resampleCurveSurfaceLine(points, count);
  if (!sampled.length || !reference?.length) return sampled;
  const reversed = [...sampled].reverse();
  return endpointDistance(reversed, reference) < endpointDistance(sampled, reference) ? reversed : sampled;
}

function averageLateralScore(curve, reference, side) {
  if (!curve?.length || !reference?.length) return 0;
  const count = Math.min(curve.length, reference.length);
  let score = 0;
  for (let index = 0; index < count; index += 1) {
    score += curveSurfaceCurveLateralScore([curve[index]], [reference[index]], side);
  }
  return score / count;
}

/**
 * Builds a single connected row-major lattice from authored strokes.
 *
 * The first stroke produces left/center/right columns. Every later stroke is
 * attached to exactly one current exterior column; it never creates another
 * generated cap column and never re-sorts previously authored topology.
 */
export function buildCurveSurfaceGrid(
  curves,
  {
    rows = DEFAULT_CURVE_SURFACE_ROWS,
    stripWidth = DEFAULT_CURVE_SURFACE_STRIP_WIDTH,
    side = { x: 1, y: 0, z: 0 }
  } = {}
) {
  const sourceCurves = Array.isArray(curves)
    ? curves.filter((curve) => Array.isArray(curve) && curve.length >= 2)
    : [];
  if (!sourceCurves.length) {
    return { points: [], columns: 0, rows: 0, orderedCurves: [], sourceColumns: [], rejectedCurveIndices: [] };
  }

  const rowCount = Math.max(2, Math.round(Number(rows) || DEFAULT_CURVE_SURFACE_ROWS));
  const sideDirection = normalizedDirection(side, { x: 1, y: 0, z: 0 });
  const width = Math.max(0.001, Number(stripWidth) || DEFAULT_CURVE_SURFACE_STRIP_WIDTH);
  const center = resampleCurveSurfaceLine(sourceCurves[0], rowCount);
  const columns = [
    center.map((point) => offsetPoint(point, sideDirection, -width)),
    center,
    center.map((point) => offsetPoint(point, sideDirection, width))
  ];
  const orderedCurves = [center];
  const sourceColumns = [1];
  const attachments = ["center"];
  const rejectedCurveIndices = [];

  for (let sourceIndex = 1; sourceIndex < sourceCurves.length; sourceIndex += 1) {
    const curve = orientCurveSurfaceLine(sourceCurves[sourceIndex], center, rowCount);
    const curveScore = averageLateralScore(curve, center, sideDirection);
    const leftScore = averageLateralScore(columns[0], center, sideDirection);
    const rightScore = averageLateralScore(columns.at(-1), center, sideDirection);
    const tolerance = Math.max(0.0001, width * 0.02);
    if (curveScore < leftScore - tolerance) {
      columns.unshift(curve);
      for (let index = 0; index < sourceColumns.length; index += 1) sourceColumns[index] += 1;
      sourceColumns[sourceIndex] = 0;
      orderedCurves.unshift(curve);
      attachments[sourceIndex] = "left";
    } else if (curveScore > rightScore + tolerance) {
      sourceColumns[sourceIndex] = columns.length;
      columns.push(curve);
      orderedCurves.push(curve);
      attachments[sourceIndex] = "right";
    } else {
      sourceColumns[sourceIndex] = null;
      attachments[sourceIndex] = null;
      rejectedCurveIndices.push(sourceIndex);
    }
  }

  const points = [];
  for (let row = 0; row < rowCount; row += 1) {
    for (const column of columns) points.push(column[row]);
  }
  return {
    points,
    columns: columns.length,
    rows: rowCount,
    orderedCurves,
    sourceColumns,
    attachments,
    rejectedCurveIndices
  };
}

/**
 * Generates the grid for connected open hair cards while keeping the supplied
 * longitudinal curves as the authoritative controllers and midpoint loops.
 * Every card has a controller loop between its two boundary loops. Adjacent
 * cards share the averaged boundary between their controller loops.
 */
export function buildConnectedCurveCardGrid(
  controllerCurves,
  {
    rows = DEFAULT_CURVE_SURFACE_ROWS,
    stripWidth = DEFAULT_CURVE_SURFACE_STRIP_WIDTH,
    side = { x: 1, y: 0, z: 0 },
    controllerSides = null
  } = {}
) {
  const source = Array.isArray(controllerCurves)
    ? controllerCurves.filter((curve) => Array.isArray(curve) && curve.length >= 2)
    : [];
  if (!source.length) return { points: [], columns: 0, rows: 0, controllerCurves: [] };
  const rowCount = Math.max(2, Math.round(Number(rows) || DEFAULT_CURVE_SURFACE_ROWS));
  const direction = normalizedDirection(side, { x: 1, y: 0, z: 0 });
  const width = Math.max(0.001, Number(stripWidth) || DEFAULT_CURVE_SURFACE_STRIP_WIDTH);
  const controllers = source.map((curve, index) => (
    index === 0
      ? resampleCurveSurfaceLine(curve, rowCount)
      : orientCurveSurfaceLine(curve, source[0], rowCount)
  ));
  const sides = controllers.map((curve, controllerIndex) => curve.map((_, row) => (
    normalizedDirection(controllerSides?.[controllerIndex]?.[row] || direction, direction)
  )));
  const surfaceColumns = [controllers[0].map((point, row) => offsetPoint(point, sides[0][row], -width))];
  for (let index = 0; index < controllers.length - 1; index += 1) {
    surfaceColumns.push(controllers[index]);
    surfaceColumns.push(controllers[index].map((point, row) => interpolatePoint(
      offsetPoint(point, sides[index][row], width),
      offsetPoint(controllers[index + 1][row], sides[index + 1][row], -width),
      0.5
    )));
  }
  surfaceColumns.push(controllers.at(-1));
  surfaceColumns.push(controllers.at(-1).map((point, row) => offsetPoint(point, sides.at(-1)[row], width)));
  const points = [];
  for (let row = 0; row < rowCount; row += 1) {
    for (const column of surfaceColumns) points.push(column[row]);
  }
  return {
    points,
    columns: surfaceColumns.length,
    rows: rowCount,
    controllerCurves: controllers,
    controllerSides: sides
  };
}

export function curveSurfaceCurveLateralScore(curve, reference, side) {
  if (!curve?.length || !reference?.length) return 0;
  const index = Math.floor(curve.length * 0.5);
  const point = curve[index] || curve.at(-1);
  const referencePoint = reference[index] || reference.at(-1);
  return (
    (pointValue(point, "x") - pointValue(referencePoint, "x")) * pointValue(side, "x")
    + (pointValue(point, "y") - pointValue(referencePoint, "y")) * pointValue(side, "y")
    + (pointValue(point, "z") - pointValue(referencePoint, "z")) * pointValue(side, "z")
  );
}
