export function normalizeCurvePointSharpness(values, pointCount) {
  const count = Math.max(0, Math.round(Number(pointCount) || 0));
  return Array.from({ length: count }, (_, index) => {
    const value = Number(values?.[index] ?? 0);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  });
}

export function curveSegmentCoordinates(t, pointCount) {
  const count = Math.max(0, Math.round(Number(pointCount) || 0));
  if (count < 2) return { index: 0, amount: 0 };
  const scaled = Math.min(1, Math.max(0, Number(t) || 0)) * (count - 1);
  const index = Math.min(count - 2, Math.floor(scaled));
  return { index, amount: scaled - index };
}

export function curveSegmentSharpness(values, segmentIndex, pointCount) {
  const normalized = normalizeCurvePointSharpness(values, pointCount);
  const index = Math.min(Math.max(0, Math.round(Number(segmentIndex) || 0)), Math.max(0, normalized.length - 2));
  return Math.max(normalized[index] || 0, normalized[index + 1] || 0);
}

export function alignCurveParametersToSharpControls(parameters, values, pointCount, bevel = false, removeApex = false, apexFlow = 1) {
  const aligned = (parameters || []).map(Number);
  const sharpness = normalizeCurvePointSharpness(values, pointCount);
  if (aligned.length < 3 || sharpness.length < 3) return aligned;

  for (let controlIndex = 1; controlIndex < sharpness.length - 1; controlIndex += 1) {
    if (sharpness[controlIndex] <= 0.001) continue;
    const target = controlIndex / (sharpness.length - 1);
    const exactIndex = aligned.findIndex((parameter) => Math.abs(parameter - target) <= 1e-7);
    if (exactIndex >= 0) continue;
    let bestIndex = -1;
    let bestDistance = Infinity;
    for (let index = 1; index < aligned.length - 1; index += 1) {
      if (target <= aligned[index - 1] + 1e-7 || target >= aligned[index + 1] - 1e-7) continue;
      const distance = Math.abs(aligned[index] - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    if (bestIndex >= 0) aligned[bestIndex] = target;
  }

  if (!bevel) return aligned;

  const sharpRows = new Map();
  for (let controlIndex = 1; controlIndex < sharpness.length - 1; controlIndex += 1) {
    if (sharpness[controlIndex] <= 0.001) continue;
    const target = controlIndex / (sharpness.length - 1);
    const rowIndex = aligned.findIndex((parameter) => Math.abs(parameter - target) <= 1e-7);
    if (rowIndex > 0 && rowIndex < aligned.length - 1) {
      sharpRows.set(rowIndex, { target, sharpness: sharpness[controlIndex] });
    }
  }

  const beveled = [...aligned];
  const supportParameters = [];
  sharpRows.forEach(({ target, sharpness: amount }, rowIndex) => {
    // At the softest usable sharpness the support sits halfway across the
    // existing surface span. Increasing sharpness slides it toward the apex
    // without ever collapsing it onto the apex row.
    const surfaceBlend = 0.5 + amount * 0.4;
    const neighbors = [aligned[rowIndex - 1], aligned[rowIndex + 1]];
    neighbors.forEach((neighborParameter) => {
      const parameter = neighborParameter + (target - neighborParameter) * surfaceBlend;
      if (Math.abs(parameter - target) <= 1e-7) return;
      beveled.push(parameter);
      supportParameters.push({ parameter, apexParameter: target, neighborParameter, surfaceBlend });
    });
  });
  beveled.sort((a, b) => a - b);
  const result = beveled.filter((parameter, index) => (
    index === 0 || parameter - beveled[index - 1] > 1e-7
  ));
  const bevelSupports = supportParameters.map((support) => ({
    rowIndex: result.findIndex((parameter) => Math.abs(parameter - support.parameter) <= 1e-7),
    apexRowIndex: result.findIndex((parameter) => Math.abs(parameter - support.apexParameter) <= 1e-7),
    neighborRowIndex: result.findIndex((parameter) => Math.abs(parameter - support.neighborParameter) <= 1e-7),
    surfaceBlend: support.surfaceBlend
  })).filter((support) => (
    support.rowIndex >= 0
    && support.apexRowIndex >= 0
    && support.neighborRowIndex >= 0
  ));
  Object.defineProperty(result, "bevelSupports", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: bevelSupports
  });
  Object.defineProperty(result, "omittedRows", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: removeApex
      ? [...new Set(bevelSupports.map((support) => support.apexRowIndex))].sort((a, b) => a - b)
      : []
  });
  Object.defineProperty(result, "apexFlow", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Math.min(1, Math.max(0, Number(apexFlow) || 0))
  });
  return result;
}

export function curveTopologyRowIndices(parameters) {
  const omitted = new Set(Array.isArray(parameters?.omittedRows) ? parameters.omittedRows : []);
  return Array.from({ length: parameters?.length || 0 }, (_, index) => index)
    .filter((index) => !omitted.has(index));
}

