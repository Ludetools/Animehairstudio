import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { BoundedHistory, RestoreRefreshRegistry } from "../modules/history.js";
import {
  focusedControlShouldYieldToShortcut,
  pointerControlShouldReturnViewportFocus,
  shortcutToolForKey,
  TOOL_SHORTCUTS,
  workspaceForShortcutKey,
  WORKSPACE_SHORTCUTS
} from "../modules/shortcut-registry.js";
import {
  activateStrandSelection,
  emptyStrandSelection,
  resolveStrandSelection,
  restoreStrandSelection,
  screenBoundsOverlap,
  triangleIntersectsScreenBounds
} from "../modules/selection-state.js";
import {
  createSelectionSetRecord,
  nextSelectionSetName,
  normalizeSelectionSets,
  updateSelectionSetMembers
} from "../modules/selection-sets.js";
import {
  layoutRadialOptions,
  layoutRadialSubmenuSlots,
  partitionRadialOptions,
  radialMenuAngles,
  radialOptionSector,
  radialButtonEntryDistance,
  radialListCorridorContains,
  radialSubmenuTravelAngle,
  radialButtonRayExtent,
  radialMenuDimensions
} from "../modules/radial-layout.js";
import { solvePulledStrand } from "../modules/strand-constraints.js";
import {
  createArcHairSurfaceGrid,
  normalizeArcHairSurfaceSettings
} from "../modules/arc-hair-surface.js";
import { polygonOnlyObjSource } from "../modules/obj-import.js";
import { mirrorSelectionTargets } from "../modules/mirror-selection.js";
import {
  MAX_RECENT_PROJECTS,
  normalizeRecentProjects,
  recentProjectId
} from "../modules/recent-projects.js";
import {
  createRecoveryRecord,
  DEFAULT_AUTOSAVE_INTERVAL_SECONDS,
  normalizeAutosaveInterval,
  normalizeRecoveryRecord,
  RECOVERY_RECORD_ID
} from "../modules/recovery-storage.js";
import {
  proceduralAccessoryTaperScale,
  proceduralAccessoryTemplateData,
  proceduralBranchTemplateData
} from "../modules/procedural-draw.js";
import {
  resampleClosedProfilePoints
} from "../modules/branch-knife.js";
import {
  compoundBridgeArchWeight,
  compoundBridgeParameters,
  compoundBridgeSegmentCounts,
  compoundConnectedSegmentCount,
  compoundControllerWidthScales,
  normalizeCompoundBridgeZippers,
  compoundProfileBridgePlan
} from "../modules/compound-strand.js";
import {
  adaptiveCurveParameters,
  blendCylindricalPolylinePointData,
  blendDirectionPointData,
  blendRelativePolylinePointData,
  blendSurfaceOrientedPolylinePointData,
  blendSampleArrays,
  blendEnvelopeCurves,
  blendTaperCurves,
  clumpMemberGuideParameter,
  eightWayScreenDelta,
  curveRebuildParameters,
  curvePointRemovalPlan,
  curvedRelaxPositionTarget,
  cylindricalArcPointData,
  evenlySpacedInteriorAmounts,
  horizontalCirclePointData,
  horizontalCircleThroughPointData,
  lowestSharedHorizontalPolylinePointData,
  mirroredAsymmetricTaperCurves,
  normalizeEnvelopeCurve,
  normalizeTaperCurve,
  polylineMidpointPointData,
  panelTipCurveParameter,
  panelTipLoopParameters,
  profileTopologyCenterWeight,
  proximityCurveBlendAmount,
  relaxAngleValue,
  remapEnvelopeCurveRange,
  rootCorrectionFalloff,
  sampleArray,
  sampleAsymmetricTaperCurve,
  sampleIntegratedEnvelopeCurve,
  sampleTaperCurve,
  symmetricClosedCurveParameters,
  surfaceArcBlendAmount,
  surfaceArcPolylinePointData,
  twistCurveDensityDetail,
  twistCurveDisplayRange,
  twistCurveHandleDistancePerDegree,
  twistRateDegreesFromUnits,
  twistRateUnitsFromDegrees,
  upperProfileArcIndices
} from "../modules/curve-math.js";

test("arc hair surfaces form an open, consistently wound quad canopy", () => {
  const settings = normalizeArcHairSurfaceSettings({
    width: 2,
    arcHeight: 1,
    legLength: 0.5,
    depth: 1.5,
    arcSegments: 4,
    legSegments: 2,
    depthSegments: 3
  });
  const grid = createArcHairSurfaceGrid(settings);
  assert.equal(grid.columns, 9);
  assert.equal(grid.rows, 4);
  assert.equal(grid.points.length, 36);
  assert.equal(grid.faces.length, 24);
  assert.ok(grid.faces.every((face) => face.length === 4 && new Set(face).size === 4));
  assert.equal(Math.min(...grid.points.map((point) => point.x)), -1);
  assert.equal(Math.max(...grid.points.map((point) => point.x)), 1);
  assert.equal(Math.max(...grid.points.map((point) => point.y)), 1);
  assert.equal(Math.min(...grid.points.map((point) => point.y)), -0.5);
  assert.equal(Math.min(...grid.points.map((point) => point.z)), -0.75);
  assert.equal(Math.max(...grid.points.map((point) => point.z)), 0.75);

  const topFace = grid.faces[11];
  const [a, b, , d] = topFace.map((index) => grid.points[index]);
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ad = { x: d.x - a.x, y: d.y - a.y, z: d.z - a.z };
  const normalY = ab.z * ad.x - ab.x * ad.z;
  assert.ok(normalY > 0, "top faces should point away from the canopy interior");
});

test("recovery records and autosave intervals use safe normalized values", () => {
  assert.equal(normalizeAutosaveInterval("60"), 60);
  assert.equal(normalizeAutosaveInterval(17), DEFAULT_AUTOSAVE_INTERVAL_SECONDS);
  const record = createRecoveryRecord({
    name: "  Bangs Study  ",
    content: "{\"format\":\"anime-hair-studio-project\"}",
    updatedAt: 1234,
    appVersion: "0.1.4"
  });
  assert.deepEqual(record, {
    id: RECOVERY_RECORD_ID,
    name: "Bangs Study",
    content: "{\"format\":\"anime-hair-studio-project\"}",
    updatedAt: 1234,
    appVersion: "0.1.4"
  });
  assert.equal(normalizeRecoveryRecord({ content: "", updatedAt: 1234 }), null);
  assert.throws(() => createRecoveryRecord({ content: "" }), /non-empty project file/);
});

test("clump members can follow a subsection of their guide curve", () => {
  assert.equal(clumpMemberGuideParameter(0, 0.4, 1), 0.4);
  assert.equal(clumpMemberGuideParameter(0.5, 0.4, 1), 0.7);
  assert.equal(clumpMemberGuideParameter(1, 0.4, 1), 1);
  assert.equal(clumpMemberGuideParameter(-1, -2, 2), 0);
});

test("compound strands remove touching quad loops and bridge their boundary rails", () => {
  const profile = [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: -1, z: 0 },
    { x: 0, z: -1 }
  ];
  const plan = compoundProfileBridgePlan(profile, 3);

  assert.ok(plan);
  assert.deepEqual(plan.removedEdges, [
    [plan.rightEdge],
    [plan.leftEdge, plan.rightEdge],
    [plan.leftEdge]
  ]);
  assert.equal(plan.bridges.length, 4);
  assert.equal(plan.bridges.filter((bridge) => bridge.surface === "upper").length, 2);
  assert.equal(plan.bridges.filter((bridge) => bridge.surface === "lower").length, 2);
  assert.equal(plan.perimeter.length, profile.length * 3);
  assert.equal(new Set(plan.perimeter.map((slot) => `${slot.controllerIndex}:${slot.profileIndex}`)).size, 12);
});

test("compound strands reserve a lower unbridged extension", () => {
  assert.equal(compoundConnectedSegmentCount(26), 9);
  assert.equal(compoundConnectedSegmentCount(2), 1);
  assert.equal(compoundConnectedSegmentCount(1), 1);
  assert.equal(compoundConnectedSegmentCount(0), 0);
});

test("compound bridge loops add evenly spaced lengthwise rails", () => {
  assert.deepEqual(compoundBridgeParameters(0), [0, 1]);
  assert.deepEqual(compoundBridgeParameters(3), [0, 0.25, 0.5, 0.75, 1]);
  assert.equal(compoundBridgeParameters(99).length, 10);
});

test("compound bridge smoothing feathers a centered arch into the split edge", () => {
  assert.equal(compoundBridgeArchWeight(0, 1, 1), 0);
  assert.ok(Math.abs(compoundBridgeArchWeight(1, 1, 1)) < 1e-12);
  assert.equal(compoundBridgeArchWeight(0.5, 0.4, 1), 0);
  assert.ok(compoundBridgeArchWeight(0.5, 0.75, 1) > 0);
  assert.equal(compoundBridgeArchWeight(0.5, 1, 0.5), 0.5);
});

test("compound bridge zippers independently set merge rows and redistribute neighboring widths", () => {
  assert.deepEqual(normalizeCompoundBridgeZippers(null), [
    { parameter: 0.35, offset: 0 },
    { parameter: 0.35, offset: 0 }
  ]);
  assert.deepEqual(compoundBridgeSegmentCounts(26, [
    { parameter: 0.25 },
    { parameter: 0.75 }
  ]), [7, 20]);
  const widthScales = compoundControllerWidthScales([
    { offset: 0.2 },
    { offset: -0.1 }
  ]);
  assert.ok(widthScales.every((scale, index) => Math.abs(scale - [1.2, 0.7, 1.1][index]) < 1e-12));
});

test("branch curves remap a parent envelope subsection across the full child", () => {
  const parent = [
    { position: 0, value: 1, interpolation: "linear" },
    { position: 0.5, value: 0.8, interpolation: "linear" },
    { position: 0.75, value: 0.4, interpolation: "constant" },
    { position: 1, value: 0, interpolation: "smooth" }
  ];
  const child = remapEnvelopeCurveRange(parent, 0.5, 1);
  assert.deepEqual(child.map((point) => point.position), [0, 0.5, 1]);
  assert.deepEqual(child.map((point) => point.value), [0.8, 0.4, 0.4]);
  assert.equal(child[0].interpolation, "linear");
  assert.equal(child[1].interpolation, "constant");
  assert.equal(sampleTaperCurve(child, 0.25), sampleTaperCurve(parent, 0.625));
  assert.equal(sampleTaperCurve(child, 0.75), sampleTaperCurve(parent, 0.875));
});

test("shortcut registry owns tool lookup and transient control focus policy", () => {
  assert.equal(shortcutToolForKey("Q"), "select");
  assert.equal(shortcutToolForKey("g"), "braid");
  assert.equal(shortcutToolForKey("?"), null);
  assert.equal(TOOL_SHORTCUTS.w, "move");
  assert.equal(workspaceForShortcutKey("1"), "strand");
  assert.equal(workspaceForShortcutKey("2"), "guide");
  assert.equal(workspaceForShortcutKey("3"), "reference");
  assert.equal(workspaceForShortcutKey("4"), null);
  assert.equal(WORKSPACE_SHORTCUTS[2], "guide");

    const range = { tagName: "INPUT", type: "range" };
    const checkbox = { tagName: "INPUT", type: "checkbox" };
    const number = { tagName: "INPUT", type: "number" };
    const select = { tagName: "SELECT" };
    const toggleButton = { tagName: "BUTTON", getAttribute: (name) => name === "aria-pressed" ? "false" : null };
    const plainButton = { tagName: "BUTTON", getAttribute: () => null };
    assert.equal(pointerControlShouldReturnViewportFocus(range), true);
    assert.equal(pointerControlShouldReturnViewportFocus(checkbox), true);
    assert.equal(pointerControlShouldReturnViewportFocus(toggleButton), true);
    assert.equal(pointerControlShouldReturnViewportFocus(number), false);
    assert.equal(pointerControlShouldReturnViewportFocus(select), false);
    assert.equal(pointerControlShouldReturnViewportFocus(plainButton), false);
  assert.equal(focusedControlShouldYieldToShortcut(range, { key: "Q", code: "KeyQ" }), true);
  assert.equal(focusedControlShouldYieldToShortcut(range, { key: "Tab", code: "Tab" }), true);
  assert.equal(focusedControlShouldYieldToShortcut(range, { key: "L", code: "KeyL" }), true);
  assert.equal(focusedControlShouldYieldToShortcut(range, { key: "h", code: "KeyH", ctrlKey: true }), true);
  assert.equal(focusedControlShouldYieldToShortcut(select, { key: "2", code: "Digit2" }), true);
  assert.equal(focusedControlShouldYieldToShortcut(select, { key: "Delete", code: "Delete" }), true);
  assert.equal(focusedControlShouldYieldToShortcut(range, { key: "z", ctrlKey: true }), true);
  assert.equal(focusedControlShouldYieldToShortcut(range, { key: "d", altKey: true }), true);
  assert.equal(focusedControlShouldYieldToShortcut(range, { key: "ArrowLeft" }), false);
  assert.equal(focusedControlShouldYieldToShortcut(number, { key: "Q", code: "KeyQ" }), false);
});

test("mirror selection separates unmirrored strands and unique linked pairs", () => {
  const locks = [
    { id: "a", mirrorPartnerId: "b" },
    { id: "b", mirrorPartnerId: "a" },
    { id: "c", mirrorPartnerId: null },
    { id: "d", mirrorPartnerId: "e" },
    { id: "e", mirrorPartnerId: "d" }
  ];
  const byId = new Map(locks.map((lock) => [lock.id, lock]));
  const result = mirrorSelectionTargets(locks, (lock) => byId.get(lock.mirrorPartnerId));
  assert.deepEqual(result.mirrorable.map((lock) => lock.id), ["c"]);
  assert.deepEqual(result.decouple.map((lock) => lock.id), ["a", "d"]);
});

test("restore refresh registry runs named consumers once in registration order", () => {
  const calls = [];
  const registry = new RestoreRefreshRegistry()
    .register("selection", (context) => calls.push(["selection", context.id]))
    .register("editors", (context) => calls.push(["editors", context.id]));

  registry.run({ id: 7 });
  assert.deepEqual(calls, [["selection", 7], ["editors", 7]]);
  assert.throws(() => registry.register("selection", () => {}), /already registered/);
});

test("strand selection transitions preserve the active item across additive edits", () => {
  const validIds = ["a", "b", "c"];
  const initial = resolveStrandSelection({
    requestedId: "a",
    requestedIds: ["a"],
    validIds
  });
  assert.deepEqual(initial, { activeId: "a", selectedIds: ["a"] });

  const added = resolveStrandSelection({
    ...initial,
    requestedId: "b",
    requestedIds: ["b"],
    selectionMode: "add",
    validIds
  });
  assert.deepEqual(added, { activeId: "a", selectedIds: ["a", "b"] });

  const removedPrimary = resolveStrandSelection({
    ...added,
    requestedId: "a",
    requestedIds: ["a"],
    selectionMode: "remove",
    validIds
  });
  assert.deepEqual(removedPrimary, { activeId: "b", selectedIds: ["b"] });
});

