export const GREASE_PENCIL_LAYERS = Object.freeze(["background", "front", "left", "right", "back"]);

export function normalizeGreasePencilLayer(value) {
  return GREASE_PENCIL_LAYERS.includes(value) ? value : "background";
}

export function normalizeGreasePencilColor(value, fallback = "#ff4fd8") {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

export function normalizeGreasePencilSize(value, fallback = 3) {
  const size = Number(value);
  return Math.max(1, Math.min(20, Number.isFinite(size) ? size : fallback));
}

export function normalizeGreasePencilSmoothing(value, fallback = 1) {
  const smoothing = Number(value);
  return Math.max(0, Math.min(1, Number.isFinite(smoothing) ? smoothing : fallback));
}

export function normalizeGreasePencilKind(value) {
  return value === "shape" ? "shape" : "stroke";
}

export function normalizeGreasePencilOperation(value) {
  return value === "trim" ? "trim" : "add";
}

export function normalizeGreasePencilPoint(point, layer = "background") {
  const dimensions = normalizeGreasePencilLayer(layer) === "background" ? ["x", "y"] : ["x", "y", "z"];
  const normalized = {};
  dimensions.forEach((axis) => {
    const value = Number(point?.[axis]);
    normalized[axis] = Number.isFinite(value) ? value : 0;
  });
  return normalized;
}

export function normalizeGreasePencilStroke(stroke, index = 0) {
  const layer = normalizeGreasePencilLayer(stroke?.layer);
  return {
    id: String(stroke?.id || `grease-stroke-${index + 1}`),
    layer,
    color: normalizeGreasePencilColor(stroke?.color),
    size: normalizeGreasePencilSize(stroke?.size),
    smoothing: normalizeGreasePencilSmoothing(stroke?.smoothing),
    kind: normalizeGreasePencilKind(stroke?.kind),
    operation: normalizeGreasePencilOperation(stroke?.operation),
    panelId: String(stroke?.panelId || "") || null,
    mirrorStrokeId: String(stroke?.mirrorStrokeId || "") || null,
    points: (stroke?.points || []).map((point) => normalizeGreasePencilPoint(point, layer))
  };
}

export function greasePencilMirrorLayer(layer) {
  const normalizedLayer = normalizeGreasePencilLayer(layer);
  if (normalizedLayer === "left") return "right";
  if (normalizedLayer === "right") return "left";
  return normalizedLayer;
}

export function smoothGreasePencilPoints(points, layer = "background", passes = 2, strength = 1) {
  const normalizedLayer = normalizeGreasePencilLayer(layer);
  let smoothed = (points || []).map((point) => normalizeGreasePencilPoint(point, normalizedLayer));
  const dimensions = normalizedLayer === "background" ? ["x", "y"] : ["x", "y", "z"];
  const passCount = Math.max(0, Math.min(4, Math.floor(Number(passes) || 0)));
  const smoothing = normalizeGreasePencilSmoothing(strength);
  if (smoothing <= 0) return smoothed;
  const cut = 0.25 * smoothing;
  for (let pass = 0; pass < passCount && smoothed.length > 2; pass += 1) {
    const next = [smoothed[0]];
    for (let index = 0; index < smoothed.length - 1; index += 1) {
      const start = smoothed[index];
      const end = smoothed[index + 1];
      const nearStart = {};
      const nearEnd = {};
      dimensions.forEach((axis) => {
        nearStart[axis] = start[axis] * (1 - cut) + end[axis] * cut;
        nearEnd[axis] = start[axis] * cut + end[axis] * (1 - cut);
      });
      next.push(nearStart, nearEnd);
    }
    next.push(smoothed.at(-1));
    smoothed = next;
  }
  return smoothed;
}

export function smoothGreasePencilClosedPoints(points, layer = "background", passes = 2, strength = 1) {
  const normalizedLayer = normalizeGreasePencilLayer(layer);
  let smoothed = (points || []).map((point) => normalizeGreasePencilPoint(point, normalizedLayer));
  const dimensions = normalizedLayer === "background" ? ["x", "y"] : ["x", "y", "z"];
  const passCount = Math.max(0, Math.min(4, Math.floor(Number(passes) || 0)));
  const smoothing = normalizeGreasePencilSmoothing(strength);
  if (smoothing <= 0 || smoothed.length < 3) return smoothed;
  const cut = 0.25 * smoothing;
  for (let pass = 0; pass < passCount; pass += 1) {
    const next = [];
    for (let index = 0; index < smoothed.length; index += 1) {
      const start = smoothed[index];
      const end = smoothed[(index + 1) % smoothed.length];
      const nearStart = {};
      const nearEnd = {};
      dimensions.forEach((axis) => {
        nearStart[axis] = start[axis] * (1 - cut) + end[axis] * cut;
        nearEnd[axis] = start[axis] * cut + end[axis] * (1 - cut);
      });
      next.push(nearStart, nearEnd);
    }
    smoothed = next;
  }
  return smoothed;
}

export function greasePencilPlaneOrigin(layer, target = {}, distance = 2.4) {
  const normalizedLayer = normalizeGreasePencilLayer(layer);
  const origin = {
    x: Number.isFinite(Number(target?.x)) ? Number(target.x) : 0,
    y: Number.isFinite(Number(target?.y)) ? Number(target.y) : 0,
    z: Number.isFinite(Number(target?.z)) ? Number(target.z) : 0
  };
  const offset = Math.max(0, Number(distance) || 0);
  if (normalizedLayer === "front") origin.z += offset;
  else if (normalizedLayer === "back") origin.z -= offset;
  else if (normalizedLayer === "left") origin.x -= offset;
  else if (normalizedLayer === "right") origin.x += offset;
  return origin;
}

export function greasePencilPointDistanceSquared(point, target) {
  const dx = Number(point?.x || 0) - Number(target?.x || 0);
  const dy = Number(point?.y || 0) - Number(target?.y || 0);
  return dx * dx + dy * dy;
}

export function greasePencilSegmentDistanceSquared(point, start, end) {
  const dx = Number(end?.x || 0) - Number(start?.x || 0);
  const dy = Number(end?.y || 0) - Number(start?.y || 0);
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-12) return greasePencilPointDistanceSquared(point, start);
  const amount = Math.max(0, Math.min(1, (
    (Number(point?.x || 0) - Number(start?.x || 0)) * dx
    + (Number(point?.y || 0) - Number(start?.y || 0)) * dy
  ) / lengthSquared));
  return greasePencilPointDistanceSquared(point, {
    x: Number(start?.x || 0) + dx * amount,
    y: Number(start?.y || 0) + dy * amount
  });
}