export function slideCurveBevelSupportRows(parameters, rowSize, values, itemSize = 3, vertexOffset = 0, normalizeDirection = false) {
  const supports = parameters?.bevelSupports;
  const columns = Math.max(0, Math.round(Number(rowSize) || 0));
  const components = Math.max(1, Math.round(Number(itemSize) || 0));
  if (!Array.isArray(supports) || !supports.length || !Array.isArray(values) || columns <= 0) return values;
  supports.forEach((support) => {
    for (let column = 0; column < columns; column += 1) {
      const supportIndex = (vertexOffset + support.rowIndex * columns + column) * components;
      const neighborIndex = (vertexOffset + support.neighborRowIndex * columns + column) * components;
      const apexIndex = (vertexOffset + support.apexRowIndex * columns + column) * components;
      for (let component = 0; component < components; component += 1) {
        values[supportIndex + component] = values[neighborIndex + component]
          + (values[apexIndex + component] - values[neighborIndex + component]) * support.surfaceBlend;
      }
      if (normalizeDirection && components >= 3) {
        const magnitude = Math.hypot(
          values[supportIndex],
          values[supportIndex + 1],
          values[supportIndex + 2]
        );
        if (magnitude > 1e-8) {
          values[supportIndex] /= magnitude;
          values[supportIndex + 1] /= magnitude;
          values[supportIndex + 2] /= magnitude;
        }
      }
    }
  });
  return values;
}

export function flowCurveBevelApexRows(parameters, rowSize, values, itemSize = 3, vertexOffset = 0, normalizeDirection = false) {
  const supports = parameters?.bevelSupports;
  const omittedRows = new Set(Array.isArray(parameters?.omittedRows) ? parameters.omittedRows : []);
  const columns = Math.max(0, Math.round(Number(rowSize) || 0));
  const components = Math.max(1, Math.round(Number(itemSize) || 0));
  if (!Array.isArray(supports) || !supports.length || !Array.isArray(values) || columns <= 0) return values;
  const supportsByApex = new Map();
  supports.forEach((support) => {
    if (omittedRows.has(support.apexRowIndex)) return;
    if (!supportsByApex.has(support.apexRowIndex)) supportsByApex.set(support.apexRowIndex, []);
    supportsByApex.get(support.apexRowIndex).push(support.rowIndex);
  });
  supportsByApex.forEach((supportRows, apexRowIndex) => {
    const leftRow = supportRows.filter((row) => row < apexRowIndex).sort((a, b) => b - a)[0];
    const rightRow = supportRows.filter((row) => row > apexRowIndex).sort((a, b) => a - b)[0];
    if (leftRow == null || rightRow == null) return;
    for (let column = 0; column < columns; column += 1) {
      const apexIndex = (vertexOffset + apexRowIndex * columns + column) * components;
      const leftIndex = (vertexOffset + leftRow * columns + column) * components;
      const rightIndex = (vertexOffset + rightRow * columns + column) * components;
      for (let component = 0; component < components; component += 1) {
        const flowedValue = (values[leftIndex + component] + values[rightIndex + component]) * 0.5;
        const flow = Number.isFinite(Number(parameters.apexFlow)) ? parameters.apexFlow : 1;
        values[apexIndex + component] += (flowedValue - values[apexIndex + component]) * flow;
      }
      if (normalizeDirection && components >= 3) {
        const magnitude = Math.hypot(
          values[apexIndex],
          values[apexIndex + 1],
          values[apexIndex + 2]
        );
        if (magnitude > 1e-8) {
          values[apexIndex] /= magnitude;
          values[apexIndex + 1] /= magnitude;
          values[apexIndex + 2] /= magnitude;
        }
      }
    }
  });
  return values;
}

function pointComponents(point) {
  if (Array.isArray(point)) return point.slice(0, 3).map((value) => Number(value) || 0);
  return [Number(point?.x) || 0, Number(point?.y) || 0, Number(point?.z) || 0];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function length(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector) {
  const magnitude = length(vector);
  return magnitude > 1e-8 ? vector.map((value) => value / magnitude) : [0, 0, 0];
}

export function sharpCurveJointData(points, values, parameter, maxMiterScale = 2.25) {
  const pointCount = points?.length || 0;
  const sharpnessValues = normalizeCurvePointSharpness(values, pointCount);
  if (pointCount < 3) return null;
  const scaled = Math.min(1, Math.max(0, Number(parameter) || 0)) * (pointCount - 1);
  const controlIndex = Math.round(scaled);
  if (
    controlIndex <= 0
    || controlIndex >= pointCount - 1
    || Math.abs(scaled - controlIndex) > 1e-5
    || sharpnessValues[controlIndex] <= 0.001
  ) return null;

  const previous = pointComponents(points[controlIndex - 1]);
  const current = pointComponents(points[controlIndex]);
  const next = pointComponents(points[controlIndex + 1]);
  const incoming = normalize(subtract(current, previous));
  const outgoing = normalize(subtract(next, current));
  if (length(incoming) < 0.5 || length(outgoing) < 0.5) return null;
  const bisector = normalize([
    incoming[0] + outgoing[0],
    incoming[1] + outgoing[1],
    incoming[2] + outgoing[2]
  ]);
  const bendDirection = normalize([
    outgoing[0] - incoming[0],
    outgoing[1] - incoming[1],
    outgoing[2] - incoming[2]
  ]);
  if (length(bisector) < 0.5 || length(bendDirection) < 0.5) return null;
  const tangentDot = Math.min(1, Math.max(-1, (
    incoming[0] * outgoing[0]
    + incoming[1] * outgoing[1]
    + incoming[2] * outgoing[2]
  )));
  const rawMiterScale = 1 / Math.max(0.001, Math.cos(Math.acos(tangentDot) * 0.5));
  const sharpness = sharpnessValues[controlIndex];
  const clampedMiterScale = Math.min(Math.max(1, Number(maxMiterScale) || 1), rawMiterScale);
  return {
    controlIndex,
    sharpness,
    incoming,
    outgoing,
    bisector,
    bendDirection,
    miterScale: 1 + (clampedMiterScale - 1) * sharpness
  };
}