test("selection sets receive stable names and discard missing strand members", () => {
  const existing = [{ id: "set-a", name: "Selection Set 1", strandIds: ["a", "b"] }];
  assert.equal(nextSelectionSetName(existing), "Selection Set 2");
  assert.deepEqual(createSelectionSetRecord(existing, ["b", "a", "b"], "set-b"), {
    id: "set-b",
    name: "Selection Set 2",
    strandIds: ["b", "a"]
  });
  assert.equal(createSelectionSetRecord(existing, ["a"], "set-c"), null);
  assert.deepEqual(normalizeSelectionSets([
    ...existing,
    { id: "set-b", name: "Keep", strandIds: ["b", "missing"] },
    { id: "empty", name: "Empty", strandIds: ["missing"] }
  ], ["a", "b"]), [
    existing[0],
    { id: "set-b", name: "Keep", strandIds: ["b"] }
  ]);
  assert.deepEqual(updateSelectionSetMembers(existing[0], ["b", "c"], "add", ["a", "b", "c"]), {
    id: "set-a",
    name: "Selection Set 1",
    strandIds: ["a", "b", "c"]
  });
  assert.deepEqual(updateSelectionSetMembers(existing[0], ["a", "missing"], "remove", ["a", "b"]), {
    id: "set-a",
    name: "Selection Set 1",
    strandIds: ["b"]
  });
});

test("radial menus use stable count-aware layouts from one through many options", () => {
  const partitioned = partitionRadialOptions([
    { action: "primary-a" },
    { action: "low-priority", list: true },
    { action: "submenu", submenu: "child" },
    { action: "primary-b" },
    { action: "primary-c" },
    { action: "primary-d" },
    { action: "primary-e" },
    { action: "primary-f" },
    { action: "overflow" }
  ]);
  assert.deepEqual(partitioned.radialOptions.map(({ action }) => action), [
    "submenu", "primary-a", "primary-b", "primary-c", "primary-d", "primary-e", "primary-f", "overflow"
  ]);
  assert.deepEqual(partitioned.listOptions.map(({ action }) => action), [
    "low-priority"
  ]);
  const cappedSubmenus = partitionRadialOptions(
    Array.from({ length: 6 }, (_, index) => ({
      action: `submenu-${index}`,
      submenu: `submenu-${index}`
    }))
  );
  assert.equal(cappedSubmenus.radialOptions.length, 5);
  assert.deepEqual(cappedSubmenus.listOptions.map(({ action }) => action), ["submenu-5"]);
  assert.deepEqual(radialMenuAngles(1), [-Math.PI * 0.5]);
  assert.deepEqual(radialMenuAngles(2), [Math.PI, 0]);
  assert.deepEqual(radialMenuAngles(3), [
    -Math.PI * 0.5,
    Math.PI * 5 / 18,
    Math.PI * 13 / 18
  ]);
  const threeOptionLayout = layoutRadialOptions([
    { action: "apex" },
    { action: "pair-a" },
    { action: "pair-b" }
  ]);
  const threeOptionRadius = radialMenuDimensions(3).radius;
  const threeOptionPoints = threeOptionLayout.map(({ angle, radiusOffset = 0 }) => ({
    x: Math.cos(angle) * (threeOptionRadius + radiusOffset),
    y: Math.sin(angle) * (threeOptionRadius + radiusOffset)
  }));
  const threeOptionVerticalMidpoint = (
    Math.min(...threeOptionPoints.map(({ y }) => y))
    + Math.max(...threeOptionPoints.map(({ y }) => y))
  ) / 2;
  assert.deepEqual(threeOptionLayout.map(({ radiusOffset = 0 }) => radiusOffset), [0, 20, 20]);
  assert.ok(Math.abs(threeOptionVerticalMidpoint) < 6);
  assert.ok(Math.abs(threeOptionPoints[1].x - threeOptionPoints[2].x) > 165);
  assert.equal(radialButtonEntryDistance(-Math.PI * 0.5, { radius: 112 }), 92);
  assert.equal(radialButtonRayExtent(-Math.PI * 0.5), 20);
  assert.ok(radialButtonEntryDistance(Math.PI * 5 / 18, {
    radius: 112,
    radiusOffset: 20
  }) > 105);
  assert.deepEqual(radialMenuAngles(4), [
    -Math.PI * 0.5,
    0,
    Math.PI * 0.5,
    Math.PI
  ]);
  assert.equal(radialMenuAngles(5).length, 5);
  assert.equal(radialMenuAngles(7)[0], -Math.PI * 0.5);
  const fourSectors = radialMenuAngles(4).map((_, index, angles) => radialOptionSector(angles, index));
  fourSectors.forEach((sector) => {
    assert.ok(Math.abs(sector.span - (Math.PI * 0.5 - Math.PI / 90)) < 1e-10);
    assert.ok(Math.abs((sector.start - sector.boundaryStart) - Math.PI / 180) < 1e-10);
  });
  assert.ok(Math.abs(fourSectors[0].boundaryStart - (-Math.PI * 0.75)) < 1e-10);
  const unevenSectors = radialMenuAngles(3).map((_, index, angles) => radialOptionSector(angles, index));
  assert.ok(unevenSectors[0].span > unevenSectors[1].span);
  assert.ok(unevenSectors[0].span > unevenSectors[2].span);
  assert.deepEqual(layoutRadialOptions([{ action: "a" }, { action: "b" }]), [
    { action: "a", angle: Math.PI },
    { action: "b", angle: 0 }
  ]);
  const anchored = layoutRadialOptions([
    { action: "back-to-main" },
    { action: "a" },
    { action: "b" },
    { action: "c" }
  ], {
    anchorAction: "back-to-main",
    anchorAngle: Math.PI * 0.5
  });
  assert.equal(anchored.find((option) => option.action === "back-to-main").angle, Math.PI * 0.5);
  const topSubmenu = layoutRadialSubmenuSlots([
    { action: "first" },
    { action: "second" },
    { action: "third" }
  ], -Math.PI * 0.5, { slotCount: 12 });
  assert.deepEqual(topSubmenu.options.map(({ action, radialSlotIndex }) => ({ action, radialSlotIndex })), [
    { action: "first", radialSlotIndex: 0 },
    { action: "second", radialSlotIndex: 1 },
    { action: "third", radialSlotIndex: 11 }
  ]);
  const expectedTopSubmenuAngles = [
    -Math.PI * 0.5,
    -Math.PI / 3,
    Math.PI * 4 / 3
  ];
  topSubmenu.options.forEach(({ angle }, index) => {
    assert.ok(Math.abs(angle - expectedTopSubmenuAngles[index]) < 1e-10);
  });
  assert.equal(topSubmenu.slotAngles.length, 12);
  assert.equal(topSubmenu.hitOptions.length, 12);
  assert.equal(topSubmenu.hitOptions.filter(({ radialPlaceholder }) => radialPlaceholder).length, 9);
  const listSafeSubmenus = layoutRadialOptions([
    { action: "workspace", submenu: "workspace-submenu" },
    { action: "surface", submenu: "surface-submenu" },
    { action: "mode", submenu: "mode-submenu" }
  ], { reserveBottomForList: true });
  assert.deepEqual(listSafeSubmenus.map(({ angle }) => angle), [
    -Math.PI * 0.5,
    0,
    Math.PI
  ]);
  const listSafeMixed = layoutRadialOptions([
    { action: "workspace", submenu: "workspace-submenu" },
    { action: "surface", submenu: "surface-submenu" },
    { action: "mode", submenu: "mode-submenu" },
    { action: "unhide" }
  ], { reserveBottomForList: true });
  assert.equal(listSafeMixed.find(({ action }) => action === "unhide").angle, Math.PI * 0.5);
  assert.equal(radialListCorridorContains(0, 100), true);
  assert.equal(radialListCorridorContains(100, 0), false);
  assert.equal(radialSubmenuTravelAngle(-Math.PI * 0.5), -Math.PI * 0.25);
  assert.equal(radialSubmenuTravelAngle(0), 0);
  assert.deepEqual(radialMenuDimensions(3), { size: 332, radius: 112 });
  assert.deepEqual(radialMenuDimensions(4), { size: 270, radius: 104 });
  assert.equal(radialMenuDimensions(5).radius, 112);
  assert.ok(radialMenuDimensions(5, { buttonWidth: 138, buttonHeight: 42 }).radius > 120);
  assert.ok(radialMenuDimensions(5, {
    buttonWidth: 138,
    buttonHeight: 42,
    gap: 24
  }).radius >= 138);
  [5, 6, 7, 8, 9].forEach((count) => {
    const buttonWidth = 138;
    const buttonHeight = 42;
    const gap = 8;
    const { radius } = radialMenuDimensions(count, { buttonWidth, buttonHeight, gap });
    const points = radialMenuAngles(count).map((angle) => ({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    }));
    points.forEach((point, first) => points.slice(first + 1).forEach((other) => {
      assert.ok(
        Math.abs(point.x - other.x) >= buttonWidth + gap
        || Math.abs(point.y - other.y) >= buttonHeight + gap,
        `${count}-option buttons ${first} and ${first + 1} must not overlap`
      );
    }));
  });
});

test("strand selection restore and explicit replacement reject stale ids", () => {
  assert.deepEqual(emptyStrandSelection(), { activeId: undefined, selectedIds: [] });
  assert.deepEqual(
    restoreStrandSelection({ activeId: "missing", selectedIds: ["a"], validIds: ["a"] }),
    { activeId: undefined, selectedIds: [] }
  );
  assert.deepEqual(
    restoreStrandSelection({ activeId: "a", selectedIds: ["missing", "b"], validIds: ["a", "b"] }),
    { activeId: "a", selectedIds: ["b", "a"] }
  );
  assert.deepEqual(
    resolveStrandSelection({
      requestedId: "b",
      requestedIds: ["b"],
      explicitSelectedIds: ["a", "missing"],
      validIds: ["a", "b"]
    }),
    { activeId: "b", selectedIds: ["a", "b"] }
  );
  assert.deepEqual(
    activateStrandSelection({ selectedIds: ["a", "b"] }, "b"),
    { activeId: "b", selectedIds: ["a", "b"] }
  );
});

test("object marquee selection accepts any projected bounds overlap", () => {
  const marquee = { left: 100, right: 160, top: 80, bottom: 140 };
  assert.equal(screenBoundsOverlap(marquee, { left: 140, right: 220, top: 100, bottom: 180 }), true);
  assert.equal(screenBoundsOverlap(marquee, { left: 110, right: 120, top: 90, bottom: 100 }), true);
  assert.equal(screenBoundsOverlap(marquee, { left: 161, right: 220, top: 100, bottom: 180 }), false);
  assert.equal(screenBoundsOverlap(marquee, null), false);
});

test("object marquee selection rejects empty areas inside broad object bounds", () => {
  const triangle = [
    { x: 20, y: 20 },
    { x: 180, y: 20 },
    { x: 20, y: 40 }
  ];
  assert.equal(triangleIntersectsScreenBounds(triangle, { left: 80, right: 100, top: 24, bottom: 30 }), true);
  assert.equal(triangleIntersectsScreenBounds(triangle, { left: 120, right: 140, top: 80, bottom: 100 }), false);
  assert.equal(triangleIntersectsScreenBounds(triangle, { left: 10, right: 30, top: 10, bottom: 30 }), true);
});

test("bounded history retains its existing stack behavior", () => {
  const history = new BoundedHistory(2);
  history.push("first");
  history.push("second");
  history.push("third");
  assert.equal(history.length, 2);
  assert.equal(history.pop(), "third");
  assert.equal(history.pop(), "second");
});

