import { sampleTaperCurve } from "./curve-math.js";
import {
  DEFAULT_SWEEP_PROFILE,
  DEFAULT_TWIST_CURVE,
  SOFT_DOME_SWEEP_PROFILE
} from "./app-config.js?v=20260902-9";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const cleanZero = (value) => Math.abs(value) < 1e-12 ? 0 : value;
const cleanPatternCoordinate = (value) => cleanZero(Number(value.toFixed(12)));
export const PROCEDURAL_BRUSH_PATTERN_FULLNESS = 1.12;

export const DEFAULT_PROCEDURAL_BRUSH_PATTERN_POINTS = Object.freeze([
  Object.freeze({ x: 0, y: 1.4, z: 0 }),
  Object.freeze({ x: 0, y: 0.75, z: 0 }),
  Object.freeze({ x: 0, y: 0.1, z: 0 }),
  Object.freeze({ x: 0, y: -0.55, z: 0 }),
  Object.freeze({ x: 0, y: -1.2, z: 0 })
]);

function freezePatternData(patterns) {
  return Object.freeze(patterns.map((pattern) => Object.freeze(
    pattern.map((point) => Object.freeze({ ...point }))
  )));
}

const THREE_STRAND_BRAID_PATTERNS = freezePatternData([
  [
    { x: -0.21237213870712715, y: 1.4130347068061901, z: 0.06626137918472574 },
    { x: -0.11, y: 1.1833333333333331, z: 0.09 },
    { x: 0.11, y: 0.7499999999999999, z: -0.09 },
    { x: 0.22, y: 0.316666666667, z: 0 },
    { x: 0.11, y: -0.11666666666666692, z: 0.09 },
    { x: -0.11, y: -0.5500000000000003, z: -0.09 },
    { x: -0.22, y: -0.766666666666667, z: 0 },
    { x: -0.212372138702, y: -1.186965293194, z: 0.066261379175 }
  ],
  [
    { x: 0, y: 1.4, z: 0 },
    { x: -0.11, y: 1.1833333333333331, z: -0.09 },
    { x: -0.22, y: 0.75, z: 0 },
    { x: -0.11, y: 0.31666666666666643, z: 0.09 },
    { x: 0.11, y: -0.11666666666666692, z: -0.09 },
    { x: 0.22, y: -0.55, z: 0 },
    { x: 0.1112171502995324, y: -0.9276867451665647, z: 0.07536728554491803 },
    { x: 0, y: -1.2000000000000002, z: 0 }
  ],
  [
    { x: 0.22, y: 1.4, z: 0 },
    { x: 0.11, y: 0.7499999999999999, z: 0.09 },
    { x: -0.11, y: 0.31666666666666643, z: -0.09 },
    { x: -0.22, y: -0.116666666667, z: 0 },
    { x: -0.11, y: -0.5500000000000003, z: 0.09 },
    { x: 0.11, y: -0.9833333333333334, z: -0.09 },
    { x: 0.22, y: -1.2000000000000002, z: 0 }
  ]
]);

function generatedBraidPatterns(strandCount) {
  const count = clamp(Math.round(Number(strandCount) || 3), 2, 5);
  if (count === 3) return THREE_STRAND_BRAID_PATTERNS;
  const laneSpacing = 0.22;
  const laneX = Array.from({ length: count }, (_, laneIndex) => (
    (laneIndex - (count - 1) * 0.5) * laneSpacing
  ));
  const patterns = Array.from({ length: count }, () => []);
  const strandAtLane = Array.from({ length: count }, (_, index) => index);
  const crossingCount = count * (count - 1);
  const appendPoint = (strandIndex, x, t, z = 0) => {
    patterns[strandIndex].push({
      x: cleanPatternCoordinate(x),
      y: cleanPatternCoordinate(1.4 - t * 2.6),
      z: cleanPatternCoordinate(z)
    });
  };
  strandAtLane.forEach((strandIndex, laneIndex) => appendPoint(strandIndex, laneX[laneIndex], 0));
  for (let crossingIndex = 0; crossingIndex < crossingCount; crossingIndex += 1) {
    const leftLane = crossingIndex % (count - 1);
    const rightLane = leftLane + 1;
    const frontLane = leftLane % 2 === 0 ? leftLane : rightLane;
    const backLane = frontLane === leftLane ? rightLane : leftLane;
    const crossingT = (crossingIndex + 0.5) / crossingCount;
    const crossingX = (laneX[leftLane] + laneX[rightLane]) * 0.5;
    appendPoint(strandAtLane[frontLane], crossingX, crossingT, 0.09);
    appendPoint(strandAtLane[backLane], crossingX, crossingT, -0.09);
    [strandAtLane[leftLane], strandAtLane[rightLane]] = [
      strandAtLane[rightLane],
      strandAtLane[leftLane]
    ];
    const boundaryT = (crossingIndex + 1) / crossingCount;
    strandAtLane.forEach((strandIndex, laneIndex) => appendPoint(strandIndex, laneX[laneIndex], boundaryT));
  }
  return freezePatternData(patterns.map((pattern) => reduceProceduralBrushPatternPoints(pattern)));
}

