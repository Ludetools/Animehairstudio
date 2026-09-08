import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BoundedHistory,
  expandHistoryDependencyIds,
  RestoreRefreshRegistry
} from "../modules/history.js";
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
  closestPointOnScreenSegment,
  emptyStrandSelection,
  pointInsideScreenBounds,
  resolveStrandSelection,
  restoreStrandSelection,
  segmentIntersectsScreenBounds,
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
  normalizeReferenceFlipPivotX,
  referenceCropHorizontalFlipOffset,
  referencePlaneCropCoordinateFromPoint,
  referencePlaneCropGeometryData,
  referencePlanePointFromCropCoordinate
} from "../modules/reference-plane-crop.js";
import {
  alignCurveParametersToSharpControls,
  curveTopologyRowIndices,
  curveSegmentCoordinates,
  curveSegmentSharpness,
  flowCurveBevelApexRows,
  normalizeCurvePointSharpness,
  slideCurveBevelSupportRows,
  sharpCurveJointData
} from "../modules/strand-curve-sharpness.js";
import {
  createArcHairSurfaceGrid,
  normalizeArcHairSurfaceSettings
} from "../modules/arc-hair-surface.js";

test("reference plane crop geometry shrinks its boundary while preserving source UVs", () => {
  const data = referencePlaneCropGeometryData(2, {
    left: 0.25,
    top: 0.1,
    right: 0.75,
    bottom: 0.7
  });

  const roundedPositions = data.positions.map((value) => Number(value.toFixed(6)));
  assert.deepEqual(
    Object.fromEntries(Object.entries(data.center).map(([key, value]) => [key, Number(value.toFixed(6))])),
    { x: 0, y: 0.3, z: 0 }
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(data.bounds).map(([key, value]) => [key, Number(value.toFixed(6))])),
    { xMin: -1.5, xMax: 1.5, yMin: -0.9, yMax: 0.9 }
  );
  assert.deepEqual(roundedPositions, [
    -1.5, 0.9, 0,
    1.5, 0.9, 0,
    -1.5, -0.9, 0,
    1.5, -0.9, 0
  ]);
  assert.deepEqual(data.uvs, [0.25, 0.9, 0.75, 0.9, 0.25, 0.30000000000000004, 0.75, 0.30000000000000004]);
  assert.deepEqual(data.indices, [0, 2, 1, 2, 3, 1]);
});

test("reference plane crop coordinates round-trip through local plane space", () => {
  const local = referencePlanePointFromCropCoordinate(1.5, 0.2, 0.8);
  const crop = referencePlaneCropCoordinateFromPoint(1.5, local);

  assert.ok(Math.abs(crop.x - 0.2) < 1e-9);
  assert.ok(Math.abs(crop.y - 0.8) < 1e-9);
});

test("cropped reference flipping reflects within the selected source interval", () => {
  const crop = { left: 0.2, right: 0.6 };
  const offset = referenceCropHorizontalFlipOffset(crop);

  assert.equal(offset, 0.8);
  assert.ok(Math.abs((-crop.left + offset) - crop.right) < 1e-9);
  assert.ok(Math.abs((-crop.right + offset) - crop.left) < 1e-9);
  assert.equal(referenceCropHorizontalFlipOffset({ left: 0.3, right: 0.6 }, 0.4), offset);
  assert.equal(normalizeReferenceFlipPivotX(crop, "invalid"), 0.4);
});
import {
  buildHairShellExtrusionPreviewTopology,
  buildHairShellRegionExtrusionPreviewTopology,
  buildHairShellTopology,
  connectedHairShellFaceRegion,
  extrudeHairShellFaceTopology,
  HAIR_SHELL_ROOT_SUPPORT_SIDE,
  hairShellExtrusionCurveFrames,
  hairShellExtrusionProfileForFaces,
  hairShellRootSupportSide,
  normalizeHairShellExtrusionSettings,
  subdivideHairShellVerticalLoops
} from "../modules/hair-shell.js";
import {
  buildConnectedStrandShellMesh,
  connectedStrandShellTopologySummary,
  createConnectedStrandShellData,
  DEFAULT_CONNECTED_STRAND_SECTION_CURVE,
  DEFAULT_CONNECTED_STRAND_SECTION_PROFILE,
  deformConnectedStrandShell,
  normalizeConnectedStrandShellSectionCurve,
  normalizeConnectedStrandShellSettings
} from "../modules/connected-strand-shell.js";
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
  crownGrowCoverageRadius,
  crownGrowGravityStrength,
  crownGrowSmoothingMetrics,
  crownGrowStrandPlan,
  DEFAULT_CROWN_GROW_SETTINGS,
  normalizeCrownGrowSettings
} from "../modules/crown-grow.js";
import {
  proceduralAccessoryTaperScale,
  proceduralAccessoryTemplateData,
  proceduralBranchTemplateData
} from "../modules/procedural-draw.js";
import {
  resampleClosedProfilePoints
} from "../modules/branch-knife.js";

import {
  createSilhouetteVolumeGrid,
  mirrorSilhouetteInterval,
  resampleClosedSilhouette,
  silhouetteIntervalAtY
} from "../modules/silhouette-volume.js";
import {
  createMirroredScalpGrid,
  resampleOpenScalpBoundary,
  scalpQuadWireEdges
} from "../modules/scalp-draw.js";
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

test("crown grow produces stable evenly distributed strand plans", () => {
  const settings = { ...DEFAULT_CROWN_GROW_SETTINGS, strandCount: 12, randomness: 0.12, seed: 42 };
  const first = crownGrowStrandPlan(settings);
  const second = crownGrowStrandPlan(settings);
  assert.deepEqual(first, second);
  assert.equal(first.length, 12);
  assert.ok(first.every((strand) => (
    Number.isFinite(strand.angle)
    && strand.rootT > 0
    && strand.rootT <= 1
    && strand.length > 0
  )));
  assert.ok(first.every((strand, index) => index === 0 || strand.rootT > first[index - 1].rootT));
  assert.notEqual(first[0].length, first[1].length);
});

test("curve point sharpness defaults, clamps, and addresses curve segments", () => {
  assert.deepEqual(normalizeCurvePointSharpness(undefined, 3), [0, 0, 0]);
  assert.deepEqual(normalizeCurvePointSharpness([-1, 0.35, 2], 3), [0, 0.35, 1]);
  assert.deepEqual(curveSegmentCoordinates(0.625, 5), { index: 2, amount: 0.5 });
  assert.deepEqual(curveSegmentCoordinates(1, 5), { index: 3, amount: 1 });
  assert.equal(curveSegmentSharpness([0, 0.4, 0.8], 0, 3), 0.4);
  assert.equal(curveSegmentSharpness([0, 0.4, 0.8], 1, 3), 0.8);
});

test("sharp curve joints optionally add support rows around an aligned apex and bounded miter", () => {
  const baseParameters = [0, 0.2, 0.4, 0.6, 0.8, 1];
  assert.deepEqual(
    alignCurveParametersToSharpControls(baseParameters, [0, 0, 0], 3),
    baseParameters
  );
  const aligned = alignCurveParametersToSharpControls(baseParameters, [0, 1, 0], 3);
  assert.equal(aligned.length, baseParameters.length);
  closeTo(aligned[1], 0.2);
  closeTo(aligned[2], 0.5);
  closeTo(aligned[3], 0.6);
  assert.ok(aligned.every((value, index) => index === 0 || value > aligned[index - 1]));

  const beveled = alignCurveParametersToSharpControls(baseParameters, [0, 1, 0], 3, true);
  assert.equal(beveled.length, baseParameters.length + 2);
  closeTo(beveled[1], 0.2);
  closeTo(beveled[2], 0.47);
  closeTo(beveled[3], 0.5);
  closeTo(beveled[4], 0.51);
  closeTo(beveled[5], 0.6);
  assert.ok(beveled.every((value, index) => index === 0 || value > beveled[index - 1]));
  assert.deepEqual(beveled.bevelSupports, [
    { rowIndex: 2, apexRowIndex: 3, neighborRowIndex: 1, surfaceBlend: 0.9 },
    { rowIndex: 4, apexRowIndex: 3, neighborRowIndex: 5, surfaceBlend: 0.9 }
  ]);

  const lightlyBeveled = alignCurveParametersToSharpControls(baseParameters, [0, 0.01, 0], 3, true);
  closeTo(lightlyBeveled[2], 0.3512);
  closeTo(lightlyBeveled[4], 0.5496);
  closeTo(lightlyBeveled.bevelSupports[0].surfaceBlend, 0.504);

  const surfaceRows = beveled.map((_, row) => (
    row === 1 ? 0 : row === 2 ? 99 : row === 3 ? 10 : row === 4 ? 99 : row === 5 ? 20 : row
  ));
  slideCurveBevelSupportRows(beveled, 1, surfaceRows, 1);
  closeTo(surfaceRows[2], 9);
  closeTo(surfaceRows[4], 11);
  flowCurveBevelApexRows(beveled, 1, surfaceRows, 1);
  closeTo(surfaceRows[3], 10);

  const unevenSurfaceRows = beveled.map((_, row) => (
    row === 1 ? 0 : row === 2 ? 99 : row === 3 ? 20 : row === 4 ? 99 : row === 5 ? 10 : row
  ));
  slideCurveBevelSupportRows(beveled, 1, unevenSurfaceRows, 1);
  flowCurveBevelApexRows(beveled, 1, unevenSurfaceRows, 1);
  closeTo(unevenSurfaceRows[2], 18);
  closeTo(unevenSurfaceRows[4], 19);
  closeTo(unevenSurfaceRows[3], 18.5);

  const halfFlowParameters = alignCurveParametersToSharpControls(baseParameters, [0, 1, 0], 3, true, false, 0.5);
  const halfFlowRows = halfFlowParameters.map((_, row) => (
    row === 1 ? 0 : row === 2 ? 99 : row === 3 ? 20 : row === 4 ? 99 : row === 5 ? 10 : row
  ));
  slideCurveBevelSupportRows(halfFlowParameters, 1, halfFlowRows, 1);
  flowCurveBevelApexRows(halfFlowParameters, 1, halfFlowRows, 1);
  closeTo(halfFlowRows[3], 19.25);

  const bevelWithoutApex = alignCurveParametersToSharpControls(baseParameters, [0, 1, 0], 3, true, true);
  assert.deepEqual(bevelWithoutApex.omittedRows, [3]);
  assert.deepEqual(curveTopologyRowIndices(bevelWithoutApex), [0, 1, 2, 4, 5, 6, 7]);
  assert.equal(curveTopologyRowIndices(bevelWithoutApex).includes(bevelWithoutApex.bevelSupports[0].rowIndex), true);
  assert.deepEqual(
    alignCurveParametersToSharpControls(baseParameters, [0, 0, 0], 3, true),
    baseParameters
  );

  const joint = sharpCurveJointData(
    [[0, 0, 0], [1, 0, 0], [1, 1, 0]],
    [0, 1, 0],
    0.5
  );
  closeTo(joint.bisector[0], Math.SQRT1_2);
  closeTo(joint.bisector[1], Math.SQRT1_2);
  closeTo(joint.miterScale, Math.SQRT2);
  assert.equal(sharpCurveJointData([[0, 0, 0], [1, 0, 0], [1, 1, 0]], [0, 0, 0], 0.5), null);

  const clamped = sharpCurveJointData(
    [[0, 0, 0], [1, 0, 0], [0.02, 0.2, 0]],
    [0, 1, 0],
    0.5,
    1.75
  );
  assert.ok(clamped.miterScale <= 1.75);
});

test("crown grow coverage scales with length and surface follow without becoming unsafe", () => {
  assert.equal(crownGrowCoverageRadius({ length: 0.35, surfaceFollow: 0 }), 0.65);
  assert.ok(crownGrowCoverageRadius({ length: 2, surfaceFollow: 1 }) > 1.5);
  assert.equal(crownGrowCoverageRadius({ length: 4, surfaceFollow: 1 }), 2.1);
});

