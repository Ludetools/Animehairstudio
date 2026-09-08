import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROCEDURAL_BRUSH_PATTERN_POINTS,
  PROCEDURAL_BRUSH_PATTERN_FULLNESS,
  insertProceduralBrushPatternPoint,
  moveProceduralBrushPatternPoint,
  normalizeProceduralBrushLayout,
  normalizeProceduralBrushPatternPoints,
  normalizeProceduralBrushRecipe,
  normalizeProceduralBrushSectionPatterns,
  normalizeProceduralBrushStrandProfiles,
  normalizeProceduralBrushStrandPatterns,
  proceduralBrushBraidPreset,
  proceduralBrushCenteredPatternSections,
  proceduralBrushPatternPoints,
  proceduralBrushPatternSections,
  proceduralBrushPatternPreset,
  proceduralBrushPatternPointRemovable,
  proceduralBrushPatternFootprint,
  proceduralBrushPathParameters,
  proceduralBrushRepeatCountForCurve,
  removeProceduralBrushPatternPoint,
  reduceProceduralBrushPatternPoints,
  proceduralBrushSectionPointLocked,
  scaleProceduralBrushPatternY,
  proceduralBrushTopologySegments,
  proceduralBrushTemplateData,
  proceduralBrushLayoutOffsets,
  repeatProceduralBrushPattern
} from "../modules/procedural-brush.js";

test("procedural brush layout defaults to one centered radial strand", () => {
  assert.deepEqual(normalizeProceduralBrushLayout(), {
    pattern: "radial",
    strandCount: 1,
    spacing: 0.4,
    rootSpread: 1,
    tipSpread: 1,
    rootRotation: 0,
    tipRotation: 0
  });
  assert.deepEqual(proceduralBrushLayoutOffsets(), [{ rootX: 0, rootZ: 0, tipX: 0, tipZ: 0 }]);
});

test("authored pattern curves remain authoritative after profile normalization", () => {
  const [initial] = normalizeProceduralBrushStrandProfiles([], 1);
  const editedWidth = [
    { position: 0, value: 0.4, interpolation: "smooth" },
    { position: 1, value: 1.6, interpolation: "smooth" }
  ];
  const editedTwist = [
    { position: 0, value: -45, interpolation: "smooth" },
    { position: 1, value: 90, interpolation: "smooth" }
  ];
  const [normalized] = normalizeProceduralBrushStrandProfiles([{
    ...initial,
    taperCurve: editedWidth,
    twistCurve: editedTwist
  }], 1);
  assert.deepEqual(normalized.taperCurve, editedWidth);
  assert.deepEqual(normalized.twistCurve, editedTwist);
});

test("procedural brush linear layout centers every strand at one shared spacing", () => {
  assert.deepEqual(
    proceduralBrushLayoutOffsets({ pattern: "linear", strandCount: 4, spacing: 0.5 }),
    [
      { rootX: -0.75, rootZ: 0, tipX: -0.75, tipZ: 0 },
      { rootX: -0.25, rootZ: 0, tipX: -0.25, tipZ: 0 },
      { rootX: 0.25, rootZ: 0, tipX: 0.25, tipZ: 0 },
      { rootX: 0.75, rootZ: 0, tipX: 0.75, tipZ: 0 }
    ]
  );
});

test("procedural brush radial layout maintains spacing around its ring", () => {
  const offsets = proceduralBrushLayoutOffsets({ pattern: "radial", strandCount: 8, spacing: 0.36 });
  assert.equal(offsets.length, 8);
  offsets.forEach((offset, index) => {
    const next = offsets[(index + 1) % offsets.length];
    assert.ok(Math.abs(Math.hypot(next.rootX - offset.rootX, next.rootZ - offset.rootZ) - 0.36) < 1e-9);
  });
});

test("braid layout supports two through five strands and defaults to three", () => {
  assert.equal(normalizeProceduralBrushLayout({ pattern: "braid" }).strandCount, 3);
  assert.equal(normalizeProceduralBrushLayout({ pattern: "braid", strandCount: 1 }).strandCount, 2);
  assert.equal(normalizeProceduralBrushLayout({ pattern: "braid", strandCount: 9 }).strandCount, 5);
  assert.deepEqual(
    proceduralBrushLayoutOffsets({ pattern: "braid", strandCount: 4 }),
    Array.from({ length: 4 }, () => ({ rootX: 0, rootZ: 0, tipX: 0, tipZ: 0 }))
  );
});