const THREE_STRAND_BRAID_UNIFORM_CURVE = Object.freeze([
  Object.freeze({ position: 0, value: 1, interpolation: "linear" }),
  Object.freeze({ position: 1, value: 1, interpolation: "linear" })
]);
const THREE_STRAND_BRAID_PROFILES = Object.freeze(Array.from({ length: 3 }, () => Object.freeze({
  sweepProfile: SOFT_DOME_SWEEP_PROFILE,
  taperCurve: THREE_STRAND_BRAID_UNIFORM_CURVE,
  depthCurve: THREE_STRAND_BRAID_UNIFORM_CURVE,
  taperCurveSecondary: THREE_STRAND_BRAID_UNIFORM_CURVE,
  depthCurveSecondary: THREE_STRAND_BRAID_UNIFORM_CURVE,
  asymmetricWidthCurve: false,
  asymmetricDepthCurve: false,
  centerAsymmetricProfile: false
})));

export const PROCEDURAL_BRUSH_PATTERN_PRESETS = Object.freeze({
  straight: Object.freeze({
    id: "straight",
    repeatCount: 4,
    curveStep: 0.8,
    layout: Object.freeze({
      pattern: "radial",
      strandCount: 1,
      rootSpread: 1,
      tipSpread: 1,
      rootRotation: 0,
      tipRotation: 0
    }),
    strandPatterns: Object.freeze([DEFAULT_PROCEDURAL_BRUSH_PATTERN_POINTS])
  }),
  "three-strand-braid": Object.freeze({
    id: "three-strand-braid",
    repeatCount: 4,
    curveStep: 0.35,
    bodyScaleY: 0.55,
    layout: Object.freeze({
      pattern: "braid",
      strandCount: 3,
      spacing: 0.356,
      rootSpread: 0,
      tipSpread: 0,
      rootRotation: 0,
      tipRotation: 0
    }),
    strandProfiles: THREE_STRAND_BRAID_PROFILES,
    strandPatterns: THREE_STRAND_BRAID_PATTERNS,
    creationSettings: Object.freeze({
      width: 0.15,
      depth: 0.24,
      widthScale: 1,
      depthScale: 1,
      profileTrimLeft: 0,
      profileTrimRight: 0,
      profileTrimRoundness: 1,
      hairCard: false,
      strandSplitEnabled: false,
      strandSplitPosition: 0,
      strandSplitHeight: 0.3,
      strandSplitGap: 0.12,
      profileOffset: 0,
      rootScalpOffset: 0,
      strandRotation: 0,
      twist: 0,
      twistCurve: DEFAULT_TWIST_CURVE,
      hairLayer: "mid",
      dynamicDensity: false,
      densityAggression: 0.5,
      twistDensity: 0.5,
      taperCurve: THREE_STRAND_BRAID_UNIFORM_CURVE,
      depthCurve: THREE_STRAND_BRAID_UNIFORM_CURVE,
      taperCurveSecondary: THREE_STRAND_BRAID_UNIFORM_CURVE,
      depthCurveSecondary: THREE_STRAND_BRAID_UNIFORM_CURVE,
      asymmetricWidthCurve: false,
      asymmetricDepthCurve: false,
      centerAsymmetricProfile: false,
      sweepProfile: DEFAULT_SWEEP_PROFILE,
      curlCount: 4,
      curlDisplacement: 0.18
    }),
    toolSettings: Object.freeze({
      brushPreset: "standard",
      brushPatternPreset: "three-strand-braid",
      brushPattern: "braid",
      brushStrandCount: 3,
      brushRootPatternEnabled: false,
      brushTipPatternEnabled: false,
      toolSize: 1,
      smoothing: 0.45,
      curveStep: 0.38,
      scalpOffset: 0,
      surfaceNormalInfluence: 1,
      surface: "head",
      dynamicSurface: true,
      autoShowScalp: true,
      continueFromTip: true
    })
  })
});

export function proceduralBrushPatternPreset(presetId) {
  const source = PROCEDURAL_BRUSH_PATTERN_PRESETS[presetId];
  if (!source) return null;
  return {
    id: source.id,
    repeatCount: source.repeatCount,
    curveStep: source.curveStep,
    bodyScaleY: source.bodyScaleY ?? 1,
    layout: { ...source.layout },
    strandProfiles: normalizeProceduralBrushStrandProfiles(
      source.strandProfiles,
      source.layout.strandCount
    ),
    strandPatterns: source.strandPatterns.map((pattern) => pattern.map((point) => ({ ...point }))),
    rootStrandPatterns: null,
    tipStrandPatterns: null,
    creationSettings: source.creationSettings
      ? JSON.parse(JSON.stringify(source.creationSettings))
      : null,
    toolSettings: source.toolSettings
      ? JSON.parse(JSON.stringify(source.toolSettings))
      : null
  };
}