test("crown grow smoothing progressively limits turning without changing sampling", () => {
  assert.deepEqual(crownGrowSmoothingMetrics({ smoothing: 0 }), {
    surfaceTurnDegrees: 30,
    freeTurnDegrees: 24
  });
  assert.deepEqual(crownGrowSmoothingMetrics({ smoothing: 1 }), {
    surfaceTurnDegrees: 7,
    freeTurnDegrees: 6
  });
});

test("crown grow gravity has a stronger eased response while preserving neutral and maximum values", () => {
  assert.equal(crownGrowGravityStrength(0), 0);
  assert.equal(crownGrowGravityStrength(1), 1);
  assert.ok(crownGrowGravityStrength(0.5) > 0.5);
  assert.ok(crownGrowGravityStrength(DEFAULT_CROWN_GROW_SETTINGS.gravity) > 0.9);
});

test("crown grow settings clamp unsafe geometry inputs", () => {
  assert.deepEqual(normalizeCrownGrowSettings({
    strandCount: 100,
    length: -2,
    crownRadius: 4,
    surfaceFollow: 3,
    lift: -1,
    gravity: -2,
    swirl: 7,
    smoothing: 4,
    randomness: 2,
    seed: 0
  }), {
    strandCount: 48,
    length: 0.35,
    crownRadius: 0.8,
    surfaceFollow: 1,
    lift: 0,
    gravity: 0,
    swirl: 1,
    smoothing: 1,
    randomness: 0.35,
    seed: DEFAULT_CROWN_GROW_SETTINGS.seed
  });
});

test("hair shell extrusion previews stay local to the selected face", () => {
  const basePoints = Array.from({ length: 1004 }, (_, index) => ({ x: index, y: 0, z: 0 }));
  basePoints[1000] = { x: -0.5, y: 0, z: -0.5 };
  basePoints[1001] = { x: 0.5, y: 0, z: -0.5 };
  basePoints[1002] = { x: 0.5, y: 0, z: 0.5 };
  basePoints[1003] = { x: -0.5, y: 0, z: 0.5 };
  const topology = buildHairShellExtrusionPreviewTopology(
    basePoints,
    [1000, 1001, 1002, 1003],
    [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0.25, y: 2, z: 0 }
    ],
    4
  );

  assert.equal(topology.points.length, 20);
  assert.equal(topology.faces.length, 17);
  assert.equal(topology.faces.filter((face) => face.length === 3).length, 0);
  assert.ok(topology.faces.flat().every((index) => index >= 0 && index < topology.points.length));
});

test("standard hair shell extrusion replaces the source face with a connected quad cap", () => {
  const basePoints = [
    { x: -1, y: -1, z: 0 },
    { x: 1, y: -1, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: -1, y: 1, z: 0 }
  ];
  const topology = extrudeHairShellFaceTopology(
    basePoints,
    [[0, 1, 2, 3]],
    0,
    0.2
  );

  assert.ok(topology);
  assert.equal(topology.faceIndex, 0);
  assert.equal(topology.points.length, 8);
  assert.equal(topology.faces.length, 5);
  assert.deepEqual(topology.faces[0], [4, 5, 6, 7]);
  assert.ok(topology.faces.every((face) => face.length === 4 && new Set(face).size === 4));
  assert.ok(topology.points.slice(4).every((point) => Math.abs(point.z - 0.2) < 1e-8));
  assert.deepEqual(topology.faces.slice(1), [
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7]
  ]);
  const inward = extrudeHairShellFaceTopology(basePoints, [[0, 1, 2, 3]], 0, -0.15);
  assert.ok(inward.points.slice(4).every((point) => Math.abs(point.z + 0.15) < 1e-8));
  assert.equal(basePoints.length, 4);
});

test("connected hair shell face regions extrude as one quad region without internal walls", () => {
  const points = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }
  ];
  const faces = [[0, 1, 4, 3], [1, 2, 5, 4]];
  assert.equal(connectedHairShellFaceRegion(faces, [0, 1]), true);
  assert.equal(connectedHairShellFaceRegion([...faces, [6, 7, 8, 9]], [0, 2]), false);

  const topology = extrudeHairShellFaceTopology(points, faces, [0, 1], 0.25);
  assert.deepEqual(topology.faceIndices, [0, 1]);
  assert.equal(topology.points.length, 12);
  assert.equal(topology.faces.length, 8);
  assert.ok(topology.faces.every((face) => face.length === 4));
  assert.equal(topology.faces.slice(2).filter((face) => (
    face.includes(1) && face.includes(4)
  )).length, 0);
});

test("multi-face standard extrusion can ease its active end into a neighboring quad", () => {
  const points = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 }, { x: 3, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 },
    { x: 2, y: 1, z: 0 }, { x: 3, y: 1, z: 0 }
  ];
  const faces = [
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6]
  ];
  const topology = extrudeHairShellFaceTopology(points, faces, [0, 1], 0.25, {
    easeEnd: true,
    easeDirection: "right"
  });

  assert.deepEqual(topology.easedEnd, { start: 2, end: 6, supportFaceIndex: 2 });
  assert.deepEqual(topology.faces[2], [13, 12, 3, 7]);
  assert.ok(topology.faces.some((face) => face.length === 3 && face.includes(6) && face.includes(13)));
  assert.ok(topology.faces.some((face) => face.length === 3 && face.includes(2) && face.includes(12)));
  assert.equal(topology.faces.some((face) => (
    face.length === 4 && [2, 6, 12, 13].every((index) => face.includes(index))
  )), false);
});

test("standard extrusion cardinal easing follows quad-local edge directions", () => {
  const points = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }
  ];
  const faces = [
    [0, 1, 4, 3], [1, 2, 5, 4],
    [3, 4, 7, 6], [4, 5, 8, 7]
  ];
  const top = extrudeHairShellFaceTopology(points, faces, [2, 3], 0.25, {
    easeEnd: true,
    easeDirection: "top"
  });
  const bottom = extrudeHairShellFaceTopology(points, faces, [0, 1], 0.25, {
    easeEnd: true,
    easeDirection: "bottom"
  });

  assert.deepEqual(top.easedEdges, [
    { start: 3, end: 4, supportFaceIndex: 0, span: 1 },
    { start: 4, end: 5, supportFaceIndex: 1, span: 1 }
  ]);
  assert.deepEqual(bottom.easedEdges, [
    { start: 4, end: 3, supportFaceIndex: 2, span: 1 },
    { start: 5, end: 4, supportFaceIndex: 3, span: 1 }
  ]);
  assert.equal(top.faces.length, 10);
  assert.equal(bottom.faces.length, 10);
  assert.equal(top.faces.filter((face) => face.length === 3).length, 2);
  assert.equal(bottom.faces.filter((face) => face.length === 3).length, 2);
});

test("standard extrusion keeps one ease direction across cyclically rotated quads", () => {
  const points = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }
  ];
  const faces = [
    [0, 1, 4, 3], [5, 4, 1, 2],
    [3, 4, 7, 6], [8, 7, 4, 5]
  ];
  const topology = extrudeHairShellFaceTopology(points, faces, [2, 3], 0.25, {
    easeEnd: true,
    easeDirection: "top"
  });

  assert.deepEqual(topology.easedEdges, [
    { start: 3, end: 4, supportFaceIndex: 0, span: 1 },
    { start: 4, end: 5, supportFaceIndex: 1, span: 1 }
  ]);
});

test("standard extrusion ease span tapers across multiple neighboring quad rows", () => {
  const points = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 },
    { x: 0, y: 3, z: 0 }, { x: 1, y: 3, z: 0 }
  ];
  const faces = [
    [0, 1, 3, 2],
    [2, 3, 5, 4],
    [4, 5, 7, 6]
  ];
  const topology = extrudeHairShellFaceTopology(points, faces, [2], 0.25, {
    easeEnd: true,
    easeDirection: "top",
    easeSpan: 2
  });

  assert.equal(topology.easedSpan, 2);
  assert.deepEqual(topology.easedEdges, [
    { start: 4, end: 5, supportFaceIndex: 1, span: 2 }
  ]);
  assert.equal(topology.points.filter((point) => Math.abs(point.z - 0.125) < 1e-8).length, 2);
  assert.equal(topology.faces.filter((face) => face.length === 3).length, 2);
  assert.ok(topology.faces.some((face) => face.length === 4 && face.every((index) => index >= 0)));
});

test("standard extrusion caps and eased rows follow their selected face normals", () => {
  const points = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 1 },
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 1 },
    { x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 }, { x: 2, y: 2, z: 1 },
    { x: 0, y: 3, z: 0 }, { x: 1, y: 3, z: 0 }, { x: 2, y: 3, z: 1 }
  ];
  const faces = [
    [0, 1, 4, 3], [1, 2, 5, 4],
    [3, 4, 7, 6], [4, 5, 8, 7],
    [6, 7, 10, 9], [7, 8, 11, 10]
  ];
  const topology = extrudeHairShellFaceTopology(points, faces, [4, 5], 0.25, {
    easeEnd: true,
    easeDirection: "top",
    easeSpan: 2
  });

  const leftIntermediate = topology.points.find((point) => (
    Math.abs(point.x) < 1e-8
    && Math.abs(point.y - 1) < 1e-8
    && Math.abs(point.z - 0.125) < 1e-8
  ));
  const rightIntermediate = topology.points.find((point) => (
    Math.abs(point.x - (2 - (0.125 / Math.sqrt(2)))) < 1e-8
    && Math.abs(point.y - 1) < 1e-8
    && Math.abs(point.z - (1 + (0.125 / Math.sqrt(2)))) < 1e-8
  ));

  assert.ok(leftIntermediate);
  assert.ok(rightIntermediate);
  assert.deepEqual(topology.points[15], { x: 0, y: 3, z: 0.25 });
  assert.ok(Math.abs(topology.points[17].x - (2 - (0.25 / Math.sqrt(2)))) < 1e-8);
  assert.ok(Math.abs(topology.points[17].y - 3) < 1e-8);
  assert.ok(Math.abs(topology.points[17].z - (1 + (0.25 / Math.sqrt(2)))) < 1e-8);
});

test("curve extrusion sweeps a connected face region as one compound profile", () => {
  const points = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }
  ];
  const faces = [[0, 1, 4, 3], [1, 2, 5, 4]];
  const curvePoints = [
    { x: 1, y: 0.5, z: 0 },
    { x: 1, y: 0.5, z: 1 },
    { x: 1.5, y: 0.5, z: 2 }
  ];
  const preview = buildHairShellRegionExtrusionPreviewTopology(
    points,
    faces,
    [0, 1],
    curvePoints,
    2,
    {}
  );
  assert.equal(preview.points.length, 18);
  assert.equal(preview.faces.length, 14);
  assert.ok(preview.faces.every((face) => face.length === 4));

  const topology = buildHairShellTopology(points, faces, [{
    faceIndex: 0,
    faceIndices: [0, 1],
    loops: 2,
    curvePoints
  }]);
  assert.equal(topology.points.length, 18);
  assert.equal(topology.faces.length, 14);
  assert.ok(topology.faces.every((face) => face.length === 4));
  assert.ok(topology.faceSources.every((source) => source === null));
});

test("curve extrusion vertical loops continue through the parent quad flow", () => {
  const points = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }
  ];
  const faces = [[0, 1, 4, 3], [1, 2, 5, 4]];
  const subdivided = subdivideHairShellVerticalLoops(points, faces, 1, [0]);
  assert.equal(subdivided.points.length, 8);
  assert.equal(subdivided.faces.length, 3);
  assert.deepEqual(subdivided.faceSources, [0, 0, 1]);
  assert.ok(subdivided.faces.every((face) => face.length === 4));

  const topology = buildHairShellTopology(points, faces, [{
    faceIndex: 0,
    faceIndices: [0],
    loops: 2,
    verticalLoops: 1,
    rootTriangle: false,
    curvePoints: [
      { x: 0.5, y: 0.5, z: 0 },
      { x: 0.5, y: 0.5, z: 1 },
      { x: 0.5, y: 0.5, z: 2 }
    ]
  }]);
  assert.equal(topology.points.length, 20);
  assert.equal(topology.faces.length, 15);
  assert.ok(topology.faces.every((face) => face.length === 4));
  assert.deepEqual(topology.faceSources.filter(Number.isInteger), [1]);

  const verticalStripPoints = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 }, { x: 1, y: 2, z: 0 }
  ];
  const verticalStripFaces = [[0, 1, 3, 2], [2, 3, 5, 4]];
  const propagated = subdivideHairShellVerticalLoops(
    verticalStripPoints,
    verticalStripFaces,
    1,
    [0]
  );
  assert.equal(propagated.points.length, 9);
  assert.equal(propagated.faces.length, 4);
  assert.deepEqual(propagated.faceSources, [0, 0, 1, 1]);
});