test("procedural brush patterns independently edit their root and tip layouts", () => {
  const offsets = proceduralBrushLayoutOffsets({
    pattern: "linear",
    strandCount: 3,
    spacing: 0.5,
    rootSpread: 0.5,
    tipSpread: 2,
    rootRotation: 0,
    tipRotation: 90
  });
  assert.ok(Math.abs(offsets[0].rootX + 0.25) < 1e-9);
  assert.ok(Math.abs(offsets[0].rootZ) < 1e-9);
  assert.ok(Math.abs(offsets[0].tipX) < 1e-9);
  assert.ok(Math.abs(offsets[0].tipZ + 1) < 1e-9);
});

test("procedural brush pattern points fall back to one straight editable segment", () => {
  assert.deepEqual(
    normalizeProceduralBrushPatternPoints(null),
    DEFAULT_PROCEDURAL_BRUSH_PATTERN_POINTS.map((point) => ({ ...point }))
  );
});

test("moving either pattern seam endpoint moves its linked endpoint by the same delta", () => {
  const source = normalizeProceduralBrushPatternPoints();
  const movedFromRoot = moveProceduralBrushPatternPoint(source, 0, { x: 0.3, y: 1.2, z: -0.2 });
  assert.deepEqual(movedFromRoot[0], { x: 0.3, y: 1.2, z: -0.2 });
  assert.deepEqual(movedFromRoot.at(-1), { x: 0.3, y: -1.4, z: -0.2 });

  const movedFromTip = moveProceduralBrushPatternPoint(source, source.length - 1, { x: -0.4, y: -1, z: 0.1 });
  assert.deepEqual(movedFromTip.at(-1), { x: -0.4, y: -1, z: 0.1 });
  assert.deepEqual(movedFromTip[0], { x: -0.4, y: 1.6, z: 0.1 });
});

test("root and tip body-facing endpoints are locked while their outer points remain editable", () => {
  assert.equal(proceduralBrushSectionPointLocked("root", 4, 5), true);
  assert.equal(proceduralBrushSectionPointLocked("root", 0, 5), false);
  assert.equal(proceduralBrushSectionPointLocked("tip", 0, 5), true);
  assert.equal(proceduralBrushSectionPointLocked("tip", 4, 5), false);
  assert.equal(proceduralBrushSectionPointLocked("body", 0, 5), false);
  assert.equal(proceduralBrushSectionPointLocked("body", 4, 5), false);
});

test("procedural brush patterns insert and remove internal controls without deleting required seams", () => {
  const source = normalizeProceduralBrushPatternPoints();
  const inserted = insertProceduralBrushPatternPoint(source, 2, { x: 0.25, y: 0.4, z: -0.1 });
  assert.equal(inserted.length, source.length + 1);
  assert.deepEqual(inserted[2], { x: 0.25, y: 0.4, z: -0.1 });
  assert.deepEqual(source, normalizeProceduralBrushPatternPoints());

  assert.equal(proceduralBrushPatternPointRemovable("body", 0, source.length), false);
  assert.equal(proceduralBrushPatternPointRemovable("body", 2, source.length), true);
  assert.equal(proceduralBrushPatternPointRemovable("root", source.length - 1, source.length), false);
  assert.equal(proceduralBrushPatternPointRemovable("tip", 0, source.length), false);
  assert.equal(proceduralBrushPatternPointRemovable("root", 0, source.length), true);
  assert.equal(proceduralBrushPatternPointRemovable("tip", source.length - 1, source.length), true);

  const removed = removeProceduralBrushPatternPoint(source, 2, "body");
  assert.equal(removed.length, source.length - 1);
  assert.equal(removeProceduralBrushPatternPoint(source, 0, "body"), null);
});