export function proceduralBrushBraidPreset(strandCount = 3) {
  const count = clamp(Math.round(Number(strandCount) || 3), 2, 5);
  const base = proceduralBrushPatternPreset("three-strand-braid");
  return {
    ...base,
    id: `braid-${count}`,
    layout: {
      ...base.layout,
      pattern: "braid",
      strandCount: count
    },
    strandProfiles: normalizeProceduralBrushStrandProfiles(
      Array.from({ length: count }, (_, index) => base.strandProfiles[index % base.strandProfiles.length]),
      count
    ),
    strandPatterns: generatedBraidPatterns(count).map((pattern) => (
      pattern.map((point) => ({ ...point }))
    )),
    toolSettings: {
      ...base.toolSettings,
      brushPatternPreset: "custom",
      brushPattern: "braid",
      brushStrandCount: count
    }
  };
}

const DEFAULT_PROCEDURAL_BRUSH_SHAPE_CURVE = Object.freeze([
  Object.freeze({ position: 0, value: 1, interpolation: "linear" }),
  Object.freeze({ position: 1, value: 1, interpolation: "linear" })
]);

function normalizeProceduralBrushShapeCurve(curve) {
  if (!Array.isArray(curve) || curve.length < 2) {
    return DEFAULT_PROCEDURAL_BRUSH_SHAPE_CURVE.map((point) => ({ ...point }));
  }
  return curve.map((point, index) => ({
    position: clamp(
      Number.isFinite(Number(point?.position)) ? Number(point.position) : index / Math.max(1, curve.length - 1),
      0,
      1
    ),
    value: clamp(Number.isFinite(Number(point?.value)) ? Number(point.value) : 1, 0, 3),
    interpolation: point?.interpolation === "smooth" ? "smooth" : "linear"
  })).sort((left, right) => left.position - right.position);
}

function normalizeProceduralBrushTwistCurve(curve) {
  if (!Array.isArray(curve) || curve.length < 2) {
    return DEFAULT_TWIST_CURVE.map((point) => ({ ...point }));
  }
  return curve.map((point, index) => ({
    position: clamp(
      Number.isFinite(Number(point?.position)) ? Number(point.position) : index / Math.max(1, curve.length - 1),
      0,
      1
    ),
    value: clamp(Number.isFinite(Number(point?.value)) ? Number(point.value) : 0, -4500, 4500),
    interpolation: point?.interpolation === "linear" ? "linear" : "smooth"
  })).sort((left, right) => left.position - right.position);
}

export function linkProceduralBrushCurveEndpoints(curve, editedIndex = 0) {
  if (!curve || curve.length < 2) return curve;
  const value = editedIndex === curve.length - 1 ? curve.at(-1).value : curve[0].value;
  curve[0].value = value;
  curve.at(-1).value = value;
  curve[0].position = 0;
  curve.at(-1).position = 1;
  return curve;
}

export function normalizeProceduralBrushStrandProfiles(profiles, strandCount = 1) {
  const count = clamp(Math.round(Number(strandCount) || 1), 1, 16);
  const source = Array.isArray(profiles) ? profiles : [];
  return Array.from({ length: count }, (_, strandIndex) => {
    const profile = source[strandIndex] || {};
    const taperCurve = linkProceduralBrushCurveEndpoints(normalizeProceduralBrushShapeCurve(profile.taperCurve));
    const depthCurve = linkProceduralBrushCurveEndpoints(normalizeProceduralBrushShapeCurve(profile.depthCurve));
    const twistCurve = normalizeProceduralBrushTwistCurve(profile.twistCurve);
    const sweepProfile = Array.isArray(profile.sweepProfile) && profile.sweepProfile.length >= 4
      ? profile.sweepProfile.map((point) => ({
        x: Number(point?.x) || 0,
        z: Number(point?.z) || 0,
        interpolation: point?.interpolation === "linear" ? "linear" : "smooth"
      }))
      : null;
    return {
      ...(sweepProfile ? { sweepProfile } : {}),
      taperCurve,
      depthCurve,
      twistCurve,
      taperCurveSecondary: linkProceduralBrushCurveEndpoints(normalizeProceduralBrushShapeCurve(profile.taperCurveSecondary || taperCurve)),
      depthCurveSecondary: linkProceduralBrushCurveEndpoints(normalizeProceduralBrushShapeCurve(profile.depthCurveSecondary || depthCurve)),
      asymmetricWidthCurve: Boolean(profile.asymmetricWidthCurve),
      asymmetricDepthCurve: Boolean(profile.asymmetricDepthCurve),
      centerAsymmetricProfile: Boolean(profile.centerAsymmetricProfile)
    };
  });
}

function normalizedPatternPoint(point, fallback) {
  return {
    x: Number.isFinite(Number(point?.x)) ? Number(point.x) : fallback.x,
    y: Number.isFinite(Number(point?.y)) ? Number(point.y) : fallback.y,
    z: Number.isFinite(Number(point?.z)) ? Number(point.z) : fallback.z
  };
}