test("hair shell curve extrusions sweep the selected polygon profile through transported curve frames", () => {
  const topology = buildHairShellExtrusionPreviewTopology(
    [
      { x: -1.2, y: 0, z: -0.4 },
      { x: -0.9, y: 0, z: 0.7 },
      { x: 0.8, y: 0, z: 0.5 },
      { x: 1.1, y: 0, z: -0.6 }
    ],
    [0, 3, 2, 1],
    [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0.8, y: 2, z: 0 }
    ],
    2,
    {
      rootTriangle: true,
      taperCurve: [
        { position: 0, value: 1, interpolation: "linear" },
        { position: 0.5, value: 0.5, interpolation: "linear" },
        { position: 1, value: 0.5, interpolation: "linear" }
      ],
      depthCurve: [
        { position: 0, value: 1, interpolation: "linear" },
        { position: 0.5, value: 0.5, interpolation: "linear" },
        { position: 1, value: 0.5, interpolation: "linear" }
      ]
    }
  );

  const center = (indices) => indices.reduce((sum, index) => ({
    x: sum.x + topology.points[index].x / indices.length,
    y: sum.y + topology.points[index].y / indices.length,
    z: sum.z + topology.points[index].z / indices.length
  }), { x: 0, y: 0, z: 0 });
  const ringOne = [4, 5, 6, 7];
  const ringTwo = [8, 9, 10, 11];
  const rootCenter = center([0, 1, 2, 3]);
  const centerOne = center(ringOne);
  const centerTwo = center(ringTwo);
  const tangentOne = {
    x: centerTwo.x - rootCenter.x,
    y: centerTwo.y - rootCenter.y,
    z: centerTwo.z - rootCenter.z
  };
  const tangentLength = Math.hypot(tangentOne.x, tangentOne.y, tangentOne.z);
  Object.keys(tangentOne).forEach((axis) => { tangentOne[axis] /= tangentLength; });
  ringOne.forEach((index) => {
    const offset = {
      x: topology.points[index].x - centerOne.x,
      y: topology.points[index].y - centerOne.y,
      z: topology.points[index].z - centerOne.z
    };
    assert.ok(Math.abs(offset.x * tangentOne.x + offset.y * tangentOne.y + offset.z * tangentOne.z) < 1e-8);
  });

  const rootEdgeLengths = [0, 1, 2, 3].map((index) => {
    const next = (index + 1) % 4;
    return Math.hypot(
      topology.points[index].x - topology.points[next].x,
      topology.points[index].y - topology.points[next].y,
      topology.points[index].z - topology.points[next].z
    );
  });
  const sweptEdgeLengths = ringOne.map((pointIndex, index) => {
    const nextIndex = ringOne[(index + 1) % ringOne.length];
    return Math.hypot(
      topology.points[pointIndex].x - topology.points[nextIndex].x,
      topology.points[pointIndex].y - topology.points[nextIndex].y,
      topology.points[pointIndex].z - topology.points[nextIndex].z
    );
  });
  rootEdgeLengths.forEach((length, index) => {
    assert.ok(Math.abs(sweptEdgeLengths[index] / length - 0.5) < 1e-8);
  });
  assert.ok(topology.faces.every((face) => face.length === 4));
});

test("hair shell curve extrusions apply strand-like width, depth, rotation, twist, and envelope controls", () => {
  const basePoints = [
    { x: -1, y: 0, z: -0.5 },
    { x: 1, y: 0, z: -0.5 },
    { x: 1, y: 0, z: 0.5 },
    { x: -1, y: 0, z: 0.5 }
  ];
  const curvePoints = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 }
  ];
  const settings = normalizeHairShellExtrusionSettings({
    loops: 2,
    taper: 2,
    tipScale: 0.25,
    rootTriangle: false,
    widthScale: 2,
    depthScale: 0.5,
    profileRotation: 20,
    twist: 70,
    taperCurve: [
      { position: 0, value: 1, interpolation: "linear" },
      { position: 1, value: 0.5, interpolation: "linear" }
    ],
    depthCurve: [
      { position: 0, value: 1, interpolation: "smooth" },
      { position: 1, value: 1, interpolation: "smooth" }
    ]
  });
  const topology = buildHairShellExtrusionPreviewTopology(
    basePoints,
    [0, 3, 2, 1],
    curvePoints,
    2,
    settings
  );

  assert.equal(settings.widthScale, 2);
  assert.equal(settings.depthScale, 0.5);
  assert.equal(settings.profileRotation, 20);
  assert.equal(settings.twist, 70);
  assert.equal(Object.hasOwn(settings, "taper"), false);
  assert.equal(Object.hasOwn(settings, "tipScale"), false);
  assert.deepEqual(settings.taperCurve.map((point) => point.value), [1, 0.5]);
  assert.equal(topology.points.length, 12);
  assert.equal(topology.faces.length, 9);
  assert.ok(topology.faces.slice(0, -1).every((face) => face.length === 4));

  const ringRadius = (indices) => {
    const center = indices.reduce((sum, index) => ({
      x: sum.x + topology.points[index].x / indices.length,
      y: sum.y + topology.points[index].y / indices.length,
      z: sum.z + topology.points[index].z / indices.length
    }), { x: 0, y: 0, z: 0 });
    return Math.max(...indices.map((index) => Math.hypot(
      topology.points[index].x - center.x,
      topology.points[index].y - center.y,
      topology.points[index].z - center.z
    )));
  };
  assert.ok(ringRadius([8, 9, 10, 11]) < ringRadius([4, 5, 6, 7]));
});

test("hair shell root support falls back to Side 3 and ignores legacy authored sides", () => {
  assert.equal(HAIR_SHELL_ROOT_SUPPORT_SIDE, 2);
  assert.equal(
    Object.hasOwn(normalizeHairShellExtrusionSettings({ triangleSide: 0 }), "triangleSide"),
    false
  );
});

test("hair shell curve extrusions use tapered width and depth defaults", () => {
  const settings = normalizeHairShellExtrusionSettings();
  assert.deepEqual(settings.taperCurve.map(({ position, value }) => ({ position, value })), [
    { position: 0, value: 1 },
    { position: 0.43, value: 0.95 },
    { position: 0.68, value: 0.8 },
    { position: 0.89, value: 0.4 },
    { position: 1, value: 0 }
  ]);
  assert.deepEqual(settings.depthCurve.map(({ position, value }) => ({ position, value })), [
    { position: 0, value: 1 },
    { position: 0.59, value: 0.83 },
    { position: 1, value: 0 }
  ]);
});

test("hair shell curve extrusions derive and apply an editable source-face profile", () => {
  const points = [
    { x: -1, y: 0, z: -0.5 },
    { x: 1, y: 0, z: -0.5 },
    { x: 1, y: 0, z: 0.5 },
    { x: -1, y: 0, z: 0.5 }
  ];
  const faces = [[0, 3, 2, 1]];
  const derived = hairShellExtrusionProfileForFaces(points, faces, [0]);
  assert.equal(derived.length, 4);
  assert.ok(derived.every((point) => point.interpolation === "linear"));

  const curvePoints = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 }
  ];
  const original = buildHairShellExtrusionPreviewTopology(points, faces[0], curvePoints, 2, {
    rootTriangle: false,
    taperCurve: [{ position: 0, value: 1 }, { position: 1, value: 1 }],
    depthCurve: [{ position: 0, value: 1 }, { position: 1, value: 1 }]
  });
  const shaped = buildHairShellExtrusionPreviewTopology(points, faces[0], curvePoints, 2, {
    rootTriangle: false,
    taperCurve: [{ position: 0, value: 1 }, { position: 1, value: 1 }],
    depthCurve: [{ position: 0, value: 1 }, { position: 1, value: 1 }],
    sweepProfile: [
      { x: 1, z: 0, interpolation: "linear" },
      { x: 0, z: 0.25, interpolation: "linear" },
      { x: -1, z: 0, interpolation: "linear" },
      { x: 0, z: -0.25, interpolation: "linear" }
    ]
  });
  assert.equal(shaped.points.length, original.points.length);
  assert.equal(shaped.faces.length, original.faces.length);
  assert.notDeepEqual(shaped.points.slice(4), original.points.slice(4));
});

test("curve extrusion profile orientation is stable across vertical-loop subdivision", () => {
  const points = [
    { x: -1, y: 0, z: -0.5 }, { x: 0, y: 0, z: -0.5 }, { x: 1, y: 0, z: -0.5 },
    { x: -1, y: 0, z: 0.5 }, { x: 0, y: 0, z: 0.5 }, { x: 1, y: 0, z: 0.5 }
  ];
  const faces = [[0, 1, 4, 3], [4, 1, 2, 5]];
  const profile = [
    { x: 1, z: -0.1, interpolation: "linear" },
    { x: 0, z: 1, interpolation: "linear" },
    { x: -1, z: -0.1, interpolation: "linear" },
    { x: 0, z: -0.2, interpolation: "linear" }
  ];
  const extrusion = {
    faceIndex: 1,
    faceIndices: [1],
    loops: 2,
    rootTriangle: false,
    sweepProfile: profile,
    taperCurve: [{ position: 0, value: 1 }, { position: 1, value: 1 }],
    depthCurve: [{ position: 0, value: 1 }, { position: 1, value: 1 }],
    curvePoints: [{ x: 0.5, y: 0, z: 0 }, { x: 0.5, y: 1, z: 0 }, { x: 0.5, y: 2, z: 0 }]
  };
  const ringBounds = (verticalLoops) => {
    const topology = buildHairShellTopology(points, faces, [{ ...extrusion, verticalLoops }]);
    const ring = topology.points.filter((point) => Math.abs(point.y - 1) < 1e-8);
    return {
      minX: Math.min(...ring.map((point) => point.x)),
      maxX: Math.max(...ring.map((point) => point.x)),
      minZ: Math.min(...ring.map((point) => point.z)),
      maxZ: Math.max(...ring.map((point) => point.z))
    };
  };
  const withoutLoops = ringBounds(0);
  const withLoops = ringBounds(1);
  Object.keys(withoutLoops).forEach((key) => {
    assert.ok(Math.abs(withoutLoops[key] - withLoops[key]) < 1e-8, `${key} changed with vertical loops`);
  });
});

test("curve extrusions preserve the source face boundary without dense transition loops", () => {
  const points = [
    { x: -1, y: 0, z: -0.5 },
    { x: 1, y: 0, z: -0.5 },
    { x: 1, y: 0, z: 0.5 },
    { x: -1, y: 0, z: 0.5 }
  ];
  const topology = buildHairShellExtrusionPreviewTopology(
    points,
    [0, 3, 2, 1],
    [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 2, z: 0 }
    ],
    2,
    {
      radialSegments: 24,
      rootTriangle: false,
      taperCurve: [{ position: 0, value: 1 }, { position: 1, value: 1 }],
      depthCurve: [{ position: 0, value: 1 }, { position: 1, value: 1 }]
    }
  );

  assert.equal(topology.points.length, 12);
  assert.equal(topology.faces.filter((face) => face.length === 3).length, 0);
  assert.equal(topology.faces.filter((face) => face.length === 4).length, 9);
  assert.ok(topology.faces.flat().every((index) => index >= 0 && index < topology.points.length));
});