test("procedural brush point reduction removes only redundant collinear controls", () => {
  const points = [
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0.5, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0.2, y: -0.5, z: 0.1 },
    { x: 0, y: -1, z: 0 }
  ];
  const reduced = reduceProceduralBrushPatternPoints(points);
  assert.deepEqual(reduced, [points[0], points[2], points[3], points[4]]);
  assert.deepEqual(points[1], { x: 0, y: 0.5, z: 0 });

  const plateau = [
    { x: 0, y: 1, z: 0 },
    { x: 0.2, y: 0.5, z: 0.1 },
    { x: 0.2, y: 0, z: 0.1 },
    { x: 0, y: -1, z: 0 }
  ];
  assert.deepEqual(reduceProceduralBrushPatternPoints(plateau), [
    plateau[0],
    { x: 0.2, y: 0.25, z: 0.1 },
    plateau[3]
  ]);
});

test("repeated procedural brush segments share their seam exactly", () => {
  const pattern = moveProceduralBrushPatternPoint(null, 2, { x: 0.45, y: 0.15, z: 0.2 });
  const repeated = repeatProceduralBrushPattern(pattern, 5);
  assert.equal(repeated.length, 5);
  for (let index = 1; index < repeated.length; index += 1) {
    ["x", "y", "z"].forEach((axis) => {
      assert.ok(Math.abs(repeated[index - 1].at(-1)[axis] - repeated[index][0][axis]) < 1e-12);
    });
  }
});

test("procedural brush body Y scale preserves the centre, width, and depth", () => {
  const pattern = [
    { x: -0.2, y: 1.5, z: 0.1 },
    { x: 0.35, y: 0.2, z: -0.25 },
    { x: 0.1, y: -0.5, z: 0.3 }
  ];
  const scaled = scaleProceduralBrushPatternY(pattern, 2);
  assert.deepEqual(scaled.map(({ x, z }) => ({ x, z })), pattern.map(({ x, z }) => ({ x, z })));
  assert.equal((scaled[0].y + scaled.at(-1).y) * 0.5, 0.5);
  assert.equal(scaled[0].y - scaled.at(-1).y, 4);

  const recipe = normalizeProceduralBrushRecipe({
    bodyScaleY: 2,
    layout: { strandCount: 1 },
    strandPatterns: [pattern]
  });
  assert.equal(recipe.bodyScaleY, 2);
  const [body] = proceduralBrushPatternSections(recipe, 0, 1);
  assert.deepEqual(body.points, scaled);
  assert.equal(normalizeProceduralBrushRecipe({ ...recipe, bodyScaleY: 99 }).bodyScaleY, 4);
  assert.equal(normalizeProceduralBrushRecipe({ ...recipe, bodyScaleY: 0 }).bodyScaleY, 1);
});

test("repeated procedural brush cycles retain a consistent longitudinal phase", () => {
  const preset = proceduralBrushPatternPreset("three-strand-braid");
  const points = proceduralBrushPatternPoints(preset, 0, 8);
  const parameters = proceduralBrushPathParameters(points);
  const cyclePointSpan = preset.strandPatterns[0].length - 1;
  const cycleSpans = Array.from({ length: 8 }, (_, cycleIndex) => (
    parameters[(cycleIndex + 1) * cyclePointSpan] - parameters[cycleIndex * cyclePointSpan]
  ));
  cycleSpans.forEach((span) => assert.ok(Math.abs(span - 1 / 8) < 1e-12));
  for (let index = 1; index < parameters.length; index += 1) {
    assert.ok(parameters[index] >= parameters[index - 1]);
  }
});

test("procedural brush strand patterns preserve independent segments with legacy fallback", () => {
  const legacy = moveProceduralBrushPatternPoint(null, 2, { x: 0.2, y: 0.1, z: 0 });
  const second = moveProceduralBrushPatternPoint(null, 2, { x: -0.35, y: 0.1, z: 0.15 });
  const patterns = normalizeProceduralBrushStrandPatterns([legacy, second], 3);
  assert.equal(patterns.length, 3);
  assert.equal(patterns[0][2].x, 0.2);
  assert.equal(patterns[1][2].x, -0.35);
  assert.equal(patterns[2][2].x, 0.2);
  patterns[2][2].x = 1;
  assert.equal(patterns[0][2].x, 0.2);

  const migrated = normalizeProceduralBrushStrandPatterns(null, 2, second);
  assert.deepEqual(migrated[0], second);
  assert.deepEqual(migrated[1], second);
});