export function normalizeProceduralBrushPatternPoints(points) {
  if (!Array.isArray(points) || points.length < 2 || points.length > 32) {
    return DEFAULT_PROCEDURAL_BRUSH_PATTERN_POINTS.map((point) => ({ ...point }));
  }
  return points.map((point, index) => normalizedPatternPoint(
    point,
    DEFAULT_PROCEDURAL_BRUSH_PATTERN_POINTS[
      Math.round(index / Math.max(1, points.length - 1) * (DEFAULT_PROCEDURAL_BRUSH_PATTERN_POINTS.length - 1))
    ]
  ));
}

function pointToSegmentDistance(point, start, end) {
  const segment = {
    x: end.x - start.x,
    y: end.y - start.y,
    z: end.z - start.z
  };
  const offset = {
    x: point.x - start.x,
    y: point.y - start.y,
    z: point.z - start.z
  };
  const lengthSquared = segment.x ** 2 + segment.y ** 2 + segment.z ** 2;
  if (lengthSquared < 1e-18) return Math.hypot(offset.x, offset.y, offset.z);
  const t = clamp(
    (offset.x * segment.x + offset.y * segment.y + offset.z * segment.z) / lengthSquared,
    0,
    1
  );
  return Math.hypot(
    point.x - (start.x + segment.x * t),
    point.y - (start.y + segment.y * t),
    point.z - (start.z + segment.z * t)
  );
}

export function reduceProceduralBrushPatternPoints(points, tolerance = 1e-6) {
  const reduced = normalizeProceduralBrushPatternPoints(points);
  const threshold = Math.max(0, Number(tolerance) || 0);
  let changed = true;
  while (changed && reduced.length > 2) {
    changed = false;
    for (let index = 1; index < reduced.length - 1; index += 1) {
      if (pointToSegmentDistance(reduced[index], reduced[index - 1], reduced[index + 1]) > threshold) continue;
      reduced.splice(index, 1);
      changed = true;
      break;
    }
    if (changed) continue;
    for (let index = 1; index < reduced.length - 2; index += 1) {
      const current = reduced[index];
      const next = reduced[index + 1];
      if (Math.hypot(current.x - next.x, current.z - next.z) > threshold) continue;
      reduced.splice(index, 2, {
        x: cleanPatternCoordinate((current.x + next.x) * 0.5),
        y: cleanPatternCoordinate((current.y + next.y) * 0.5),
        z: cleanPatternCoordinate((current.z + next.z) * 0.5)
      });
      changed = true;
      break;
    }
  }
  return reduced;
}

export function normalizeProceduralBrushStrandPatterns(patterns, strandCount = 1, legacyPattern = null) {
  const count = clamp(Math.round(Number(strandCount) || 1), 1, 16);
  const sourcePatterns = Array.isArray(patterns) && patterns.some((pattern) => Array.isArray(pattern))
    ? patterns
    : [];
  const fallback = normalizeProceduralBrushPatternPoints(
    legacyPattern || sourcePatterns[0] || DEFAULT_PROCEDURAL_BRUSH_PATTERN_POINTS
  );
  return Array.from({ length: count }, (_, strandIndex) => normalizeProceduralBrushPatternPoints(
    sourcePatterns[strandIndex] || fallback
  ));
}

function proceduralBrushSectionExtension(bodyPattern, section = "root") {
  const body = normalizeProceduralBrushPatternPoints(bodyPattern);
  const rootSection = section !== "tip";
  const anchorIndex = rootSection ? 0 : body.length - 1;
  const anchor = body[anchorIndex];
  const bodySpan = Math.hypot(
    body.at(-1).x - body[0].x,
    body.at(-1).y - body[0].y,
    body.at(-1).z - body[0].z
  );
  const extensionLength = Math.max(bodySpan, 0.001);
  const outer = {
    x: anchor.x,
    y: anchor.y + (rootSection ? extensionLength : -extensionLength),
    z: anchor.z
  };
  const pointCount = DEFAULT_PROCEDURAL_BRUSH_PATTERN_POINTS.length;
  return Array.from({ length: pointCount }, (_, index) => {
    const t = index / Math.max(1, pointCount - 1);
    const from = rootSection ? outer : anchor;
    const to = rootSection ? anchor : outer;
    return {
      x: cleanPatternCoordinate(from.x + (to.x - from.x) * t),
      y: cleanPatternCoordinate(from.y + (to.y - from.y) * t),
      z: cleanPatternCoordinate(from.z + (to.z - from.z) * t)
    };
  });
}

export function normalizeProceduralBrushSectionPatterns(patterns, bodyPatterns, strandCount = 1, section = "root") {
  const count = clamp(Math.round(Number(strandCount) || 1), 1, 16);
  const normalizedBodies = normalizeProceduralBrushStrandPatterns(bodyPatterns, count);
  const sourcePatterns = Array.isArray(patterns) && patterns.some((pattern) => Array.isArray(pattern))
    ? patterns
    : [];
  return Array.from({ length: count }, (_, strandIndex) => normalizeProceduralBrushPatternPoints(
    sourcePatterns[strandIndex]
      || proceduralBrushSectionExtension(normalizedBodies[strandIndex] || normalizedBodies[0], section)
  ));
}