test("curve extrusion point rotations roll the swept profile and its displayed normal", () => {
  const points = [
    { x: -1, y: 0, z: -0.5 },
    { x: 1, y: 0, z: -0.5 },
    { x: 1, y: 0, z: 0.5 },
    { x: -1, y: 0, z: 0.5 }
  ];
  const faces = [[0, 3, 2, 1]];
  const curvePoints = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 2, z: 0 }
  ];
  const base = {
    faceIndex: 0,
    curvePoints,
    rootTriangle: false,
    taperCurve: [{ position: 0, value: 1 }, { position: 1, value: 1 }],
    depthCurve: [{ position: 0, value: 1 }, { position: 1, value: 1 }]
  };
  const originalFrames = hairShellExtrusionCurveFrames(points, faces, base);
  const rotatedFrames = hairShellExtrusionCurveFrames(points, faces, {
    ...base,
    pointRotations: [0, 90, 0]
  });
  const original = buildHairShellExtrusionPreviewTopology(points, faces[0], curvePoints, 2, base);
  const rotated = buildHairShellExtrusionPreviewTopology(points, faces[0], curvePoints, 2, {
    ...base,
    pointRotations: [0, 90, 0]
  });

  assert.equal(rotatedFrames.length, 3);
  assert.ok(originalFrames[1].normal.x > 0.99);
  assert.ok(Math.abs(
    rotatedFrames[1].normal.x * rotatedFrames[1].tangent.x
    + rotatedFrames[1].normal.y * rotatedFrames[1].tangent.y
    + rotatedFrames[1].normal.z * rotatedFrames[1].tangent.z
  ) < 1e-8);
  assert.ok(Math.abs(
    originalFrames[1].normal.x * rotatedFrames[1].normal.x
    + originalFrames[1].normal.y * rotatedFrames[1].normal.y
    + originalFrames[1].normal.z * rotatedFrames[1].normal.z
  ) < 1e-8);
  assert.notDeepEqual(rotated.points.slice(4), original.points.slice(4));
  assert.deepEqual(
    normalizeHairShellExtrusionSettings({ curvePoints, pointRotations: [0, 900] }).pointRotations,
    [0, 720, 0]
  );
});

test("connected-face curve extrusions preserve their source region topology", () => {
  const points = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 }
  ];
  const faces = [[0, 1, 4, 3], [1, 2, 5, 4]];
  const topology = buildHairShellRegionExtrusionPreviewTopology(
    points,
    faces,
    [0, 1],
    [
      { x: 1, y: 0.5, z: 0 },
      { x: 1, y: 0.5, z: 1 },
      { x: 1, y: 0.5, z: 2 }
    ],
    2,
    { radialSegments: 24 }
  );

  assert.equal(topology.points.length, 18);
  assert.equal(topology.faces.filter((face) => face.length === 3).length, 0);
  assert.equal(topology.faces.filter((face) => face.length === 4).length, 14);
});

test("hair shell root support chooses the face above the initial extrusion direction", () => {
  const points = [
    { x: -1, y: 0, z: -1 },
    { x: 1, y: 0, z: -1 },
    { x: 1, y: 0, z: 1 },
    { x: -1, y: 0, z: 1 }
  ];
  assert.equal(hairShellRootSupportSide(
    points,
    [1, 2, 3, 0],
    [{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: -1 }]
  ), 1);
});

test("hair shell root support stays on the parent mesh above a standard quad sweep", () => {
  const topology = buildHairShellTopology(
    [
      { x: -1, y: 0, z: -1 },
      { x: 1, y: 0, z: -1 },
      { x: 1, y: 0, z: 1 },
      { x: -1, y: 0, z: 1 },
      { x: 1, y: 0, z: 2 },
      { x: -1, y: 0, z: 2 }
    ],
    [[1, 2, 3, 0], [3, 2, 4, 5]],
    [{
      faceIndex: 0,
      loops: 2,
      rootTriangle: true,
      curvePoints: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1, z: -0.5 },
        { x: 0.5, y: 2, z: -1 }
      ]
    }]
  );

  assert.equal(topology.points.length, 15);
  assert.equal(topology.faces.length, 12);
  assert.equal(topology.faces.filter((face) => face.length === 4).length, 9);
  assert.equal(topology.faces.filter((face) => face.length === 3).length, 3);
  assert.equal(topology.faceSources.filter((source) => source === 1).length, 3);
  assert.equal(topology.faceSources.filter((source) => source === null).length, 9);
  assert.deepEqual(topology.points[6], { x: 0, y: 0, z: 2 });
  assert.deepEqual(topology.faces.slice(0, 3), [[6, 2, 4], [6, 3, 2], [6, 5, 3]]);
  assert.ok(topology.faces.slice(3).every((face) => !face.includes(6)));
  topology.faces.forEach((face) => {
    assert.equal(new Set(face).size, face.length);
    const origin = topology.points[face[0]];
    const area = face.slice(1, -1).reduce((sum, _, index) => {
      const a = topology.points[face[index + 1]];
      const b = topology.points[face[index + 2]];
      const ab = { x: a.x - origin.x, y: a.y - origin.y, z: a.z - origin.z };
      const ac = { x: b.x - origin.x, y: b.y - origin.y, z: b.z - origin.z };
      return sum + Math.hypot(
        ab.y * ac.z - ab.z * ac.y,
        ab.z * ac.x - ab.x * ac.z,
        ab.x * ac.y - ab.y * ac.x
      ) * 0.5;
    }, 0);
    assert.ok(area > 1e-8);
  });
});

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
  assert.equal(workspaceForShortcutKey("2"), "mesh");
  assert.equal(workspaceForShortcutKey("3"), "guide");
  assert.equal(workspaceForShortcutKey("4"), "reference");
  assert.equal(workspaceForShortcutKey("5"), "brush");
  assert.equal(WORKSPACE_SHORTCUTS[2], "mesh");

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
  assert.equal(focusedControlShouldYieldToShortcut(select, { key: "4", code: "Digit4" }), true);
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

test("component marquee selection recognises contained vertices and crossing edges", () => {
  const marquee = { left: 40, right: 80, top: 40, bottom: 80 };
  assert.equal(pointInsideScreenBounds({ x: 60, y: 60 }, marquee), true);
  assert.equal(pointInsideScreenBounds({ x: 20, y: 60 }, marquee), false);
  assert.equal(segmentIntersectsScreenBounds([{ x: 20, y: 60 }, { x: 100, y: 60 }], marquee), true);
  assert.equal(segmentIntersectsScreenBounds([{ x: 20, y: 20 }, { x: 30, y: 30 }], marquee), false);
  assert.equal(segmentIntersectsScreenBounds([null, { x: 60, y: 60 }], marquee), false);
});