test("polygon-only OBJ import removes primitives that can reclassify face objects", () => {
  const source = [
    "mtllib head.mtl",
    "o head",
    "v 0 0 0",
    "v 1 0 0",
    "v 1 1 0",
    "v 0 1 0",
    "usemtl skin",
    "f 1/1/1 2/2/2 3/3/3 4/4/4",
    "l 1 2",
    "  p 3",
    "# l 2 3 is only a comment",
    "g eyelashes",
    "f 1 2 3"
  ].join("\r\n");

  const sanitized = polygonOnlyObjSource(source);
  assert.doesNotMatch(sanitized, /^[\t ]*[lp](?:[\t ]|$)/m);
  assert.match(sanitized, /^mtllib head\.mtl$/m);
  assert.match(sanitized, /^usemtl skin$/m);
  assert.match(sanitized, /^f 1\/1\/1 2\/2\/2 3\/3\/3 4\/4\/4$/m);
  assert.match(sanitized, /^# l 2 3 is only a comment$/m);
  assert.match(sanitized, /^g eyelashes$/m);
  assert.match(sanitized, /^f 1 2 3$/m);
  assert.equal(polygonOnlyObjSource("v 0 0 0\nf 1 1 1\n"), "v 0 0 0\nf 1 1 1\n");
});

test("procedural draw distributes accessory strands evenly around its parent", () => {
  const template = proceduralAccessoryTemplateData({ count: 4, radius: 0.75 });
  assert.equal(template.strands.length, 5);
  assert.deepEqual(template.strands[0].points[0], [0, 0, 0]);
  const accessoryRoots = template.strands.slice(1).map((strand) => strand.points[0]);
  assert.deepEqual(template.strands[0].radialOffset, undefined);
  assert.deepEqual(template.strands[1].radialOffset, [0.75, 0]);
  assert.ok(Math.abs(accessoryRoots[0][0] - 0.75) < 1e-12);
  assert.ok(Math.abs(accessoryRoots[0][2]) < 1e-12);
  assert.ok(Math.abs(accessoryRoots[1][0]) < 1e-12);
  assert.ok(Math.abs(accessoryRoots[1][2] - 0.75) < 1e-12);
  assert.ok(Math.abs(accessoryRoots[2][0] + 0.75) < 1e-12);
  assert.ok(Math.abs(accessoryRoots[3][2] + 0.75) < 1e-12);
  accessoryRoots.forEach(([x, , z]) => assert.ok(Math.abs(Math.hypot(x, z) - 0.75) < 1e-12));
});

test("procedural draw supports a parent with no accessory strands", () => {
  const template = proceduralAccessoryTemplateData({ count: 0, radius: 0.75 });
  assert.equal(template.strands.length, 1);
  assert.deepEqual(template.strands[0].points[0], [0, 0, 0]);
});

test("procedural branches attach to evenly distributed positions across the continuous curve", () => {
  const branches = proceduralBranchTemplateData({
    count: 3,
    pointCount: 9,
    length: 0.8,
    tipOffset: 0.4,
    sampleCount: 5
  });
  assert.equal(branches.length, 3);
  assert.deepEqual(branches.map((branch) => branch.parameter), [0.25, 0.5, 0.75]);
  assert.deepEqual(branches.map((branch) => branch.pointIndex), [2, 4, 6]);
  branches.forEach((branch) => {
    assert.deepEqual(branch.localPoints[0], [0, 0, 0]);
    assert.equal(branch.localPoints.length, 5);
    const tip = branch.localPoints.at(-1);
    assert.ok(Math.abs(Math.hypot(...tip) - 0.8) < 1e-12);
    assert.ok(Math.abs(Math.hypot(tip[0], tip[2]) / tip[1] - 0.4) < 1e-12);
  });
});

test("procedural branch spread preserves its fan ratio as branch length changes", () => {
  const shortBranch = proceduralBranchTemplateData({
    count: 1,
    pointCount: 5,
    length: 0.5,
    tipOffset: 0.75
  })[0];
  const longBranch = proceduralBranchTemplateData({
    count: 1,
    pointCount: 5,
    length: 1.5,
    tipOffset: 0.75
  })[0];
  const fanRatio = (branch) => {
    const tip = branch.localPoints.at(-1);
    return Math.hypot(tip[0], tip[2]) / tip[1];
  };
  assert.ok(Math.abs(fanRatio(shortBranch) - 0.75) < 1e-12);
  assert.ok(Math.abs(fanRatio(longBranch) - 0.75) < 1e-12);
  assert.ok(Math.abs(Math.hypot(...shortBranch.localPoints.at(-1)) - 0.5) < 1e-12);
  assert.ok(Math.abs(Math.hypot(...longBranch.localPoints.at(-1)) - 1.5) < 1e-12);
});

test("procedural branch length curves multiply branch length along the parent", () => {
  const branches = proceduralBranchTemplateData({
    count: 3,
    pointCount: 9,
    length: 2,
    tipOffset: 0,
    lengthCurve: [
      { position: 0, value: 0.25, interpolation: "linear" },
      { position: 1, value: 1, interpolation: "linear" }
    ]
  });
  const lengths = branches.map((branch) => Math.hypot(...branch.localPoints.at(-1)));
  assert.deepEqual(branches.map((branch) => branch.parameter), [0.25, 0.5, 0.75]);
  assert.ok(Math.abs(lengths[0] - 0.875) < 1e-12);
  assert.ok(Math.abs(lengths[1] - 1.25) < 1e-12);
  assert.ok(Math.abs(lengths[2] - 1.625) < 1e-12);
});

test("procedural branch shape curves bend interiors while preserving roots and pitched tips", () => {
  const straight = proceduralBranchTemplateData({
    count: 1,
    pointCount: 5,
    length: 1,
    tipOffset: 1,
    sampleCount: 5
  })[0];
  const shaped = proceduralBranchTemplateData({
    count: 1,
    pointCount: 5,
    length: 1,
    tipOffset: 1,
    sampleCount: 5,
    shapeCurve: [
      { position: 0, value: 0, interpolation: "linear" },
      { position: 0.5, value: 0, interpolation: "linear" },
      { position: 1, value: 1, interpolation: "linear" }
    ]
  })[0];
  assert.deepEqual(shaped.localPoints[0], [0, 0, 0]);
  assert.deepEqual(shaped.localPoints.at(-1), straight.localPoints.at(-1));
  assert.ok(Math.abs(shaped.localPoints[2][0]) < 1e-12);
  assert.ok(Math.abs(straight.localPoints[2][0]) > 0.3);
});

test("procedural branch count can exceed the number of authored control points", () => {
  const branches = proceduralBranchTemplateData({ count: 8, pointCount: 4 });
  assert.equal(branches.length, 8);
  assert.ok(Math.abs(branches[0].parameter - 1 / 9) < 1e-12);
  assert.ok(Math.abs(branches.at(-1).parameter - 8 / 9) < 1e-12);
});

test("procedural accessories inherit the parent width and depth taper", () => {
  const primary = [
    { position: 0, value: 1, interpolation: "linear" },
    { position: 1, value: 0.2, interpolation: "linear" }
  ];
  const secondary = [
    { position: 0, value: 0.8, interpolation: "linear" },
    { position: 1, value: 0.1, interpolation: "linear" }
  ];
  const scale = proceduralAccessoryTaperScale({
    taperCurve: primary,
    taperCurveSecondary: secondary,
    depthCurve: primary,
    depthCurveSecondary: secondary,
    asymmetricWidthCurve: true,
    asymmetricDepthCurve: true,
    pointScales: [{ x: 1, z: 1 }, { x: 0.5, z: 0.75 }]
  }, 1, -1, 1);
  assert.ok(Math.abs(scale.x - 0.05) < 1e-12);
  assert.ok(Math.abs(scale.z - 0.15) < 1e-12);
});

test("procedural duplicate amounts evenly divide the selected source interval", () => {
  assert.deepEqual(evenlySpacedInteriorAmounts(1), [0.5]);
  assert.deepEqual(evenlySpacedInteriorAmounts(2), [1 / 3, 2 / 3]);
  assert.deepEqual(evenlySpacedInteriorAmounts(3), [0.25, 0.5, 0.75]);
});

test("procedural duplicate curve rows follow a shared cylindrical arc", () => {
  const center = { x: 0, y: 0, z: 0 };
  const midpoint = cylindricalArcPointData(
    { x: 2, y: 1, z: 0 },
    { x: 0, y: 3, z: 2 },
    center,
    0.5
  );
  assert.ok(Math.abs(midpoint.x - Math.SQRT2) < 1e-12);
  assert.ok(Math.abs(midpoint.z - Math.SQRT2) < 1e-12);
  assert.equal(midpoint.y, 2);

  const blended = blendCylindricalPolylinePointData(
    [{ x: 1, y: 1, z: 0 }, { x: 2, y: -1, z: 0 }],
    [{ x: 0, y: 1, z: 1 }, { x: 0, y: -1, z: 2 }],
    center,
    0.5,
    2
  );
  assert.ok(Math.abs(blended[0].x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(blended[0].z - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(blended[1].x - Math.SQRT2) < 1e-12);
  assert.ok(Math.abs(blended[1].z - Math.SQRT2) < 1e-12);
  assert.deepEqual(blended.map((point) => point.y), [1, -1]);
});

test("procedural duplicate curves stop at the lowest horizontal plane shared by both sources", () => {
  const first = [
    { x: 2, y: 3, z: 0 },
    { x: 2, y: 1, z: 0 },
    { x: 2, y: -2, z: 0 }
  ];
  const second = [
    { x: 0, y: 3, z: 2 },
    { x: 0, y: 0, z: 2 }
  ];
  const shared = lowestSharedHorizontalPolylinePointData(first, second);
  assert.equal(shared.limitY, 0);
  assert.deepEqual(shared.intersections, [
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 0, z: 2 }
  ]);

  const blended = blendCylindricalPolylinePointData(first, second, { x: 0, y: 0, z: 0 }, 0.5, 4);
  assert.equal(blended.at(-1).y, 0);
  assert.ok(Math.abs(blended.at(-1).x - Math.SQRT2) < 1e-12);
  assert.ok(Math.abs(blended.at(-1).z - Math.SQRT2) < 1e-12);
  assert.ok(blended.every((point) => point.y >= 0));
});

test("procedural duplicate horizontal circles pass through unequal-radius source intersections", () => {
  const first = { x: 3, y: -1, z: 0 };
  const second = { x: 0, y: -1, z: 2 };
  const circle = horizontalCircleThroughPointData(first, second, { x: 0, y: 0, z: 0 });
  const start = horizontalCirclePointData(circle, 0);
  assert.ok(Math.abs(start.x - first.x) < 1e-12);
  assert.ok(Math.abs(start.y - first.y) < 1e-12);
  assert.ok(Math.abs(start.z - first.z) < 1e-12);
  const end = horizontalCirclePointData(circle, 1);
  assert.ok(Math.abs(end.x - second.x) < 1e-12);
  assert.ok(Math.abs(end.y - second.y) < 1e-12);
  assert.ok(Math.abs(end.z - second.z) < 1e-12);
});

test("procedural duplicate root correction ends at the selected strand position", () => {
  assert.equal(rootCorrectionFalloff(0, 0), 1);
  assert.equal(rootCorrectionFalloff(0.01, 0), 0);
  assert.equal(rootCorrectionFalloff(0, 0.5), 1);
  assert.ok(Math.abs(rootCorrectionFalloff(0.25, 0.5) - 0.5) < 1e-12);
  assert.equal(rootCorrectionFalloff(0.5, 0.5), 0);
  assert.equal(rootCorrectionFalloff(1, 0.5), 0);
});
import {
  curveLatticeLoopPointIndices,
  DEFAULT_CURVE_LATTICE_PLANE,
  flatCurveLatticePointData,
  resampleCurveLatticePointData
} from "../modules/curve-lattice.js";
import {
  createLoftSurfaceLatticePointData,
  createSurfaceLatticePointData,
  mirroredSurfaceLatticePointIndex,
  resampleSurfaceLatticePointData,
  sampleSurfaceLattice,
  surfaceLatticePointIndex,
  surfaceLatticeWireSegments
} from "../modules/surface-lattice.js";
import {
  buildConnectedCurveCardGrid,
  buildCurveSurfaceGrid,
  curveSurfaceControlPointCount,
  curveSurfaceControllerSideDirections,
  curveSurfaceCurveLateralScore,
  curveSurfaceLineLength,
  orientCurveSurfaceLine,
  resampleCurveSurfaceLine
} from "../modules/curve-surface.js";
import {
  cameraFacingPlaneNormal,
  inflateSculptPointScale,
  pointInCameraFacingHalfSpace,
  proportionalSculptWeights,
  sculptBrushWeight,
  smoothSculptPointDeltas
} from "../modules/sculpt-brush.js";

test("sculpt brush falloff supports hard and soft influence radii", () => {
  assert.equal(sculptBrushWeight(0, 100, 0.5), 1);
  assert.equal(sculptBrushWeight(50, 100, 0.5), 1);
  assert.equal(sculptBrushWeight(100, 100, 0.5), 0);
  assert.equal(sculptBrushWeight(75, 100, 0), 1);
  assert.equal(sculptBrushWeight(101, 100, 0), 0);
  assert.ok(sculptBrushWeight(75, 100, 0.5) > 0);
  assert.ok(sculptBrushWeight(75, 100, 0.5) < 1);
});

test("inflate sculpt scales widen and thicken without changing curve positions", () => {
  assert.deepEqual(
    inflateSculptPointScale({ x: 1, z: 1 }, 0.5, 0.4, 45, 90),
    { x: 1.1, z: 1.1 }
  );
  assert.deepEqual(
    inflateSculptPointScale({ x: 1.2, z: 0.8 }, 1, 0.5, 180, 90),
    { x: 1.7, z: 1.3 }
  );
  assert.deepEqual(
    inflateSculptPointScale({ x: 1.2, z: 0.8 }, 0, 1, 90, 90),
    { x: 1.2, z: 0.8 }
  );
});

test("smooth sculpt deltas preserve the root and relax weighted curve points", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 2, y: 0, z: 0 }
  ];
  const deltas = smoothSculptPointDeltas(points, [1, 1, 0.5], 1, 0.5);
  assert.deepEqual(deltas[0], { x: 0, y: 0, z: 0 });
  assert.deepEqual(deltas[1], { x: 0, y: -1, z: 0 });
  assert.deepEqual(deltas[2], { x: -0.25, y: 0.5, z: 0 });
  assert.deepEqual(
    smoothSculptPointDeltas(points, [1, 1, 0.5], 1, 0.5, { preserveTip: true }),
    [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 0 }
    ]
  );
  assert.deepEqual(smoothSculptPointDeltas(points, [1, 1, 1], 0), [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 }
  ]);
  assert.deepEqual(smoothSculptPointDeltas(points, [1, 1, 1], 0.5), [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: -0.04, z: 0 },
    { x: -0.02, y: 0.04, z: 0 }
  ]);
});

test("sculpt proportional editing spreads brush seeds along the curve while preserving the root", () => {
  assert.deepEqual(
    proportionalSculptWeights([0, 0, 1, 0, 0], 2, 1),
    [0, 0.5, 1, 0.5, 0]
  );
  assert.deepEqual(
    proportionalSculptWeights([0, 0, 0.4, 0, 0], 2, 0),
    [0, 0.4, 0.4, 0.4, 0.4]
  );
  assert.deepEqual(
    proportionalSculptWeights([1, 0.5, 0], 2, 1),
    [0, 0.5, 0.25]
  );
});

test("brush viability follows a camera-facing plane through the origin", () => {
  const normal = cameraFacingPlaneNormal({ x: 3, y: 0, z: 4 });
  assert.deepEqual(normal, { x: 0.6, y: 0, z: 0.8 });
  assert.deepEqual(cameraFacingPlaneNormal({ x: 0, y: 0, z: 0 }), { x: 0, y: 0, z: 1 });
  assert.equal(pointInCameraFacingHalfSpace({ x: 2, y: 0, z: 0 }, normal), true);
  assert.equal(pointInCameraFacingHalfSpace({ x: -2, y: 0, z: 0 }, normal), false);
  assert.equal(pointInCameraFacingHalfSpace({ x: -2, y: 0, z: 2 }, normal), true);
  assert.equal(pointInCameraFacingHalfSpace({ x: 0.5, y: 0, z: 0 }, normal, 1), false);
  assert.equal(pointInCameraFacingHalfSpace({ x: 2, y: 0, z: 0 }, normal, 1), true);
});

test("the default standalone curve lattice is a flat 3 by 3 plane", () => {
  const points = flatCurveLatticePointData();
  const uniqueX = [...new Set(points.map((point) => Number(point.x.toFixed(2))))];
  const uniqueY = [...new Set(points.map((point) => Number(point.y.toFixed(2))))];

  assert.equal(points.length, 9);
  assert.deepEqual(uniqueX, [-0.75, 0, 0.75]);
  assert.deepEqual(uniqueY, [1.45, 0.75, 0.05]);
  assert.ok(points.every((point) => point.z === DEFAULT_CURVE_LATTICE_PLANE.z));
});

test("curve lattice loop resampling preserves the plane bounds and adds both loop directions", () => {
  const source = flatCurveLatticePointData();
  const points = resampleCurveLatticePointData(source, 3, 3, 5, 4);

  assert.equal(points.length, 20);
  assert.deepEqual(points[0], source[0]);
  assert.deepEqual(points.at(-1), source.at(-1));
  assert.equal(new Set(points.map((point) => point.x.toFixed(4))).size, 5);
  assert.equal(new Set(points.map((point) => point.y.toFixed(4))).size, 4);
  assert.ok(points.every((point) => point.z === DEFAULT_CURVE_LATTICE_PLANE.z));
});

test("curve lattice edge loops resolve complete horizontal and vertical point selections", () => {
  assert.deepEqual(curveLatticeLoopPointIndices(4, 3, "horizontal", 1), [4, 5, 6, 7]);
  assert.deepEqual(curveLatticeLoopPointIndices(4, 3, "vertical", 2), [2, 6, 10]);
  assert.deepEqual(curveLatticeLoopPointIndices(4, 3, "horizontal", 3), []);
});