export function moveProceduralBrushPatternPoint(points, pointIndex, nextPoint, { linkEndpoints = true } = {}) {
  const normalized = normalizeProceduralBrushPatternPoints(points);
  const index = clamp(Math.round(Number(pointIndex) || 0), 0, normalized.length - 1);
  const target = normalizedPatternPoint(nextPoint, normalized[index]);
  const delta = {
    x: target.x - normalized[index].x,
    y: target.y - normalized[index].y,
    z: target.z - normalized[index].z
  };
  normalized[index] = target;
  if (linkEndpoints && (index === 0 || index === normalized.length - 1)) {
    const linkedIndex = index === 0 ? normalized.length - 1 : 0;
    normalized[linkedIndex] = {
      x: cleanPatternCoordinate(normalized[linkedIndex].x + delta.x),
      y: cleanPatternCoordinate(normalized[linkedIndex].y + delta.y),
      z: cleanPatternCoordinate(normalized[linkedIndex].z + delta.z)
    };
  }
  return normalized;
}

export function insertProceduralBrushPatternPoint(points, insertionIndex, point) {
  const normalized = normalizeProceduralBrushPatternPoints(points);
  if (normalized.length >= 32) return null;
  const index = clamp(Math.round(Number(insertionIndex) || 1), 1, normalized.length - 1);
  const fallback = {
    x: (normalized[index - 1].x + normalized[index].x) * 0.5,
    y: (normalized[index - 1].y + normalized[index].y) * 0.5,
    z: (normalized[index - 1].z + normalized[index].z) * 0.5
  };
  normalized.splice(index, 0, normalizedPatternPoint(point, fallback));
  return normalized;
}

export function proceduralBrushPatternPointRemovable(section, pointIndex, pointCount) {
  const index = Math.round(Number(pointIndex));
  const count = Math.max(0, Math.round(Number(pointCount) || 0));
  if (!Number.isInteger(index) || count <= 2 || index < 0 || index >= count) return false;
  if (section === "body") return index > 0 && index < count - 1;
  return !proceduralBrushSectionPointLocked(section, index, count);
}

export function removeProceduralBrushPatternPoint(points, pointIndex, section = "body") {
  const normalized = normalizeProceduralBrushPatternPoints(points);
  const index = Math.round(Number(pointIndex));
  if (!proceduralBrushPatternPointRemovable(section, index, normalized.length)) return null;
  normalized.splice(index, 1);
  return normalized;
}

export function proceduralBrushSectionPointLocked(section, pointIndex, pointCount) {
  const index = Math.round(Number(pointIndex));
  const count = Math.max(0, Math.round(Number(pointCount) || 0));
  if (!Number.isInteger(index) || index < 0 || index >= count) return false;
  if (section === "root") return index === count - 1;
  if (section === "tip") return index === 0;
  return false;
}

export function repeatProceduralBrushPattern(points, repeatCount = 4) {
  const normalized = normalizeProceduralBrushPatternPoints(points);
  const count = clamp(Math.round(Number(repeatCount) || 1), 1, 16);
  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const step = {
    x: last.x - first.x,
    y: last.y - first.y,
    z: last.z - first.z
  };
  return Array.from({ length: count }, (_, repeatIndex) => normalized.map((point) => ({
    x: point.x + step.x * repeatIndex,
    y: point.y + step.y * repeatIndex,
    z: point.z + step.z * repeatIndex
  })));
}

export function normalizeProceduralBrushLayout(options = {}) {
  const pattern = ["linear", "braid"].includes(options.pattern) ? options.pattern : "radial";
  return {
    pattern,
    strandCount: clamp(
      Math.round(Number(options.strandCount) || (pattern === "braid" ? 3 : 1)),
      pattern === "braid" ? 2 : 1,
      pattern === "braid" ? 5 : 16
    ),
    spacing: clamp(Number(options.spacing) || 0.4, 0.01, 4),
    rootSpread: clamp(Number.isFinite(Number(options.rootSpread)) ? Number(options.rootSpread) : 1, 0, 2),
    tipSpread: clamp(Number.isFinite(Number(options.tipSpread)) ? Number(options.tipSpread) : 1, 0, 2),
    rootRotation: clamp(Number(options.rootRotation) || 0, -180, 180),
    tipRotation: clamp(Number(options.tipRotation) || 0, -180, 180)
  };
}