test("screen-space edge picking returns a stable closest point and pixel distance", () => {
  assert.deepEqual(
    closestPointOnScreenSegment({ x: 50, y: 56 }, [{ x: 20, y: 50 }, { x: 80, y: 50 }]),
    { amount: 0.5, point: { x: 50, y: 50 }, distance: 6 }
  );
  assert.deepEqual(
    closestPointOnScreenSegment({ x: 10, y: 54 }, [{ x: 20, y: 50 }, { x: 80, y: 50 }]),
    { amount: 0, point: { x: 20, y: 50 }, distance: Math.hypot(10, 4) }
  );
  assert.equal(closestPointOnScreenSegment({ x: 0, y: 0 }, [null, { x: 1, y: 1 }]), null);
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

test("history dependency expansion follows authored strand relationships", () => {
  const snapshots = [
    { id: "source", mirrorPartnerId: "mirror" },
    { id: "mirror", mirrorPartnerId: "source", clumpId: "clump-a" },
    { id: "clump-peer", clumpId: "clump-a", branchParentId: "branch-child" },
    { id: "branch-child", branchParentId: "clump-peer" },
    {
      id: "remesh",
      modelingMeshType: "auto-remesh",
      adaptiveRemeshSourceIds: ["branch-child"]
    },
    { id: "unrelated" }
  ];

  assert.deepEqual(
    [...expandHistoryDependencyIds(snapshots, new Set(["source"]))].sort(),
    ["branch-child", "clump-peer", "mirror", "remesh", "source"].sort()
  );
});

test("history dependency expansion combines current and restored relationships", () => {
  const currentSnapshots = [
    { id: "a", clumpId: "old-clump" },
    { id: "b", clumpId: "old-clump" },
    { id: "c" }
  ];
  const restoredSnapshots = [
    { id: "a" },
    { id: "b", mirrorPartnerId: "c" },
    { id: "c", mirrorPartnerId: "b" }
  ];

  assert.deepEqual(
    [...expandHistoryDependencyIds([...currentSnapshots, ...restoredSnapshots], ["a"])].sort(),
    ["a", "b", "c"]
  );
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

test("radial draw interpolates each strand between independent root and tip circles", () => {
  const template = proceduralAccessoryTemplateData({
    count: 4,
    radius: 0.8,
    tipRadius: 0.35,
    sampleCount: 5
  });
  const first = template.strands[1];
  assert.deepEqual(first.radialOffset, [0.8, 0]);
  assert.deepEqual(first.radialTipOffset, [0.35, 0]);
  assert.deepEqual(first.points[0], [0.8, 0, 0]);
  assert.deepEqual(first.points.at(-1), [0.35, -1, 0]);
  assert.ok(Math.abs(template.strands[2].points[0][0]) < 1e-12);
  assert.ok(Math.abs(template.strands[2].points[0][2] - 0.8) < 1e-12);
});

test("radial draw independently rotates its root and tip placement circles", () => {
  const template = proceduralAccessoryTemplateData({
    count: 4,
    radius: 0.8,
    tipRadius: 0.35,
    rootRotation: 90,
    tipRotation: -90,
    sampleCount: 5
  });
  const first = template.strands[1];
  assert.ok(Math.abs(first.radialRootAngle - Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(first.radialTipAngle + Math.PI / 2) < 1e-12);
  assert.ok(Math.abs(first.radialOffset[0]) < 1e-12);
  assert.ok(Math.abs(first.radialOffset[1] - 0.8) < 1e-12);
  assert.ok(Math.abs(first.radialTipOffset[0]) < 1e-12);
  assert.ok(Math.abs(first.radialTipOffset[1] + 0.35) < 1e-12);
  assert.ok(Math.abs(first.points[2][0] - 0.575) < 1e-12);
  assert.ok(Math.abs(first.points[2][2]) < 1e-12);
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
  curveLatticePresetMatches,
  curveLatticePresetPoints,
  curveLatticePresetValue,
  curveLatticeLoopPointIndices,
  DEFAULT_CURVE_LATTICE_PLANE,
  flatCurveLatticePointData,
  normalizeCurveLatticePresetLibrary,
  removeCurveLatticePreset,
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
  rebuildInflatedSculptProfileCurve,
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
  assert.deepEqual(
    inflateSculptPointScale({ x: 1, z: 1 }, 1, 0.5, 90, 90, -1),
    { x: 0.5, z: 0.5 }
  );
  assert.deepEqual(
    inflateSculptPointScale({ x: 0.2, z: 0.3 }, 1, 1, 90, 90, -1),
    { x: 0.18, z: 0.18 }
  );
});

test("inflate sculpt rebuilds authored profiles with local automatic control points", () => {
  const rebuilt = rebuildInflatedSculptProfileCurve(
    [
      { position: 0, value: 1, interpolation: "smooth" },
      { position: 1, value: 0, interpolation: "smooth" }
    ],
    [
      { position: 0, scale: 1 },
      { position: 0.25, scale: 1 },
      { position: 0.5, scale: 1.25 },
      { position: 0.75, scale: 1 },
      { position: 1, scale: 1 }
    ]
  );
  assert.deepEqual(rebuilt.map((point) => point.position), [0, 0.25, 0.5, 0.75, 1]);
  assert.ok(rebuilt.find((point) => point.position === 0.5).value > 0.5);
  assert.equal(rebuilt[0].value, 1);
  assert.equal(rebuilt.at(-1).value, 0);
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

test("curve lattice presets retain shape while applying at the target guide centre", () => {
  const source = flatCurveLatticePointData({ columns: 3, rows: 2, centerX: 4, centerY: 2, z: -1 });
  source[1].z += 0.5;
  const value = curveLatticePresetValue({ columns: 3, rows: 2, points: source });
  const target = flatCurveLatticePointData({ columns: 2, rows: 2, centerX: -3, centerY: 5, z: 2 });
  const applied = curveLatticePresetPoints(value, target);

  assert.equal(value.columns, 3);
  assert.equal(value.rows, 2);
  assert.equal(applied.length, 6);
  assert.ok(curveLatticePresetMatches(value, 3, 2, applied));
  const appliedCenter = applied.reduce((sum, point) => ({
    x: sum.x + point.x / applied.length,
    y: sum.y + point.y / applied.length,
    z: sum.z + point.z / applied.length
  }), { x: 0, y: 0, z: 0 });
  assert.ok(Math.abs(appliedCenter.x + 3) < 1e-10);
  assert.ok(Math.abs(appliedCenter.y - 5) < 1e-10);
  assert.ok(Math.abs(appliedCenter.z - 2) < 1e-10);
});

test("curve lattice preset libraries reject malformed and duplicate records", () => {
  const value = curveLatticePresetValue({ columns: 3, rows: 3, points: flatCurveLatticePointData() });
  const normalized = normalizeCurveLatticePresetLibrary([
    { id: "arched", name: "Arched", value },
    { id: "arched", name: "Duplicate", value },
    { id: "broken", name: "Broken", value: { columns: 3, rows: 3, points: [] } }
  ]);
  assert.deepEqual(normalized, [{ id: "arched", name: "Arched", value }]);
  assert.deepEqual(removeCurveLatticePreset(normalized, "arched"), []);
});

test("strand point removal promotes roots, shortens tips, and redistributes a local curve window", () => {
  assert.deepEqual(curvePointRemovalPlan(6, 0), {
    removedIndex: 0,
    promotedRoot: true,
    shortenedTip: false,
    parameters: [0.2, 0.4, 0.6, 0.8, 1]
  });
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
  hairstylePresetExportScopes,
  hairstylePresetPreviewView,
  mergeRegionalHairstylePresetState,
  stateForHairstylePresetScope
} from "../modules/preset-export.js";
import {
  forgetHairstylePresetRecord,
  normalizeHairstylePresetRecord,
  normalizeHairstylePresetRecords
} from "../modules/hairstyle-preset-storage.js";
import {
  createProjectRestorePlan,
  createProjectSelectionSnapshot,
  projectSnapshotLocks
} from "../modules/project-state.js";
import {
  greasePencilSegmentDistanceSquared,
  greasePencilPlaneOrigin,
  greasePencilMirrorLayer,
  normalizeGreasePencilKind,
  normalizeGreasePencilOperation,
  normalizeGreasePencilStroke,
  normalizeGreasePencilSize,
  normalizeGreasePencilSmoothing,
  smoothGreasePencilClosedPoints,
  smoothGreasePencilPoints
} from "../modules/grease-pencil.js";
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
  deletePolyFacesAndOrphans,
  deletePolyVertex,
  deletePolyVertices,
  extrudePolyBoundaryEdge,
  extrudePolyBoundaryEdgeLoop,
  frontFacingPolyComponents,
  flowPolySelectedEdges,
  insertPolyEdgeLoops,
  mirrorPolyTopologyAppend,
  nearestPolyWeldTarget,
  polyBoundaryEdges,
  polyBoundaryEdgeLoop,
  polyBevelSupportPlans,
  polyEdgeLoopEdges,
  polyEdgeLoopPlan,
  polyFillCandidate,
  polyMirroredFaceRegions,
  polyMirrorVertexMap,
  polyMeshBuffers,
  polyProportionalWeights,
  relaxPolyPoints,
  weldPolyVertices
} from "../modules/poly-topology.js";
import {
  createMeshPrimitiveData,
  inferMeshPrimitiveFaceSmoothingGroups,
  MESH_PRIMITIVE_TYPES,
  normalizeMeshPrimitiveSettings,
  normalizeMeshPrimitiveType,
  splitMeshVerticesByFaceGroups
} from "../modules/mesh-primitives.js";
import {
  ANIME_ANISOTROPIC_DEFAULTS,
  ANIME_ANISOTROPIC_SHADER,
  LAMBERT_SHADER,
  normalizeAnimeAnisotropicSettings,
  normalizeHairShader,
  STANDARD_ANISOTROPIC_SHADER
} from "../modules/anime-hair-shaders.js";
import {
  defaultMaterialIdForGeometry,
  ensureRequiredMaterialDefinitions,
  hairMaterialPresetValue,
  hairMaterialUsageCounts,
  MAX_HAIR_GRADIENT_STOPS,
  normalizeHairGradientStops,
  normalizeHairMaterialDefinition,
  normalizeHairMaterialPresetLibrary,
  removeHairMaterialPreset,
  resolveHairMaterialDefinition
} from "../modules/material-state.js";
import {
  meshComponentOverlayBuffers,
  meshTopologyEdgePositions,
  mirroredComponentFaceIndices,
  mirroredComponentVertexIndices
} from "../modules/mesh-component-visuals.js";

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

test("mesh primitives generate outward-facing editable quad topology", () => {
  assert.deepEqual(MESH_PRIMITIVE_TYPES, ["cube", "plane", "cylinder", "sphere"]);
  assert.equal(normalizeMeshPrimitiveType("sphere"), "sphere");
  assert.equal(normalizeMeshPrimitiveType("unknown"), "cube");
  assert.deepEqual(normalizeMeshPrimitiveSettings("cube", { segmentsX: 2, segmentsY: 3, segmentsZ: 4 }), {
    segmentsX: 2,
    segmentsY: 3,
    segmentsZ: 4
  });
  assert.deepEqual(normalizeMeshPrimitiveSettings("cylinder", { radialSegments: 19, heightSegments: 2 }), {
    radialSegments: 20,
    heightSegments: 2
  });

  for (const type of MESH_PRIMITIVE_TYPES) {
    const primitive = createMeshPrimitiveData(type);
    assert.equal(primitive.type, type);
    assert.ok(primitive.points.length >= 4);
    assert.ok(primitive.faces.length >= 1);
    assert.ok(primitive.faces.every((face) => face.length === 4));
    assert.ok(primitive.faces.flat().every((index) => index >= 0 && index < primitive.points.length));
    const buffers = polyMeshBuffers(primitive.points, primitive.faces);
    assert.deepEqual(buffers.quadFaces, primitive.faces);

    if (type !== "plane") {
      for (const face of primitive.faces) {
        const [p0, p1, p2] = face.map((index) => primitive.points[index]);
        const ax = p1.x - p0.x;
        const ay = p1.y - p0.y;
        const az = p1.z - p0.z;
        const bx = p2.x - p0.x;
        const by = p2.y - p0.y;
        const bz = p2.z - p0.z;
        const normal = {
          x: ay * bz - az * by,
          y: az * bx - ax * bz,
          z: ax * by - ay * bx
        };
        const center = face.reduce((sum, index) => ({
          x: sum.x + primitive.points[index].x / face.length,
          y: sum.y + primitive.points[index].y / face.length,
          z: sum.z + primitive.points[index].z / face.length
        }), { x: 0, y: 0, z: 0 });
        assert.ok(normal.x * center.x + normal.y * center.y + normal.z * center.z > 0);
      }
    }
  }

  assert.deepEqual(
    MESH_PRIMITIVE_TYPES.map((type) => {
      const primitive = createMeshPrimitiveData(type);
      return [type, primitive.points.length, primitive.faces.length];
    }),
    [["cube", 8, 6], ["plane", 4, 1], ["cylinder", 98, 96], ["sphere", 98, 96]]
  );
  assert.equal(createMeshPrimitiveData("plane", { columns: 3, rows: 2 }).faces.length, 6);
  assert.equal(createMeshPrimitiveData("cube", { segmentsX: 2, segmentsY: 3, segmentsZ: 4 }).faces.length, 52);
  assert.equal(createMeshPrimitiveData("cylinder", { radialSegments: 20, heightSegments: 2 }).faces.length, 90);
  assert.equal(createMeshPrimitiveData("sphere", { resolution: 2 }).faces.length, 24);

  const cube = createMeshPrimitiveData("cube");
  assert.deepEqual([...new Set(cube.faceSmoothingGroups)], [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(
    inferMeshPrimitiveFaceSmoothingGroups("cube", cube.points, cube.faces),
    cube.faceSmoothingGroups
  );
  const splitCube = splitMeshVerticesByFaceGroups(cube.faces, cube.faceSmoothingGroups);
  assert.equal(splitCube.sourceIndices.length, 24);
  assert.equal(splitCube.faces.length, cube.faces.length);

  const cylinder = createMeshPrimitiveData("cylinder");
  assert.deepEqual([...new Set(cylinder.faceSmoothingGroups)], [0, 1, 2]);
  assert.equal(cylinder.faceSmoothingGroups.filter((group) => group === 0).length, 64);
  assert.deepEqual(
    inferMeshPrimitiveFaceSmoothingGroups("cylinder", cylinder.points, cylinder.faces),
    cylinder.faceSmoothingGroups
  );
  const splitCylinder = splitMeshVerticesByFaceGroups(
    cylinder.faces,
    cylinder.faceSmoothingGroups
  );
  assert.equal(splitCylinder.sourceIndices.length, 130);

  const sphere = createMeshPrimitiveData("sphere");
  assert.deepEqual([...new Set(sphere.faceSmoothingGroups)], [0]);
});

test("standard extrusion can extend a primitive mesh face while keeping an editable quad cap", () => {
  const cube = createMeshPrimitiveData("cube");
  const topology = extrudeHairShellFaceTopology(cube.points, cube.faces, [0], 0.3);

  assert.ok(topology);
  assert.equal(topology.faceIndex, 0);
  assert.equal(topology.points.length, cube.points.length + 4);
  assert.equal(topology.faces.length, cube.faces.length + 4);
  assert.deepEqual(topology.faces[0], [8, 9, 10, 11]);
  assert.ok(topology.faces.every((face) => face.length === 4));
  assert.ok(topology.faces.flat().every((index) => index >= 0 && index < topology.points.length));
});

test("standard extrusion resolves opposite primitive faces while leaving centre-spanning faces single", () => {
  const cube = createMeshPrimitiveData("cube");
  const faceCenters = cube.faces.map((face) => (
    face.reduce((sum, index) => sum + cube.points[index].x, 0) / face.length
  ));
  const rightFaceIndex = faceCenters.findIndex((center) => center > 0.49);
  const leftFaceIndex = faceCenters.findIndex((center) => center < -0.49);
  const centreFaceIndex = faceCenters.findIndex((center) => Math.abs(center) < 1e-8);

  assert.deepEqual(
    polyMirroredFaceRegions(cube.points, cube.faces, [rightFaceIndex]),
    [[rightFaceIndex], [leftFaceIndex]]
  );
  assert.deepEqual(
    polyMirroredFaceRegions(cube.points, cube.faces, [centreFaceIndex]),
    [[centreFaceIndex]]
  );
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
  assert.deepEqual(faces, [[0, 1, 3, 2], [3, 1, 4, 5]]);

  const buffers = polyMeshBuffers(points, faces);
  assert.deepEqual(buffers.quadFaces, faces);
  assert.deepEqual(buffers.indices, [0, 1, 3, 0, 3, 2, 3, 1, 4, 3, 4, 5]);
  assert.deepEqual(buffers.triangleQuadIds, [0, 0, 1, 1]);
  assert.equal(buffers.uvs.length, points.length * 2);

  const triangleBuffers = polyMeshBuffers(points, [...faces, [0, 2, 5]], { allowTriangles: true });
  assert.deepEqual(triangleBuffers.quadFaces.at(-1), [0, 2, 5]);
  assert.deepEqual(triangleBuffers.indices.slice(-3), [0, 2, 5]);
  assert.equal(triangleBuffers.triangleQuadIds.at(-1), 2);
});

test("poly front-facing component filtering excludes rear vertices and edges", () => {
  const points = [
    { x: -1, y: -1, z: 0 },
    { x: 1, y: -1, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: -1, y: 1, z: 0 },
    { x: -1, y: -1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: -1, y: 1, z: -1 }
  ];
  const faces = [
    [0, 1, 2, 3],
    [4, 7, 6, 5]
  ];

  const front = frontFacingPolyComponents(points, faces, { x: 0, y: 0, z: -1 });
  assert.deepEqual([...front.faceIndices], [0]);
  assert.deepEqual([...front.vertexIndices], [0, 1, 2, 3]);
  assert.ok(front.edgeKeys.has("1:2"));
  assert.ok(!front.vertexIndices.has(4));
  assert.ok(!front.edgeKeys.has("4:7"));

  const rear = frontFacingPolyComponents(points, faces, { x: 0, y: 0, z: 1 });
  assert.deepEqual([...rear.faceIndices], [1]);
  assert.deepEqual([...rear.vertexIndices], [4, 7, 6, 5]);
  assert.ok(rear.edgeKeys.has("4:7"));
  assert.ok(!rear.vertexIndices.has(0));
});

test("poly boundary edge extrusion adds one connected quad with opposite shared-edge winding", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 }
  ];
  const faces = [[0, 1, 2, 3]];
  const result = extrudePolyBoundaryEdge(points, faces, [1, 2], [
    { x: 2, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 }
  ]);

  assert.deepEqual(result.newVertexIndices, [4, 5]);
  assert.deepEqual(result.faces, [[0, 1, 2, 3], [2, 1, 4, 5]]);
  assert.equal(extrudePolyBoundaryEdge(points, faces, [0, 2], [points[0], points[2]]), null);
});

test("poly boundary loop extrusion follows one continuous run and stops at perimeter corners", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 2, y: 1, z: 0 }
  ];
  const faces = [[0, 1, 4, 3], [1, 2, 5, 4]];
  const loop = polyBoundaryEdgeLoop(points, faces, [3, 4]);
  assert.equal(loop.edges.length, 2);
  assert.deepEqual(new Set(loop.sourceVertexIndices), new Set([3, 4, 5]));
  const result = extrudePolyBoundaryEdgeLoop(
    points,
    faces,
    [3, 4],
    loop.sourceVertexIndices.map((index) => ({ ...points[index], z: 1 }))
  );
  assert.equal(result.points.length, 9);
  assert.equal(result.faces.length, 4);
  assert.equal(result.edgeCount, 2);
  assert.ok(result.faces.every((face) => face.length === 4));
  assert.deepEqual(result.faces.slice(2), [
    [3, 4, 6, 7],
    [4, 5, 8, 6]
  ]);
});

test("poly edge extrusion welding finds nearby existing vertices while excluding its source edge", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 1.04, y: 0.02, z: 0 },
    { x: 2, y: 1, z: 0 }
  ];
  assert.equal(nearestPolyWeldTarget(points, points[4], {
    maxDistance: 0.08,
    excludedIndices: [1, 2, 4, 5]
  }), -1);
  points.push({ x: 1.02, y: 0.03, z: 0 });
  assert.equal(nearestPolyWeldTarget(points, points[4], {
    maxDistance: 0.08,
    excludedIndices: [1, 2, 4, 5]
  }), 6);
});