test("strand point removal protects roots, shortens tips, and redistributes a local curve window", () => {
  assert.equal(curvePointRemovalPlan(6, 0), null);
  assert.equal(curvePointRemovalPlan(2, 1), null);
  assert.deepEqual(curvePointRemovalPlan(5, 4), {
    removedIndex: 4,
    shortenedTip: true,
    parameters: [0, 0.25, 0.5, 0.75]
  });

  const interior = curvePointRemovalPlan(6, 3);
  assert.equal(interior.removedIndex, 3);
  assert.equal(interior.shortenedTip, false);
  assert.equal(interior.parameters.length, 5);
  assert.equal(interior.parameters[0], 0);
  assert.equal(interior.parameters[1], 0.2);
  assert.ok(Math.abs(interior.parameters[2] - 7 / 15) < 1e-12);
  assert.ok(Math.abs(interior.parameters[3] - 11 / 15) < 1e-12);
  assert.equal(interior.parameters[4], 1);
});

test("curve rebuild parameters support native and even arc-length spacing", () => {
  assert.deepEqual(curveRebuildParameters(4, false, [0, 1, 4]), [0, 1 / 3, 2 / 3, 1]);
  assert.deepEqual(curveRebuildParameters(2, true, [0, 1, 4]), [0, 1]);
  const evenlySpaced = curveRebuildParameters(3, true, [0, 1, 4]);
  assert.equal(evenlySpaced.length, 3);
  assert.equal(evenlySpaced[0], 0);
  assert.ok(Math.abs(evenlySpaced[1] - 2 / 3) < 1e-12);
  assert.equal(evenlySpaced[2], 1);
  assert.deepEqual(curveRebuildParameters(1, false), [0, 1]);
});

test("rotation relaxation averages neighboring angles across the wrap boundary", () => {
  assert.equal(relaxAngleValue(0, 1, 3, 0.5), 1);
  assert.ok(Math.abs(relaxAngleValue(
    Math.PI,
    Math.PI - 0.2,
    -Math.PI + 0.2,
    1
  ) - Math.PI) < 1e-12);
  const oppositeCurrent = relaxAngleValue(
    0,
    Math.PI - 0.02,
    -Math.PI + 0.02,
    1
  );
  assert.ok(Math.abs(Math.abs(oppositeCurrent) - Math.PI) < 1e-12);
  assert.ok(Math.abs(relaxAngleValue(Math.PI * 2 + 0.2, -0.1, 0.1, 1) - Math.PI * 2) < 1e-12);
  assert.equal(relaxAngleValue(0.5, -2, 2, 0), 0.5);
});

test("position relaxation follows surrounding curve instead of flattening to the neighbor chord", () => {
  const points = [
    { x: -2, y: 4, z: 0 },
    { x: -1, y: 1, z: 0 },
    { x: 0, y: 0.2, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 2, y: 4, z: 0 }
  ];
  const target = curvedRelaxPositionTarget(points, 2);
  assert.equal(target.x, 0);
  assert.ok(Math.abs(target.y + 0.1) < 1e-12);
  assert.equal(target.z, 0);
  assert.notEqual(target.y, 1);
  const nearRootTarget = curvedRelaxPositionTarget(points, 1);
  assert.equal(nearRootTarget.x, -1);
  assert.ok(Math.abs(nearRootTarget.y - 1.2) < 1e-12);
  assert.equal(nearRootTarget.z, 0);
  assert.deepEqual(
    curvedRelaxPositionTarget(points.slice(0, 3), 1),
    { x: -1, y: 2.1, z: 0 }
  );
});

test("procedural curve blending resamples asymmetric control counts and follows placement proximity", () => {
  const first = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 2, z: 0 }
  ];
  const second = [
    { x: 4, y: 0, z: 0 },
    { x: 5, y: 0.5, z: 0 },
    { x: 5, y: 1.5, z: 0 },
    { x: 4, y: 2, z: 0 }
  ];
  const blended = blendRelativePolylinePointData(first, second, 0.5);

  assert.equal(blended.length, 4);
  assert.deepEqual(blended[0], { x: 0, y: 0, z: 0 });
  assert.deepEqual(blended.at(-1), { x: 0, y: 2, z: 0 });
  assert.ok(blended[1].x > 0);
  assert.equal(proximityCurveBlendAmount({ x: 0, y: 0, z: 0 }, first[0], second[0]), 0);
  assert.equal(proximityCurveBlendAmount({ x: 4, y: 0, z: 0 }, first[0], second[0]), 1);
  assert.equal(proximityCurveBlendAmount({ x: 2, y: 0, z: 0 }, first[0], second[0]), 0.5);
  const blendedDirection = blendDirectionPointData(
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    0.5
  );
  assert.ok(Math.abs(blendedDirection.x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(blendedDirection.y - Math.SQRT1_2) < 1e-12);
  assert.equal(blendedDirection.z, 0);
  assert.deepEqual(polylineMidpointPointData([
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 }
  ]), { x: 2, y: 0, z: 0 });
  assert.ok(Math.abs(surfaceArcBlendAmount(
    { x: Math.SQRT1_2, y: Math.SQRT1_2, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 0 }
  ) - 0.5) < 1e-12);
  const arc = surfaceArcPolylinePointData(
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 0 },
    2
  );
  assert.deepEqual(arc[0], { x: 1, y: 0, z: 0 });
  assert.ok(Math.abs(arc[1].x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(arc[1].y - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(arc[2].x) < 1e-12);
  assert.equal(arc[2].y, 1);
  const xzPlaneArc = surfaceArcPolylinePointData(
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 0 },
    2,
    "y"
  );
  assert.ok(Math.abs(xzPlaneArc[0].x - 1) < 1e-12);
  assert.ok(Math.abs(xzPlaneArc[1].x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(xzPlaneArc[2].x) < 1e-12);
  assert.ok(xzPlaneArc.every((point) => point.y === 0.5));
  const oriented = blendSurfaceOrientedPolylinePointData(
    [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 2 }],
    [{ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }],
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 0 },
    { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 },
    0.5
  );
  assert.ok(Math.abs(oriented[1].x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(oriented[1].z - Math.SQRT1_2) < 1e-12);
  const directionPreserving = blendSurfaceOrientedPolylinePointData(
    [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }],
    [{ x: 0, y: 0, z: 0 }, { x: 0, y: -2, z: 0 }],
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: 1 },
    0.5
  );
  assert.ok(Math.abs(Math.hypot(
    directionPreserving[1].x,
    directionPreserving[1].y,
    directionPreserving[1].z
  ) - 2) < 1e-12);
  assert.deepEqual(blendSampleArrays([1, 3], [3, 5, 7], 0.5, 3), [2, 3.5, 5]);

  const taper = blendTaperCurves(
    [{ position: 0, value: 1 }, { position: 1, value: 0 }],
    [{ position: 0, value: 0.5 }, { position: 0.5, value: 1 }, { position: 1, value: 0.5 }],
    0.5
  );
  assert.deepEqual(taper.map((point) => point.position), [0, 0.5, 1]);
  assert.equal(taper[0].value, 0.75);
  assert.equal(taper.at(-1).value, 0.25);
});

test("surface lattice keeps center root and tip compatibility while sampling a smooth 3 by 3 cage", () => {
  assert.equal(surfaceLatticePointIndex(0, 1), 0);
  assert.equal(surfaceLatticePointIndex(2, 1), 8);
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 1, z: 0 },
    { x: 0, y: 1, z: 1 },
    { x: 1, y: 1, z: 0 },
    { x: -1, y: 2, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 0, y: 2, z: 0 }
  ];
  const center = sampleSurfaceLattice(points, 0.5, 0.5);
  assert.deepEqual(center.point, { x: 0, y: 1, z: 1 });
  assert.ok(sampleSurfaceLattice(points, 0.25, 0.5).point.z > 0);
  assert.equal(surfaceLatticeWireSegments(points).length, 192);
});

test("surface lattice adds horizontal and vertical control points while preserving a flat plane", () => {
  const source = createSurfaceLatticePointData();
  const points = resampleSurfaceLatticePointData(source, 3, 3, 7, 5);

  assert.equal(points.length, 35);
  assert.equal(surfaceLatticePointIndex(0, 3, 7, 5), 0);
  assert.equal(surfaceLatticePointIndex(4, 3, 7, 5), 34);
  assert.equal(mirroredSurfaceLatticePointIndex(0, 7, 5), 0);
  assert.equal(
    mirroredSurfaceLatticePointIndex(
      surfaceLatticePointIndex(2, 1, 7, 5),
      7,
      5
    ),
    surfaceLatticePointIndex(2, 5, 7, 5)
  );
  assert.deepEqual(points[0], source[0]);
  assert.ok(Math.abs(points.at(-1).x - source.at(-1).x) < 1e-9);
  assert.ok(Math.abs(points.at(-1).y - source.at(-1).y) < 1e-9);
  assert.ok(Math.abs(points.at(-1).z - source.at(-1).z) < 1e-9);
  assert.ok(points.every((point) => Math.abs(point.z - 1.05) < 1e-9));
  assert.equal(surfaceLatticeWireSegments(points, 7, 5).length, 928);
  const center = sampleSurfaceLattice(points, 0.5, 0.5, 7, 5);
  assert.ok(Math.abs(center.point.x) < 1e-9);
  assert.ok(Math.abs(center.point.y - 0.75) < 1e-9);
});

test("curve surface grid creates a centered strip and extends with additional curves", () => {
  const center = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 }
  ];
  const right = [
    { x: 0.7, y: 0, z: 0 },
    { x: 0.8, y: 1, z: 0.1 },
    { x: 0.9, y: 2, z: 0 }
  ];
  const first = buildCurveSurfaceGrid([center], { rows: 5, stripWidth: 0.2, side: { x: 1, y: 0, z: 0 } });
  const extended = buildCurveSurfaceGrid([center, right], { rows: 5, stripWidth: 0.2, side: { x: 1, y: 0, z: 0 } });
  assert.equal(first.columns, 3);
  assert.equal(first.rows, 5);
  assert.equal(first.points.length, 15);
  assert.equal(extended.columns, 4);
  assert.equal(extended.points.length, 20);
  assert.equal(first.points[2].x, 0.2);
  assert.equal(extended.points[5].x, 0);
  assert.equal(extended.points.at(-1).x, right.at(-1).x);
  assert.deepEqual(extended.attachments, ["center", "right"]);
  assert.deepEqual(extended.sourceColumns, [1, 3]);
  assert.ok(curveSurfaceCurveLateralScore(right, center, { x: 1, y: 0, z: 0 }) > 0);
  assert.equal(resampleCurveSurfaceLine(center, 7).length, 7);
});

test("curve surface strokes attach only to exterior boundaries without reordering prior columns", () => {
  const center = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }];
  const right = [{ x: 0.7, y: 2, z: 0 }, { x: 0.7, y: 0, z: 0 }];
  const left = [{ x: -0.8, y: 0, z: 0 }, { x: -0.8, y: 2, z: 0 }];
  const inside = [{ x: 0.1, y: 0, z: 0 }, { x: 0.1, y: 2, z: 0 }];
  const grid = buildCurveSurfaceGrid([center, right, left, inside], {
    rows: 3,
    stripWidth: 0.2,
    side: { x: 1, y: 0, z: 0 }
  });
  assert.equal(grid.columns, 5);
  assert.deepEqual(grid.attachments, ["center", "right", "left", null]);
  assert.deepEqual(grid.sourceColumns, [2, 4, 0, null]);
  assert.deepEqual(grid.rejectedCurveIndices, [3]);
  assert.equal(grid.points[0].x, -0.8);
  assert.equal(grid.points[4].x, 0.7);
  assert.equal(orientCurveSurfaceLine(right, center, 3)[0].y, 0);
});

test("curve surface resampling uses arc length instead of pointer sample density", () => {
  const sampled = resampleCurveSurfaceLine([
    { x: 0, y: 0, z: 0 },
    { x: 0.1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 }
  ], 5);
  assert.deepEqual(sampled.map((point) => point.x), [0, 0.5, 1, 1.5, 2]);
  assert.equal(curveSurfaceLineLength(sampled), 2);
});

test("curve surface controller stepping adds points as curves get longer", () => {
  const short = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0.4, z: 0 }];
  const standard = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1.5, z: 0 }];
  const long = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 3, z: 0 }];
  assert.equal(curveSurfaceControlPointCount([short]), 3);
  assert.equal(curveSurfaceControlPointCount([standard]), 6);
  assert.equal(curveSurfaceControlPointCount([long]), 11);
  assert.equal(curveSurfaceControlPointCount([short, long]), 11);
});

test("connected curve cards keep curves as midpoint loops and share derived edges", () => {
  const left = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }];
  const right = [{ x: 1, y: 0, z: 0 }, { x: 1, y: 2, z: 0 }];
  const single = buildConnectedCurveCardGrid([left], {
    rows: 3,
    stripWidth: 0.2,
    side: { x: 1, y: 0, z: 0 }
  });
  const connected = buildConnectedCurveCardGrid([left, right], {
    rows: 3,
    stripWidth: 0.2,
    side: { x: 1, y: 0, z: 0 }
  });
  assert.equal(single.columns, 3);
  assert.equal(single.points[0].x, -0.2);
  assert.equal(single.points[1].x, 0);
  assert.equal(single.points[2].x, 0.2);
  assert.equal(connected.columns, 5);
  assert.equal(connected.points[0].x, -0.2);
  assert.equal(connected.points[1].x, 0);
  assert.equal(connected.points[2].x, 0.5);
  assert.equal(connected.points[3].x, 1);
  assert.equal(connected.points[4].x, 1.2);
  assert.deepEqual(connected.controllerCurves[0][1], { x: 0, y: 1, z: 0 });
});

test("connected curve cards weld the averaged edges of rotated controller frames", () => {
  const left = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }];
  const right = [{ x: 1, y: 0, z: 0 }, { x: 1, y: 2, z: 0 }];
  const grid = buildConnectedCurveCardGrid([left, right], {
    rows: 3,
    stripWidth: 0.2,
    side: { x: 1, y: 0, z: 0 },
    controllerSides: [
      Array.from({ length: 3 }, () => ({ x: 1, y: 0, z: 0 })),
      Array.from({ length: 3 }, () => ({ x: 0, y: 0, z: 1 }))
    ]
  });
  assert.deepEqual(grid.points[0], { x: -0.2, y: 0, z: 0 });
  assert.deepEqual(grid.points[1], { x: 0, y: 0, z: 0 });
  assert.ok(Math.abs(grid.points[2].x - 0.6) < 1e-9);
  assert.ok(Math.abs(grid.points[2].y) < 1e-9);
  assert.ok(Math.abs(grid.points[2].z + 0.1) < 1e-9);
  assert.deepEqual(grid.points[3], { x: 1, y: 0, z: 0 });
  assert.deepEqual(grid.points[4], { x: 1, y: 0, z: 0.2 });
  assert.equal(grid.columns, 5);
});