export function proceduralBrushLayoutOffsets(options = {}) {
  const settings = normalizeProceduralBrushLayout(options);
  if (settings.strandCount === 1) {
    return [{ rootX: 0, rootZ: 0, tipX: 0, tipZ: 0 }];
  }
  if (settings.pattern === "braid") {
    return Array.from({ length: settings.strandCount }, () => ({
      rootX: 0,
      rootZ: 0,
      tipX: 0,
      tipZ: 0
    }));
  }

  const rootRotation = settings.rootRotation * Math.PI / 180;
  const tipRotation = settings.tipRotation * Math.PI / 180;

  if (settings.pattern === "linear") {
    const center = (settings.strandCount - 1) / 2;
    return Array.from({ length: settings.strandCount }, (_, index) => {
      const distance = (index - center) * settings.spacing;
      return {
        rootX: cleanZero(Math.cos(rootRotation) * distance * settings.rootSpread),
        rootZ: cleanZero(Math.sin(rootRotation) * distance * settings.rootSpread),
        tipX: cleanZero(Math.cos(tipRotation) * distance * settings.tipSpread),
        tipZ: cleanZero(Math.sin(tipRotation) * distance * settings.tipSpread)
      };
    });
  }

  const radius = settings.spacing / (2 * Math.sin(Math.PI / settings.strandCount));
  return Array.from({ length: settings.strandCount }, (_, index) => {
    const baseAngle = Math.PI / 2 - index / settings.strandCount * Math.PI * 2;
    const rootAngle = baseAngle + rootRotation;
    const tipAngle = baseAngle + tipRotation;
    return {
      rootX: cleanZero(Math.cos(rootAngle) * radius * settings.rootSpread),
      rootZ: cleanZero(Math.sin(rootAngle) * radius * settings.rootSpread),
      tipX: cleanZero(Math.cos(tipAngle) * radius * settings.tipSpread),
      tipZ: cleanZero(Math.sin(tipAngle) * radius * settings.tipSpread)
    };
  });
}

export function normalizeProceduralBrushRecipe(value = {}) {
  const layout = normalizeProceduralBrushLayout(value.layout || value);
  const strandPatterns = normalizeProceduralBrushStrandPatterns(
    value.strandPatterns,
    layout.strandCount,
    value.patternPoints
  );
  const optionalPatterns = (patterns, section) => Array.isArray(patterns)
    ? normalizeProceduralBrushSectionPatterns(patterns, strandPatterns, layout.strandCount, section)
    : null;
  return {
    layout,
    repeatCount: clamp(Math.round(Number(value.repeatCount) || 4), 1, 16),
    curveStep: clamp(Number(value.curveStep) || 0.8, 0.2, 2.5),
    bodyScaleY: clamp(Number(value.bodyScaleY) || 1, 0.25, 4),
    strandPatterns,
    strandProfiles: normalizeProceduralBrushStrandProfiles(
      value.strandProfiles,
      layout.strandCount
    ),
    rootStrandPatterns: optionalPatterns(value.rootStrandPatterns, "root"),
    tipStrandPatterns: optionalPatterns(value.tipStrandPatterns, "tip")
  };
}

export function proceduralBrushTopologySegments(pointCount, authoredSegments = 26) {
  const controlCount = clamp(Math.round(Number(pointCount) || 2), 2, 512);
  const requested = clamp(Math.round(Number(authoredSegments) || 26), 4, 256);
  return clamp(Math.max(requested, (controlCount - 1) * 4), 4, 256);
}

export function proceduralBrushRepeatCountForCurve(curveLength, curveStep = 0.8) {
  const length = Math.max(0, Number(curveLength) || 0);
  const step = clamp(Number(curveStep) || 0.8, 0.2, 2.5);
  return clamp(Math.max(1, Math.round(length / step)), 1, 64);
}

function appendPatternSection(target, points) {
  const normalized = normalizeProceduralBrushPatternPoints(points);
  if (!target.length) {
    normalized.forEach((point) => target.push({ ...point }));
    return target;
  }
  const previous = target.at(-1);
  const first = normalized[0];
  const offset = {
    x: previous.x - first.x,
    y: previous.y - first.y,
    z: previous.z - first.z
  };
  normalized.slice(1).forEach((point) => target.push({
    x: point.x + offset.x,
    y: point.y + offset.y,
    z: point.z + offset.z
  }));
  return target;
}

export function scaleProceduralBrushPatternY(points, scale = 1) {
  const normalized = normalizeProceduralBrushPatternPoints(points);
  const amount = clamp(Number(scale) || 1, 0.25, 4);
  const centerY = (normalized[0].y + normalized.at(-1).y) * 0.5;
  return normalized.map((point) => ({
    x: point.x,
    y: cleanPatternCoordinate(centerY + (point.y - centerY) * amount),
    z: point.z
  }));
}

function patternSectionsFromRecipe(recipe, strandIndex = 0, repeatCountOverride = null) {
  const index = clamp(Math.round(Number(strandIndex) || 0), 0, recipe.layout.strandCount - 1);
  const repeatCount = repeatCountOverride == null
    ? recipe.repeatCount
    : clamp(Math.round(Number(repeatCountOverride) || 1), 1, 64);
  const sections = [];
  const append = (section, pattern, repeatIndex = 0) => {
    const assembled = [];
    if (sections.length) assembled.push({ ...sections.at(-1).points.at(-1) });
    appendPatternSection(assembled, pattern);
    sections.push({ section, repeatIndex, points: assembled });
  };
  const bodyPattern = scaleProceduralBrushPatternY(
    recipe.strandPatterns[index],
    recipe.bodyScaleY
  );
  for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
    append("body", bodyPattern, repeatIndex);
  }
  if (recipe.rootStrandPatterns) {
    const root = normalizeProceduralBrushPatternPoints(recipe.rootStrandPatterns[index]);
    const bodyRoot = sections[0].points[0];
    const rootTip = root.at(-1);
    const offset = {
      x: bodyRoot.x - rootTip.x,
      y: bodyRoot.y - rootTip.y,
      z: bodyRoot.z - rootTip.z
    };
    sections.unshift({
      section: "root",
      repeatIndex: 0,
      points: root.map((point) => ({
        x: point.x + offset.x,
        y: point.y + offset.y,
        z: point.z + offset.z
      }))
    });
  }
  if (recipe.tipStrandPatterns) append("tip", recipe.tipStrandPatterns[index]);
  return sections;
}

