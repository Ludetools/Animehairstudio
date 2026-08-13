export const DEFAULT_ARC_HAIR_SURFACE = Object.freeze({
  width: 1.6,
  arcHeight: 0.9,
  legLength: 0.8,
  depth: 1.2,
  arcSegments: 8,
  legSegments: 3,
  depthSegments: 5
});

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeArcHairSurfaceSettings(settings = {}) {
  return {
    width: clamp(finiteNumber(settings.width, DEFAULT_ARC_HAIR_SURFACE.width), 0.2, 6),
    arcHeight: clamp(finiteNumber(settings.arcHeight, DEFAULT_ARC_HAIR_SURFACE.arcHeight), 0.1, 4),
    legLength: clamp(finiteNumber(settings.legLength, DEFAULT_ARC_HAIR_SURFACE.legLength), 0, 4),
    depth: clamp(finiteNumber(settings.depth, DEFAULT_ARC_HAIR_SURFACE.depth), 0.1, 6),
    arcSegments: clamp(Math.round(finiteNumber(settings.arcSegments, DEFAULT_ARC_HAIR_SURFACE.arcSegments)), 2, 32),
    legSegments: clamp(Math.round(finiteNumber(settings.legSegments, DEFAULT_ARC_HAIR_SURFACE.legSegments)), 1, 24),
    depthSegments: clamp(Math.round(finiteNumber(settings.depthSegments, DEFAULT_ARC_HAIR_SURFACE.depthSegments)), 1, 32)
  };
}

function arcCrossSection(settings) {
  const halfWidth = settings.width * 0.5;
  const points = [];
  for (let index = 0; index < settings.legSegments; index += 1) {
    points.push({
      x: -halfWidth,
      y: -settings.legLength + settings.legLength * index / settings.legSegments
    });
  }
  for (let index = 0; index <= settings.arcSegments; index += 1) {
    const angle = Math.PI - Math.PI * index / settings.arcSegments;
    points.push({
      x: Math.cos(angle) * halfWidth,
      y: Math.sin(angle) * settings.arcHeight
    });
  }
  for (let index = 1; index <= settings.legSegments; index += 1) {
    points.push({
      x: halfWidth,
      y: -settings.legLength * index / settings.legSegments
    });
  }
  return points;
}

export function createArcHairSurfaceGrid(settings = {}) {
  const normalized = normalizeArcHairSurfaceSettings(settings);
  const crossSection = arcCrossSection(normalized);
  const columns = crossSection.length;
  const rows = normalized.depthSegments + 1;
  const points = [];
  const faces = [];

  for (let row = 0; row < rows; row += 1) {
    const z = -normalized.depth * 0.5 + normalized.depth * row / normalized.depthSegments;
    crossSection.forEach((point) => points.push({ x: point.x, y: point.y, z }));
  }

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const current = row * columns + column;
      const nextRow = current + columns;
      faces.push([current, nextRow, nextRow + 1, current + 1]);
    }
  }

  return {
    settings: normalized,
    columns,
    rows,
    points,
    faces
  };
}