test("curve surface controller sides follow the local span between neighboring curves", () => {
  const left = [
    { x: -1, y: 0, z: 0 },
    { x: -1, y: 1, z: 0 },
    { x: -1, y: 2, z: 0 }
  ];
  const right = [
    { x: 1, y: 0, z: 1 },
    { x: 1, y: 1, z: 1 },
    { x: 1, y: 2, z: 1 }
  ];
  const sides = curveSurfaceControllerSideDirections([left, right], { x: 1, y: 0, z: 0 });
  const expected = 1 / Math.sqrt(5);
  assert.ok(Math.abs(sides[0][1].x - 2 * expected) < 1e-9);
  assert.ok(Math.abs(sides[0][1].y) < 1e-9);
  assert.ok(Math.abs(sides[0][1].z - expected) < 1e-9);
  assert.deepEqual(sides[0][1], sides[1][1]);
});

test("single-controller curve surfaces retain their authored fallback side", () => {
  const curve = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 }
  ];
  const sides = curveSurfaceControllerSideDirections([curve], { x: 1, y: 0, z: 0 });
  assert.deepEqual(sides, [[
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 }
  ]]);
});

test("loft surface lattice combines horizontal and vertical profile curves at their midpoints", () => {
  const horizontalPoints = [
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0.2, z: 0.4 },
    { x: 1, y: 0, z: 0 }
  ];
  const verticalPoints = [
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 0.2 },
    { x: 0, y: -1, z: 0.6 }
  ];
  const points = createLoftSurfaceLatticePointData({
    horizontalPoints,
    verticalPoints
  });
  const assertPointClose = (actual, expected) => {
    assert.ok(Math.abs(actual.x - expected.x) < 1e-9);
    assert.ok(Math.abs(actual.y - expected.y) < 1e-9);
    assert.ok(Math.abs(actual.z - expected.z) < 1e-9);
  };

  assert.equal(points.length, 9);
  assertPointClose(
    points[surfaceLatticePointIndex(1, 0)],
    horizontalPoints[0]
  );
  assertPointClose(
    points[surfaceLatticePointIndex(1, 1)],
    horizontalPoints[1]
  );
  assertPointClose(
    points[surfaceLatticePointIndex(1, 2)],
    horizontalPoints[2]
  );
  assertPointClose(
    points[surfaceLatticePointIndex(0, 1)],
    { x: 0, y: 1.2, z: 0.2 }
  );
  assertPointClose(
    points[surfaceLatticePointIndex(2, 1)],
    { x: 0, y: -0.8, z: 0.8 }
  );
  assert.deepEqual(createLoftSurfaceLatticePointData({ horizontalPoints, verticalPoints: [] }), []);
});

test("asymmetric taper sampling selects the secondary curve only for the negative side", () => {
  const primary = [
    { position: 0, value: 1, interpolation: "linear" },
    { position: 1, value: 0.5, interpolation: "linear" }
  ];
  const secondary = [
    { position: 0, value: 0.4, interpolation: "linear" },
    { position: 1, value: 0.2, interpolation: "linear" }
  ];

  assert.equal(sampleAsymmetricTaperCurve(primary, secondary, true, 1, 0.5), 0.75);
  assert.ok(Math.abs(sampleAsymmetricTaperCurve(primary, secondary, true, -1, 0.5) - 0.3) < 1e-9);
  assert.equal(sampleAsymmetricTaperCurve(primary, secondary, false, -1, 0.5), 0.75);
});

test("profile topology centering preserves edges and fully shifts the center line", () => {
  assert.equal(profileTopologyCenterWeight(-2, -2, 3), 0);
  assert.equal(profileTopologyCenterWeight(3, -2, 3), 0);
  assert.equal(profileTopologyCenterWeight(0, -2, 3), 1);
  assert.equal(profileTopologyCenterWeight(-1, -2, 3), 0.5);
  assert.ok(Math.abs(profileTopologyCenterWeight(1, -2, 3) - (2 / 3)) < 1e-9);
});

test("panel tip curve bows opposite portions of the fringe while preserving the root", () => {
  assert.equal(panelTipCurveParameter(0, 0, 1), 0);
  assert.equal(panelTipCurveParameter(0.5, 0, 1), 0.5);
  assert.equal(panelTipCurveParameter(1, 0, 1), 1);
  assert.equal(panelTipCurveParameter(1, 1, 1), 0.7);
  assert.equal(panelTipCurveParameter(1, 0, -1), 0.7);
  assert.equal(panelTipCurveParameter(1, 1, -1), 1);
  assert.equal(panelTipCurveParameter(1, 0, 0, 0.25), 0.75);
  assert.ok(panelTipCurveParameter(0.75, 1, 1) > panelTipCurveParameter(0.5, 1, 1));
});

test("panel tip loops preserve base rows and subdivide only the lower fringe", () => {
  const parameters = panelTipLoopParameters(10, 6);
  assert.equal(parameters.length, 17);
  assert.deepEqual(panelTipLoopParameters(10, 0), Array.from({ length: 11 }, (_, index) => index / 10));
  for (let index = 0; index <= 10; index += 1) {
    assert.ok(parameters.some((parameter) => Math.abs(parameter - index / 10) < 1e-9));
  }
  const added = parameters.filter((parameter) => (
    !Array.from({ length: 11 }, (_, index) => index / 10)
      .some((baseParameter) => Math.abs(baseParameter - parameter) < 1e-9)
  ));
  assert.ok(added.every((parameter) => parameter >= 0.55 && parameter <= 1));
  assert.ok(parameters.every((parameter, index) => index === 0 || parameter > parameters[index - 1]));
});

test("closed profile parameters mirror radial rails around the authored symmetry axis", () => {
  const axis = 1 / 3;
  const parameters = symmetricClosedCurveParameters(14, axis, [axis, 0.1]);
  parameters.forEach((parameter) => {
    const mirrored = ((axis * 2 - parameter) % 1 + 1) % 1;
    assert.ok(parameters.some((candidate) => Math.abs(candidate - mirrored) < 0.00001));
  });
  assert.equal(parameters.filter((parameter) => Math.abs(parameter - axis) < 0.00001).length, 1);
  assert.ok(parameters.every((value, index) => index === 0 || value > parameters[index - 1]));
});

test("mirrored asymmetric width curves exchange their profile sides", () => {
  const primary = [{ position: 0, value: 1 }, { position: 1, value: 0.2 }];
  const secondary = [{ position: 0, value: 0.45 }, { position: 1, value: 0.05 }];
  const mirrored = mirroredAsymmetricTaperCurves(primary, secondary, true);
  assert.deepEqual(mirrored.primary, secondary);
  assert.deepEqual(mirrored.secondary, primary);
  assert.notEqual(mirrored.primary, secondary);
  const roundTrip = mirroredAsymmetricTaperCurves(mirrored.primary, mirrored.secondary, true);
  assert.deepEqual(roundTrip.primary, primary);
  assert.deepEqual(roundTrip.secondary, secondary);
  const symmetric = mirroredAsymmetricTaperCurves(primary, secondary, false);
  assert.deepEqual(symmetric, { primary, secondary });
});
import { exportHairFaces, hairFaceIndices, orderedFanBoundary } from "../modules/obj-export.js";
import { exportAnimeHairUsda, usdIdentifier } from "../modules/usda-export.js";
import {
  cleanFileBaseName,
  fileNameForAction,
  normalizeExportContents
} from "../modules/file-actions.js";
import { applicationDropFileKind } from "../modules/file-drop.js";
import { uvCoordinateBounds, uvViewTransform } from "../modules/uv-inspector.js";
import { createHairProject, projectFileName, validateHairProject } from "../modules/project-schema.js";
import {
  createProjectRestorePlan,
  createProjectSelectionSnapshot,
  projectSnapshotLocks
} from "../modules/project-state.js";
import {
  fanTriangleEdgeMasks,
  parseObjFaceVertexCounts,
  quadCellTopology,
  triangleEdgeMasksFromFaces
} from "../modules/topology.js";
import {
  emptyToolPresetLibrary,
  normalizeToolPresetLibrary,
  removeToolPreset
} from "../modules/tool-presets.js";
import {
  emptyShapePresetLibrary,
  normalizeShapePresetLibrary,
  removeShapePreset
} from "../modules/shape-presets.js";
import {
  createPreferencesBackup,
  normalizePreferencesBackup,
  preferencesBackupFileName
} from "../modules/preferences-backup.js";
import {
  createClumpBrushTemplate,
  normalizeClumpBrushTemplate
} from "../modules/clump-brush-presets.js";
import {
  readStoredBooleanPreference,
  readStoredPreference,
  writeStoredPreference
} from "../modules/preference-storage.js";
import {
  appendPolyQuad,
  bridgePolyEdges,
  deletePolyEdge,
  deletePolyFaceAndOrphans,
  deletePolyVertex,
  polyBoundaryEdges,
  polyFillCandidate,
  polyMeshBuffers,
  relaxPolyPoints
} from "../modules/poly-topology.js";
import {
  ANIME_ANISOTROPIC_DEFAULTS,
  ANIME_ANISOTROPIC_SHADER,
  LAMBERT_SHADER,
  normalizeAnimeAnisotropicSettings,
  normalizeHairShader,
  STANDARD_ANISOTROPIC_SHADER
} from "../modules/anime-hair-shaders.js";
import {
  hairMaterialPresetValue,
  hairMaterialUsageCounts,
  MAX_HAIR_GRADIENT_STOPS,
  normalizeHairGradientStops,
  normalizeHairMaterialDefinition,
  normalizeHairMaterialPresetLibrary,
  removeHairMaterialPreset,
  resolveHairMaterialDefinition
} from "../modules/material-state.js";

test("preference storage preserves defaults, normalization, and unavailable-storage fallbacks", () => {
  const values = new Map([
    ["enabled", "true"],
    ["disabled", "false"],
    ["invalid", "sometimes"],
    ["language", "JA"]
  ]);
  const host = {
    localStorage: {
      getItem(key) {
        return values.get(key) ?? null;
      },
      setItem(key, value) {
        values.set(key, value);
      }
    }
  };

  assert.equal(readStoredBooleanPreference(host, "enabled", false), true);
  assert.equal(readStoredBooleanPreference(host, "disabled", true), false);
  assert.equal(readStoredBooleanPreference(host, "missing", true), true);
  assert.equal(readStoredBooleanPreference(host, "invalid", false), false);
  assert.equal(
    readStoredPreference(host, "language", {
      fallback: "en",
      normalize: (value) => value.toLowerCase()
    }),
    "ja"
  );
  assert.equal(writeStoredPreference(host, "enabled", false), true);
  assert.equal(values.get("enabled"), "false");

  const unavailableHost = {
    get localStorage() {
      throw new Error("blocked");
    }
  };
  assert.equal(readStoredBooleanPreference(unavailableHost, "enabled", true), true);
  assert.equal(readStoredPreference(unavailableHost, "language", { fallback: "en" }), "en");
  assert.equal(writeStoredPreference(unavailableHost, "enabled", true), false);
});

test("eight-way drawing locks a screen drag to the nearest 45-degree direction", () => {
  assert.deepEqual(eightWayScreenDelta(30, 5), { x: Math.hypot(30, 5), y: 0 });
  const southeast = eightWayScreenDelta(20, 16);
  assert.ok(Math.abs(southeast.x - southeast.y) < 0.000001);
  assert.ok(southeast.x > 0);
  const northwest = eightWayScreenDelta(-20, -16);
  assert.ok(Math.abs(northwest.x - northwest.y) < 0.000001);
  assert.ok(northwest.x < 0);
});

test("poly topology creates authored quads, bridges boundary edges, and preserves quad export metadata", () => {
  const points = [
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: -1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 }
  ];
  let faces = appendPolyQuad(points, [], [0, 1, 3, 2]);
  assert.deepEqual(faces, [[0, 1, 3, 2]]);
  assert.equal(polyBoundaryEdges(points, faces).length, 4);

  faces = bridgePolyEdges(points, faces, [1, 3], [4, 5]);
  assert.deepEqual(faces, [[0, 1, 3, 2], [1, 3, 5, 4]]);

  const buffers = polyMeshBuffers(points, faces);
  assert.deepEqual(buffers.quadFaces, faces);
  assert.deepEqual(buffers.indices, [0, 1, 3, 0, 3, 2, 1, 3, 5, 1, 5, 4]);
  assert.deepEqual(buffers.triangleQuadIds, [0, 0, 1, 1]);
  assert.equal(buffers.uvs.length, points.length * 2);
});

test("poly topology deletion removes incident faces and reindexes surviving vertices", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 }
  ];
  const faces = [[0, 1, 2, 3], [1, 4, 5, 2]];

  assert.deepEqual(deletePolyEdge(points, faces, [1, 2]), []);
  assert.deepEqual(deletePolyVertex(points, faces, 0), {
    points: points.slice(1),
    faces: [[0, 3, 4, 1]]
  });
  assert.deepEqual(deletePolyFaceAndOrphans(points, faces, 0), {
    points: [points[1], points[2], points[4], points[5]],
    faces: [[0, 2, 3, 1]],
    removedVertexIndices: [0, 3]
  });
  assert.deepEqual(deletePolyFaceAndOrphans(points.slice(0, 4), [faces[0]], 0), {
    points: [],
    faces: [],
    removedVertexIndices: [0, 1, 2, 3]
  });
});

test("one contextual poly fill detects four loose vertices or two nearby boundary edges", () => {
  const loosePoints = [
    { x: -1, y: -1, z: 0 },
    { x: 1, y: -1, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: -1, y: 1, z: 0 }
  ];
  const looseFill = polyFillCandidate(
    loosePoints,
    [],
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { maxDistance: 2 }
  );
  assert.equal(looseFill.kind, "quad");
  assert.equal(looseFill.faces.length, 1);
  assert.deepEqual(new Set(looseFill.faces[0]), new Set([0, 1, 2, 3]));

  const bridgePoints = [
    { x: -2, y: -1, z: 0 },
    { x: -1, y: -1, z: 0 },
    { x: -1, y: 1, z: 0 },
    { x: -2, y: 1, z: 0 },
    { x: 1, y: -1, z: 0 },
    { x: 2, y: -1, z: 0 },
    { x: 2, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 }
  ];
  const bridgeFaces = [[0, 1, 2, 3], [4, 5, 6, 7]];
  const bridgeFill = polyFillCandidate(
    bridgePoints,
    bridgeFaces,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { maxDistance: 1.5 }
  );
  assert.equal(bridgeFill.kind, "bridge");
  assert.equal(bridgeFill.faces.length, 3);
  assert.equal(polyFillCandidate(
    bridgePoints,
    bridgeFaces,
    { x: 20, y: 20, z: 0 },
    { x: 0, y: 0, z: 1 },
    { maxDistance: 1.5 }
  ), null);
});

test("poly relaxation moves only nearby connected vertices toward their edge-neighbor average", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 1.4, y: 1, z: 0 },
    { x: 2, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 },
    { x: 1, y: 2, z: 0 },
    { x: 2, y: 2, z: 0 }
  ];
  const faces = [
    [0, 1, 4, 3],
    [1, 2, 5, 4],
    [3, 4, 7, 6],
    [4, 5, 8, 7]
  ];
  const relaxed = relaxPolyPoints(points, faces, points[4], {
    radius: 0.5,
    strength: 0.5
  });

  assert.deepEqual(relaxed.movedVertexIndices, [4]);
  assert.equal(relaxed.points[4].x, 1.2);
  assert.equal(relaxed.points[4].y, 1);
  assert.deepEqual(relaxed.points.filter((_, index) => index !== 4), points.filter((_, index) => index !== 4));
  assert.deepEqual(faces, [
    [0, 1, 4, 3],
    [1, 2, 5, 4],
    [3, 4, 7, 6],
    [4, 5, 8, 7]
  ]);
});