test("poly edge loop planning follows opposite quad edges and inserts a quad-only ring", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 2, y: 1, z: 0 }
  ];
  const faces = [[0, 1, 4, 3], [1, 2, 5, 4]];
  const plan = polyEdgeLoopPlan(points, faces, [0, 3], 0.75);

  assert.ok(plan);
  assert.equal(plan.faceCuts.length, 2);
  assert.deepEqual(new Set(plan.cuts.map((cut) => cut.key)), new Set(["0:3", "1:4", "2:5"]));
  const result = insertPolyEdgeLoops(points, faces, plan);
  assert.equal(result.points.length, 9);
  assert.equal(result.faces.length, 4);
  assert.ok(result.faces.every((face) => face.length === 4));
  assert.deepEqual(result.faceSourceIndices, [0, 0, 1, 1]);
  result.newVertexIndices.forEach((index) => assert.equal(result.points[index].y, 0.75));
  assert.equal(polyEdgeLoopPlan(points, faces, [0, 5], 0.5), null);
});

test("poly edge loop selection continues through vertices instead of selecting an edge ring", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
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

  assert.deepEqual(
    new Set(polyEdgeLoopEdges(points, faces, [3, 4]).map((edge) => edge.slice().sort().join(":"))),
    new Set(["3:4", "4:5"])
  );
  assert.deepEqual(
    new Set(polyEdgeLoopEdges(points, faces, [1, 4]).map((edge) => edge.slice().sort().join(":"))),
    new Set(["1:4", "4:7"])
  );
  assert.deepEqual(polyEdgeLoopEdges(points, faces, [0, 5]), []);
});

test("poly edge loop planning preserves one percentage across irregular crossed edges", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1.4, y: 0.2, z: 0.1 },
    { x: 3.1, y: -0.1, z: 0.4 },
    { x: -0.2, y: 1.2, z: 0.3 },
    { x: 1.1, y: 1.6, z: 0.8 },
    { x: 2.8, y: 1.1, z: 1.2 }
  ];
  const faces = [[0, 1, 4, 3], [1, 2, 5, 4]];
  const plan = polyEdgeLoopPlan(points, faces, [0, 3], 0.5);
  const result = insertPolyEdgeLoops(points, faces, plan);

  plan.cuts.forEach((cut) => {
    const entry = result.cutVertexIndices.find(({ key }) => key === cut.key);
    const start = points[cut.vertices[0]];
    const end = points[cut.vertices[1]];
    assert.deepEqual(result.points[entry.index], {
      x: (start.x + end.x) * 0.5,
      y: (start.y + end.y) * 0.5,
      z: (start.z + end.z) * 0.5
    });
  });
});

test("poly bevel support planning inserts quad support loops on both sides of an interior edge", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 2, y: 1, z: 0 }
  ];
  const faces = [[0, 1, 4, 3], [1, 2, 5, 4]];
  const plans = polyBevelSupportPlans(points, faces, [[1, 4]], 0.2);
  const result = insertPolyEdgeLoops(points, faces, plans);

  assert.equal(plans.length, 2);
  assert.equal(result.points.length, 10);
  assert.equal(result.faces.length, 4);
  assert.ok(result.faces.every((face) => face.length === 4));
});

test("poly edge flow leaves insufficient curvature support unchanged", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: -0.5, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1.5, z: 0 },
    { x: 2, y: 1, z: 0 }
  ];
  const faces = [[0, 1, 4, 3], [1, 2, 5, 4]];
  const result = flowPolySelectedEdges(points, faces, [[1, 4]], 1);

  assert.deepEqual(result.movedVertexIndices, []);
  assert.deepEqual(result.points, points);
  assert.deepEqual(flowPolySelectedEdges(points, faces, [[1, 4]], 0).movedVertexIndices, []);
});

test("poly mirror append shares center vertices and reverses mirrored quad winding", () => {
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 0, y: 1, z: 0 }
  ];
  const result = mirrorPolyTopologyAppend(points, [[0, 1, 2, 3]], {
    vertexStart: 0,
    faceStart: 0
  });
  assert.deepEqual(result.addedPoints, [
    { sourceIndex: 1, point: { x: -1, y: 0, z: 0 } },
    { sourceIndex: 2, point: { x: -1, y: 1, z: 0 } }
  ]);
  assert.deepEqual(result.sourceToMirror.slice(0, 4), [0, 4, 5, 3]);
  assert.deepEqual(result.faces, [[0, 1, 2, 3], [3, 5, 4, 0]]);
  assert.deepEqual(polyMirrorVertexMap([...points, ...result.addedPoints.map(({ point }) => point)]), [0, 4, 5, 3, 1, 2]);
  assert.deepEqual(polyMirrorVertexMap([
    { x: 0.5, y: 0, z: 0 },
    { x: -0.5005, y: 0, z: 0 }
  ], { tolerance: 0.001 }), [1, 0]);
  assert.deepEqual(polyMirrorVertexMap([
    { x: 0.004, y: 0, z: 0 }
  ], { tolerance: 0.02 }), [0]);
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
  assert.deepEqual(deletePolyVertices(points, faces, [0, 5]), {
    points: [points[1], points[2], points[3], points[4]],
    faces: []
  });
  assert.deepEqual(deletePolyFacesAndOrphans(points, faces, [0, 1]), {
    points: [],
    faces: [],
    removedVertexIndices: [0, 1, 2, 3, 4, 5]
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

  const spreadFill = polyFillCandidate(
    loosePoints.map((point) => ({ x: point.x * 2, y: point.y * 2, z: point.z })),
    [],
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    { maxDistance: 0.5, vertexMaxDistance: 3 }
  );
  assert.equal(spreadFill.kind, "quad");
  assert.deepEqual(new Set(spreadFill.faces[0]), new Set([0, 1, 2, 3]));

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
  assert.deepEqual(bridgeFill.faces.at(-1), [2, 1, 4, 7]);
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

test("mesh proportional editing falls off from vertex, edge, and face selections across topology", () => {
  const faces = [
    [0, 1, 4, 3],
    [1, 2, 5, 4],
    [3, 4, 7, 6],
    [4, 5, 8, 7]
  ];

  assert.deepEqual(
    polyProportionalWeights(9, faces, [0], { radius: 2, falloff: 1 }),
    [1, 0.5, 0, 0.5, 0, 0, 0, 0, 0]
  );
  assert.deepEqual(
    polyProportionalWeights(9, faces, [0, 1], { radius: 2, falloff: 1 }),
    [1, 1, 0.5, 0.5, 0.5, 0, 0, 0, 0]
  );
  assert.deepEqual(
    polyProportionalWeights(9, faces, [0, 1, 4, 3], { radius: 2, falloff: 1 }),
    [1, 1, 0.5, 1, 1, 0.5, 0.5, 0.5, 0]
  );
});

test("poly vertex welding remaps connected quads and removes only committed source vertices", () => {
  const points = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 },
    { x: 1.02, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 }, { x: 1.02, y: 1, z: 0 }
  ];
  const result = weldPolyVertices(points, [
    [0, 1, 2, 3],
    [4, 5, 6, 7]
  ], [[4, 1], [7, 2]]);

  assert.deepEqual(result.removedVertexIndices, [4, 7]);
  assert.equal(result.points.length, 6);
  assert.deepEqual(result.faces, [[0, 1, 2, 3], [1, 4, 5, 2]]);
  assert.ok(result.faces.every((face) => face.length === 4 && new Set(face).size === 4));
  assert.deepEqual(points[4], { x: 1.02, y: 0, z: 0 });
});

test("poly vertex welding drops a quad only when the committed weld collapses that face", () => {
  const points = [
    { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }
  ];
  const result = weldPolyVertices(points, [[0, 1, 2, 3]], [[1, 0]]);

  assert.deepEqual(result.removedVertexIndices, [1]);
  assert.deepEqual(result.faces, []);
  assert.equal(result.points.length, 3);
});

test("poly vertex welding safely collapses a mirrored pair without following a reverse cycle", () => {
  const points = [
    { x: -0.02, y: 0, z: 0 },
    { x: 0.02, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }
  ];
  const result = weldPolyVertices(points, [], [[0, 1], [1, 0]]);

  assert.deepEqual(result.removedVertexIndices, [0]);
  assert.deepEqual(result.points, [points[1], points[2]]);
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
    materialPresets: [{ id: "amber", name: "Amber", value: { color: "#aa6622" } }],
    curveLatticePresets: [{
      id: "arched",
      name: "Arched",
      value: { columns: 2, rows: 2, points: [{ x: -1, y: 1, z: 0 }] }
    }]
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
    materialPresets: [{ id: "amber", name: "Amber", value: { color: "#aa6622" } }],
    curveLatticePresets: [{
      id: "arched",
      name: "Arched",
      value: { columns: 2, rows: 2, points: [{ x: -1, y: 1, z: 0 }] }
    }]
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
    materialPresets: [{ id: "amber", value: { color: "#aa6622" } }],
    curveLatticePresets: [{ id: "arched", value: { columns: 2, rows: 2, points: [{ x: 0, y: 0, z: 0 }] } }]
  });
  assert.deepEqual(backup.preferences, { defaultShader: "anime-anisotropic" });
  assert.deepEqual(backup.presets, { strand: [{ id: "soft" }], braid: [] });
  assert.deepEqual(backup.shapePresets, {
    sweepProfile: [],
    taperCurve: [{ id: "width" }],
    depthCurve: []
  });
  assert.deepEqual(backup.materialPresets, [{ id: "amber", value: { color: "#aa6622" } }]);
  assert.deepEqual(backup.curveLatticePresets, [{
    id: "arched",
    value: { columns: 2, rows: 2, points: [{ x: 0, y: 0, z: 0 }] }
  }]);
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

