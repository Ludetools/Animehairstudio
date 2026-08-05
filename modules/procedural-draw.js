import { sampleAsymmetricTaperCurve, sampleScale } from "./curve-math.js";

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
  const count = Math.max(1, Math.min(24, Math.round(Number(options.count) || 1)));
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