test("tool preset libraries discard malformed entries and retain browser-safe fields", () => {
  const normalized = normalizeToolPresetLibrary({
    strand: [
      {
        id: " strand-1 ",
        name: " Soft Bang ",
        value: { width: 0.2 },
        toolSettings: { smoothing: 0.8 }
      },
      { id: "", name: "Missing id", value: {} },
      null
    ],
    braid: "not-an-array"
  }, (value, type) => ({ ...value, type }));

  assert.deepEqual(normalized, {
    strand: [{
      id: "strand-1",
      name: "Soft Bang",
      value: { width: 0.2, type: "strand" },
      toolSettings: { smoothing: 0.8 }
    }],
    braid: []
  });
  assert.deepEqual(normalizeToolPresetLibrary(null), emptyToolPresetLibrary());
});

test("tool preset removal deletes only the matching custom record without mutating the library", () => {
  const library = {
    strand: [
      { id: "soft-bang", name: "Soft Bang", value: { width: 0.2 } },
      { id: "chain", name: "Chain", value: { width: 0.12 } }
    ],
    braid: [{ id: "rope", name: "Rope", value: { width: 0.4 } }]
  };

  const removed = removeToolPreset(library, "strand", "chain");

  assert.deepEqual(removed, {
    strand: [{ id: "soft-bang", name: "Soft Bang", value: { width: 0.2 } }],
    braid: library.braid
  });
  assert.equal(library.strand.length, 2);
  assert.equal(removed.braid, library.braid);
  assert.equal(removeToolPreset(library, "panel", "chain"), library);
});

test("shape preset libraries retain valid profiles and asymmetric width and depth curves", () => {
  const normalized = normalizeShapePresetLibrary({
    sweepProfile: [{
      id: " profile ",
      name: " Soft Wedge ",
      value: [{ x: -1, z: 0 }, { x: 1, z: 0 }]
    }],
    taperCurve: [{
      id: "width",
      name: "Wide Tip",
      value: [{ position: 0, value: 1 }, { position: 1, value: 0.4 }],
      secondaryValue: [{ position: 0, value: 0.8 }, { position: 1, value: 0.2 }],
      asymmetric: true
    }],
    depthCurve: [{ id: "", name: "Invalid", value: [] }]
  });

  assert.equal(normalized.sweepProfile[0].name, "Soft Wedge");
  assert.equal(normalized.taperCurve[0].asymmetric, true);
  assert.deepEqual(normalized.taperCurve[0].secondaryValue.at(-1), { position: 1, value: 0.2 });
  assert.deepEqual(normalized.depthCurve, []);
  assert.deepEqual(normalizeShapePresetLibrary(null), emptyShapePresetLibrary());

  const removed = removeShapePreset(normalized, "taperCurve", "width");
  assert.deepEqual(removed.taperCurve, []);
  assert.equal(normalized.taperCurve.length, 1);
});

test("preferences backup creates a versioned portable envelope and dated file name", () => {
  const backup = createPreferencesBackup({
    appVersion: "0.1.3",
    exportedAt: "2026-07-26T15:30:00.000Z",
    preferences: {
      language: "ja",
      navigationTips: false,
      radialMenus: true,
      defaultShader: "lambert"
    },
    presets: {
      strand: [{ id: "soft-bang", name: "Soft Bang", value: { width: 0.2 } }],
      braid: [{ id: "chain", name: "Chain", value: { braidWidth: 0.12 } }]
    },
    shapePresets: {
      sweepProfile: [{ id: "wedge", name: "Wedge", value: [{ x: -1, z: 0 }, { x: 1, z: 0 }] }],
      taperCurve: [],
      depthCurve: []
    },
    materialPresets: [{ id: "amber", name: "Amber", value: { color: "#aa6622" } }]
  });

  assert.deepEqual(backup, {
    format: "anime-hair-studio-preferences-and-presets",
    version: 1,
    appVersion: "0.1.3",
    exportedAt: "2026-07-26T15:30:00.000Z",
    preferences: {
      language: "ja",
      navigationTips: false,
      radialMenus: true,
      defaultShader: "lambert"
    },
    presets: {
      strand: [{ id: "soft-bang", name: "Soft Bang", value: { width: 0.2 } }],
      braid: [{ id: "chain", name: "Chain", value: { braidWidth: 0.12 } }]
    },
    shapePresets: {
      sweepProfile: [{ id: "wedge", name: "Wedge", value: [{ x: -1, z: 0 }, { x: 1, z: 0 }] }],
      taperCurve: [],
      depthCurve: []
    },
    materialPresets: [{ id: "amber", name: "Amber", value: { color: "#aa6622" } }]
  });
  assert.equal(
    preferencesBackupFileName(new Date("2026-07-26T15:30:00.000Z")),
    "anime-hair-studio-preferences-presets-2026-07-26.json"
  );
  assert.equal(preferencesBackupFileName("invalid"), "anime-hair-studio-preferences-presets-backup.json");
});

test("preferences backups validate their format and normalize preset collections", () => {
  const backup = normalizePreferencesBackup({
    format: "anime-hair-studio-preferences-and-presets",
    version: 1,
    preferences: { defaultShader: "anime-anisotropic" },
    presets: { strand: [{ id: "soft" }], braid: "invalid" },
    shapePresets: { taperCurve: [{ id: "width" }], depthCurve: "invalid" },
    materialPresets: [{ id: "amber", value: { color: "#aa6622" } }]
  });
  assert.deepEqual(backup.preferences, { defaultShader: "anime-anisotropic" });
  assert.deepEqual(backup.presets, { strand: [{ id: "soft" }], braid: [] });
  assert.deepEqual(backup.shapePresets, {
    sweepProfile: [],
    taperCurve: [{ id: "width" }],
    depthCurve: []
  });
  assert.deepEqual(backup.materialPresets, [{ id: "amber", value: { color: "#aa6622" } }]);
  assert.throws(() => normalizePreferencesBackup({ format: "other", version: 1 }), /not an Anime Hair Studio/);
  assert.throws(
    () => normalizePreferencesBackup({ format: "anime-hair-studio-preferences-and-presets", version: 2 }),
    /Unsupported preferences backup version/
  );
});

test("clumps become normalized reusable brush templates", () => {
  const locks = [
    {
      id: "guide",
      clumpId: "source-clump",
      clumpName: "Source",
      clumpGuide: true,
      clumpGuideId: "guide",
      mirrorPartnerId: "member",
      rootAttachmentEnabled: true,
      rootAttachment: { surfaceType: "scalp" },
      width: 0.2,
      depth: 0.3,
      clumpSpread: 1.4,
      clumpDepthSpread: 0.8,
      clumpGuideRestPoints: [{ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }],
      clumpGuideRestTwists: [0, 0.2],
      points: [{ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }],
      pointWidths: [1, 1],
      pointScales: [{ x: 1, z: 1 }, { x: 1, z: 1 }],
      pointTwists: [0, 0]
    },
    {
      id: "member",
      clumpId: "source-clump",
      clumpName: "Source",
      clumpGuide: false,
      clumpGuideId: "guide",
      mirrorPartnerId: "guide",
      rootAttachmentEnabled: true,
      rootAttachment: { surfaceType: "scalp" },
      width: 0.1,
      depth: 0.12,
      clumpRestPoints: [{ x: 0.08, y: 1, z: 0 }, { x: 0.16, y: 0, z: 0 }],
      clumpRestTwists: [0.1, 0.3],
      points: [{ x: 0.1, y: 1, z: 0 }, { x: 0.2, y: 0, z: 0 }],
      pointWidths: [1, 1],
      pointScales: [{ x: 1, z: 1 }, { x: 1, z: 1 }],
      pointTwists: [0, 0]
    }
  ];
  const unrelatedGuide = {
    ...locks[0],
    id: "unrelated-guide",
    clumpId: "unrelated-clump",
    clumpGuideId: "unrelated-guide",
    width: 0.9
  };
  const template = createClumpBrushTemplate([locks[1], unrelatedGuide, locks[0]], "guide");

  assert.equal(template.baseWidth, 0.2);
  assert.equal(template.strands.length, 2);
  assert.equal(template.strands[0].isParent, true);
  assert.equal(template.strands[0].width, 0.2);
  assert.equal(template.strands[1].isParent, false);
  assert.deepEqual(template.strands[1].points, locks[1].clumpRestPoints);
  assert.deepEqual(template.strands[1].pointTwists, [0.1, 0.3]);
  assert.equal(template.strands[1].width, 0.1);
  assert.equal(template.strands[1].depth, 0.12);
  assert.equal(template.clumpSettings.clumpSpread, 1.4);
  assert.equal(template.clumpSettings.clumpDepthSpread, 0.8);
  const reordered = normalizeClumpBrushTemplate({
    ...template,
    strands: [template.strands[1], template.strands[0]]
  });
  assert.equal(reordered.strands[0].isParent, true);
  assert.equal(reordered.strands[0].width, 0.2);
  assert.deepEqual(normalizeClumpBrushTemplate({ baseWidth: 0.2, strands: [] }), null);
  assert.deepEqual(locks[1].points[0], { x: 0.1, y: 1, z: 0 });
});

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  copy(value) { return this.set(value.x, value.y, value.z); }
  add(value) { this.x += value.x; this.y += value.y; this.z += value.z; return this; }
  sub(value) { this.x -= value.x; this.y -= value.y; this.z -= value.z; return this; }
  addScaledVector(value, scale) { this.x += value.x * scale; this.y += value.y * scale; this.z += value.z * scale; return this; }
  multiplyScalar(scale) { this.x *= scale; this.y *= scale; this.z *= scale; return this; }
  dot(value) { return this.x * value.x + this.y * value.y + this.z * value.z; }
  lengthSq() { return this.dot(this); }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() { const length = this.length(); return length > 0 ? this.multiplyScalar(1 / length) : this; }
  distanceToSquared(value) { return this.clone().sub(value).lengthSq(); }
  distanceTo(value) { return Math.sqrt(this.distanceToSquared(value)); }
  angleTo(value) {
    const denominator = Math.sqrt(this.lengthSq() * value.lengthSq());
    if (!denominator) return Math.PI / 2;
    return Math.acos(Math.min(1, Math.max(-1, this.dot(value) / denominator)));
  }
}