export function proceduralBrushPatternSections(value = {}, strandIndex = 0, repeatCountOverride = null) {
  return patternSectionsFromRecipe(
    normalizeProceduralBrushRecipe(value),
    strandIndex,
    repeatCountOverride
  );
}

// Shape curves use the same control-span parameter as the assembled strand.
// Keep recipe curves local; only expand the derived preview/template settings.
export function proceduralBrushRepeatedProfile(profile = {}, sections = []) {
  const spans = sections.map(section => Math.max(0, section.points.length - 1));
  const total = spans.reduce((sum, count) => sum + count, 0);
  if (!total || sections.length < 2) return JSON.parse(JSON.stringify(profile));
  const result = JSON.parse(JSON.stringify(profile));
  for (const key of ['taperCurve', 'depthCurve', 'taperCurveSecondary', 'depthCurveSecondary']) {
    const curve = normalizeProceduralBrushShapeCurve(profile[key] || profile[key.replace('Secondary', '')]);
    // Sample each smooth span before assembly so neighbouring repeats cannot
    // change its Hermite tangents. Authored keys remain exact; recipe stays small.
    const local = [];
    curve.forEach((point, index) => {
      const next = curve[index + 1];
      const count = next && point.interpolation === 'smooth' ? 32 : 1;
      for (let step = 0; step < count; step += 1) {
        const position = next ? point.position + (next.position - point.position) * step / count : point.position;
        local.push({ position, value: step === 0 ? point.value : sampleTaperCurve(curve, position),
          interpolation: point.interpolation === 'constant' ? 'constant' : 'linear' });
      }
    });
    if (local[0].position > 0) local.unshift({...local[0], position:0});
    if (local.at(-1).position < 1) local.push({...local.at(-1), position:1});
    let start = 0;
    const expanded = [];
    spans.forEach(span => {
      if (!span) return;
      local.forEach(point => {
        const next = {...point, position:(start + point.position * span) / total};
        const previous = expanded.at(-1);
        if (previous && Math.abs(previous.position - next.position) < 1e-12) {
          if (previous.value === next.value) { expanded[expanded.length-1] = next; return; }
          // Explicit narrow transition when the authored endpoints do not match.
          previous.position -= Math.min(1e-6, span / total * 1e-4);
          previous.interpolation = 'linear';
        }
        expanded.push(next);
      });
      start += span;
    });
    result[key] = expanded;
  }
  return result;
}

export function proceduralBrushCenteredPatternSections(value = {}, strandIndex = 0, repeatCountOverride = 1) {
  const recipe = normalizeProceduralBrushRecipe(value);
  const index = clamp(Math.round(Number(strandIndex) || 0), 0, recipe.layout.strandCount - 1);
  const sections = patternSectionsFromRecipe(recipe, index, repeatCountOverride);
  const bodySections = sections.filter((segment) => segment.section === "body");
  const centerBody = bodySections[Math.floor(bodySections.length / 2)];
  const authoredAnchor = scaleProceduralBrushPatternY(
    recipe.strandPatterns[index],
    recipe.bodyScaleY
  )[0];
  const assembledAnchor = centerBody?.points?.[0];
  if (!authoredAnchor || !assembledAnchor) return sections;
  const offset = {
    x: authoredAnchor.x - assembledAnchor.x,
    y: authoredAnchor.y - assembledAnchor.y,
    z: authoredAnchor.z - assembledAnchor.z
  };
  return sections.map((segment) => ({
    ...segment,
    points: segment.points.map((point) => ({
      x: cleanPatternCoordinate(point.x + offset.x),
      y: cleanPatternCoordinate(point.y + offset.y),
      z: cleanPatternCoordinate(point.z + offset.z)
    }))
  }));
}

function compiledPatternPointsFromRecipe(recipe, strandIndex = 0, repeatCountOverride = null) {
  const points = [];
  patternSectionsFromRecipe(recipe, strandIndex, repeatCountOverride).forEach((segment) => {
    segment.points.forEach((point, pointIndex) => {
      if (points.length && pointIndex === 0) return;
      points.push({ ...point });
    });
  });
  return points;
}

export function proceduralBrushPatternPoints(value = {}, strandIndex = 0, repeatCountOverride = null) {
  return compiledPatternPointsFromRecipe(
    normalizeProceduralBrushRecipe(value),
    strandIndex,
    repeatCountOverride
  );
}