test("material state supplies geometry defaults and restores required built-ins without duplicates", () => {
  const ids = { hairMaterialId: "hair", meshMaterialId: "mesh" };
  assert.equal(defaultMaterialIdForGeometry("strand", ids), "hair");
  assert.equal(defaultMaterialIdForGeometry("poly", ids), "mesh");
  assert.equal(defaultMaterialIdForGeometry("hair-shell", ids), "mesh");

  const existing = [{ id: "hair", name: "Saved Hair", color: "#123456" }];
  const restored = ensureRequiredMaterialDefinitions(existing, [
    { id: "hair", name: "Built-in Hair", color: "#654321" },
    { id: "mesh", name: "Default Mesh", color: "#777982", shader: LAMBERT_SHADER }
  ]);
  assert.deepEqual(restored.map((material) => material.id), ["hair", "mesh"]);
  assert.equal(restored[0].name, "Saved Hair");
  assert.equal(restored[1].shader, LAMBERT_SHADER);
  assert.notEqual(restored[0], existing[0]);
});

test("mesh component visuals share mirrored selection and topology buffer planning", () => {
  const points = [
    { x: -2, y: -1, z: 0 }, { x: -1, y: -1, z: 0 },
    { x: -1, y: 1, z: 0 }, { x: -2, y: 1, z: 0 },
    { x: 1, y: -1, z: 0 }, { x: 2, y: -1, z: 0 },
    { x: 2, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }
  ];
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7]];
  assert.deepEqual(mirroredComponentVertexIndices(points, [0, 1]), [5, 4]);
  assert.deepEqual(mirroredComponentVertexIndices(points, [0], { enabled: false }), []);
  assert.deepEqual(mirroredComponentFaceIndices(points, faces, [0]), [1]);

  const faceBuffers = meshComponentOverlayBuffers(points, [faces[0]], "face");
  assert.equal(faceBuffers.componentCount, 1);
  assert.deepEqual(faceBuffers.indices, [0, 1, 2, 0, 2, 3]);
  assert.equal(faceBuffers.positions.length, 12);
  assert.equal(faceBuffers.outlinePositions.length, 24);
  assert.equal(meshTopologyEdgePositions(points, faces).length, 48);
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

test("hairstyle preset exports can independently include every populated region", () => {
  const locks = [
    { id: "front", scalpRegion: "bangs", mirrorPartnerId: "back", branchParentId: "back", clumpId: "mixed-clump" },
    { id: "left-bang", scalpRegion: "side-bangs-left" },
    { id: "right-side", scalpRegion: "side-right" },
    { id: "back", scalpRegion: "back", mirrorPartnerId: "front" },
    { id: "loose", scalpRegion: "unassigned" }
  ];
  const scopes = hairstylePresetExportScopes({
    name: "Layered Bob.ahs",
    locks,
    includeFull: true,
    includedRegionScopeIds: ["front-bangs", "side-bangs", "sides", "back"]
  });
  assert.deepEqual(scopes.map((scope) => scope.id), ["full", "front-bangs", "side-bangs", "sides", "back"]);
  assert.equal(scopes[0].fileBaseName, "Layered Bob");
  assert.deepEqual(scopes[2].lockIds, ["left-bang"]);

  const frontState = stateForHairstylePresetScope({
    locks,
    guides: [{ id: "guide" }],
    referenceImages: [{ id: "reference" }],
    greasePencilStrokes: [{ id: "stroke" }],
    selectedId: "back",
    selectedStrandIds: ["front", "back"],
    selectionSets: [{ id: "set", strandIds: ["front", "back"] }]
  }, scopes[1]);
  assert.deepEqual(frontState.locks.map((lock) => lock.id), ["front"]);
  assert.equal(frontState.locks[0].mirrorPartnerId, null);
  assert.equal(frontState.locks[0].branchParentId, null);
  assert.equal(frontState.locks[0].clumpId, null);
  assert.equal(frontState.selectedId, null);
  assert.deepEqual(frontState.selectedStrandIds, ["front"]);
  assert.deepEqual(frontState.selectionSets[0].strandIds, ["front"]);
  assert.deepEqual(frontState.guides, []);
  assert.deepEqual(frontState.referenceImages, []);
  assert.deepEqual(frontState.greasePencilStrokes, []);

  const selectedScopes = hairstylePresetExportScopes({
    name: "Layered Bob",
    locks,
    includeFull: false,
    includedRegionScopeIds: ["side-bangs", "back"]
  });
  assert.deepEqual(selectedScopes.map((scope) => scope.id), ["side-bangs", "back"]);
});

test("hairstyle preset previews use stable region-facing camera views", () => {
  assert.deepEqual(hairstylePresetPreviewView("front-bangs"), { x: 0, y: -0.06, z: -1, padding: 1.08 });
  assert.deepEqual(hairstylePresetPreviewView("side-bangs"), { x: -1, y: -0.06, z: 0, padding: 1.08 });
  assert.deepEqual(hairstylePresetPreviewView("back"), { x: 0, y: -0.06, z: 1, padding: 1.08 });
  assert.deepEqual(hairstylePresetPreviewView("unknown"), hairstylePresetPreviewView("full"));
});

test("regional hairstyle presets replace only their target regions and remap relationships", () => {
  let nextId = 0;
  const merged = mergeRegionalHairstylePresetState({
    lockIndex: 5,
    hairMaterialIndex: 2,
    visibleStrandRegions: ["bangs", "back"],
    hairMaterials: [
      { id: "default", color: "purple" },
      { id: "shared", color: "current" }
    ],
    locks: [
      { id: "old-front", scalpRegion: "bangs", materialId: "default" },
      { id: "keep-back", scalpRegion: "back", mirrorPartnerId: "old-front", materialId: "default" }
    ],
    selectionSets: [{ id: "current-set", strandIds: ["old-front", "keep-back"] }],
    guides: [{ id: "guide" }]
  }, {
    lockIndex: 9,
    hairMaterialIndex: 7,
    hairMaterials: [{ id: "shared", color: "preset" }],
    locks: [
      { id: "front-a", scalpRegion: "bangs", mirrorPartnerId: "front-b", clumpId: "clump-a", clumpGuideId: "front-a", materialId: "shared" },
      { id: "front-b", scalpRegion: "bangs", mirrorPartnerId: "front-a", clumpId: "clump-a", clumpGuideId: "front-a", materialId: "shared" },
      { id: "not-imported", scalpRegion: "back", materialId: "shared" }
    ],
    selectionSets: [{ id: "incoming-set", strandIds: ["front-a", "front-b"] }]
  }, {
    regionIds: ["bangs"],
    createId: (kind) => `${kind}-${++nextId}`
  });
  assert.deepEqual(merged.locks.map((lock) => lock.id), ["keep-back", "lock-1", "lock-2"]);
  assert.equal(merged.locks[0].mirrorPartnerId, null);
  assert.equal(merged.locks[1].mirrorPartnerId, "lock-2");
  assert.equal(merged.locks[1].clumpGuideId, "lock-1");
  assert.equal(merged.locks[1].clumpId, merged.locks[2].clumpId);
  assert.match(merged.locks[1].materialId, /^preset-material-material-/);
  assert.deepEqual(merged.selectionSets.map((set) => set.strandIds), [["keep-back"], ["lock-1", "lock-2"]]);
  assert.deepEqual(merged.guides, [{ id: "guide" }]);
  assert.equal(merged.lockIndex, 9);
});

test("preset project metadata embeds its catalog role and generated preview", () => {
  const previewImage = "data:image/jpeg;base64,preview";
  const project = createHairProject({
    name: "Side Bangs",
    state: { locks: [], guides: [] },
    strandGroups: [],
    preset: { category: "elements", regions: ["side-bangs"] },
    previewImage
  });
  assert.deepEqual(project.metadata.preset, { category: "elements", regions: ["side-bangs"] });
  assert.equal(project.metadata.previewImage, previewImage);
});

test("custom hairstyle preset records retain projects and normalize library metadata", () => {
  const project = createHairProject({
    name: "Back Shape",
    state: { locks: [], guides: [] },
    strandGroups: []
  });
  const record = normalizeHairstylePresetRecord({
    id: "custom-back-1",
    title: "Back Shape",
    category: "elements",
    regions: ["back", "back", ""],
    previewImage: "data:image/jpeg;base64,preview",
    previewModel: {
      version: 1,
      meshes: [{
        positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1],
        indices: [0, 1, 2],
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        color: 0x224466
      }]
    },
    project,
    createdAt: 12
  });
  assert.deepEqual(record.regions, ["back"]);
  assert.equal(record.project, project);
  assert.equal(record.previewModel.meshes[0].positions instanceof Float32Array, true);
  assert.equal(record.previewModel.meshes[0].indices instanceof Uint32Array, true);
  assert.equal(record.previewModel.meshes[0].color, 0x224466);
  assert.equal(normalizeHairstylePresetRecord({ id: "missing-project", title: "Nope" }), null);
  assert.deepEqual(
    normalizeHairstylePresetRecords([{ ...record, createdAt: 8 }, record]).map((entry) => entry.id),
    ["custom-back-1"]
  );
});

test("custom hairstyle preset deletion rejects an empty persistent id", async () => {
  await assert.rejects(() => forgetHairstylePresetRecord("  "), /valid id/);
});

test("project restore plans normalize transient collections without changing scene records", () => {
  const state = {
    lockIndex: 7,
    referenceImageIndex: 0,
    hairMaterialIndex: 0,
    capsuleGuidesVisible: undefined,
    curveLatticeGuidesVisible: undefined,
    referencesVisible: undefined,
    importedMeshVisibility: { "mesh-0": false, "mesh-1": 1 },
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
    greasePencilStrokeIndex: 1,
    hairMaterialIndex: 1
  });
  assert.deepEqual(plan.visibility, {
    strandRegions: ["bangs", "back"],
    strandLayers: ["bottom", "top"],
    capsuleGuides: true,
    curveLatticeGuides: true,
    references: true,
    headMesh: true,
    bodyMesh: true,
    importedMeshes: { "mesh-0": false, "mesh-1": true }
  });
  assert.equal(plan.resources.hairMaterials, null);
  assert.equal(plan.scene.locks, state.locks);
  assert.equal(plan.scene.guides, state.guides);
  assert.deepEqual(plan.scene.referenceImages, []);
  assert.deepEqual(plan.scene.greasePencilStrokes, []);
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

test("grease pencil strokes normalize legacy data and support segment erasing", () => {
  assert.deepEqual(normalizeGreasePencilStroke({
    id: "stroke-a",
    layer: "left",
    color: "#AABBCC",
    points: [{ x: 1, y: 2, z: 3 }, { x: "4", y: 5, z: 6 }]
  }), {
    id: "stroke-a",
    layer: "left",
    color: "#aabbcc",
    size: 3,
    smoothing: 1,
    kind: "stroke",
    operation: "add",
    panelId: null,
    mirrorStrokeId: null,
    points: [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }]
  });
  assert.equal(greasePencilMirrorLayer("left"), "right");
  assert.equal(greasePencilMirrorLayer("front"), "front");
  assert.equal(normalizeGreasePencilSize(24), 20);
  assert.equal(normalizeGreasePencilSize("bad"), 3);
  assert.equal(normalizeGreasePencilSmoothing(-1), 0);
  assert.equal(normalizeGreasePencilSmoothing(0.65), 0.65);
  assert.equal(normalizeGreasePencilKind("shape"), "shape");
  assert.equal(normalizeGreasePencilKind("unknown"), "stroke");
  assert.equal(normalizeGreasePencilOperation("trim"), "trim");
  assert.equal(normalizeGreasePencilOperation("unknown"), "add");
  const closed = smoothGreasePencilClosedPoints([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 }
  ], "background", 1, 1);
  assert.equal(closed.length, 6);
  assert.deepEqual(closed.at(-1), { x: 0, y: 0.25 });
  assert.equal(greasePencilSegmentDistanceSquared(
    { x: 0.5, y: 0.25 },
    { x: 0, y: 0 },
    { x: 1, y: 0 }
  ), 0.0625);
  assert.deepEqual(smoothGreasePencilPoints([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 0 }
  ], "background", 1), [
    { x: 0, y: 0 },
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.75 },
    { x: 1.25, y: 0.75 },
    { x: 1.75, y: 0.25 },
    { x: 2, y: 0 }
  ]);
  assert.deepEqual(smoothGreasePencilPoints([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 0 }
  ], "background", 2, 0), [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 0 }
  ]);
  assert.deepEqual(greasePencilPlaneOrigin("front", { x: 0.1, y: 0.75, z: 0 }), {
    x: 0.1,
    y: 0.75,
    z: 2.4
  });
  assert.deepEqual(greasePencilPlaneOrigin("left", { x: 0.1, y: 0.75, z: 0 }), {
    x: -2.3,
    y: 0.75,
    z: 0
  });
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