const point = (x, y = 0, z = 0) => new Vector3(x, y, z);
const closeTo = (actual, expected, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test("hair shader normalization preserves supported shaders and safely defaults unknown materials", () => {
  assert.equal(normalizeHairShader(ANIME_ANISOTROPIC_SHADER), ANIME_ANISOTROPIC_SHADER);
  assert.equal(normalizeHairShader(LAMBERT_SHADER), LAMBERT_SHADER);
  assert.equal(normalizeHairShader(STANDARD_ANISOTROPIC_SHADER), STANDARD_ANISOTROPIC_SHADER);
  assert.equal(normalizeHairShader(undefined), STANDARD_ANISOTROPIC_SHADER);
  assert.equal(normalizeHairShader("unknown"), STANDARD_ANISOTROPIC_SHADER);
  assert.deepEqual(normalizeAnimeAnisotropicSettings(), {
    animeBaseColor: "#dbc2aa",
    animeShadowColor: "#99675c",
    animeSoftShadowColor: "#bd917a",
    animeHighlightColor: "#fff8ec",
    animeRimColor: "#ffd9cf",
    animeShadowThreshold: 0.67,
    animeShadowSoftness: 0.05,
    animeSoftShadowStrength: 0.65,
    animeSoftShadowSpread: 0.41,
    animeRimStrength: 0.35,
    animeRimWidth: 0.3,
    animeHighlightStrength: 0.41,
    animeHighlightWidth: 0.051,
    animeAnisotropy: 0.9,
    animeHighlightJaggedness: 0.16,
    animeHighlightNoiseScale: 69,
    animeHighlightNoiseBlur: 1,
    animeHighlightTopFade: 1,
    animeHighlightTopBlur: 0.72,
    animeHighlightEdgeSuppression: 1
  });
  assert.equal(ANIME_ANISOTROPIC_DEFAULTS.softShadowStrength, 0.65);
  assert.equal(normalizeAnimeAnisotropicSettings({ animeHighlightWidth: 4 }).animeHighlightWidth, 0.15);
  assert.equal(normalizeAnimeAnisotropicSettings({ animeRimStrength: -1 }).animeRimStrength, 0);
  assert.equal(normalizeAnimeAnisotropicSettings({ animeRimWidth: 4 }).animeRimWidth, 1);
});

test("material state normalizes definitions and resolves material users", () => {
  const material = {
    id: "material-a",
    name: "Material A",
    shader: "unknown",
    roughness: 2,
    shadowColor: "#ffffff"
  };
  const normalized = normalizeHairMaterialDefinition(material);
  assert.equal(normalized, material);
  assert.equal(normalized.shader, STANDARD_ANISOTROPIC_SHADER);
  assert.equal(normalized.roughness, 1);
  assert.equal(normalized.color, "#2c223a");
  assert.equal(normalized.baseColorGradientEnabled, false);
  assert.deepEqual(normalized.baseColorGradientStops, [
    { position: 0, color: "#2c223a" },
    { position: 1, color: "#2c223a" }
  ]);
  assert.equal("shadowColor" in normalized, false);

  const definitions = [material, normalizeHairMaterialDefinition({
    id: "material-b",
    name: "Material B",
    shader: LAMBERT_SHADER,
    roughness: 0.4
  })];
  assert.equal(resolveHairMaterialDefinition(definitions, "material-b"), definitions[1]);
  assert.equal(resolveHairMaterialDefinition(definitions, "missing"), definitions[0]);
  assert.equal(resolveHairMaterialDefinition([], "missing"), null);

  const counts = hairMaterialUsageCounts([
    {},
    { materialId: "material-b" },
    { materialId: "missing" }
  ], definitions, "material-a");
  assert.equal(counts.get("material-a"), 2);
  assert.equal(counts.get("material-b"), 1);
});

test("material presets retain reusable settings without project resource identities", () => {
  const value = hairMaterialPresetValue({
    id: "project-material",
    name: "Project Material",
    shader: LAMBERT_SHADER,
    color: "#aabbcc",
    roughness: 0.35,
    baseColorGradientEnabled: true,
    baseColorGradientStops: [
      { position: 0, color: "#112233" },
      { position: 1, color: "#ddeeff" }
    ],
    untrustedExtraField: "discard me"
  });
  assert.equal("id" in value, false);
  assert.equal("name" in value, false);
  assert.equal(value.shader, LAMBERT_SHADER);
  assert.equal("untrustedExtraField" in value, false);
  assert.deepEqual(value.baseColorGradientStops, [
    { position: 0, color: "#112233" },
    { position: 1, color: "#ddeeff" }
  ]);

  const library = normalizeHairMaterialPresetLibrary([
    { id: " amber ", name: " Amber Hair ", value },
    { id: "", name: "Invalid", value },
    null
  ]);
  assert.equal(library.length, 1);
  assert.equal(library[0].id, "amber");
  assert.equal(library[0].name, "Amber Hair");
  assert.deepEqual(removeHairMaterialPreset(library, "amber"), []);
});

test("hair base gradients normalize ordered bounded color stops", () => {
  const stops = normalizeHairGradientStops([
    { position: 1.4, color: "#FFFFFF" },
    { position: 0.25, color: "invalid" },
    { position: -1, color: "#112233" }
  ], "#445566");
  assert.deepEqual(stops, [
    { position: 0, color: "#112233" },
    { position: 0.25, color: "#445566" },
    { position: 1, color: "#ffffff" }
  ]);
  assert.equal(normalizeHairGradientStops(
    Array.from({ length: MAX_HAIR_GRADIENT_STOPS + 3 }, (_, index) => ({
      position: index / 10,
      color: "#000000"
    }))
  ).length, MAX_HAIR_GRADIENT_STOPS);
});

test("OBJ face sizes and fan edge masks preserve authored quad boundaries", () => {
  assert.deepEqual(parseObjFaceVertexCounts(`
    v 0 0 0
    f 1/1 2/2 3/3 4/4
    f 4 3 5
  `), [4, 3]);
  assert.deepEqual(fanTriangleEdgeMasks(4), [
    [1, 0, 1],
    [1, 1, 0]
  ]);
  assert.deepEqual(fanTriangleEdgeMasks(3), [[1, 1, 1]]);
});

test("split strand cells remain quads until their taper collapses a corner", () => {
  const square = [
    0, 0, 0,
    0, 1, 0,
    1, 1, 0,
    1, 0, 0
  ];
  assert.deepEqual(quadCellTopology(square, [0, 1, 2, 3]), {
    faces: [[0, 1, 2, 3]],
    triangleEdgeMasks: [[0, 1, 1], [1, 1, 0]]
  });

  const collapsedTip = [
    0, 0, 0,
    0, 1, 0,
    1, 0, 0,
    1, 0, 0
  ];
  assert.deepEqual(quadCellTopology(collapsedTip, [0, 1, 2, 3]), {
    faces: [[0, 1, 3]],
    triangleEdgeMasks: [[1, 1, 1], [0, 0, 0]]
  });
});

test("authored split-panel quads hide only their render diagonals", () => {
  assert.deepEqual(
    triangleEdgeMasksFromFaces(
      [0, 1, 2, 0, 2, 3],
      [[0, 3, 2, 1]]
    ),
    [[1, 0, 1], [1, 1, 0]]
  );
  assert.deepEqual(
    triangleEdgeMasksFromFaces([0, 1, 2], [[0, 1, 2]]),
    [[1, 1, 1]]
  );
});

test("bundled braid assets expose their authored quad topology", async () => {
  const [classic, chainLinks] = await Promise.all([
    readFile(new URL("../assets/braid-segment.obj", import.meta.url), "utf8"),
    readFile(new URL("../assets/chainlinks.obj", import.meta.url), "utf8")
  ]);
  const classicCounts = parseObjFaceVertexCounts(classic);
  const chainCounts = parseObjFaceVertexCounts(chainLinks);
  assert.equal(classicCounts.filter((count) => count === 4).length, 84);
  assert.equal(classicCounts.filter((count) => count === 3).length, 22);
  assert.equal(chainCounts.filter((count) => count === 4).length, 480);
  assert.ok(chainCounts.every((count) => count === 4));
});

test("hair cards select the higher profile arc between the side extremes", () => {
  const profile = [
    { x: 1, z: -0.3 },
    { x: 0.5, z: 0.2 },
    { x: 0, z: 0.4 },
    { x: -0.5, z: 0.2 },
    { x: -1, z: -0.3 },
    { x: -0.6, z: -0.4 },
    { x: 0.6, z: -0.4 }
  ];
  assert.deepEqual(upperProfileArcIndices(profile), [0, 1, 2, 3, 4]);

  const reversed = [...profile].reverse();
  const selected = upperProfileArcIndices(reversed).map((index) => reversed[index]);
  assert.deepEqual(selected, [profile[0], profile[1], profile[2], profile[3], profile[4]]);

  const verticalSides = [
    { x: 1, z: 0.2 },
    { x: 0, z: 0.5 },
    { x: -1, z: 0.2 },
    { x: -1, z: -0.3 },
    { x: 0, z: -0.4 },
    { x: 1, z: -0.3 }
  ];
  assert.deepEqual(upperProfileArcIndices(verticalSides), [5, 0, 1, 2, 3]);
});

test("pull keeps the root fixed and preserves rigid segment lengths", () => {
  const source = [point(0), point(1), point(2), point(3)];
  const result = solvePulledStrand(source, 3, point(2, 1.5), 0);
  closeTo(result[0].distanceTo(source[0]), 0);
  for (let index = 1; index < result.length; index += 1) closeTo(result[index - 1].distanceTo(result[index]), 1, 1e-3);
});

test("pull elasticity stretches later links more than links near the root", () => {
  const source = [point(0), point(1), point(2), point(3)];
  const result = solvePulledStrand(source, 3, point(5), 0.6);
  const lengths = result.slice(1).map((value, index) => value.distanceTo(result[index]));
  assert.ok(lengths[2] > lengths[1]);
  assert.ok(lengths[1] > lengths[0]);
});

test("pulling a middle point carries the untouched tail", () => {
  const source = [point(0), point(1), point(2), point(3)];
  const result = solvePulledStrand(source, 2, point(1.5, 1), 0.2);
  const moved = result[2].clone().sub(source[2]);
  const tailMoved = result[3].clone().sub(source[3]);
  closeTo(moved.distanceTo(tailMoved), 0);
});

test("curve normalization clamps, sorts, and anchors endpoints", () => {
  const curve = normalizeTaperCurve([
    { position: 0.8, value: 2, interpolation: "wat" },
    { position: 0.2, value: -1, interpolation: "linear" }
  ]);
  assert.equal(curve[0].position, 0);
  assert.equal(curve.at(-1).position, 1);
  assert.equal(curve[0].value, 0);
  assert.equal(curve.at(-1).value, 1.5);
  assert.equal(curve.at(-1).interpolation, "smooth");
});

test("smooth taper interpolation stays between neighboring controls", () => {
  const curve = normalizeTaperCurve([
    { position: 0, value: 0.2, interpolation: "smooth" },
    { position: 0.5, value: 1, interpolation: "smooth" },
    { position: 1, value: 0, interpolation: "smooth" }
  ]);
  for (let index = 0; index <= 100; index += 1) {
    const value = sampleTaperCurve(curve, index / 100);
    assert.ok(value >= 0 && value <= 1);
  }
});

test("signed envelope curves preserve direction, clamp values, and anchor endpoints", () => {
  const fallback = [
    { position: 0, value: 0, interpolation: "smooth" },
    { position: 1, value: 0, interpolation: "smooth" }
  ];
  const curve = normalizeEnvelopeCurve([
    { position: 0.8, value: -900, interpolation: "constant" },
    { position: 0.2, value: 180, interpolation: "linear" },
    { position: 0.5, value: -90, interpolation: "wat" }
  ], fallback, -720, 720);

  assert.deepEqual(curve.map((point) => point.position), [0, 0.5, 1]);
  assert.deepEqual(curve.map((point) => point.value), [180, -90, -720]);
  assert.equal(curve[1].interpolation, "smooth");
  assert.ok(sampleTaperCurve(curve, 0.25) < 180);
  assert.ok(sampleTaperCurve(curve, 0.75) <= -90);
});

test("integrated twist rates accumulate rotation without reversing as the rate returns to zero", () => {
  const constantRate = [
    { position: 0, value: 180, interpolation: "linear" },
    { position: 1, value: 180, interpolation: "linear" }
  ];
  closeTo(sampleIntegratedEnvelopeCurve(constantRate, 0), 0);
  closeTo(sampleIntegratedEnvelopeCurve(constantRate, 0.5), 90, 0.01);
  closeTo(sampleIntegratedEnvelopeCurve(constantRate, 1), 180, 0.01);

  const positivePulse = [
    { position: 0, value: 0, interpolation: "linear" },
    { position: 0.25, value: 0, interpolation: "linear" },
    { position: 0.5, value: 180, interpolation: "linear" },
    { position: 0.75, value: 0, interpolation: "linear" },
    { position: 1, value: 0, interpolation: "linear" }
  ];
  const accumulatedAtPeak = sampleIntegratedEnvelopeCurve(positivePulse, 0.5);
  const accumulatedWhenFlat = sampleIntegratedEnvelopeCurve(positivePulse, 0.75);
  assert.ok(accumulatedWhenFlat > accumulatedAtPeak && accumulatedAtPeak > 0);
  closeTo(sampleIntegratedEnvelopeCurve(positivePulse, 1), accumulatedWhenFlat, 0.01);

  const negativePulse = positivePulse.map((point) => ({ ...point, value: -point.value }));
  assert.ok(sampleIntegratedEnvelopeCurve(negativePulse, 1) < 0);
});

test("twist rate authoring units represent quarter turns", () => {
  assert.equal(twistRateDegreesFromUnits(1), 90);
  assert.equal(twistRateDegreesFromUnits(-1), -90);
  assert.equal(twistRateDegreesFromUnits(50), 4500);
  assert.equal(twistRateUnitsFromDegrees(90), 1);
  assert.equal(twistRateUnitsFromDegrees(-4500), -50);
});

test("signed envelope blending retains both control layouts and interpolation", () => {
  const fallback = [
    { position: 0, value: 0, interpolation: "smooth" },
    { position: 1, value: 0, interpolation: "smooth" }
  ];
  const curve = blendEnvelopeCurves(
    [
      { position: 0, value: 0, interpolation: "linear" },
      { position: 1, value: 360, interpolation: "linear" }
    ],
    [
      { position: 0, value: 0, interpolation: "smooth" },
      { position: 0.5, value: -180, interpolation: "constant" },
      { position: 1, value: -360, interpolation: "smooth" }
    ],
    0.5,
    fallback,
    -720,
    720
  );

  assert.deepEqual(curve.map((point) => point.position), [0, 0.5, 1]);
  assert.equal(curve[0].value, 0);
  assert.equal(curve[1].value, 0);
  assert.equal(curve[2].value, 90);
  assert.equal(curve[1].interpolation, "constant");
});

test("adaptive density keeps ordered endpoints", () => {
  const sampler = { getTangent: (t) => point(1, Math.sin(t * Math.PI) * 0.5, 0) };
  const parameters = adaptiveCurveParameters(sampler, 24, 0.8);
  assert.equal(parameters[0], 0);
  assert.equal(parameters.at(-1), 1);
  assert.ok(parameters.length >= 5 && parameters.length <= 25);
  assert.ok(parameters.every((value, index) => index === 0 || value > parameters[index - 1]));
  closeTo(sampleArray([0, 10], 0.25), 2.5);
});

test("adaptive density retains and concentrates loops around width profile changes", () => {
  const straightSampler = { getTangent: () => point(1, 0, 0) };
  const flatParameters = adaptiveCurveParameters(
    straightSampler,
    32,
    1,
    0,
    1,
    4,
    () => 1
  );
  const pinchedParameters = adaptiveCurveParameters(
    straightSampler,
    32,
    1,
    0,
    1,
    4,
    (t) => 1 - 0.75 * Math.exp(-Math.pow((t - 0.5) / 0.08, 2))
  );
  const smallestPinchSpacing = Math.min(...pinchedParameters.slice(1).map((value, index) => (
    Math.abs((value + pinchedParameters[index]) * 0.5 - 0.5) < 0.15
      ? value - pinchedParameters[index]
      : Infinity
  )));
  assert.ok(pinchedParameters.length > flatParameters.length);
  assert.ok(smallestPinchSpacing < 1 / (flatParameters.length - 1));
  assert.equal(pinchedParameters[0], 0);
  assert.equal(pinchedParameters.at(-1), 1);
});

test("twist density follows twist magnitude rather than envelope slope", () => {
  const flatCurve = [
    { position: 0, value: 0, interpolation: "linear" },
    { position: 1, value: 0, interpolation: "linear" }
  ];
  const twistCurve = [
    { position: 0, value: 0, interpolation: "linear" },
    { position: 0.3, value: 0, interpolation: "linear" },
    { position: 0.7, value: 360, interpolation: "linear" },
    { position: 1, value: 0, interpolation: "linear" }
  ];
  assert.equal(twistCurveDensityDetail(flatCurve, 0.1, 0.15, 0.2, 1), 0);
  const slopeDetail = twistCurveDensityDetail(twistCurve, 0.4, 0.45, 0.5, 1, 32);
  const peakDetail = twistCurveDensityDetail(twistCurve, 0.65, 0.7, 0.75, 1, 32);
  assert.ok(peakDetail > slopeDetail && slopeDetail > 0);
  assert.equal(twistCurveDensityDetail(twistCurve, 0.65, 0.7, 0.75, 0), 0);

  const straightSampler = { getTangent: () => point(1, 0, 0) };
  const baseline = adaptiveCurveParameters(straightSampler, 32, 0.8);
  const supported = adaptiveCurveParameters(
    straightSampler,
    32,
    0.8,
    0,
    1,
    4,
    null,
    false,
    (before, middle, after) => twistCurveDensityDetail(twistCurve, before, middle, after, 1, 32)
  );
  assert.ok(supported.length >= baseline.length);
  const spacings = supported.slice(1).map((value, index) => ({
    midpoint: (value + supported[index]) * 0.5,
    size: value - supported[index]
  }));
  const twistSpacing = Math.min(...spacings.filter((item) => item.midpoint > 0.6 && item.midpoint < 0.8).map((item) => item.size));
  const calmSpacing = Math.min(...spacings.filter((item) => item.midpoint < 0.25).map((item) => item.size));
  assert.ok(twistSpacing < calmSpacing);
});

test("twist density adds rotation support independently of density aggression", () => {
  const twistCurve = [
    { position: 0, value: 180, interpolation: "linear" },
    { position: 1, value: 180, interpolation: "linear" }
  ];
  const straightSampler = { getTangent: () => point(1, 0, 0) };
  const supportSampler = (before, middle, after) => (
    twistCurveDensityDetail(twistCurve, before, middle, after, 1, 32)
  );
  const withoutReduction = adaptiveCurveParameters(
    straightSampler,
    32,
    0,
    0,
    1,
    4,
    null,
    false,
    supportSampler
  );
  const aggressiveReduction = adaptiveCurveParameters(
    straightSampler,
    32,
    1,
    0,
    1,
    4,
    null,
    false,
    supportSampler
  );
  const noTwistSupport = adaptiveCurveParameters(straightSampler, 32, 1);
  const entryTwistCurve = twistCurve.map((point) => ({ ...point, value: 45 }));
  const entryTwistSupport = adaptiveCurveParameters(
    straightSampler,
    32,
    1,
    0,
    1,
    4,
    null,
    false,
    (before, middle, after) => (
      twistCurveDensityDetail(entryTwistCurve, before, middle, after, 1, 32)
    )
  );
  const doubleTwistCurve = twistCurve.map((point) => ({ ...point, value: point.value * 2 }));
  const doubleTwistSupport = adaptiveCurveParameters(
    straightSampler,
    32,
    1,
    0,
    1,
    4,
    null,
    false,
    (before, middle, after) => (
      twistCurveDensityDetail(doubleTwistCurve, before, middle, after, 1, 32)
    )
  );

  assert.equal(withoutReduction.length - 1, 96);
  assert.equal(aggressiveReduction.length - noTwistSupport.length, 64);
  assert.equal(entryTwistSupport.length - noTwistSupport.length, 32);
  assert.equal(doubleTwistSupport.length - aggressiveReduction.length, 64);
  assert.ok(aggressiveReduction.length < withoutReduction.length);
  const spacings = withoutReduction.slice(1).map((parameter, index) => (
    parameter - withoutReduction[index]
  ));
  const averageSpacing = 1 / (withoutReduction.length - 1);
  assert.ok(Math.min(...spacings) > averageSpacing * 0.45);
});

test("twist curve display range defaults to 180 degrees and expands for authored values", () => {
  assert.equal(twistCurveDisplayRange([], 180, 720), 180);
  assert.equal(twistCurveDisplayRange([{ value: -90 }, { value: 120 }], 180, 720), 180);
  assert.equal(twistCurveDisplayRange([{ value: -360 }, { value: 120 }], 180, 720), 360);
  assert.equal(twistCurveDisplayRange([{ value: 900 }], 180, 720), 720);
});

test("twist curve mesh handles compress larger ranges into one quarter of the former height", () => {
  const distancePerDegree = twistCurveHandleDistancePerDegree(0.08, 180);
  assert.ok(distancePerDegree > 0);
  assert.equal(distancePerDegree * 180, 0.05);
  assert.equal(distancePerDegree * -180, -0.05);
  assert.equal(twistCurveHandleDistancePerDegree(0.08, 720) * 720, 0.05);
  assert.equal(twistCurveHandleDistancePerDegree(0, 720) * 720, 0.025);
});

test("adaptive density can mirror along-curve loop distribution around the midpoint", () => {
  const sampler = {
    getTangent: (t) => point(1, t < 0.3 ? Math.sin(t * Math.PI * 3) : 0, 0)
  };
  const parameters = adaptiveCurveParameters(
    sampler,
    32,
    0.9,
    0,
    1,
    4,
    (t) => t < 0.35 ? 0.4 + t : 1,
    true
  );
  parameters.forEach((value, index) => {
    closeTo(value + parameters[parameters.length - 1 - index], 1);
  });
  assert.ok(parameters.every((value, index) => index === 0 || value > parameters[index - 1]));
});

test("OBJ side triangles reconstruct as a quad and preserve UV indices", () => {
  const geometry = {
    userData: { sideTriangleCount: 2 },
    getIndex: () => ({ array: [0, 2, 1, 1, 2, 3] }),
    getAttribute: (name) => name === "uv" ? {} : null
  };
  assert.equal(exportHairFaces(geometry, 1, 1), "f 1/1 3/3 4/4 2/2\n");
  assert.deepEqual(orderedFanBoundary([[1, 2], [2, 3], [3, 1]]), [1, 2, 3]);
});

test("OBJ export preserves authored open hair-card quads", () => {
  const geometry = {
    userData: { quadFaces: [[0, 1, 3, 2]], openSurface: true },
    getIndex: () => ({ array: [0, 1, 2, 1, 3, 2] }),
    getAttribute: (name) => name === "uv" ? {} : null
  };
  assert.equal(exportHairFaces(geometry, 1, 1), "f 1/1 2/2 4/4 3/3\n");
  assert.deepEqual(hairFaceIndices(geometry), [[0, 1, 3, 2]]);
});

test("USDA export preserves quad meshes and emits editable center curves", () => {
  const usda = exportAnimeHairUsda({
    rootName: "Braided Bob",
    meshes: [{
      name: "Front Strand",
      group: "front",
      layer: "top",
      points: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
      normals: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]],
      uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
      colors: [[1, 0, 0], [1, 0, 0], [1, 0, 0], [1, 0, 0]],
      tangents: [[0, 1, 0, 1], [0, 1, 0, 1], [0, 1, 0, 1], [0, 1, 0, 1]],
      faces: [[0, 1, 2, 3]]
    }],
    curves: [{
      name: "Front Strand",
      group: "front",
      layer: "top",
      width: 0.02,
      points: [[0, 0, 0], [0, 0.33, 0], [0, 0.66, 0], [0, 1, 0]]
    }]
  });

  assert.match(usda, /^#usda 1\.0/);
  assert.match(usda, /defaultPrim = "Braided_Bob"/);
  assert.match(usda, /def Mesh "Front_Strand"/);
  assert.match(usda, /int\[\] faceVertexCounts = \[4\]/);
  assert.match(usda, /int\[\] faceVertexIndices = \[0, 1, 2, 3\]/);
  assert.match(usda, /texCoord2f\[\] primvars:st = \[\(0, 0\), \(1, 0\), \(1, 1\), \(0, 1\)\] \(\s*interpolation = "faceVarying"\s*\)/);
  assert.match(usda, /int\[\] primvars:st:indices = \[0, 1, 2, 3\]/);
  assert.doesNotMatch(usda, /primvars:st:interpolation/);
  assert.match(usda, /color3f\[\] primvars:displayColor/);
  assert.match(usda, /float4\[\] primvars:animeHairStudio:tangent/);
  assert.match(usda, /def BasisCurves "Front_Strand_Curve"/);
  assert.match(usda, /uniform token basis = "catmullRom"/);
  assert.match(usda, /uniform token wrap = "pinned"/);
  assert.match(usda, /custom string animeHairStudio:group = "front"/);
  assert.equal(usdIdentifier("12 / Bangs"), "_12_Bangs");
});

