import test from "node:test";
import assert from "node:assert/strict";
import {
  curveDeformedCapsulePoints,
  parallelTransportFrames,
  polylineLength,
  resamplePolyline,
  sampleCapsuleRadialProfile,
  scaleCapsuleRadialLoops
} from "../modules/capsule-curve.js";

test("resamples capsule centerlines uniformly while preserving endpoints", () => {
  const points = [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 3, z: 0 }];
  const samples = resamplePolyline(points, 5);
  assert.deepEqual(samples[0], points[0]);
  assert.deepEqual(samples.at(-1), points.at(-1));
  assert.equal(polylineLength(points), 4);
  const distances = samples.slice(1).map((point, index) => Math.hypot(
    point.x - samples[index].x,
    point.y - samples[index].y,
    point.z - samples[index].z
  ));
  distances.forEach((distance) => assert.ok(distance <= 1.01));
});

test("parallel transport frames stay orthonormal through a bend", () => {
  const frames = parallelTransportFrames([
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 1, y: -1, z: 0 }
  ], 25, { x: 0, y: 0, z: 1 });
  frames.forEach(({ tangent, side, normal }) => {
    assert.ok(Math.abs(tangent.x * side.x + tangent.y * side.y + tangent.z * side.z) < 1e-6);
    assert.ok(Math.abs(tangent.x * normal.x + tangent.y * normal.y + tangent.z * normal.z) < 1e-6);
    assert.ok(Math.abs(Math.hypot(normal.x, normal.y, normal.z) - 1) < 1e-6);
  });
  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1].normal;
    const current = frames[index].normal;
    assert.ok(previous.x * current.x + previous.y * current.y + previous.z * current.z > 0.9);
  }
});

test("deforms capsule rings around the authored center curve", () => {
  const deformed = curveDeformedCapsulePoints({
    centerline: [{ x: 0, y: 1, z: 0 }, { x: 0.5, y: 0, z: 0 }, { x: 1, y: -1, z: 0 }],
    guideLength: 2,
    preferredNormal: { x: 0, y: 0, z: 1 },
    cagePoints: [
      { x: 0, y: 1, z: 0 },
      { x: 0.2, y: 0, z: 0 },
      { x: 0, y: -1, z: 0 }
    ]
  });
  assert.deepEqual(deformed[0], { x: 0, y: 1, z: 0 });
  assert.deepEqual(deformed.at(-1), { x: 1, y: -1, z: 0 });
  assert.ok(Math.hypot(deformed[1].x - 0.5, deformed[1].y, deformed[1].z) > 0.19);
});

test("combined width and depth profiles taper the cage toward a capped curve tip", () => {
  const profile = [{ t: 0, value: 1 }, { t: 0.5, value: 0.75 }, { t: 1, value: 0.1 }];
  assert.equal(sampleCapsuleRadialProfile(profile, 0), 1);
  assert.equal(sampleCapsuleRadialProfile(profile, 1), 0.1);
  const deformed = curveDeformedCapsulePoints({
    centerline: [{ x: 0, y: 0, z: 0 }, { x: 0, y: -2, z: 0 }],
    guideLength: 2,
    preferredNormal: { x: 0, y: 0, z: 1 },
    radialProfile: profile,
    capAtEnd: true,
    cagePoints: [
      { x: 0.4, y: -1, z: 0 },
      { x: 0.4, y: 1, z: 0 }
    ]
  });
  assert.ok(Math.abs(deformed[0].x) > 0.39);
  assert.ok(Math.abs(deformed[1].x) < 0.05);
  assert.deepEqual({ y: deformed[0].y, tipY: deformed[1].y }, { y: 0, tipY: -2 });
});

test("capsule radius scaling preserves curved radial-loop centers", () => {
  const points = [
    { x: 1, y: 2, z: 0 },
    { x: 2, y: 3, z: 0 },
    { x: 1, y: 4, z: 0 },
    { x: 0, y: 3, z: 0 },
    { x: -1, y: 5, z: 2 },
    { x: 0, y: 6, z: 2 },
    { x: -1, y: 7, z: 2 },
    { x: -2, y: 6, z: 2 },
    { x: 4, y: 9, z: 3 }
  ];
  const scaled = scaleCapsuleRadialLoops(points, [[0, 1, 2, 3], [4, 5, 6, 7]], 2);
  assert.deepEqual(scaled.slice(0, 4), [
    { x: 1, y: 1, z: 0 },
    { x: 3, y: 3, z: 0 },
    { x: 1, y: 5, z: 0 },
    { x: -1, y: 3, z: 0 }
  ]);
  assert.deepEqual(scaled.slice(4, 8), [
    { x: -1, y: 4, z: 2 },
    { x: 1, y: 6, z: 2 },
    { x: -1, y: 8, z: 2 },
    { x: -3, y: 6, z: 2 }
  ]);
  assert.deepEqual(scaled[8], points[8]);
});