export function proceduralBrushPathParameters(points = []) {
  if (!Array.isArray(points) || points.length === 0) return [];
  if (points.length === 1) return [0];
  const yAt = (point) => Number(Array.isArray(point) ? point[1] : point?.y) || 0;
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distances.push(distances.at(-1) + Math.abs(yAt(points[index]) - yAt(points[index - 1])));
  }
  const total = distances.at(-1);
  if (total < 1e-9) return points.map((_, index) => index / Math.max(1, points.length - 1));
  return distances.map((distance) => distance / total);
}

function maximumCurveValue(curve, fallback = 1) {
  if (!Array.isArray(curve) || !curve.length) return fallback;
  return Math.max(fallback, ...curve.map((point) => Number(point?.value) || 0));
}

export function proceduralBrushPatternFootprint(strands = [], fallbackSize = 0.16) {
  const fallback = Math.max(0.001, Number(fallbackSize) || 0.16);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  strands.forEach((strand) => {
    if (!Array.isArray(strand?.points) || !strand.points.length) return;
    const settings = strand.settings && typeof strand.settings === "object" ? strand.settings : {};
    const widthScale = Math.max(0.001, Number(settings.widthScale) || 1) * Math.max(
      maximumCurveValue(settings.taperCurve),
      maximumCurveValue(settings.taperCurveSecondary)
    );
    const depthScale = Math.max(0.001, Number(settings.depthScale) || 1) * Math.max(
      maximumCurveValue(settings.depthCurve),
      maximumCurveValue(settings.depthCurveSecondary)
    );
    const halfWidth = Math.max(0.0005, Number(strand.width) || fallback) * widthScale * 0.5;
    const halfDepth = Math.max(0.0005, Number(strand.depth ?? strand.width) || fallback) * depthScale * 0.5;
    strand.points.forEach((point) => {
      const x = Number(Array.isArray(point) ? point[0] : point?.x) || 0;
      const z = Number(Array.isArray(point) ? point[2] : point?.z) || 0;
      minX = Math.min(minX, x - halfWidth);
      maxX = Math.max(maxX, x + halfWidth);
      minZ = Math.min(minZ, z - halfDepth);
      maxZ = Math.max(maxZ, z + halfDepth);
    });
  });
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return fallback;
  return Math.max(fallback, maxX - minX, maxZ - minZ);
}

export function proceduralBrushTemplateData(value = {}, options = {}) {
  const recipe = normalizeProceduralBrushRecipe(value);
  const repeatCount = options.repeatCount == null
    ? recipe.repeatCount
    : clamp(Math.round(Number(options.repeatCount) || 1), 1, 64);
  const baseWidth = Math.max(0.001, Number(options.baseWidth) || 0.16);
  const depth = Math.max(0.001, Number(options.depth) || baseWidth);
  const settings = options.settings && typeof options.settings === "object"
    ? JSON.parse(JSON.stringify(options.settings))
    : {};
  const placements = proceduralBrushLayoutOffsets(recipe.layout);
  const guideSegment = compiledPatternPointsFromRecipe(recipe, 0, repeatCount)
    .map((point) => ({ x: 0, y: point.y, z: 0 }));
  const strands = [{
    width: baseWidth,
    depth,
    points: guideSegment.map((point) => [point.x, point.y, point.z]),
    pathParameters: proceduralBrushPathParameters(guideSegment),
    pointTwists: []
  }];
  recipe.strandPatterns.forEach((pattern, strandIndex) => {
    const placement = placements[strandIndex] || placements[0];
    const compiled = compiledPatternPointsFromRecipe(recipe, strandIndex, repeatCount);
    const placed = compiled.map((point, pointIndex) => {
      const t = pointIndex / Math.max(1, compiled.length - 1);
      return {
        x: point.x + placement.rootX + (placement.tipX - placement.rootX) * t,
        y: point.y,
        z: point.z + placement.rootZ + (placement.tipZ - placement.rootZ) * t
      };
    });
    const points = placed.map((point) => [point.x, point.y, point.z]);
    const profile = proceduralBrushRepeatedProfile(recipe.strandProfiles[strandIndex] || {}, patternSectionsFromRecipe(recipe, strandIndex, repeatCount));
    strands.push({
      width: baseWidth,
      depth,
      points,
      pathParameters: proceduralBrushPathParameters(points),
      pointTwists: points.map(() => 0),
      settings: {
        ...JSON.parse(JSON.stringify(settings)),
        ...JSON.parse(JSON.stringify(profile))
      }
    });
  });
  const authoredStrandSize = Math.max(baseWidth, depth);
  const measuredFootprint = proceduralBrushPatternFootprint(strands.slice(1), authoredStrandSize);
  const patternFootprint = measuredFootprint > authoredStrandSize * 1.001
    ? measuredFootprint / PROCEDURAL_BRUSH_PATTERN_FULLNESS
    : measuredFootprint;
  strands[0].width = patternFootprint;
  strands[0].depth = patternFootprint;
  strands[0].pointTwists = strands[0].points.map(() => 0);
  return {
    baseWidth: patternFootprint,
    proceduralBrushBaseStrandWidth: baseWidth,
    proceduralBrushBaseStrandDepth: depth,
    strands,
    proceduralBrush: true,
    proceduralBrushRecipe: recipe,
    proceduralBrushRepeatCount: repeatCount
  };
}