test("file actions sanitize names and expose only supported available export contents", () => {
  assert.equal(cleanFileBaseName("  Braided: Bob.usda  "), "Braided Bob");
  assert.equal(fileNameForAction("Braided Bob.obj", "usda"), "Braided Bob.usda");
  assert.equal(fileNameForAction(" ", "project", "Untitled Hair Project"), "Untitled Hair Project.ahs");
  assert.equal(fileNameForAction("Legacy.animehair.json", "project"), "Legacy.ahs");
  assert.equal(fileNameForAction("Current.ahs", "project"), "Current.ahs");
  assert.deepEqual(
    normalizeExportContents(
      "obj",
      { mesh: true, curves: false, bones: true, weights: true },
      { mesh: true, curves: true, bones: true, weights: true }
    ),
    { mesh: true, curves: false, bones: false, weights: false }
  );
  assert.deepEqual(
    normalizeExportContents(
      "usda",
      { mesh: true, curves: true, bones: true, weights: true },
      { mesh: true, curves: true, bones: false, weights: false }
    ),
    { mesh: true, curves: true, bones: false, weights: false }
  );
});

test("application file drops route projects and OBJ meshes by extension", () => {
  assert.equal(applicationDropFileKind({ name: "Short Bob.ahs" }), "project");
  assert.equal(applicationDropFileKind({ name: "HEAD.OBJ" }), "obj");
  assert.equal(applicationDropFileKind({ name: "reference.png" }), null);
  assert.equal(applicationDropFileKind(null), null);
});

test("UV inspector bounds and view transforms preserve UV proportions and flip V for canvas space", () => {
  assert.deepEqual(
    uvCoordinateBounds([[0, 0], [2, 4], [Number.NaN, 3]]),
    { minU: 0, maxU: 2, minV: 0, maxV: 4 }
  );
  assert.deepEqual(
    uvCoordinateBounds([[0.5, 0.5]]),
    { minU: 0, maxU: 1, minV: 0, maxV: 1 }
  );
  const transform = uvViewTransform({ minU: 0, maxU: 2, minV: 0, maxV: 1 }, 240, 140, 20);
  assert.deepEqual(transform.project(0, 1), [20, 20]);
  assert.deepEqual(transform.project(2, 0), [220, 120]);
});

test("project files have stable names, metadata, and validation", () => {
  assert.equal(projectFileName(" Braided Bob! "), "braided-bob.ahs");
  const project = createHairProject({
    name: "Braided Bob",
    state: { locks: [{ scalpRegion: "bangs" }], guides: [], pendingPlacedLockId: "temporary" },
    strandGroups: [{ id: "bangs" }, { id: "unassigned" }],
    savedAt: "2026-07-19T00:00:00.000Z"
  });
  assert.equal(project.metadata.groupCounts.bangs, 1);
  assert.equal(project.state.pendingPlacedLockId, null);
  assert.equal(project.headAssetOmitted, false);
  const hairOnlyProject = createHairProject({
    name: "Hair Only",
    state: { locks: [], guides: [] },
    strandGroups: [],
    headAssetOmitted: true
  });
  assert.equal(hairOnlyProject.headAsset, null);
  assert.equal(hairOnlyProject.headAssetOmitted, true);
  assert.equal(validateHairProject(project), project);
  assert.throws(() => validateHairProject({ format: "other", version: 1 }), /Unsupported/);
});

test("project restore plans normalize transient collections without changing scene records", () => {
  const state = {
    lockIndex: 7,
    referenceImageIndex: 0,
    hairMaterialIndex: 0,
    capsuleGuidesVisible: undefined,
    curveLatticeGuidesVisible: undefined,
    hairMaterials: [],
    locks: [{ id: "strand-a" }],
    guides: [{ id: "guide-a" }],
    selectedId: "strand-a",
    selectedStrandIds: ["strand-a"],
    clumpViewportSelection: 1,
    selectedGuideId: "guide-a",
    selectedReferenceImageId: "",
    activeCurveLatticeGuideId: "lattice-a",
    selectedStrandGroup: "bangs",
    selectedPoint: { lockId: "strand-a", pointIndex: 2 },
    selectedCurveSurfaceController: { lockId: "strand-a", index: 1 },
    selectedCurveLatticePoint: { guideId: "guide-a", pointIndex: 3 },
    selectedControlPoints: [{ type: "strand", lockId: "strand-a", pointIndex: 2 }],
    pendingPlacedLockId: "strand-a"
  };
  const plan = createProjectRestorePlan(state, {
    regionIds: ["bangs", "back"],
    layerIds: ["bottom", "top"]
  });

  assert.deepEqual(plan.counters, {
    lockIndex: 7,
    referenceImageIndex: 1,
    hairMaterialIndex: 1
  });
  assert.deepEqual(plan.visibility, {
    strandRegions: ["bangs", "back"],
    strandLayers: ["bottom", "top"],
    capsuleGuides: true,
    curveLatticeGuides: true,
    headMesh: true,
    bodyMesh: true
  });
  assert.equal(plan.resources.hairMaterials, null);
  assert.equal(plan.scene.locks, state.locks);
  assert.equal(plan.scene.guides, state.guides);
  assert.deepEqual(plan.scene.referenceImages, []);
  assert.deepEqual(plan.scene.selectionSets, []);
  assert.deepEqual(plan.strandSelection, {
    activeId: "strand-a",
    selectedIds: ["strand-a"],
    validIds: ["strand-a"]
  });
  assert.deepEqual(plan.selection, {
    clumpViewport: true,
    guideId: "guide-a",
    referenceImageId: null,
    activeCurveLatticeGuideId: "lattice-a",
    strandGroup: "bangs",
    point: { lockId: "strand-a", pointIndex: 2 },
    curveSurfaceController: { lockId: "strand-a", index: 1 },
    curveLatticePoint: { guideId: "guide-a", pointIndex: 3 },
    controlPoints: [{ type: "strand", lockId: "strand-a", pointIndex: 2 }],
    pendingPlacedLockId: "strand-a"
  });
  assert.notEqual(plan.selection.point, state.selectedPoint);
  assert.notEqual(plan.selection.controlPoints[0], state.selectedControlPoints[0]);
});

test("project snapshots clone selection records and exclude uncommitted strands", () => {
  const point = { lockId: "strand-a", pointIndex: 2 };
  const controlPoint = { type: "strand", lockId: "strand-a", pointIndex: 2 };
  const selection = createProjectSelectionSnapshot({
    selectedId: "strand-a",
    selectedStrandIds: new Set(["strand-a", "strand-b"]),
    selectedPoint: point,
    selectedControlPoints: [controlPoint],
    pendingPlacedLockId: "strand-b"
  });
  assert.deepEqual(selection.selectedStrandIds, ["strand-a", "strand-b"]);
  assert.deepEqual(selection.selectedPoint, point);
  assert.deepEqual(selection.selectedControlPoints, [controlPoint]);
  assert.notEqual(selection.selectedPoint, point);
  assert.notEqual(selection.selectedControlPoints[0], controlPoint);

  const committed = { id: "strand-a" };
  const placement = { id: "strand-b" };
  const placementMirror = { id: "strand-c" };
  const preview = { id: "strand-d", proceduralDuplicatePreview: true };
  assert.deepEqual(
    projectSnapshotLocks([committed, placement, placementMirror, preview], {
      lockId: "strand-b",
      lockIds: ["strand-c"]
    }),
    [committed]
  );
});

test("undo history stays bounded and returns newest snapshots first", () => {
  const history = new BoundedHistory(2);
  history.push("first");
  history.push("second");
  history.push("third");
  assert.equal(history.length, 2);
  assert.equal(history.pop(), "third");
  assert.equal(history.pop(), "second");
  assert.equal(history.pop(), undefined);
});

test("recent projects are deduplicated, newest-first, and capped at ten", () => {
  const entries = Array.from({ length: 12 }, (_, index) => ({
    name: `Project ${index}.ahs`,
    content: `{\"project\":${index}}`,
    updatedAt: index
  }));
  entries.push({
    name: "PROJECT 5.AHS",
    content: "{\"project\":\"newer\"}",
    updatedAt: 50
  });
  const recent = normalizeRecentProjects(entries);
  assert.equal(recent.length, MAX_RECENT_PROJECTS);
  assert.equal(recent[0].name, "PROJECT 5.AHS");
  assert.equal(recent[0].content, "{\"project\":\"newer\"}");
  assert.equal(recent.filter((entry) => entry.id === recentProjectId("Project 5.ahs")).length, 1);
  assert.deepEqual(recent.map((entry) => entry.updatedAt), [...recent.map((entry) => entry.updatedAt)].sort((a, b) => b - a));
});

test("branch knife profile sampling preserves the closed profile proportions", () => {
  const loop = resampleClosedProfilePoints([
    { x: -2, z: -1 },
    { x: 2, z: -1 },
    { x: 2, z: 1 },
    { x: -2, z: 1 }
  ], 8);
  assert.equal(loop.length, 8);
  const width = Math.max(...loop.map((point) => point.x)) - Math.min(...loop.map((point) => point.x));
  const height = Math.max(...loop.map((point) => point.z)) - Math.min(...loop.map((point) => point.z));
  assert.ok(width > height);
});