test("root and tip defaults extend each corresponding body strand without copying its pattern", () => {
  const body = [
    moveProceduralBrushPatternPoint(null, 2, { x: -0.4, y: 0, z: 0 }),
    moveProceduralBrushPatternPoint(null, 2, { x: 0, y: 0, z: 0.2 }),
    moveProceduralBrushPatternPoint(null, 2, { x: 0.4, y: 0, z: 0 })
  ];
  const roots = normalizeProceduralBrushSectionPatterns(null, body, 3, "root");
  const tips = normalizeProceduralBrushSectionPatterns(null, body, 3, "tip");
  assert.equal(roots.length, body.length);
  assert.equal(tips.length, body.length);
  roots.forEach((pattern, index) => {
    assert.equal(pattern.length, DEFAULT_PROCEDURAL_BRUSH_PATTERN_POINTS.length);
    assert.deepEqual(pattern.at(-1), body[index][0]);
    assert.notDeepEqual(pattern, body[index]);
    assert.ok(pattern[0].y > pattern.at(-1).y);
    pattern.forEach((point) => {
      assert.equal(point.x, body[index][0].x);
      assert.equal(point.z, body[index][0].z);
    });
  });
  tips.forEach((pattern, index) => {
    assert.equal(pattern.length, DEFAULT_PROCEDURAL_BRUSH_PATTERN_POINTS.length);
    assert.deepEqual(pattern[0], body[index].at(-1));
    assert.notDeepEqual(pattern, body[index]);
    assert.ok(pattern.at(-1).y < pattern[0].y);
    pattern.forEach((point) => {
      assert.equal(point.x, body[index].at(-1).x);
      assert.equal(point.z, body[index].at(-1).z);
    });
  });
  roots[0][2].x = 2;
  assert.equal(body[0][2].x, -0.4);
});

test("procedural brush recipes migrate legacy body-only patterns to four repetitions", () => {
  const recipe = normalizeProceduralBrushRecipe({
    layout: { strandCount: 2 },
    strandPatterns: [normalizeProceduralBrushPatternPoints()]
  });
  assert.equal(recipe.repeatCount, 4);
  assert.equal(recipe.curveStep, 0.8);
  assert.equal(recipe.rootStrandPatterns, null);
  assert.equal(recipe.tipStrandPatterns, null);
  assert.equal(recipe.strandPatterns.length, 2);
  assert.deepEqual(recipe.strandProfiles.map((profile) => profile.taperCurve), [
    [{ position: 0, value: 1, interpolation: "linear" }, { position: 1, value: 1, interpolation: "linear" }],
    [{ position: 0, value: 1, interpolation: "linear" }, { position: 1, value: 1, interpolation: "linear" }]
  ]);
});

test("procedural brush strand profiles preserve independent width and depth curves", () => {
  const profiles = normalizeProceduralBrushStrandProfiles([
    {
      taperCurve: [{ position: 0, value: 0.4, interpolation: "smooth" }, { position: 1, value: 1.2, interpolation: "linear" }],
      depthCurve: [{ position: 0, value: 1.5, interpolation: "linear" }, { position: 1, value: 0.2, interpolation: "smooth" }]
    }
  ], 2);
  assert.equal(profiles.length, 2);
  assert.equal(profiles[0].taperCurve[0].value, 0.4);
  assert.equal(profiles[0].depthCurve[1].value, 0.2);
  assert.equal(profiles[1].taperCurve[0].value, 1);
  profiles[1].taperCurve[0].value = 0.5;
  assert.equal(profiles[0].taperCurve[0].value, 0.4);

  const template = proceduralBrushTemplateData({
    layout: { strandCount: 2 },
    strandProfiles: profiles
  }, { settings: { strandRotation: 12 } });
  assert.equal(template.strands[1].settings.taperCurve[0].value, 0.4);
  assert.equal(template.strands[1].settings.depthCurve[1].value, 0.2);
  assert.equal(template.strands[2].settings.taperCurve[0].value, 0.5);
  assert.equal(template.strands[1].settings.strandRotation, 12);
});

