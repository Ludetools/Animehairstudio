const cloneJsonValue = (value) => JSON.parse(JSON.stringify(value));

const CLUMP_SETTING_FIELDS = Object.freeze([
  "clumpInfluence",
  "clumpSpread",
  "clumpDepthSpread",
  "clumpTipFan",
  "clumpRoll",
  "clumpStrandWidth",
  "clumpStrandDepth",
  "clumpVariation"
]);

const STRAND_SETTING_FIELDS = Object.freeze([
  "twist",
  "taperCurve",
  "depthCurve",
  "taperCurveSecondary",
  "depthCurveSecondary",
  "asymmetricWidthCurve",
  "asymmetricDepthCurve",
  "centerAsymmetricProfile",
  "widthScale",
  "depthScale",
  "profileTrimLeft",
  "profileTrimRight",
  "profileTrimRoundness",
  "hairCard",
  "strandSplitEnabled",
  "strandSplitPosition",
  "strandSplitHeight",
  "strandSplitGap",
  "sweepProfile",
  "profileOffset",
  "rootScalpOffset",
  "hairLayer",
  "radialSegments",
  "lengthSegments",
  "dynamicDensity",
  "densityAggression"
]);

function finitePoint(point) {
  return point
    && Number.isFinite(Number(point.x))
    && Number.isFinite(Number(point.y))
    && Number.isFinite(Number(point.z));
}

function normalizePoints(points) {
  if (!Array.isArray(points) || points.length < 2 || !points.every(finitePoint)) return null;
  return points.map((point) => ({
    x: Number(point.x),
    y: Number(point.y),
    z: Number(point.z)
  }));
}

function normalizeStrand(strand) {
  const points = normalizePoints(strand?.points);
  const width = Number(strand?.width);
  const depth = Number(strand?.depth);
  if (!points || !Number.isFinite(width) || width <= 0 || !Number.isFinite(depth) || depth <= 0) return null;
  const settings = strand.settings && typeof strand.settings === "object" && !Array.isArray(strand.settings)
    ? cloneJsonValue(strand.settings)
    : {};
  return {
    isParent: strand?.isParent === true,
    width,
    depth,
    points,
    pointTwists: Array.isArray(strand.pointTwists)
      ? strand.pointTwists.map((value) => Number(value) || 0)
      : [],
    settings
  };
}

export function normalizeClumpBrushTemplate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const baseWidth = Number(value.baseWidth);
  let strands = Array.isArray(value.strands)
    ? value.strands.slice(0, 64).map(normalizeStrand)
    : [];
  if (!Number.isFinite(baseWidth) || baseWidth <= 0 || strands.length < 2 || strands.some((strand) => !strand)) {
    return null;
  }
  const clumpSettings = {};
  CLUMP_SETTING_FIELDS.forEach((field) => {
    const number = Number(value.clumpSettings?.[field]);
    if (Number.isFinite(number)) clumpSettings[field] = number;
  });
  const parentIndex = strands.findIndex((strand) => strand.isParent);
  const parent = strands[parentIndex >= 0 ? parentIndex : 0];
  strands = [
    { ...parent, isParent: true },
    ...strands
      .filter((_, index) => index !== (parentIndex >= 0 ? parentIndex : 0))
      .map((strand) => ({ ...strand, isParent: false }))
  ];
  return { baseWidth, strands, clumpSettings };
}

export function createClumpBrushTemplate(locks, guideId = null) {
  if (!Array.isArray(locks) || locks.length < 2) return null;
  const guide = locks.find((lock) => lock?.clumpGuide && (!guideId || lock.id === guideId));
  if (!guide) return null;
  const clumpLocks = locks.filter((lock) => lock?.clumpId === guide.clumpId);
  if (clumpLocks.length < 2) return null;
  const orderedLocks = [guide, ...clumpLocks.filter((lock) => lock !== guide)];
  const template = {
    baseWidth: Number(guide.width),
    strands: orderedLocks.map((lock) => {
      const restPoints = lock.clumpGuide
        ? lock.clumpGuideRestPoints
        : lock.clumpRestPoints;
      const restTwists = lock.clumpGuide
        ? lock.clumpGuideRestTwists
        : lock.clumpRestTwists;
      const settings = {};
      STRAND_SETTING_FIELDS.forEach((field) => {
        if (lock[field] !== undefined) settings[field] = cloneJsonValue(lock[field]);
      });
      return {
        isParent: lock === guide,
        width: Number(lock.width),
        depth: Number(lock.depth ?? lock.width),
        points: cloneJsonValue(restPoints?.length >= 2 ? restPoints : lock.points),
        pointTwists: cloneJsonValue(restTwists?.length ? restTwists : lock.pointTwists || []),
        settings
      };
    }),
    clumpSettings: Object.fromEntries(
      CLUMP_SETTING_FIELDS
        .filter((field) => Number.isFinite(Number(guide[field])))
        .map((field) => [field, Number(guide[field])])
    )
  };
  return normalizeClumpBrushTemplate(template);
}