test("silhouette scanlines recover the outer interval of a closed outline", () => {
  const contour = [
    { x: -2, y: -1 },
    { x: 2, y: -1 },
    { x: 2, y: 1 },
    { x: -2, y: 1 }
  ];
  assert.deepEqual(silhouetteIntervalAtY(contour, 0), { min: -2, max: 2 });
});

test("drawn silhouettes become evenly spaced closed editable curves", () => {
  const samples = resampleClosedSilhouette([
    { x: -2, y: -1 },
    { x: 2, y: -1 },
    { x: 2, y: 1 },
    { x: -2, y: 1 }
  ], 12);
  assert.equal(samples.length, 12);
  const distances = samples.map((point, index) => {
    const next = samples[(index + 1) % samples.length];
    return Math.hypot(next.x - point.x, next.y - point.y);
  });
  assert.ok(Math.max(...distances) - Math.min(...distances) < 0.000001);
});

test("silhouette volume produces quad side flow and two caps", () => {
  const side = [
    { x: -1, y: -2 },
    { x: 1, y: -2 },
    { x: 1.5, y: 2 },
    { x: -1.5, y: 2 }
  ];
  const back = [
    { x: -2, y: -2 },
    { x: 2, y: -2 },
    { x: 2.5, y: 2 },
    { x: -2.5, y: 2 }
  ];
  const grid = createSilhouetteVolumeGrid({
    sidePoints: side,
    backPoints: back,
    lengthSegments: 4,
    radialSegments: 8,
    roundness: 2
  });
  assert.equal(grid.points.length, 40);
  assert.equal(grid.faces.length, 34);
  assert.ok(grid.faces.slice(0, -2).every((face) => face.length === 4));
  assert.equal(grid.faces.at(-2).length, 8);
  assert.equal(grid.faces.at(-1).length, 8);
  assert.equal(grid.sections[2].centerX, 0);
  assert.equal(grid.sections[2].centerZ, 0);
  assert.ok(grid.sections[0].halfWidth > grid.sections.at(-1).halfWidth);
});

test("silhouette X mirroring expands the authored back curve into one symmetric volume", () => {
  assert.deepEqual(mirrorSilhouetteInterval({ min: 1, max: 3 }, 0), { min: -3, max: 3 });
  const grid = createSilhouetteVolumeGrid({
    sidePoints: [
      { x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }
    ],
    backPoints: [
      { x: 1, y: -1 }, { x: 3, y: -1 }, { x: 3, y: 1 }, { x: 1, y: 1 }
    ],
    lengthSegments: 2,
    radialSegments: 8,
    mirrorBackX: true,
    mirrorCenterX: 0
  });
  assert.equal(grid.sections[1].centerX, 0);
  assert.equal(grid.sections[1].halfWidth, 3);
});

test("scalp drawing resamples one boundary and builds a mirrored quad surface", () => {
  const boundary = resampleOpenScalpBoundary([
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 },
    { x: 1, y: 2, z: 0 }
  ], 5);
  assert.equal(boundary.length, 5);
  assert.deepEqual(boundary[0], { x: 1, y: 0, z: 0 });
  assert.deepEqual(boundary.at(-1), { x: 1, y: 2, z: 0 });
  const grid = createMirroredScalpGrid(boundary, { centerX: 0, widthSegments: 4 });
  assert.equal(grid.points.length, 25);
  assert.equal(grid.faces.length, 16);
  assert.ok(grid.faces.every((face) => face.length === 4));
  assert.equal(grid.points[0].x, -1);
  assert.equal(grid.points[4].x, 1);
});

test("scalp preview wireframes preserve quad borders without triangle diagonals", () => {
  assert.deepEqual(
    scalpQuadWireEdges([[0, 1, 4, 3], [1, 2, 5, 4]]),
    [[0, 1], [1, 4], [4, 3], [3, 0], [1, 2], [2, 5], [5, 4]]
  );
});

test("scalp filled-side points choose between complementary surface arcs", () => {
  const boundary = [
    { x: 1, y: 0, z: 1 },
    { x: 1, y: 1, z: 1 }
  ];
  const front = createMirroredScalpGrid(boundary, {
    centerX: 0,
    widthSegments: 2,
    headCenter: { x: 0, y: 0, z: 0 },
    insidePoint: { x: 0, y: 0, z: 2 }
  });
  const back = createMirroredScalpGrid(boundary, {
    centerX: 0,
    widthSegments: 2,
    headCenter: { x: 0, y: 0, z: 0 },
    insidePoint: { x: 0, y: 0, z: -2 }
  });
  assert.ok(front.points[1].z > 0);
  assert.ok(back.points[1].z < 0);
});

test("connected strand shell keeps one welded quad surface driven by six section curves", () => {
  const data = createConnectedStrandShellData();
  const uninflated = createConnectedStrandShellData({ inflation: 0 });
  const summary = connectedStrandShellTopologySummary();
  assert.deepEqual(summary, {
    vertexCount: 103,
    faceCount: 88,
    quadCount: 88,
    sectionCount: 6,
    boundaryEdgeCount: 28,
    nonManifoldEdgeCount: 0
  });
  assert.ok(data.curves.every((curve) => curve.points.length >= 7));
  assert.equal(new Set(data.faces.flat()).size, 103);
  assert.equal(data.settings.inflation, 0.08);
  assert.equal(uninflated.points.length, data.points.length);
  const averageInflation = data.points.reduce((sum, point, index) => {
    const source = uninflated.points[index];
    return sum + Math.hypot(point.x - source.x, point.y - source.y, point.z - source.z);
  }, 0) / data.points.length;
  assert.ok(Math.abs(averageInflation - 0.08) < 1e-6);
  assert.deepEqual(normalizeConnectedStrandShellSettings({ inflation: 2 }), {
    inflation: 0.4,
    mergeDistance: 0.04,
    sectionWidths: [1, 1, 1, 1, 1, 1]
  });

  const curves = data.curves.map((curve) => ({
    ...curve,
    points: curve.points.map((point) => ({ ...point }))
  }));
  curves[0].points[3].x += 0.5;
  const deformed = deformConnectedStrandShell(
    data.points,
    data.restCurves,
    curves,
    data.vertexBindings
  );
  const changed = deformed.filter((point, index) => Math.abs(point.x - data.points[index].x) > 1e-6);
  assert.ok(changed.length > 0);
  assert.ok(changed.length < data.points.length);
  assert.equal(deformed.length, data.points.length);
});

test("connected strand shell sections widen independently and weld only within their merge distance", () => {
  const data = createConnectedStrandShellData();
  const baseMesh = buildConnectedStrandShellMesh(
    data.points,
    data.faces,
    data.faceSections,
    data.restCurves,
    data.curves,
    data.settings
  );
  assert.equal(baseMesh.points.length, 103);
  assert.equal(baseMesh.faces.length, 88);

  const narrowMesh = buildConnectedStrandShellMesh(
    data.points,
    data.faces,
    data.faceSections,
    data.restCurves,
    data.curves,
    { ...data.settings, sectionWidths: [0.7, 1, 1, 1, 1, 1] }
  );
  assert.ok(narrowMesh.points.length > baseMesh.points.length);
  assert.equal(narrowMesh.faces.length, baseMesh.faces.length);
  assert.ok(narrowMesh.faces.every((face) => face.length === 4 && new Set(face).size === 4));

  const reweldedMesh = buildConnectedStrandShellMesh(
    data.points,
    data.faces,
    data.faceSections,
    data.restCurves,
    data.curves,
    { ...data.settings, mergeDistance: 0.2, sectionWidths: [0.7, 1, 1, 1, 1, 1] }
  );
  assert.equal(reweldedMesh.points.length, baseMesh.points.length);
  assert.equal(reweldedMesh.splitVertexCount, 150);
});

test("connected strand shell sections own independent profile, width, and depth curves", () => {
  const data = createConnectedStrandShellData();
  assert.ok(data.curves.every((curve) => (
    curve.sweepProfile !== data.curves[0].sweepProfile || curve === data.curves[0]
  )));
  assert.deepEqual(data.curves[0].sweepProfile, DEFAULT_CONNECTED_STRAND_SECTION_PROFILE);
  assert.deepEqual(data.curves[0].taperCurve, DEFAULT_CONNECTED_STRAND_SECTION_CURVE);
  assert.deepEqual(data.curves[0].depthCurve, DEFAULT_CONNECTED_STRAND_SECTION_CURVE);

  const editedCurves = data.curves.map((curve) => ({
    ...curve,
    points: curve.points.map((point) => ({ ...point })),
    sweepProfile: curve.sweepProfile.map((point) => ({ ...point })),
    taperCurve: curve.taperCurve.map((point) => ({ ...point })),
    depthCurve: curve.depthCurve.map((point) => ({ ...point }))
  }));
  editedCurves[0].sweepProfile = editedCurves[0].sweepProfile.map((point, index) => ({
    ...point,
    z: index === 1 || index === 2 ? 0.5 : 0
  }));
  editedCurves[0].taperCurve = [
    { position: 0, value: 1, interpolation: "linear" },
    { position: 1, value: 0.55, interpolation: "linear" }
  ];
  editedCurves[0].depthCurve = [
    { position: 0, value: 0, interpolation: "linear" },
    { position: 1, value: 1, interpolation: "linear" }
  ];
  const baseMesh = buildConnectedStrandShellMesh(
    data.points, data.faces, data.faceSections, data.restCurves, data.curves, data.settings
  );
  const editedMesh = buildConnectedStrandShellMesh(
    data.points, data.faces, data.faceSections, data.restCurves, editedCurves, data.settings
  );
  assert.equal(editedMesh.faces.length, baseMesh.faces.length);
  assert.ok(editedMesh.points.some((point, index) => (
    Math.hypot(
      point.x - baseMesh.points[index].x,
      point.y - baseMesh.points[index].y,
      point.z - baseMesh.points[index].z
    ) > 1e-4
  )));

  const legacy = normalizeConnectedStrandShellSectionCurve({ name: "Legacy" });
  assert.equal(legacy.name, "Legacy");
  assert.deepEqual(legacy.sweepProfile, DEFAULT_CONNECTED_STRAND_SECTION_PROFILE);
  assert.deepEqual(legacy.taperCurve, DEFAULT_CONNECTED_STRAND_SECTION_CURVE);
  assert.deepEqual(legacy.depthCurve, DEFAULT_CONNECTED_STRAND_SECTION_CURVE);
});