test("procedural brush curve step converts stroke length into bounded pattern repetitions", () => {
  assert.equal(proceduralBrushRepeatCountForCurve(4, 0.8), 5);
  assert.equal(proceduralBrushRepeatCountForCurve(4, 0.4), 10);
  assert.equal(proceduralBrushRepeatCountForCurve(0.05, 2.5), 1);
  assert.equal(proceduralBrushRepeatCountForCurve(100, 0.2), 64);
  assert.equal(normalizeProceduralBrushRecipe({ curveStep: 0.01 }).curveStep, 0.2);
  assert.equal(normalizeProceduralBrushRecipe({ curveStep: 9 }).curveStep, 2.5);
});

test("procedural brush patterns compose one-shot root and tip sections around the repeated body", () => {
  const body = moveProceduralBrushPatternPoint(null, 2, { x: 0.3, y: 0.1, z: 0 });
  const root = moveProceduralBrushPatternPoint(
    null,
    0,
    { x: -0.5, y: 1.4, z: 0.2 },
    { linkEndpoints: false }
  );
  const tip = moveProceduralBrushPatternPoint(
    null,
    4,
    { x: 0.6, y: -1.2, z: -0.1 },
    { linkEndpoints: false }
  );
  const points = proceduralBrushPatternPoints({
    layout: { strandCount: 1 },
    repeatCount: 3,
    strandPatterns: [body],
    rootStrandPatterns: [root],
    tipStrandPatterns: [tip]
  });
  assert.equal(points.length, root.length + (body.length - 1) * 3 + tip.length - 1);
  const rootOffset = {
    x: body[0].x - root.at(-1).x,
    y: body[0].y - root.at(-1).y,
    z: body[0].z - root.at(-1).z
  };
  ["x", "y", "z"].forEach((axis) => {
    assert.ok(Math.abs(points[0][axis] - (root[0][axis] + rootOffset[axis])) < 1e-12);
  });
  assert.ok(points.at(-1).y < points[0].y);
  assert.notEqual(root[0].x, root.at(-1).x);
  assert.notEqual(tip[0].x, tip.at(-1).x);
});

test("procedural brush pattern sections retain labeled root, repeated body, and tip spans", () => {
  const pattern = normalizeProceduralBrushPatternPoints();
  const sections = proceduralBrushPatternSections({
    layout: { strandCount: 1 },
    repeatCount: 2,
    strandPatterns: [pattern],
    rootStrandPatterns: [pattern],
    tipStrandPatterns: [pattern]
  });
  assert.deepEqual(sections.map(({ section, repeatIndex }) => ({ section, repeatIndex })), [
    { section: "root", repeatIndex: 0 },
    { section: "body", repeatIndex: 0 },
    { section: "body", repeatIndex: 1 },
    { section: "tip", repeatIndex: 0 }
  ]);
  for (let index = 1; index < sections.length; index += 1) {
    ["x", "y", "z"].forEach((axis) => {
      assert.ok(
        Math.abs(sections[index - 1].points.at(-1)[axis] - sections[index].points[0][axis]) < 1e-12
      );
    });
  }
  ["x", "y", "z"].forEach((axis) => {
    assert.ok(Math.abs(sections[1].points[0][axis] - pattern[0][axis]) < 1e-12);
  });
});

test("procedural brush neighbour previews centre the editable body between both repetitions", () => {
  const pattern = [
    { x: 0.2, y: 1, z: -0.1 },
    { x: 0.5, y: -1, z: 0.3 }
  ];
  const sections = proceduralBrushCenteredPatternSections({
    layout: { strandCount: 1 },
    strandPatterns: [pattern]
  }, 0, 3).filter((segment) => segment.section === "body");
  assert.equal(sections.length, 3);
  assert.deepEqual(sections[1].points, pattern);
  assert.deepEqual(sections[0].points.at(-1), sections[1].points[0]);
  assert.deepEqual(sections[2].points[0], sections[1].points.at(-1));
  assert.ok(sections[0].points[0].y > sections[1].points[0].y);
  assert.ok(sections[2].points.at(-1).y < sections[1].points.at(-1).y);
});

