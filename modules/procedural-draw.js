import { sampleAsymmetricTaperCurve, sampleScale, sampleTaperCurve } from "./curve-math.js";

export function proceduralAccessoryTaperScale(parentShape, t, offsetX, offsetZ) {
  if (!parentShape) return { x: 1, z: 1 };
  const pointScales = parentShape.pointScales || [{ x: 1, z: 1 }];
  return {
    x: sampleAsymmetricTaperCurve(
      parentShape.taperCurve,
      parentShape.taperCurveSecondary,
      Boolean(parentShape.asymmetricWidthCurve),
      offsetX,
      t
    ) * sampleScale(pointScales, t, "x"),
    z: sampleAsymmetricTaperCurve(
      parentShape.depthCurve,
      parentShape.depthCurveSecondary,
      Boolean(parentShape.asymmetricDepthCurve),
      offsetZ,
      t
    ) * sampleScale(pointScales, t, "z")
  };
}

export function proceduralAccessoryTemplateData(options = {}) {
  const count = Math.max(0, Math.min(24, Math.round(Number(options.count) || 0)));
  const radius = Math.max(0, Number(options.radius) || 0);
  const parentWidth = Math.max(0.001, Number(options.parentWidth) || 1);
  const accessoryWidth = Math.max(0.001, Number(options.accessoryWidth) || 0.32);
  const sampleCount = Math.max(2, Math.min(16, Math.round(Number(options.sampleCount) || 3)));
  const longitudinalPoints = (offsetX = 0, offsetZ = 0) => Array.from(
    { length: sampleCount },
    (_, index) => [offsetX, index === 0 ? 0 : -index / (sampleCount - 1), offsetZ]
  );

  return {
    baseWidth: parentWidth,
    strands: [
      { width: parentWidth, depth: parentWidth, points: longitudinalPoints() },
      ...Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * Math.PI * 2;
        return {
          width: accessoryWidth,
          depth: accessoryWidth,
          radialOffset: [Math.cos(angle) * radius, Math.sin(angle) * radius],
          points: longitudinalPoints(Math.cos(angle) * radius, Math.sin(angle) * radius)
        };
      })
    ]
  };
}

export function proceduralBranchTemplateData(options = {}) {
  const pointCount = Math.max(0, Math.round(Number(options.pointCount) || 0));
  const requestedCount = Math.max(0, Math.min(64, Math.round(Number(options.count) || 0)));
  const count = pointCount >= 2 ? requestedCount : 0;
  const length = Math.max(0.01, Number(options.length) || 0.6);
  // Retain the persisted `tipOffset` field for project compatibility, but
  // interpret it as a pitch ratio. Normalizing the pitched direction keeps
  // the authored branch length independent from its spread.
  const spread = Math.max(0, Math.min(2, Number(options.tipOffset) || 0));
  const lengthCurve = options.lengthCurve;
  const shapeCurve = options.shapeCurve;
  const sampleCount = Math.max(3, Math.min(16, Math.round(Number(options.sampleCount) || 5)));

  if (!count) return [];

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  return Array.from({ length: count }, (_, branchIndex) => {
    // Evenly distribute roots over the full continuous curve. Keeping one
    // equal interval clear at either end avoids placing a branch directly on
    // the parent root or tip while allowing roots between authored points.
    const parameter = (branchIndex + 1) / (count + 1);
    const pointIndex = Math.round(parameter * Math.max(1, pointCount - 1));
    const lengthMultiplier = lengthCurve?.length
      ? Math.max(0, sampleTaperCurve(lengthCurve, parameter))
      : 1;
    const branchLength = length * lengthMultiplier;
    const pitchedDirectionLength = Math.hypot(1, spread);
    const forwardDistance = branchLength / pitchedDirectionLength;
    const spreadDistance = branchLength * spread / pitchedDirectionLength;
    const angle = branchIndex * goldenAngle;
    const offsetX = Math.cos(angle);
    const offsetZ = Math.sin(angle);
    const shapeStart = shapeCurve?.length ? sampleTaperCurve(shapeCurve, 0) : 0;
    const shapeEnd = shapeCurve?.length ? sampleTaperCurve(shapeCurve, 1) : 1;
    const shapeRange = shapeEnd - shapeStart;
    return {
      pointIndex,
      parameter,
      localPoints: Array.from({ length: sampleCount }, (_, sampleIndex) => {
        const t = sampleIndex / (sampleCount - 1);
        if (sampleIndex === 0) return [0, 0, 0];
        const sampledShape = shapeCurve?.length ? sampleTaperCurve(shapeCurve, t) : t;
        const shapeProgress = Math.abs(shapeRange) > 0.000001
          ? (sampledShape - shapeStart) / shapeRange
          : t;
        return [
          offsetX * spreadDistance * shapeProgress,
          forwardDistance * t,
          offsetZ * spreadDistance * shapeProgress
        ];
      })
    };
  });
}