test("body remains the positional authority for connected root and tip sections", () => {
  const body = moveProceduralBrushPatternPoint(null, 0, { x: 0.7, y: 1.1, z: -0.2 });
  const root = moveProceduralBrushPatternPoint(null, 4, { x: -0.8, y: -0.9, z: 0.3 }, { linkEndpoints: false });
  const tip = moveProceduralBrushPatternPoint(null, 0, { x: 0.4, y: 0.8, z: -0.5 }, { linkEndpoints: false });
  const sections = proceduralBrushPatternSections({
    layout: { strandCount: 1 },
    repeatCount: 1,
    strandPatterns: [body],
    rootStrandPatterns: [root],
    tipStrandPatterns: [tip]
  });
  const [rootSection, bodySection, tipSection] = sections;
  assert.deepEqual(bodySection.points[0], body[0]);
  assert.deepEqual(rootSection.points.at(-1), bodySection.points[0]);
  assert.deepEqual(tipSection.points[0], bodySection.points.at(-1));
});

test("procedural brush recipes become repeatable hidden-guide clump templates", () => {
  const preset = proceduralBrushPatternPreset("three-strand-braid");
  const template = proceduralBrushTemplateData(preset, {
    baseWidth: 0.2,
    depth: 0.12,
    repeatCount: 3,
    settings: { strandRotation: 12 }
  });
  assert.equal(template.proceduralBrush, true);
  assert.equal(template.proceduralBrushRecipe.curveStep, 0.35);
  assert.equal(template.proceduralBrushRepeatCount, 3);
  assert.ok(Math.abs(template.baseWidth - 0.64 / PROCEDURAL_BRUSH_PATTERN_FULLNESS) < 1e-9);
  assert.equal(template.strands.length, 4);
  assert.equal(template.strands[0].width, template.baseWidth);
  assert.equal(template.strands[1].width, 0.2);
  assert.equal(template.strands[0].points.every(([x, , z]) => x === 0 && z === 0), true);
  assert.equal(template.strands[1].pathParameters.length, template.strands[1].points.length);
  assert.equal(template.strands[1].depth, 0.12);
  assert.equal(template.strands[1].settings.strandRotation, 12);
  assert.deepEqual(template.strands[1].settings.sweepProfile[2], {
    x: 0,
    z: 0.39,
    interpolation: "smooth"
  });
  assert.equal(template.strands[1].points.length, preset.strandPatterns[0].length * 3 - 2);
  assert.ok(template.strands[1].points.at(-1)[1] < template.strands[1].points[0][1]);
});

test("procedural brush size describes the combined pattern footprint", () => {
  const straight = proceduralBrushTemplateData(proceduralBrushPatternPreset("straight"), {
    baseWidth: 0.2,
    depth: 0.12
  });
  assert.equal(straight.baseWidth, 0.2);

  const braid = proceduralBrushTemplateData(proceduralBrushPatternPreset("three-strand-braid"), {
    baseWidth: 0.2,
    depth: 0.12
  });
  assert.ok(Math.abs(proceduralBrushPatternFootprint(braid.strands.slice(1), 0.2) - 0.64) < 1e-9);
  const requestedSize = 0.32;
  const scale = requestedSize / braid.baseWidth;
  const minX = Math.min(...braid.strands.slice(1).flatMap((strand) => (
    strand.points.map(([x]) => x * scale - strand.width * scale * 0.5)
  )));
  const maxX = Math.max(...braid.strands.slice(1).flatMap((strand) => (
    strand.points.map(([x]) => x * scale + strand.width * scale * 0.5)
  )));
  assert.ok(Math.abs((maxX - minX) - requestedSize * PROCEDURAL_BRUSH_PATTERN_FULLNESS) < 1e-9);
  assert.equal(PROCEDURAL_BRUSH_PATTERN_FULLNESS, 1.12);
});

test("procedural brush topology scales with repeated control spans while respecting authored density", () => {
  assert.equal(proceduralBrushTopologySegments(11, 26), 40);
  assert.equal(proceduralBrushTopologySegments(41, 26), 160);
  assert.equal(proceduralBrushTopologySegments(11, 64), 64);
  assert.equal(proceduralBrushTopologySegments(100, 26), 256);
});

test("three-strand braid preset uses the promoted braid default recipe and curves", () => {
  const preset = proceduralBrushPatternPreset("three-strand-braid");
  assert.equal(preset.layout.pattern, "braid");
  assert.equal(preset.layout.strandCount, 3);
  assert.equal(preset.layout.spacing, 0.356);
  assert.equal(preset.layout.rootSpread, 0);
  assert.equal(preset.layout.tipSpread, 0);
  assert.equal(preset.curveStep, 0.35);
  assert.equal(preset.bodyScaleY, 0.55);
  assert.equal(preset.creationSettings.width, 0.15);
  assert.equal(preset.creationSettings.depth, 0.24);
  assert.deepEqual(preset.creationSettings.taperCurve, [
    { position: 0, value: 1, interpolation: "linear" },
    { position: 1, value: 1, interpolation: "linear" }
  ]);
  assert.equal(preset.toolSettings.smoothing, 0.45);
  assert.equal(preset.toolSettings.curveStep, 0.38);
  assert.equal(preset.strandPatterns.length, 3);
  assert.equal(preset.strandProfiles.length, 3);
  preset.strandProfiles.forEach((profile) => {
    assert.equal(profile.sweepProfile.length, 7);
    assert.deepEqual(profile.sweepProfile[2], { x: 0, z: 0.39, interpolation: "smooth" });
    assert.deepEqual(profile.sweepProfile.at(-1), { x: 0.77, z: -0.16, interpolation: "smooth" });
  });
  preset.strandProfiles[0].sweepProfile[0].x = 99;
  assert.equal(proceduralBrushPatternPreset("three-strand-braid").strandProfiles[0].sweepProfile[0].x, 1);
  assert.deepEqual(preset.strandPatterns.map((pattern) => pattern.length), [8, 8, 7]);
  preset.strandPatterns.forEach((pattern) => {
    assert.equal(reduceProceduralBrushPatternPoints(pattern).length, pattern.length);
  });
  assert.deepEqual(preset.strandPatterns[0][0], {
    x: -0.21237213870712715,
    y: 1.4130347068061901,
    z: 0.06626137918472574
  });
  assert.deepEqual(preset.strandPatterns[1][6], {
    x: 0.1112171502995324,
    y: -0.9276867451665647,
    z: 0.07536728554491803
  });
  const maximumWidth = Math.max(...preset.strandPatterns.flat().map((point) => Math.abs(point.x)));
  const maximumDepth = Math.max(...preset.strandPatterns.flat().map((point) => Math.abs(point.z)));
  assert.equal(maximumWidth, 0.22);
  assert.equal(maximumDepth, 0.09);
  assert.ok(maximumDepth < maximumWidth * 0.5);
  preset.strandPatterns[0][0].x = 99;
  assert.notEqual(proceduralBrushPatternPreset("three-strand-braid").strandPatterns[0][0].x, 99);
});

test("braid pattern type generates editable twist and braid variants", () => {
  for (const strandCount of [2, 3, 4, 5]) {
    const preset = proceduralBrushBraidPreset(strandCount);
    assert.equal(preset.layout.pattern, "braid");
    assert.equal(preset.layout.strandCount, strandCount);
    assert.equal(preset.toolSettings.brushPattern, "braid");
    assert.equal(preset.toolSettings.brushStrandCount, strandCount);
    assert.equal(preset.strandPatterns.length, strandCount);
    assert.equal(preset.strandProfiles.length, strandCount);
    preset.strandPatterns.forEach((pattern) => {
      assert.ok(pattern.length >= 2);
      assert.ok(pattern.length <= 32);
    });
  }

  const twist = proceduralBrushBraidPreset(2);
  assert.ok(twist.strandPatterns.flat().some((point) => point.z > 0));
  assert.ok(twist.strandPatterns.flat().some((point) => point.z < 0));
  assert.deepEqual(proceduralBrushBraidPreset(3).strandPatterns.map((pattern) => pattern.length), [8, 8, 7]);
  assert.equal(Math.max(...proceduralBrushBraidPreset(4).strandPatterns.flat().map((point) => Math.abs(point.x))), 0.33);
  assert.equal(Math.max(...proceduralBrushBraidPreset(5).strandPatterns.flat().map((point) => Math.abs(point.x))), 0.44);
  [2, 4, 5].forEach((strandCount) => {
    proceduralBrushBraidPreset(strandCount).strandPatterns.forEach((pattern) => {
      assert.equal(pattern[0].x, pattern.at(-1).x);
      assert.equal(pattern[0].z, pattern.at(-1).z);
    });
  });
});
