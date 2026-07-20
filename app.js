import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import {
  closestPointsOnSegments,
  findSpatialCollisionPairs,
  solvePulledStrand
} from "./modules/strand-constraints.js?v=20260720-1";
import {
  adaptiveCurveParameters,
  legacyTaperCurve,
  normalizeTaperCurve,
  sampleArray,
  sampleScale,
  sampleTaperCurve,
  uniformCurveParameters
} from "./modules/curve-math.js?v=20260720-1";
import { exportHairFaces } from "./modules/obj-export.js?v=20260720-1";
import {
  createHairProject,
  projectFileName,
  validateHairProject
} from "./modules/project-schema.js?v=20260720-1";
import {
  CURVE_LATTICE_FEATURE_ENABLED,
  DEFAULT_BRAID_DEPTH_CURVE,
  DEFAULT_BRAID_MESH_PRESET,
  DEFAULT_BRAID_WIDTH_CURVE,
  DEFAULT_DEPTH_CURVE,
  DEFAULT_HAIR_COLOR,
  DEFAULT_HAIR_LAYER,
  DEFAULT_HAIR_MATERIAL_ID,
  DEFAULT_HAIR_MATERIAL_SETTINGS,
  DEFAULT_LAYER_OFFSETS,
  DEFAULT_SWEEP_PROFILE,
  DEFAULT_TAPER_CURVE,
  GROUP_CURVE_FEATURE_ENABLED,
  HAIR_LAYERS,
  LAYER_HUE_SHIFTS,
  LAYER_ROOT_OFFSET_FACTORS,
  MATERIAL_LAYER_COLOR_FACTORS,
  ROOT_SCALP_OFFSET_DISTANCE,
  ROUND_SWEEP_PROFILE,
  SCALP_REGIONS,
  STRAND_GROUPS,
  TAPER_VALUE_MAX
} from "./modules/app-config.js?v=20260720-1";
import { BoundedHistory } from "./modules/history.js?v=20260720-1";

function setupEditableSliderControls() {
  document.querySelectorAll('input[type="range"]').forEach((range) => {
    const label = range.closest("label");
    const existingPair = range.closest(".slider-number-pair");
    const container = existingPair || label;
    if (!container || container.classList.contains("slider-control-ready")) return;

    container.classList.add("slider-control-ready");
    label?.classList.add("editable-slider-control");

    const resetValue = range.getAttribute("value") ?? range.value;
    let numberInput = existingPair?.querySelector('input[type="number"]');
    let row = existingPair;

    if (!row) {
      row = document.createElement("span");
      row.className = "slider-input-row";
      range.parentNode.insertBefore(row, range);

      numberInput = document.createElement("input");
      numberInput.type = "number";
      numberInput.className = "slider-number-input";
      numberInput.setAttribute("aria-label", "Slider value");
      if (range.min !== "") numberInput.min = range.min;
      if (range.max !== "") numberInput.max = range.max;
      if (range.step !== "") numberInput.step = range.step;
      numberInput.value = range.value;
      row.append(numberInput, range);
    } else {
      row.classList.add("slider-input-row");
      if (numberInput) {
        numberInput.classList.add("slider-number-input");
        row.insertBefore(numberInput, range);
      }
    }

    const existingReset = label?.querySelector(":scope > button[data-reset-head-transform], :scope > button[data-reset-scalp-rough-scale]");
    const resetButton = existingReset || document.createElement("button");
    resetButton.type = "button";
    resetButton.classList.add("slider-reset-button");
    if (!existingReset) {
      resetButton.textContent = "⟲";
      resetButton.title = "Reset to default";
      resetButton.setAttribute("aria-label", "Reset slider to default");
      resetButton.addEventListener("click", () => {
        range.value = resetValue;
        range.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
    row.append(resetButton);

    const syncNumberFromRange = () => {
      if (numberInput && document.activeElement !== numberInput) numberInput.value = range.value;
    };
    range.addEventListener("input", syncNumberFromRange);
    range.addEventListener("change", syncNumberFromRange);

    if (!existingPair && numberInput) {
      const applyNumberValue = () => {
        if (numberInput.value === "" || !Number.isFinite(numberInput.valueAsNumber)) return;
        range.value = String(numberInput.valueAsNumber);
        numberInput.value = range.value;
        range.dispatchEvent(new Event("input", { bubbles: true }));
      };
      numberInput.addEventListener("input", applyNumberValue);
      numberInput.addEventListener("change", applyNumberValue);
    }

    const output = label?.querySelector("output");
    if (output) {
      output.classList.add("slider-generated-readout-hidden");
      new MutationObserver(syncNumberFromRange).observe(output, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }
  });
}

setupEditableSliderControls();

const viewport = document.querySelector("#viewport");
const selectionMarquee = document.querySelector("#selectionMarquee");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x151418, 7, 15);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 1.15, 5.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.75, 0);

const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setMode("translate");
transformControls.setSize(0.72);
scene.add(transformControls);
const pullTarget = new THREE.Object3D();
const pullGuide = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xf2b35f, transparent: true, opacity: 0.82, depthTest: false })
);
pullGuide.visible = false;
pullGuide.frustumCulled = false;
pullGuide.renderOrder = 90;
scene.add(pullTarget, pullGuide);
transformControls.addEventListener("dragging-changed", (event) => {
  transformDragging = event.value;
  updateInteractionLocks();
  if (transformControls.object?.userData.scalpBuilderLatticeIndex !== undefined) {
    if (event.value) {
      pushUndoState();
      beginScalpBuilderCurveLatticeEdit(transformControls.object);
    } else {
      commitScalpBuilderCurveLatticeEdit();
    }
    return;
  }
  if (transformControls.object?.userData.scalpBuilderPlane) return;
  if (proportionalSizeEdit) return;
  if (event.value) {
    pushUndoState();
    if (transformControls.object?.userData.curveLatticeGuideId !== undefined) {
      beginCurveLatticeMultiEdit(transformControls.object);
    } else if (transformControls.object?.userData.scalpLatticeIndex === undefined) {
      beginHandleEdit();
    }
  }
  if (!event.value) {
    const editedLock = locks.find((item) => item.id === activeHandleEdit?.lockId);
    commitClumpMemberRestState(editedLock);
    commitClumpMemberRestState(mirrorPartnerFor(editedLock));
    flushPendingLockGeometryUpdates();
    activeHandleEdit = null;
    activeLatticeMultiEdit = null;
    scheduleStrandCollisionResolve();
  }
});
transformControls.addEventListener("objectChange", () => {
  if (proportionalSizeEdit) return;
  const handle = transformControls.object;
  if (!handle) return;
  if (handle.userData.scalpBuilderLatticeIndex !== undefined) {
    updateScalpBuilderCurveLatticeFromHandle(handle);
    return;
  }
  if (handle.userData.scalpBuilderPlane) {
    const step = SCALP_BUILDER_STEPS[scalpBuilderStep];
    scalpBuilderPlanePositions[scalpBuilderStep] = handle.position[step.axis];
    rebuildScalpBuilderIntersection(handle, step);
    updateScalpBuilderPositionReadout();
    return;
  }
  if (handle.userData.scalpLatticeIndex !== undefined) {
    updateScalpLatticeFromHandle(handle);
    return;
  }
  if (handle.userData.curveLatticeGuideId !== undefined) {
    if (activeLatticeMultiEdit) applyCurveLatticeMultiTransform(handle);
    else updateCurveLatticeFromHandle(handle);
    return;
  }
  const lock = locks.find((item) => item.id === handle.userData.lockId);
  if (!lock) return;
  const pointIndex = handle.userData.pointIndex;
  if (!activeHandleEdit || activeHandleEdit.lockId !== lock.id || activeHandleEdit.pointIndex !== pointIndex) {
    beginHandleEdit();
  }
  if (activeTool === "move") {
    if (pullMoveActive()) applyPullMove(lock, pointIndex, handle);
    else if (multiPointHandleEditActive()) applyMultiMove(lock, handle);
    else if (hierarchyEditing) applyHierarchicalMove(lock, pointIndex, handle);
    else if (proportionalEditing) applyProportionalMove(lock, pointIndex, handle);
    else applySingleMove(lock, pointIndex, handle);
    syncLockFromCurve(lock);
  } else if (activeTool === "rotate") {
    if (multiPointHandleEditActive()) applyMultiRotate(lock, pointIndex, handle);
    else if (hierarchyEditing) applyHierarchicalRotate(lock, pointIndex, handle);
    else if (proportionalEditing) applyProportionalRotate(lock, pointIndex, handle);
    else applySingleRotate(lock, pointIndex, handle);
  } else if (activeTool === "scale") {
    if (multiPointHandleEditActive()) applyMultiScale(lock, handle);
    else if (hierarchyEditing) applyHierarchicalScale(lock, pointIndex, handle);
    else if (proportionalEditing) applyProportionalScale(lock, pointIndex, handle);
    else applySingleScale(lock, pointIndex, handle);
    lock.width = Math.max(0.04, lock.baseWidth * average(lock.pointWidths));
  }
  if (["move", "rotate"].includes(activeTool)) updateGroupLatticeBaseFromHandleEdit(lock);
  updateLockGeometry(lock);
  updatePullGuideVisual();
  syncActiveMirror(lock);
  syncInputs(lock);
});

const keyLight = new THREE.DirectionalLight(0xffead6, 2.5);
keyLight.position.set(3, 4, 4);
const keyLightDistance = keyLight.position.length();
keyLight.castShadow = true;
scene.add(keyLight);
scene.add(new THREE.HemisphereLight(0xdde9ff, 0x271c17, 1.8));

const hairGroup = new THREE.Group();
scene.add(hairGroup);
const curveGroup = new THREE.Group();
scene.add(curveGroup);
const VIEW_PLANE_SIZE = 160;
const viewPlaneFill = new THREE.Mesh(
  new THREE.PlaneGeometry(VIEW_PLANE_SIZE, VIEW_PLANE_SIZE),
  new THREE.MeshBasicMaterial({
    color: 0x2edce8,
    transparent: true,
    opacity: 0.025,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  })
);
viewPlaneFill.geometry.rotateX(-Math.PI / 2);
viewPlaneFill.renderOrder = 0;
viewPlaneFill.visible = false;
scene.add(viewPlaneFill);

const viewPlaneGrid = new THREE.GridHelper(VIEW_PLANE_SIZE, 640, 0x58f6ff, 0x58f6ff);
[viewPlaneGrid.material].flat().forEach((material, index) => {
  material.transparent = true;
  material.opacity = index === 0 ? 0.085 : 0.045;
  material.depthTest = true;
  material.depthWrite = false;
});
viewPlaneGrid.renderOrder = 1;
viewPlaneGrid.visible = false;
scene.add(viewPlaneGrid);
const guideSurfaceGroup = new THREE.Group();
scene.add(guideSurfaceGroup);
const hairMaterialDefinitions = [{
  id: DEFAULT_HAIR_MATERIAL_ID,
  name: "Default Purple",
  ...DEFAULT_HAIR_MATERIAL_SETTINGS
}];
let hairMaterialIndex = 1;
function nextStrandName(region = "unassigned") {
  const group = STRAND_GROUPS.find((item) => item.id === region) || STRAND_GROUPS.at(-1);
  const usedNumbers = new Set(
    locks
      .filter((lock) => (lock.scalpRegion || "unassigned") === group.id)
      .map((lock) => {
        const match = lock.name.match(new RegExp(`^${group.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (\\d+)$`));
        return match ? Number(match[1]) : null;
      })
      .filter(Number.isFinite)
  );
  let number = 1;
  while (usedNumbers.has(number)) number += 1;
  return `${group.label} ${number}`;
}

const DRAW_CLUMP_TEMPLATE = {
  baseWidth: 0.16,
  strands: [
    {
      width: 0.16,
      points: [
        [-0.0059968, 1.1055072, 0.8644583], [0.0046603, 0.8400218, 1.0761476],
        [0.0021184, 0.5085847, 1.1661279], [-0.0060136, 0.1663752, 1.1675754],
        [-0.0027709, -0.1783919, 1.1683911]
      ]
    },
    {
      width: 0.11,
      points: [
        [0.0570277, 1.0950850, 0.8716710], [0.1521222, 0.7779978, 1.0928572],
        [0.1577654, 0.3969150, 1.1301010], [0.1166098, 0.0842272, 1.1460944],
        [0.0878968, -0.1030747, 1.1484194]
      ]
    },
    {
      width: 0.11,
      points: [
        [-0.0581465, 1.0934739, 0.8730643], [-0.1365748, 0.8361366, 1.0668734],
        [-0.1913321, 0.5173142, 1.1480565], [-0.1772792, 0.1955351, 1.1458786],
        [-0.0859821, -0.1121232, 1.1459633]
      ]
    }
  ]
};
const SHAPE_PRESETS = {
  sweepProfile: [
    { id: "anime-wedge", name: "Anime Wedge", value: DEFAULT_SWEEP_PROFILE },
    { id: "flat-ribbon", name: "Flat Ribbon", value: [
      { x: 1, z: -0.10 }, { x: 0.72, z: 0.04 }, { x: 0, z: 0.16 },
      { x: -0.72, z: 0.04 }, { x: -1, z: -0.10 }, { x: -0.72, z: -0.16 }, { x: 0.72, z: -0.16 }
    ] },
    { id: "rounded", name: "Rounded", value: [
      ...ROUND_SWEEP_PROFILE
    ] }
  ],
  taperCurve: [
    { id: "anime-taper", name: "Anime Taper", value: DEFAULT_TAPER_CURVE },
    { id: "braid-placeholder", name: "Braid Placeholder", value: DEFAULT_BRAID_WIDTH_CURVE },
    { id: "uniform", name: "Uniform", value: [
      { position: 0, value: 1, interpolation: "linear" }, { position: 1, value: 1, interpolation: "linear" }
    ] },
    { id: "late-taper", name: "Late Taper", value: [
      { position: 0, value: 0.65, interpolation: "smooth" }, { position: 0.15, value: 1, interpolation: "smooth" },
      { position: 0.78, value: 0.95, interpolation: "smooth" }, { position: 1, value: 0, interpolation: "smooth" }
    ] },
    { id: "root-bulb", name: "Root Bulb", value: [
      { position: 0, value: 0.45, interpolation: "smooth" }, { position: 0.2, value: 1.15, interpolation: "smooth" },
      { position: 0.72, value: 0.8, interpolation: "smooth" }, { position: 1, value: 0, interpolation: "smooth" }
    ] }
  ],
  depthCurve: [
    { id: "soft-depth", name: "Soft Depth", value: DEFAULT_DEPTH_CURVE },
    { id: "braid-placeholder", name: "Braid Placeholder", value: DEFAULT_BRAID_DEPTH_CURVE },
    { id: "uniform", name: "Uniform", value: [
      { position: 0, value: 0.55, interpolation: "linear" }, { position: 1, value: 0.55, interpolation: "linear" }
    ] },
    { id: "flat", name: "Flat", value: [
      { position: 0, value: 0.12, interpolation: "linear" }, { position: 1, value: 0.05, interpolation: "linear" }
    ] },
    { id: "rounded", name: "Rounded", value: [
      { position: 0, value: 0.25, interpolation: "smooth" }, { position: 0.35, value: 0.8, interpolation: "smooth" },
      { position: 0.72, value: 0.55, interpolation: "smooth" }, { position: 1, value: 0, interpolation: "smooth" }
    ] }
  ]
};
const strandGroupDefaults = Object.fromEntries(STRAND_GROUPS.map((group) => [group.id, {
  taperCurve: DEFAULT_TAPER_CURVE.map((point) => ({ ...point })),
  depthCurve: DEFAULT_DEPTH_CURVE.map((point) => ({ ...point })),
  widthScale: 1,
  depthScale: 1,
  profileOffset: 0,
  rootScalpOffset: 0,
  radialSegments: 10,
  lengthSegments: 26,
  dynamicDensity: false,
  densityAggression: 0.5,
  layerOffsets: { ...DEFAULT_LAYER_OFFSETS },
  sweepProfile: DEFAULT_SWEEP_PROFILE.map((point) => ({ ...point }))
}]));
const strandCreationDefaults = {
  width: 0.16,
  curlCount: 4,
  curlDisplacement: 0.18,
  taperCurve: DEFAULT_TAPER_CURVE.map((point) => ({ ...point })),
  depthCurve: DEFAULT_DEPTH_CURVE.map((point) => ({ ...point })),
  widthScale: 1,
  depthScale: 1,
  profileOffset: 0,
  rootScalpOffset: 0,
  twist: 0,
  dynamicDensity: false,
  densityAggression: 0.5,
  hairLayer: DEFAULT_HAIR_LAYER,
  sweepProfile: DEFAULT_SWEEP_PROFILE.map((point) => ({ ...point }))
};
const braidCreationDefaults = {
  ...strandCreationDefaults,
  braidMeshPreset: DEFAULT_BRAID_MESH_PRESET,
  braidWidth: 0.34,
  braidDepth: 0.44,
  braidSegmentLength: 0.28,
  braidRotation: 0,
  taperCurve: DEFAULT_BRAID_WIDTH_CURVE.map((point) => ({ ...point })),
  depthCurve: DEFAULT_BRAID_DEPTH_CURVE.map((point) => ({ ...point })),
  sweepProfile: DEFAULT_SWEEP_PROFILE.map((point) => ({ ...point }))
};
const CREATION_PRESET_STORAGE_KEY = "anime-hair-studio-creation-presets-v1";
const BRAID_TOOL_PRESETS = {
  classic: {
    braidMeshPreset: DEFAULT_BRAID_MESH_PRESET,
    braidWidth: 0.34,
    braidDepth: 0.44,
    braidSegmentLength: 0.28,
    braidRotation: 0,
    taperCurve: DEFAULT_BRAID_WIDTH_CURVE,
    depthCurve: DEFAULT_BRAID_DEPTH_CURVE,
    sweepProfile: DEFAULT_SWEEP_PROFILE
  },
  "chain-links": {
    braidMeshPreset: "chain-links",
    braidWidth: 0.36,
    braidDepth: 0.36,
    braidSegmentLength: 0.28,
    braidRotation: 0,
    taperCurve: SHAPE_PRESETS.taperCurve.find((preset) => preset.id === "uniform").value,
    depthCurve: [
      { position: 0, value: 1, interpolation: "linear" },
      { position: 1, value: 1, interpolation: "linear" }
    ],
    sweepProfile: SHAPE_PRESETS.sweepProfile.find((preset) => preset.id === "flat-ribbon").value
  }
};
const SCALP_SEGMENTS = 18;

function createQuadSphereGeometry(segments = 18) {
  const positions = [];
  const indices = [];
  const quads = [];
  const vertexMap = new Map();
  const edgeMap = new Map();
  const faces = [
    { name: "right", normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
    { name: "left", normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
    { name: "top", normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { name: "front", normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
    { name: "back", normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }
  ];

  function vertexIndex(face, column, row) {
    const s = -segments + column * 2;
    const t = -segments + row * 2;
    const cube = face.normal.map((value, axis) => value * segments + face.u[axis] * s + face.v[axis] * t);
    const key = cube.join(",");
    if (vertexMap.has(key)) return vertexMap.get(key);
    const x = cube[0] / segments;
    const y = cube[1] / segments;
    const z = cube[2] / segments;
    const sphereX = x * Math.sqrt(Math.max(0, 1 - y * y * 0.5 - z * z * 0.5 + y * y * z * z / 3));
    const sphereY = y * Math.sqrt(Math.max(0, 1 - z * z * 0.5 - x * x * 0.5 + z * z * x * x / 3));
    const sphereZ = z * Math.sqrt(Math.max(0, 1 - x * x * 0.5 - y * y * 0.5 + x * x * y * y / 3));
    const index = positions.length / 3;
    positions.push(sphereX, sphereY, sphereZ);
    vertexMap.set(key, index);
    return index;
  }

  function addEdge(a, b) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (!edgeMap.has(key)) edgeMap.set(key, [a, b]);
  }

  faces.forEach((face) => {
    for (let row = 0; row < segments; row += 1) {
      for (let column = 0; column < segments; column += 1) {
        const a = vertexIndex(face, column, row);
        const b = vertexIndex(face, column + 1, row);
        const c = vertexIndex(face, column + 1, row + 1);
        const d = vertexIndex(face, column, row + 1);
        indices.push(a, b, c, a, c, d);
        quads.push({ id: quads.length, face: face.name, row, column, vertices: [a, b, c, d] });
        addEdge(a, b);
        addEdge(b, c);
        addEdge(c, d);
        addEdge(d, a);
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, quadEdges: [...edgeMap.values()], quads };
}

async function createAuthoredScalpGeometry() {
  const materialRegions = {
    lambert2SG: "bangs",
    lambert3SG: "side-bangs-right",
    lambert4SG: "side-right",
    lambert5SG: "back",
    lambert6SG: "side-bangs-left",
    lambert7SG: "side-left"
  };
  const response = await fetch("./assets/scalpcurvelatticeguide.obj?v=20260720-1");
  if (!response.ok) throw new Error(`Could not load the built-in scalp guide (${response.status})`);
  const sourceVertices = [];
  const sourceFaces = [];
  let material = "";
  (await response.text()).split(/\r?\n/).forEach((line) => {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "v" && parts.length >= 4) {
      sourceVertices.push(new THREE.Vector3(Number(parts[1]), Number(parts[2]), Number(parts[3])));
    } else if (parts[0] === "usemtl") {
      material = parts.slice(1).join(" ");
    } else if (parts[0] === "f" && parts.length === 5) {
      sourceFaces.push({
        vertices: parts.slice(1).map((token) => Number(token.split("/")[0]) - 1),
        region: materialRegions[material] || "unassigned"
      });
    }
  });
  if (!sourceVertices.length || !sourceFaces.length) throw new Error("The built-in scalp guide contains no usable quad mesh");
  const bounds = new THREE.Box3().setFromPoints(sourceVertices);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 2 / Math.max(0.0001, size.x, size.y, size.z);
  const normalizedVertices = sourceVertices.map((vertex) => vertex.clone().sub(center).multiplyScalar(scale));
  const edgeMap = new Map();
  const indices = [];
  const quads = sourceFaces.map((face, id) => {
    const [a, b, c, d] = face.vertices;
    indices.push(a, b, c, a, c, d);
    [[a, b], [b, c], [c, d], [d, a]].forEach(([start, end]) => {
      const key = start < end ? `${start}:${end}` : `${end}:${start}`;
      if (!edgeMap.has(key)) edgeMap.set(key, [start, end]);
    });
    return { id, face: "authored", row: 0, column: 0, region: face.region, vertices: [a, b, c, d] };
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(normalizedVertices.flatMap((vertex) => vertex.toArray()), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, quadEdges: [...edgeMap.values()], quads };
}

let defaultScalpGeometryData;
try {
  defaultScalpGeometryData = await createAuthoredScalpGeometry();
} catch (error) {
  console.error("Could not initialize the authored scalp guide; using the legacy guide", error);
  defaultScalpGeometryData = createQuadSphereGeometry(SCALP_SEGMENTS);
}

const scalpSurfaceGroup = new THREE.Group();
const {
  geometry: scalpSurfaceGeometry,
  quadEdges: initialScalpQuadEdges,
  quads: scalpQuads
} = defaultScalpGeometryData;
let scalpQuadEdges = initialScalpQuadEdges;
let scalpActiveVertexIndices = [...Array(scalpSurfaceGeometry.getAttribute("position").count).keys()];

function buildDefaultScalpRegionAssignments(sideBangRows = 5) {
  const rows = THREE.MathUtils.clamp(Math.round(sideBangRows), 0, SCALP_SEGMENTS);
  return scalpQuads.map((quad) => {
    let region = quad.region || "unassigned";
    if (quad.face === "front") region = "bangs";
    else if (quad.face === "back") region = "back";
    else if (quad.face === "left") region = "side-left";
    else if (quad.face === "right") region = "side-right";
    else if (quad.face === "top") region = quad.column < SCALP_SEGMENTS / 2 ? "side-left" : "side-right";

    const isRightSideBang = quad.face === "right" && quad.column < rows;
    const isLeftSideBang = quad.face === "left" && quad.column >= SCALP_SEGMENTS - rows;
    const isTopSideBang = quad.face === "top" && quad.row < rows;
    if (isRightSideBang || isLeftSideBang || isTopSideBang) {
      region = isLeftSideBang || (isTopSideBang && quad.column < SCALP_SEGMENTS / 2)
        ? "side-bangs-left"
        : "side-bangs-right";
    }
    return region;
  });
}

let scalpRegionAssignments = buildDefaultScalpRegionAssignments(5);
let scalpManualRegionQuads = new Set();
let scalpVisibleQuads = [...scalpQuads];
const scalpRenderGeometry = new THREE.BufferGeometry();

function updateScalpRenderGeometry() {
  const sourcePosition = scalpSurfaceGeometry.getAttribute("position");
  const sourceNormal = scalpSurfaceGeometry.getAttribute("normal");
  const positions = new Float32Array(scalpVisibleQuads.length * 12);
  const normals = new Float32Array(scalpVisibleQuads.length * 12);
  const colors = new Float32Array(scalpVisibleQuads.length * 12);
  const indices = new Uint16Array(scalpVisibleQuads.length * 6);
  const triangleQuadIds = [];
  const color = new THREE.Color();

  scalpVisibleQuads.forEach((quad, quadIndex) => {
    color.set(SCALP_REGIONS[scalpRegionAssignments[quad.id]].color);
    quad.vertices.forEach((sourceIndex, corner) => {
      const renderIndex = quadIndex * 4 + corner;
      const offset = renderIndex * 3;
      positions[offset] = sourcePosition.getX(sourceIndex);
      positions[offset + 1] = sourcePosition.getY(sourceIndex);
      positions[offset + 2] = sourcePosition.getZ(sourceIndex);
      normals[offset] = sourceNormal.getX(sourceIndex);
      normals[offset + 1] = sourceNormal.getY(sourceIndex);
      normals[offset + 2] = sourceNormal.getZ(sourceIndex);
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    });
    const vertex = quadIndex * 4;
    indices.set([vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3], quadIndex * 6);
    triangleQuadIds.push(quad.id, quad.id);
  });

  [["position", positions], ["normal", normals], ["color", colors]].forEach(([name, array]) => {
    const attribute = scalpRenderGeometry.getAttribute(name);
    if (attribute?.array.length === array.length) {
      attribute.array.set(array);
      attribute.needsUpdate = true;
    } else {
      scalpRenderGeometry.setAttribute(name, new THREE.BufferAttribute(array, 3));
    }
  });
  const indexAttribute = scalpRenderGeometry.getIndex();
  if (indexAttribute?.array.length === indices.length) {
    indexAttribute.array.set(indices);
    indexAttribute.needsUpdate = true;
  } else {
    scalpRenderGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  scalpRenderGeometry.userData.triangleQuadIds = triangleQuadIds;
  scalpRenderGeometry.computeBoundingBox();
  scalpRenderGeometry.computeBoundingSphere();
}

function writeScalpRegionColors() {
  const colorAttribute = scalpRenderGeometry.getAttribute("color");
  if (!colorAttribute) return;
  const color = new THREE.Color();
  scalpVisibleQuads.forEach((quad, quadIndex) => {
    color.set(SCALP_REGIONS[scalpRegionAssignments[quad.id]].color);
    for (let corner = 0; corner < 4; corner += 1) {
      colorAttribute.setXYZ(quadIndex * 4 + corner, color.r, color.g, color.b);
    }
  });
  colorAttribute.needsUpdate = true;
}

function applyDefaultScalpRegionAssignments(sideBangRows, { preserveManual = true } = {}) {
  const defaults = buildDefaultScalpRegionAssignments(sideBangRows);
  defaults.forEach((region, index) => {
    if (!preserveManual || !scalpManualRegionQuads.has(index)) scalpRegionAssignments[index] = region;
  });
  writeScalpRegionColors();
}
updateScalpRenderGeometry();
const scalpSurfaceMesh = new THREE.Mesh(
  scalpRenderGeometry,
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x111116,
    roughness: 0.72,
    vertexColors: true,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    side: THREE.FrontSide
  })
);
const scalpSurfaceWire = new THREE.LineSegments(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({
    color: 0x62f3ff,
    transparent: true,
    opacity: 0.14,
    depthWrite: false
  })
);
function createScalpSelectionOutline(geometry) {
  const outline = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: {
        outlineColor: { value: new THREE.Color(0xffd45c) },
        outlineOpacity: { value: 0.96 }
      },
      vertexShader: `
        varying vec3 vViewNormal;
        varying vec3 vViewDirection;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vViewNormal = normalize(normalMatrix * normal);
          vViewDirection = normalize(-viewPosition.xyz);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 outlineColor;
        uniform float outlineOpacity;
        varying vec3 vViewNormal;
        varying vec3 vViewDirection;
        void main() {
          float facing = abs(dot(normalize(vViewNormal), normalize(vViewDirection)));
          float silhouette = 1.0 - smoothstep(0.035, 0.16, facing);
          if (silhouette < 0.02) discard;
          gl_FragColor = vec4(outlineColor, silhouette * outlineOpacity);
        }
      `,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: false,
      depthWrite: false
    })
  );
  outline.renderOrder = 20;
  outline.visible = false;
  return outline;
}
const scalpSelectionOutline = createScalpSelectionOutline(scalpRenderGeometry);
let scalpGuideSource = "default";
let customScalpSurfaceMesh = null;
let customScalpSurfaceWire = null;
let customScalpSelectionOutline = null;
let customScalpRegions = [];
let importedScalpGuideAsset = null;
let editedScalpSurfaceMesh = null;
let editedScalpSurfaceWire = null;
let editedScalpSelectionOutline = null;
let editedScalpRegions = [];

function activeScalpSurfaceMesh() {
  if (scalpGuideSource === "custom" && customScalpSurfaceMesh) return customScalpSurfaceMesh;
  return editedScalpSurfaceMesh || scalpSurfaceMesh;
}

function activeScalpSurfaceWire() {
  if (scalpGuideSource === "custom" && customScalpSurfaceWire) return customScalpSurfaceWire;
  return editedScalpSurfaceWire || scalpSurfaceWire;
}

function activeScalpSelectionOutline() {
  if (scalpGuideSource === "custom" && customScalpSelectionOutline) return customScalpSelectionOutline;
  return editedScalpSelectionOutline || scalpSelectionOutline;
}

function inferredCustomScalpRegion(center) {
  const side = center.x < 0 ? "side-left" : "side-right";
  if (center.z > Math.abs(center.x) * 0.72) return "bangs";
  if (center.z < -Math.abs(center.x) * 0.72) return "back";
  return side;
}

function writeCustomScalpRegionColors() {
  if (!customScalpSurfaceMesh) return;
  const geometry = customScalpSurfaceMesh.geometry;
  const position = geometry.getAttribute("position");
  let colorAttribute = geometry.getAttribute("color");
  if (!colorAttribute || colorAttribute.count !== position.count) {
    colorAttribute = new THREE.BufferAttribute(new Float32Array(position.count * 3), 3);
    geometry.setAttribute("color", colorAttribute);
  }
  const color = new THREE.Color();
  customScalpRegions.forEach((region, triangleIndex) => {
    color.set(SCALP_REGIONS[region]?.color || SCALP_REGIONS.unassigned.color);
    for (let corner = 0; corner < 3; corner += 1) {
      colorAttribute.setXYZ(triangleIndex * 3 + corner, color.r, color.g, color.b);
    }
  });
  colorAttribute.needsUpdate = true;
}

function customScalpGeometryFromObject(model, { normalize = true } = {}) {
  model.updateMatrixWorld(true);
  const geometries = [];
  model.traverse((child) => {
    if (!child.isMesh || !child.geometry?.getAttribute("position")) return;
    let geometry = child.geometry.clone();
    geometry.applyMatrix4(child.matrixWorld);
    geometry = geometry.index ? geometry.toNonIndexed() : geometry;
    Object.keys(geometry.attributes).forEach((name) => {
      if (name !== "position") geometry.deleteAttribute(name);
    });
    geometry.clearGroups();
    geometries.push(geometry);
  });
  if (!geometries.length) throw new Error("Custom scalp OBJ contains no polygon geometry");
  const geometry = mergeGeometries(geometries, false);
  geometries.forEach((item) => item.dispose());
  if (!geometry) throw new Error("Custom scalp OBJ geometry could not be combined");
  geometry.computeBoundingBox();
  if (normalize) {
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    const scale = 2 / Math.max(0.0001, size.x, size.y, size.z);
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(scale, scale, scale);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function customScalpWireGeometry(geometry) {
  const quadWirePositions = geometry.userData.quadWirePositions;
  if (!Array.isArray(quadWirePositions) || !quadWirePositions.length) {
    return new THREE.WireframeGeometry(geometry);
  }
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute("position", new THREE.Float32BufferAttribute(quadWirePositions, 3));
  wireGeometry.computeBoundingSphere();
  return wireGeometry;
}

function installCustomScalpGeometry(geometry, regions, { name = "custom-scalp.obj", content = null } = {}) {
  customScalpSurfaceMesh?.geometry.dispose();
  customScalpSurfaceWire?.geometry.dispose();
  if (!customScalpSurfaceMesh) {
    customScalpSurfaceMesh = new THREE.Mesh(geometry, scalpSurfaceMesh.material.clone());
    customScalpSurfaceMesh.renderOrder = scalpSurfaceMesh.renderOrder;
    customScalpSurfaceWire = new THREE.LineSegments(
      customScalpWireGeometry(geometry),
      scalpSurfaceWire.material.clone()
    );
    customScalpSurfaceWire.renderOrder = scalpSurfaceWire.renderOrder;
    customScalpSelectionOutline = createScalpSelectionOutline(geometry);
    scalpSurfaceGroup.add(customScalpSurfaceMesh, customScalpSurfaceWire, customScalpSelectionOutline);
  } else {
    customScalpSurfaceMesh.geometry = geometry;
    customScalpSurfaceWire.geometry = customScalpWireGeometry(geometry);
    customScalpSelectionOutline.geometry = geometry;
  }
  customScalpRegions = [...regions];
  writeCustomScalpRegionColors();
  importedScalpGuideAsset = content === null ? importedScalpGuideAsset : { format: "obj", name, content };
  setScalpGuideSource("custom");
}

function installCustomScalpGuide(model, { name = "custom-scalp.obj", content = null, preserveCoordinates = false, quadWirePositions = null } = {}) {
  const geometry = customScalpGeometryFromObject(model, { normalize: !preserveCoordinates });
  if (Array.isArray(quadWirePositions)) geometry.userData.quadWirePositions = [...quadWirePositions];
  const position = geometry.getAttribute("position");
  const center = new THREE.Vector3();
  const regions = Array.from({ length: position.count / 3 }, (_, triangleIndex) => {
    center.set(0, 0, 0);
    for (let corner = 0; corner < 3; corner += 1) {
      center.x += position.getX(triangleIndex * 3 + corner);
      center.y += position.getY(triangleIndex * 3 + corner);
      center.z += position.getZ(triangleIndex * 3 + corner);
    }
    return inferredCustomScalpRegion(center.multiplyScalar(1 / 3));
  });
  installCustomScalpGeometry(geometry, regions, { name, content });
  if (preserveCoordinates && importedScalpGuideAsset) importedScalpGuideAsset.preserveCoordinates = true;
}

function setScalpGuideSource(source) {
  scalpGuideSource = source === "custom" && customScalpSurfaceMesh ? "custom" : "default";
  scalpGuideSourceInput.value = scalpGuideSource;
  const customOption = scalpGuideSourceInput.querySelector('option[value="custom"]');
  customOption.textContent = importedScalpGuideAsset
    ? `Custom: ${importedScalpGuideAsset.name}`
    : "Import Custom Mesh...";
  const customActive = scalpGuideSource === "custom";
  Object.entries(scalpArtistInputs).forEach(([key, input]) => {
    input.disabled = customActive && key !== "rootScalpOffset";
  });
  advancedLatticeButton.disabled = customActive;
  if (customActive && scalpLatticeEditing) setScalpLatticeEditing(false);
  updateScalpEditingVisibility();
}

function updateScalpQuadWire() {
  const surfacePosition = scalpSurfaceGeometry.getAttribute("position");
  const wirePositions = new Float32Array(scalpQuadEdges.length * 6);
  scalpQuadEdges.forEach(([a, b], edgeIndex) => {
    const offset = edgeIndex * 6;
    wirePositions[offset] = surfacePosition.getX(a);
    wirePositions[offset + 1] = surfacePosition.getY(a);
    wirePositions[offset + 2] = surfacePosition.getZ(a);
    wirePositions[offset + 3] = surfacePosition.getX(b);
    wirePositions[offset + 4] = surfacePosition.getY(b);
    wirePositions[offset + 5] = surfacePosition.getZ(b);
  });
  scalpSurfaceWire.geometry.setAttribute("position", new THREE.BufferAttribute(wirePositions, 3));
  scalpSurfaceWire.geometry.computeBoundingSphere();
}

function updateScalpTopology() {
  const removedRows = Math.round(scalpArtistShape.hairlineRows);
  const visibleQuads = scalpQuads.filter((quad) => quad.face !== "front" || quad.row >= removedRows);
  const indices = [];
  const edges = new Map();
  const activeVertices = new Set();
  visibleQuads.forEach((quad) => {
    const [a, b, c, d] = quad.vertices;
    indices.push(a, b, c, a, c, d);
    activeVertices.add(a);
    activeVertices.add(b);
    activeVertices.add(c);
    activeVertices.add(d);
    [[a, b], [b, c], [c, d], [d, a]].forEach(([start, end]) => {
      const key = start < end ? `${start}:${end}` : `${end}:${start}`;
      if (!edges.has(key)) edges.set(key, [start, end]);
    });
  });
  scalpSurfaceGeometry.setIndex(indices);
  scalpQuadEdges = [...edges.values()];
  scalpVisibleQuads = visibleQuads;
  scalpActiveVertexIndices = [...activeVertices];
  scalpSurfaceGeometry.computeVertexNormals();
  scalpSurfaceGeometry.computeBoundingBox();
  scalpSurfaceGeometry.computeBoundingSphere();
  updateScalpRenderGeometry();
  updateScalpQuadWire();
}

updateScalpQuadWire();
scalpSurfaceMesh.renderOrder = 1;
scalpSurfaceWire.renderOrder = 2;
scalpSurfaceGroup.add(scalpSurfaceMesh, scalpSurfaceWire, scalpSelectionOutline);
scalpSurfaceGroup.visible = false;
scene.add(scalpSurfaceGroup);
const scalpBrushCursor = new THREE.Mesh(
  new THREE.RingGeometry(0.91, 1, 48),
  new THREE.MeshBasicMaterial({ color: SCALP_REGIONS.bangs.color, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide })
);
scalpBrushCursor.visible = false;
scalpBrushCursor.renderOrder = 9;
scene.add(scalpBrushCursor);
const scalpBuilderGroup = new THREE.Group();
scalpBuilderGroup.visible = false;
scalpBuilderGroup.renderOrder = 14;
scene.add(scalpBuilderGroup);
const scalpBuilderTemplateOverlay = new THREE.Group();
scalpBuilderTemplateOverlay.visible = false;
scene.add(scalpBuilderTemplateOverlay);
const drawStrandBrushCursor = new THREE.Mesh(
  new THREE.RingGeometry(0.82, 1, 48),
  new THREE.MeshBasicMaterial({
    color: 0x58f6ff,
    transparent: true,
    opacity: 0.72,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide
  })
);
drawStrandBrushCursor.visible = false;
drawStrandBrushCursor.renderOrder = 12;
scene.add(drawStrandBrushCursor);
const drawStrandPreview = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({
    color: 0x58f6ff,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false
  })
);
drawStrandPreview.visible = false;
drawStrandPreview.renderOrder = 12;
scene.add(drawStrandPreview);
const drawStrandMirrorPreview = drawStrandPreview.clone();
drawStrandMirrorPreview.geometry = new THREE.BufferGeometry();
drawStrandMirrorPreview.material = drawStrandPreview.material.clone();
drawStrandMirrorPreview.visible = false;
scene.add(drawStrandMirrorPreview);
const drawStrandVolumePreview = new THREE.Mesh(
  new THREE.BufferGeometry(),
  new THREE.MeshLambertMaterial({
    color: DEFAULT_HAIR_COLOR,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide
  })
);
drawStrandVolumePreview.visible = false;
drawStrandVolumePreview.renderOrder = 11;
scene.add(drawStrandVolumePreview);
const drawStrandMirrorVolumePreview = drawStrandVolumePreview.clone();
drawStrandMirrorVolumePreview.geometry = new THREE.BufferGeometry();
drawStrandMirrorVolumePreview.material = drawStrandVolumePreview.material.clone();
drawStrandMirrorVolumePreview.visible = false;
scene.add(drawStrandMirrorVolumePreview);
const drawStrandClumpVolumePreviews = DRAW_CLUMP_TEMPLATE.strands.slice(1).map(() => {
  const mesh = drawStrandVolumePreview.clone();
  mesh.geometry = new THREE.BufferGeometry();
  mesh.material = drawStrandVolumePreview.material.clone();
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
});
const drawStrandClumpMirrorPreviews = DRAW_CLUMP_TEMPLATE.strands.slice(1).map(() => {
  const mesh = drawStrandVolumePreview.clone();
  mesh.geometry = new THREE.BufferGeometry();
  mesh.material = drawStrandVolumePreview.material.clone();
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
});
const scalpLatticeGroup = new THREE.Group();
const scalpLatticeLine = new THREE.LineSegments(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0x53f1ff, transparent: true, opacity: 0.48, depthTest: false })
);
scalpLatticeLine.renderOrder = 7;
scalpLatticeGroup.add(scalpLatticeLine);
scalpLatticeGroup.visible = false;
scene.add(scalpLatticeGroup);
const scalpBasePositions = Float32Array.from(scalpSurfaceGeometry.getAttribute("position").array);
const scalpLatticePoints = [];
const scalpLatticeHandles = [];
const scalpLatticeConnections = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let guideModel;
let authoredScalpGuideMatrix = null;
const headTransform = {
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  uniformScale: 1,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1
};
const scalpRoughScale = { x: 1, y: 1, z: 1 };
const scalpRoughScalePivot = new THREE.Vector3();
let braidSegmentTemplate = null;
let braidSegmentBounds = null;
const braidMeshPresets = new Map();
let hairTopologyVisible = false;
let showGroupColors = false;
let scalpGuideVisible = false;
let selectedId;
let clumpViewportSelection = false;
let selectedGuideId;
let activeCurveLatticeGuideId = null;
let lockIndex = 1;
let activeTool = "select";
let activeHandleEdit = null;
let activeLatticeMultiEdit = null;
let transformDragging = false;
const pendingLockGeometryUpdates = new Set();
let pendingLockGeometryFrame = null;
let objectSpaceEditing = false;
let hierarchyEditing = false;
let mirrorXEditing = false;
let recursiveHierarchyTransforms = false;
let proportionalEditing = false;
let proportionalRootLocked = false;
let strandCollisionEnabled = false;
let strandCollisionResolving = false;
let strandCollisionFrame = null;
let scalpShapeEditing = false;
let scalpLatticeEditing = false;
let scalpPaintEditing = false;
let headSetupEditing = false;
let scalpBuilderEditing = false;
let scalpBuilderStep = 0;
let scalpBuilderStroke = null;
let scalpBuilderPlane = null;
let scalpBuilderCurveLattice = null;
let activeScalpBuilderCurveLatticeEdit = null;
let scalpBuilderEditedPoints = null;
let scalpBuilderCurveLatticeLoadToken = 0;
let scalpBuilderCurveLatticePromise = null;
const SCALP_BUILDER_STEPS = [
  { phase: "Horizontal", phaseIndex: 1, phaseCount: 5, name: "Forehead Hairline", instruction: "Place the plane where it intersects the lowest point of the hairline on the forehead.", axis: "y", color: SCALP_REGIONS.bangs.color, ratio: 0.69 },
  { phase: "Horizontal", phaseIndex: 2, phaseCount: 5, name: "Bottom of Sideburns", instruction: "Place the plane where it intersects the bottom of the sideburns, typically around the middle of the ear.", axis: "y", color: SCALP_REGIONS["side-bangs-right"].color, ratio: 0.43 },
  { phase: "Horizontal", phaseIndex: 3, phaseCount: 5, name: "Top of Ear", instruction: "Place the plane where it intersects the highest point of the ear.", axis: "y", color: SCALP_REGIONS["side-right"].color, ratio: 0.53 },
  { phase: "Horizontal", phaseIndex: 4, phaseCount: 5, name: "Bottom of Side Hair", instruction: "Place the plane where it intersects the lowest point that the side-hair root area should reach, typically just below the ear.", axis: "y", color: SCALP_REGIONS["side-right"].color, ratio: 0.36 },
  { phase: "Horizontal", phaseIndex: 5, phaseCount: 5, name: "Back Hairline", instruction: "Place the plane where it intersects the lowest point of the hairline at the back of the head.", axis: "y", color: SCALP_REGIONS.back.color, ratio: 0.41 },
  { phase: "Vertical", phaseIndex: 1, phaseCount: 6, name: "Back of Front Bangs", instruction: "From the side, place the plane where the root area for the front bangs should end.", axis: "z", color: SCALP_REGIONS.bangs.color, ratio: 0.68 },
  { phase: "Vertical", phaseIndex: 2, phaseCount: 6, name: "Front of Sideburns", instruction: "Place the plane where the sideburn and side-bang root area should begin.", axis: "z", color: SCALP_REGIONS["side-bangs-right"].color, ratio: 0.59 },
  { phase: "Vertical", phaseIndex: 3, phaseCount: 6, name: "Middle of Ear", instruction: "Place the plane so it passes through the middle of the ear.", axis: "z", color: SCALP_REGIONS["side-bangs-right"].color, ratio: 0.51 },
  { phase: "Vertical", phaseIndex: 4, phaseCount: 6, name: "Back of Sideburns", instruction: "Place the plane where the sideburn and side-bang root area should end behind the ear.", axis: "z", color: SCALP_REGIONS["side-right"].color, ratio: 0.43 },
  { phase: "Vertical", phaseIndex: 5, phaseCount: 6, name: "Back of Ear", instruction: "Place the plane where it intersects the back edge of the ear to define the rear of the side-hair region.", axis: "z", color: SCALP_REGIONS["side-right"].color, ratio: 0.34 },
  { phase: "Vertical", phaseIndex: 6, phaseCount: 6, name: "Start of Back Hair", instruction: "Place the plane where the back hair region should begin behind the ear.", axis: "z", color: SCALP_REGIONS.back.color, ratio: 0.25 }
];
const scalpBuilderPlanePositions = new Array(SCALP_BUILDER_STEPS.length).fill(null);
const scalpBuilderContours = new Array(SCALP_BUILDER_STEPS.length).fill(null);
let scalpPaintDrag = null;
let activeScalpRegion = "bangs";
let selectedScalpLatticeIndex = null;
let selectedCurveLatticePoint = null;
let selectedControlPoints = [];
let selectionMarqueeDrag = null;
let altOrbitDrag = null;
let selectPointerCapture = null;
let scalpLatticeDrag = null;
let selectedPoint = null;
let selectedStrandGroup = null;
let relaxEdit = null;
let placeEdit = null;
let drawStrandStroke = null;
let drawStrandMode = "standard";
let clumpUpdateInProgress = false;
let placementPointer = null;
let emptySelectionPointer = null;
let proportionalSizeEdit = null;
let proportionalHotkeyPress = null;
let viewSnapDrag = null;
let activeViewportPointer = null;
let shiftSnappedViewActive = false;
let viewPlaneMoveEnabled = false;
let viewPlaneMoveSnappedOnly = false;
let viewPlaneMoveDrag = null;
let pullMoveEnabled = false;
let pullCollisionEnabled = true;
let pullRigidity = 0.65;
let lastHorizontalViewAxis = new THREE.Vector3(0, 0, 1);
const CARDINAL_VIEW_DRAG_STEP = 72;
const CARDINAL_VIEW_DRAG_GRACE = 48;
let sweepProfileEdit = null;
let taperCurveEdit = null;
const lastPointer = { x: 0, y: 0 };
let pendingPlacedLockId = null;
const locks = [];
const guides = [];
const undoHistory = new BoundedHistory(60);
const strandGroupOpen = new Map(STRAND_GROUPS.map((group) => [group.id, true]));
const strandLayerOpen = new Map();
const clumpOpen = new Map();
let outlinerContextTarget = null;
let restoringHistory = false;
let inputUndoCaptured = false;
const inputs = {
  name: document.querySelector("#lockName"),
  widthScale: document.querySelector("#widthScale"),
  depthScale: document.querySelector("#depthScale"),
  profileOffset: document.querySelector("#profileOffset"),
  rootScalpOffset: document.querySelector("#rootScalpOffset"),
  twist: document.querySelector("#twist"),
  radialSegments: document.querySelector("#strandRadialSegments"),
  lengthSegments: document.querySelector("#strandLengthSegments"),
  densityAggression: document.querySelector("#strandDensityAggression")
};
const strandLayerInput = document.querySelector("#strandLayer");
const strandDynamicDensityInput = document.querySelector("#strandDynamicDensity");
const mirrorXToggle = document.querySelector("#mirrorXToggle");
const twistNumberInput = document.querySelector("#twistNumber");
const hairMaterialSelect = document.querySelector("#hairMaterialSelect");
const newHairMaterialButton = document.querySelector("#newHairMaterial");
const hairMaterialNameInput = document.querySelector("#hairMaterialName");
const hairMaterialColorInput = document.querySelector("#hairMaterialColor");
const hairMaterialShadowColorInput = document.querySelector("#hairMaterialShadowColor");
const hairMaterialHighlightColorInput = document.querySelector("#hairMaterialHighlightColor");
const hairMaterialRoughnessInput = document.querySelector("#hairMaterialRoughness");
const roughnessValue = document.querySelector("#roughnessValue");
const hairShaderInputs = {
  shadowThreshold: document.querySelector("#hairShadowThreshold"),
  shadowSoftness: document.querySelector("#hairShadowSoftness"),
  backGradientStrength: document.querySelector("#hairBackGradientStrength"),
  backGradientPower: document.querySelector("#hairBackGradientPower"),
  highlightWidth: document.querySelector("#hairHighlightWidth"),
  highlightSoftness: document.querySelector("#hairHighlightSoftness"),
  highlightStrength: document.querySelector("#hairHighlightStrength"),
  highlightShift: document.querySelector("#hairHighlightShift"),
  highlightJaggedness: document.querySelector("#hairHighlightJaggedness"),
  highlightJaggedFrequency: document.querySelector("#hairHighlightJaggedFrequency")
};
const hairShaderValues = Object.fromEntries(Object.entries(hairShaderInputs).map(([key, input]) => [
  key,
  document.querySelector(`#${input.id}Value`)
]));
const hairShaderValuePrecision = {
  shadowSoftness: 3,
  highlightWidth: 3,
  highlightSoftness: 3,
  highlightJaggedness: 3,
  highlightJaggedFrequency: 1
};
function syncRoughnessValue() {
  roughnessValue.textContent = Number(hairMaterialRoughnessInput.value).toFixed(2);
}
hairMaterialRoughnessInput.addEventListener("input", syncRoughnessValue);
hairMaterialRoughnessInput.addEventListener("change", syncRoughnessValue);
function syncHairShaderValue(key) {
  const output = hairShaderValues[key];
  const input = hairShaderInputs[key];
  if (!output || !input) return;
  output.textContent = Number(input.value).toFixed(hairShaderValuePrecision[key] ?? 2);
}
function syncHairShaderValues() {
  Object.keys(hairShaderInputs).forEach(syncHairShaderValue);
}
const guideInputs = {
  x: document.querySelector("#guideX"),
  y: document.querySelector("#guideY"),
  z: document.querySelector("#guideZ"),
  width: document.querySelector("#guideWidth"),
  height: document.querySelector("#guideHeight"),
  depth: document.querySelector("#guideDepth"),
  bend: document.querySelector("#guideBend"),
  verticalBend: document.querySelector("#guideVerticalBend"),
  topCurve: document.querySelector("#guideTopCurve"),
  bottomCurve: document.querySelector("#guideBottomCurve"),
  density: document.querySelector("#guideDensity"),
  opacity: document.querySelector("#guideOpacity")
};
const guideControls = [...document.querySelectorAll(".guide-controls")];
const toolButtons = [...document.querySelectorAll(".tool-button")];
const spaceToggle = document.querySelector("#spaceToggle");
const hierarchyToggle = document.querySelector("#hierarchyToggle");
const proportionalToggle = document.querySelector("#proportionalToggle");
const strandCollisionToggle = document.querySelector("#strandCollisionToggle");
const scalpSetupToggle = document.querySelector("#scalpSetupToggle");
const scalpSetupMenu = document.querySelector("#scalpSetupMenu");
const scalpSetupShell = scalpSetupToggle.closest(".setup-menu-shell");
const scalpPaintToggle = document.querySelector("#scalpPaintToggle");
const headSetupMode = document.querySelector("#headSetupMode");
const scalpBuilderMode = document.querySelector("#scalpBuilderMode");
const exitSetupEditor = document.querySelector("#exitSetupEditor");
const exitSetupEditorLabel = document.querySelector("#exitSetupEditorLabel");
const scalpGuideVisibilityToggle = document.querySelector("#scalpGuideVisibilityToggle");
const groupColorToggle = document.querySelector("#groupColorToggle");
const lightAzimuthInput = document.querySelector("#lightAzimuth");
const lightElevationInput = document.querySelector("#lightElevation");
const lightAzimuthValue = document.querySelector("#lightAzimuthValue");
const lightElevationValue = document.querySelector("#lightElevationValue");
const headTransformInputs = {
  positionY: document.querySelector("#headPositionY"),
  positionZ: document.querySelector("#headPositionZ"),
  uniformScale: document.querySelector("#headUniformScale")
};
const headTransformValues = Object.fromEntries(Object.entries(headTransformInputs).map(([key, input]) => [
  key,
  document.querySelector(`#${input.id}Value`)
]));
const headTransformResetButtons = [...document.querySelectorAll("button[data-reset-head-transform]")];
const scalpRoughScaleInputs = [...document.querySelectorAll("input[data-scalp-rough-scale-axis]")];
const scalpRoughScaleValues = [...document.querySelectorAll("output[data-scalp-rough-scale-value]")];
const scalpRoughScaleResetButtons = [...document.querySelectorAll("button[data-reset-scalp-rough-scale]")];
const presetLibraryToggle = document.querySelector("#presetLibraryToggle");
const presetLibrary = document.querySelector("#presetLibrary");
const presetLibraryGrid = document.querySelector("#presetLibraryGrid");
const presetLibraryStatus = document.querySelector("#presetLibraryStatus");
const presetFilterButtons = [...document.querySelectorAll("[data-preset-filter]")];
const hairProjectFileInput = document.querySelector("#hairProjectFile");
const headMeshFileInput = document.querySelector("#headMeshFile");
const undoButton = document.querySelector("#undoAction");
const placementStatus = document.querySelector("#placementStatus");
const hierarchyNavigationHint = document.querySelector("#hierarchyNavigationHint");
const selectedPointLabel = document.querySelector("#selectedPointLabel");
const proportionalRadiusInput = document.querySelector("#proportionalRadius");
const proportionalFalloffInput = document.querySelector("#proportionalFalloff");
const proportionalLockRootInput = document.querySelector("#proportionalLockRoot");
const scalpPanel = document.querySelector("#scalpPanel");
const scalpPaintPanel = document.querySelector("#scalpPaintPanel");
const headPanel = document.querySelector("#headPanel");
const scalpBuilderPanel = document.querySelector("#scalpBuilderPanel");
const resetScalpBuilderButton = document.querySelector("#resetScalpBuilder");
const confirmScalpBuilderButton = document.querySelector("#confirmScalpBuilder");
const generateScalpBuilderButton = document.querySelector("#generateScalpBuilder");
const scalpBuilderShowTemplateInput = document.querySelector("#scalpBuilderShowTemplate");
const scalpBuilderPositionOutput = document.querySelector("#scalpBuilderPosition");
const scalpBuilderStepLabel = document.querySelector("#scalpBuilderStepLabel");
const scalpBuilderStepName = document.querySelector("#scalpBuilderStepName");
const scalpBuilderAxisLabel = document.querySelector("#scalpBuilderAxisLabel");
const scalpBuilderInstruction = document.querySelector("#scalpBuilderInstruction");
const scalpGuideSourceInput = document.querySelector("#scalpGuideSource");
const scalpGuideMeshFileInput = document.querySelector("#scalpGuideMeshFile");
const scalpBrushSizeInput = document.querySelector("#scalpBrushSize");
const scalpRegionButtons = [...document.querySelectorAll("[data-scalp-region]")];
const guidePanel = document.querySelector("#guidePanel");
const guidePanelTitle = document.querySelector("#guidePanelTitle");
const curveLatticeToggle = document.querySelector("#curveLatticeToggle") || document.createElement("button");
const curveLatticeControls = document.querySelector("#curveLatticeControls");
const curveLatticeOpacityInput = document.querySelector("#curveLatticeOpacity");
const curveLatticeBottomExtrudeInput = document.querySelector("#curveLatticeBottomExtrude");
const curveLatticeBottomExtrudeValue = document.querySelector("#curveLatticeBottomExtrudeValue");
const curveLatticeBottomRowsInput = document.querySelector("#curveLatticeBottomRows");
const curveLatticeBottomRowsValue = document.querySelector("#curveLatticeBottomRowsValue");
const groupSettingsPanel = document.querySelector("#groupSettingsPanel");
const groupSettingsTitle = document.querySelector("#groupSettingsTitle");
const presetPanel = document.querySelector("#presetPanel");
const selectedStrandPanel = document.querySelector("#selectedStrandPanel");
const clumpGuidePanel = document.querySelector("#clumpGuidePanel");
const clumpGuideStatus = document.querySelector("#clumpGuideStatus");
const clumpInfluenceControl = document.querySelector("#clumpInfluenceControl");
const clumpInfluenceInput = document.querySelector("#clumpInfluence");
const clumpInfluenceValue = document.querySelector("#clumpInfluenceValue");
const clumpShapeControls = document.querySelector("#clumpShapeControls");
const clumpShapeInputs = {
  spread: document.querySelector("#clumpSpread"),
  depthSpread: document.querySelector("#clumpDepthSpread"),
  tipFan: document.querySelector("#clumpTipFan"),
  roll: document.querySelector("#clumpRoll"),
  strandWidth: document.querySelector("#clumpStrandWidth"),
  strandDepth: document.querySelector("#clumpStrandDepth"),
  variation: document.querySelector("#clumpVariation")
};
const clumpShapeValues = {
  spread: document.querySelector("#clumpSpreadValue"),
  depthSpread: document.querySelector("#clumpDepthSpreadValue"),
  tipFan: document.querySelector("#clumpTipFanValue"),
  roll: document.querySelector("#clumpRollValue"),
  strandWidth: document.querySelector("#clumpStrandWidthValue"),
  strandDepth: document.querySelector("#clumpStrandDepthValue"),
  variation: document.querySelector("#clumpVariationValue")
};
const clumpContextMenu = document.querySelector("#clumpContextMenu");
const dissolveClumpAction = document.querySelector("#dissolveClumpAction");
const deleteOutlinerAction = document.querySelector("#deleteOutlinerAction");
const hairMaterialPanel = document.querySelector("#hairMaterialPanel");
const proportionalPanel = document.querySelector("#proportionalPanel");
const proportionalLockRootRow = document.querySelector("#proportionalLockRootRow");
const hierarchyPanel = document.querySelector("#hierarchyPanel");
const hierarchyRecursiveTransformInput = document.querySelector("#hierarchyRecursiveTransform");
const transformToolPanel = document.querySelector("#transformToolPanel");
const transformToolTitle = document.querySelector("#transformToolTitle");
const viewPlaneMoveSetting = document.querySelector("#viewPlaneMoveSetting");
const viewPlaneMoveInput = document.querySelector("#viewPlaneMove");
const viewPlaneMoveSnappedSetting = document.querySelector("#viewPlaneMoveSnappedSetting");
const viewPlaneMoveSnappedOnlyInput = document.querySelector("#viewPlaneMoveSnappedOnly");
const pullMoveSetting = document.querySelector("#pullMoveSetting");
const pullMoveInput = document.querySelector("#pullMove");
const pullRigiditySetting = document.querySelector("#pullRigiditySetting");
const pullRigidityInput = document.querySelector("#pullRigidity");
const pullRigidityValue = document.querySelector("#pullRigidityValue");
const pullCollisionSetting = document.querySelector("#pullCollisionSetting");
const pullCollisionInput = document.querySelector("#pullCollision");
const placeStrandToolPanel = document.querySelector("#placeStrandToolPanel");
const placeStrandScalpOffsetInput = document.querySelector("#placeStrandScalpOffset");
const placeStrandScalpOffsetValue = document.querySelector("#placeStrandScalpOffsetValue");
const placeAutoShowScalpInput = document.querySelector("#placeAutoShowScalp");
const drawStrandToolPanel = document.querySelector("#drawStrandToolPanel");
const drawBrushPresetInput = document.querySelector("#drawBrushPreset");
const strandToolPresetInput = document.querySelector("#strandToolPreset");
const saveStrandToolPresetButton = document.querySelector("#saveStrandToolPreset");
const drawStrandCurlCountInput = document.querySelector("#drawStrandCurlCount");
const drawStrandCurlCountValue = document.querySelector("#drawStrandCurlCountValue");
const drawStrandCurlDisplacementInput = document.querySelector("#drawStrandCurlDisplacement");
const drawStrandCurlDisplacementValue = document.querySelector("#drawStrandCurlDisplacementValue");
const drawToolSizeInput = document.querySelector("#drawToolSize");
const drawToolSizeValue = document.querySelector("#drawToolSizeValue");
const drawStrandBrushSizeInput = document.querySelector("#drawStrandBrushSize");
const drawStrandBrushSizeValue = document.querySelector("#drawStrandBrushSizeValue");
const drawStrandSmoothingInput = document.querySelector("#drawStrandSmoothing");
const drawStrandSmoothingValue = document.querySelector("#drawStrandSmoothingValue");
const drawStrandCurveStepInput = document.querySelector("#drawStrandCurveStep");
const drawStrandCurveStepValue = document.querySelector("#drawStrandCurveStepValue");
const drawStrandScalpOffsetInput = document.querySelector("#drawStrandScalpOffset");
const drawStrandScalpOffsetValue = document.querySelector("#drawStrandScalpOffsetValue");
const drawStrandSurfaceInput = document.querySelector("#drawStrandSurface");
const drawAutoShowScalpInput = document.querySelector("#drawAutoShowScalp");
const drawContinueFromTipInput = document.querySelector("#drawContinueFromTip");
const braidToolPanel = document.querySelector("#braidToolPanel");
const braidToolPresetInput = document.querySelector("#braidToolPreset");
const saveBraidToolPresetButton = document.querySelector("#saveBraidToolPreset");
const creationPresetDialog = document.querySelector("#creationPresetDialog");
const creationPresetForm = document.querySelector("#creationPresetForm");
const creationPresetDialogTitle = document.querySelector("#creationPresetDialogTitle");
const creationPresetNameInput = document.querySelector("#creationPresetName");
const closeCreationPresetDialogButton = document.querySelector("#closeCreationPresetDialog");
const cancelCreationPresetButton = document.querySelector("#cancelCreationPreset");
const braidMeshPresetInput = document.querySelector("#braidMeshPreset");
const braidToolSizeInput = document.querySelector("#braidToolSize");
const braidToolSizeValue = document.querySelector("#braidToolSizeValue");
const braidWidthInput = document.querySelector("#braidWidth");
const braidWidthValue = document.querySelector("#braidWidthValue");
const braidDepthInput = document.querySelector("#braidDepth");
const braidDepthValue = document.querySelector("#braidDepthValue");
const widthScaleLabel = document.querySelector("#widthScaleLabel");
const depthScaleLabel = document.querySelector("#depthScaleLabel");
const braidSegmentLengthInput = document.querySelector("#braidSegmentLength");
const braidSegmentLengthValue = document.querySelector("#braidSegmentLengthValue");
const braidRotationInput = document.querySelector("#braidRotation");
const braidRotationValue = document.querySelector("#braidRotationValue");
const braidSmoothingInput = document.querySelector("#braidSmoothing");
const braidSmoothingValue = document.querySelector("#braidSmoothingValue");
const braidCurveStepInput = document.querySelector("#braidCurveStep");
const braidCurveStepValue = document.querySelector("#braidCurveStepValue");
const braidScalpOffsetInput = document.querySelector("#braidScalpOffset");
const braidScalpOffsetValue = document.querySelector("#braidScalpOffsetValue");
const braidSurfaceInput = document.querySelector("#braidSurface");
const braidAutoShowScalpInput = document.querySelector("#braidAutoShowScalp");
const braidContinueFromTipInput = document.querySelector("#braidContinueFromTip");
const transformSpaceButtons = [...document.querySelectorAll("[data-transform-space]")];
const strandShapePanel = document.querySelector("#strandShapePanel");
const strandShapeTitle = document.querySelector("#strandShapeTitle");
const groupInputs = {
  widthScale: document.querySelector("#groupWidthScale"),
  depthScale: document.querySelector("#groupDepthScale"),
  profileOffset: document.querySelector("#groupProfileOffset"),
  rootScalpOffset: document.querySelector("#groupRootScalpOffset"),
  radialSegments: document.querySelector("#groupRadialSegments"),
  lengthSegments: document.querySelector("#groupLengthSegments"),
  densityAggression: document.querySelector("#groupDensityAggression")
};
const groupLayerInputs = Object.fromEntries(HAIR_LAYERS.map((layer) => [
  layer.id,
  document.querySelector(`#groupLayer${layer.id[0].toUpperCase()}${layer.id.slice(1)}`)
]));
const groupDynamicDensityInput = document.querySelector("#groupDynamicDensity");
const groupTopologyStats = document.querySelector("#groupTopologyStats");
const strandTopologyPanel = document.querySelector("#strandTopologyPanel");
const strandTopologyStats = document.querySelector("#strandTopologyStats");
const viewportStats = document.querySelector(".viewport-stats");
const viewportSelectedStats = document.querySelector("#viewportSelectedStats");
const viewportTotalStats = document.querySelector("#viewportTotalStats");
const viewportFps = document.querySelector("#viewportFps");
const topologyValues = {
  groupRadialSegments: document.querySelector("#groupRadialSegmentsValue"),
  groupLengthSegments: document.querySelector("#groupLengthSegmentsValue"),
  groupDensityAggression: document.querySelector("#groupDensityAggressionValue"),
  strandRadialSegments: document.querySelector("#strandRadialSegmentsValue"),
  strandLengthSegments: document.querySelector("#strandLengthSegmentsValue"),
  strandDensityAggression: document.querySelector("#strandDensityAggressionValue")
};
const profilePreviewPaths = {
  group: document.querySelector("#groupProfilePreview"),
  strand: document.querySelector("#strandProfilePreview")
};
const sweepProfileEditor = document.querySelector("#sweepProfileEditor");
const sweepProfileTarget = document.querySelector("#sweepProfileTarget");
const sweepProfileCanvas = document.querySelector("#sweepProfileCanvas");
const sweepProfilePath = document.querySelector("#sweepProfilePath");
const sweepProfilePoints = document.querySelector("#sweepProfilePoints");
const editSweepProfileButtons = [...document.querySelectorAll(".edit-sweep-profile")];
const taperPreviewPaths = {
  group: document.querySelector("#groupTaperPreview"),
  strand: document.querySelector("#strandTaperPreview"),
  groupDepth: document.querySelector("#groupDepthPreview"),
  strandDepth: document.querySelector("#strandDepthPreview")
};
const taperCurveEditor = document.querySelector("#taperCurveEditor");
const taperCurveTarget = document.querySelector("#taperCurveTarget");
const taperCurveCanvas = document.querySelector("#taperCurveCanvas");
const taperCurvePath = document.querySelector("#taperCurvePath");
const taperCurvePoints = document.querySelector("#taperCurvePoints");
const taperPointValue = document.querySelector("#taperPointValue");
const taperPointPosition = document.querySelector("#taperPointPosition");
const taperPointInterpolation = document.querySelector("#taperPointInterpolation");
const editTaperCurveButtons = [...document.querySelectorAll(".edit-shape-curve")];
const shapePresetSelects = [...document.querySelectorAll(".shape-preset-select")];
const groupDefaultsWarning = document.querySelector("#groupDefaultsWarning");
const hideGroupDefaultsWarning = document.querySelector("#hideGroupDefaultsWarning");
const confirmGroupDefaultsChange = document.querySelector("#confirmGroupDefaultsChange");
const cancelGroupDefaultsChange = document.querySelector("#cancelGroupDefaultsChange");
let groupDefaultsWarningAcknowledged = localStorage.getItem("anime-hair-hide-group-defaults-warning") === "true";
let groupDefaultsWarningContinuation = null;
const scalpInputs = {
  x: document.querySelector("#scalpX"),
  y: document.querySelector("#scalpY"),
  z: document.querySelector("#scalpZ"),
  radius: document.querySelector("#scalpRadius"),
  scaleX: document.querySelector("#scalpScaleX"),
  scaleY: document.querySelector("#scalpScaleY"),
  scaleZ: document.querySelector("#scalpScaleZ")
};
const scalpSurface = { x: 0, y: 0.9, z: 0, radius: 1, scaleX: 1, scaleY: 1, scaleZ: 1 };
const scalpArtistInputs = {
  mirrorX: document.querySelector("#scalpMirrorX"),
  sideFlatten: document.querySelector("#scalpSideFlatten"),
  topHeight: document.querySelector("#scalpTopHeight"),
  bottomHeight: document.querySelector("#scalpBottomHeight"),
  hairlineRows: document.querySelector("#scalpHairlineRows"),
  sideBangRows: document.querySelector("#scalpSideBangRows"),
  rootScalpOffset: document.querySelector("#scalpRootOffset"),
  topWidth: document.querySelector("#scalpTopWidth"),
  topDepth: document.querySelector("#scalpTopDepth"),
  middleWidth: document.querySelector("#scalpMiddleWidth"),
  middleDepth: document.querySelector("#scalpMiddleDepth"),
  bottomWidth: document.querySelector("#scalpBottomWidth"),
  bottomDepth: document.querySelector("#scalpBottomDepth")
};
const scalpArtistShape = {
  mirrorX: true,
  sideFlatten: 0.28,
  topHeight: 0.92,
  bottomHeight: 1.32,
  hairlineRows: 9,
  sideBangRows: 5,
  rootScalpOffset: 0,
  topWidth: 0.94,
  topDepth: 1.02,
  middleWidth: 1.05,
  middleDepth: 1.08,
  bottomWidth: 1.1,
  bottomDepth: 1.02
};
const advancedLatticeButton = document.querySelector("#toggleAdvancedLattice");
createScalpLattice();
const modeToolButtons = toolButtons.filter((button) => button.dataset.tool);
const toolModes = {
  select: "translate",
  move: "translate",
  rotate: "rotate",
  scale: "scale",
  relax: "translate",
  place: "translate",
  draw: "translate",
  braid: "translate"
};
const shortcutTools = {
  q: "select",
  w: "move",
  e: "rotate",
  r: "scale",
  t: "relax",
  d: "draw",
  g: "braid"
};

const presets = {
  front: { x: 0, y: 1.56, z: 0.9, length: 1.25, curve: -0.42, width: 0.24, taper: 0.48, twist: 0, color: "#2c223a", scalpRegion: "bangs" },
  side: { x: 0.48, y: 1.42, z: 0.72, length: 1.65, curve: 0.55, width: 0.2, taper: 0.42, twist: 0.45, color: "#2c223a", scalpRegion: "side-right" },
  back: { x: 0.2, y: 1.42, z: -0.62, length: 2.2, curve: 0.18, width: 0.28, taper: 0.5, twist: -0.2, color: "#2c223a", scalpRegion: "back" },
  twin: { x: 1.12, y: 0.88, z: -0.22, length: 2.6, curve: 0.68, width: 0.32, taper: 0.38, twist: 0.85, color: "#2c223a", scalpRegion: "back" },
  ahoge: { x: 0.06, y: 1.95, z: 0.1, length: 0.92, curve: 1.05, width: 0.08, taper: 0.35, twist: 1.2, color: "#2c223a", scalpRegion: "unassigned" }
};

const generatedPresetGroups = new Set(["generated-bangs", "bowl-cut", "long-layered-curls", "braided-bob"]);
const authoredPresetProjects = new Map([
  ["braided-buns", "./assets/presets/braided-buns.animehair.json?v=20260720-1"]
]);
const presetCatalog = [
  { id: "braided-buns", title: "Braided Buns", category: "full", thumbnail: "braided-buns", previewImage: "./assets/presets/braided-buns-preview.png?v=20260720-1" },
  { id: "braided-bob", title: "Braided Bob", category: "full", thumbnail: "braided-bob" },
  { id: "long-layered-curls", title: "Long Layered Curls", category: "full", thumbnail: "long-layers" },
  { id: "bowl-cut", title: "Bowl Cut", category: "full", thumbnail: "bowl" },
  { id: "generated-bangs", title: "Layered Bangs", category: "elements", thumbnail: "bangs" },
  { id: "front", title: "Front Bang", category: "elements", thumbnail: "front" },
  { id: "side", title: "Side Sweep", category: "elements", thumbnail: "side" },
  { id: "back", title: "Back Layer", category: "elements", thumbnail: "back" },
  { id: "twin", title: "Pony Tail", category: "elements", thumbnail: "tail" },
  { id: "ahoge", title: "Ahoge", category: "elements", thumbnail: "ahoge" }
];
const customPresetCatalog = [];
let activePresetFilter = "full";
let currentProjectName = "Untitled Hair Project";
let projectSaveInProgress = false;
let importedHeadAsset = null;

const GUIDE_HEAD_REFERENCE_SIZE = 26.760177;
const GUIDE_BOUNDS_EXCLUDED_GROUPS = new Set(["body_clean_nosupport"]);

function guideHeadBounds(model) {
  const box = new THREE.Box3();
  model.updateMatrixWorld(true);
  model.traverse((child) => {
    if (!child.isMesh || GUIDE_BOUNDS_EXCLUDED_GROUPS.has(child.name)) return;
    box.expandByObject(child);
  });
  return box.isEmpty() ? new THREE.Box3().setFromObject(model) : box;
}

function disposeGuideModel(model) {
  if (!model) return;
  scene.remove(model);
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose());
    else child.material?.dispose();
  });
}

function syncHeadTransformInputs() {
  Object.entries(headTransformInputs).forEach(([key, input]) => {
    input.value = String(headTransform[key]);
    headTransformValues[key].textContent = Number(headTransform[key]).toFixed(2);
  });
}

function applyHeadTransform() {
  if (!guideModel) return;
  const sourceCenter = guideModel.userData.sourceCenter;
  const fittedCenter = guideModel.userData.fittedCenter;
  const baseScale = Number(guideModel.userData.baseScale);
  if (!sourceCenter || !fittedCenter || !Number.isFinite(baseScale)) return;
  const scaleX = baseScale * headTransform.uniformScale * headTransform.scaleX;
  const scaleY = baseScale * headTransform.uniformScale * headTransform.scaleY;
  const scaleZ = baseScale * headTransform.uniformScale * headTransform.scaleZ;
  guideModel.scale.set(scaleX, scaleY, scaleZ);
  guideModel.position.set(
    fittedCenter.x + headTransform.positionX - sourceCenter.x * scaleX,
    fittedCenter.y + headTransform.positionY - sourceCenter.y * scaleY,
    fittedCenter.z + headTransform.positionZ - sourceCenter.z * scaleZ
  );
  guideModel.updateMatrixWorld(true);
}

function syncScalpRoughScaleInputs() {
  scalpRoughScaleInputs.forEach((input) => {
    input.value = String(scalpRoughScale[input.dataset.scalpRoughScaleAxis]);
  });
  scalpRoughScaleValues.forEach((output) => {
    output.textContent = Number(scalpRoughScale[output.dataset.scalpRoughScaleValue]).toFixed(2);
  });
}

function applyScalpRoughScale() {
  const { x, y, z } = scalpRoughScale;
  scalpBuilderGroup.scale.set(x, y, z);
  scalpBuilderGroup.position.set(
    scalpRoughScalePivot.x * (1 - x),
    scalpRoughScalePivot.y * (1 - y),
    scalpRoughScalePivot.z * (1 - z)
  );
  scalpBuilderGroup.updateMatrixWorld(true);
  if (scalpBuilderCurveLattice?.lastSubdivided) {
    syncEditedScalpSurface(scalpBuilderCurveLattice.lastSubdivided);
  }
}

function resetHeadTransform() {
  Object.assign(headTransform, {
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    uniformScale: 1,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1
  });
  syncHeadTransformInputs();
  applyHeadTransform();
}

function installGuideModel(obj, options = {}) {
  const { normalize = false, frame = true } = options;
  const box = guideHeadBounds(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const sourceSize = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(sourceSize) || sourceSize <= 0) throw new Error("Head OBJ contains no usable mesh bounds");
  const scale = 2.8 / (normalize ? sourceSize : GUIDE_HEAD_REFERENCE_SIZE);

  obj.scale.setScalar(scale);
  obj.position.set(-center.x * scale, -center.y * scale + 0.05, -center.z * scale);
  obj.userData.sourceCenter = center.clone();
  obj.userData.fittedCenter = new THREE.Vector3(0, 0.05, 0);
  obj.userData.baseScale = scale;
  let meshCount = 0;
  obj.traverse((child) => {
    if (!child.isMesh) return;
    meshCount += 1;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
    child.geometry = mergeVertices(child.geometry, 0.0001);
    child.geometry.deleteAttribute("uv");
    child.geometry.deleteAttribute("color");
    child.geometry.computeVertexNormals();
    child.material = new THREE.MeshStandardMaterial({
      color: 0x3b3d42,
      roughness: 0.9,
      metalness: 0,
      flatShading: false,
      vertexColors: false,
      transparent: false,
      opacity: 1,
      side: THREE.FrontSide
    });
  });
  if (!meshCount) throw new Error("Head OBJ does not contain any mesh geometry");
  disposeGuideModel(guideModel);
  guideModel = obj;
  scene.add(obj);
  resetHeadTransform();
  setHeadReferenceTransparency(false);
  if (frame) frameGuideModel({ distanceScale: 1.35, targetYOffset: -0.12 });
}

function loadDefaultGuideModel(options = {}) {
  return new Promise((resolve, reject) => {
    new OBJLoader().load("./assets/headplusfeatures.obj?v=20260720-1", (obj) => {
      try {
        installGuideModel(obj, options);
        obj.updateMatrixWorld(true);
        authoredScalpGuideMatrix = obj.matrixWorld.clone();
        importedHeadAsset = null;
        ensureEditedScalpSurface().catch((error) => {
          console.error("Could not initialize the live authored scalp surface", error);
        });
        resolve(obj);
      } catch (error) {
        reject(error);
      }
    }, undefined, reject);
  });
}

loadDefaultGuideModel().catch((error) => {
  console.error("Could not load base head OBJ", error);
});

function braidTemplateFromEntries(entries) {
  const geometries = entries.map((entry, partIndex) => {
    const geometry = entry.mesh.geometry.clone();
    geometry.applyMatrix4(entry.mesh.matrixWorld);
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    part.setAttribute(
      "braidPart",
      new THREE.Float32BufferAttribute(new Array(part.getAttribute("position").count).fill(partIndex), 1)
    );
    return part;
  });
  if (!geometries.length) return null;
  const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
  geometries.forEach((item) => {
    if (item !== geometry) item.dispose();
  });
  return {
    geometry,
    bounds: new THREE.Box3().setFromBufferAttribute(geometry.getAttribute("position"))
  };
}

function braidMeshEntries(obj) {
  const entries = [];
  obj.updateMatrixWorld(true);
  obj.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const box = new THREE.Box3().setFromBufferAttribute(mesh.geometry.getAttribute("position"));
    box.applyMatrix4(mesh.matrixWorld);
    entries.push({ mesh, box });
  });
  return entries.sort((a, b) => a.box.min.y - b.box.min.y);
}

function prepareBraidBodyCache(template) {
  const sourcePosition = template.geometry.getAttribute("position");
  const sourceNormal = template.geometry.getAttribute("normal");
  const sourceUv = template.geometry.getAttribute("uv");
  const sourcePart = template.geometry.getAttribute("braidPart");
  const sourceSize = template.bounds.getSize(new THREE.Vector3());
  const sourceCenter = template.bounds.getCenter(new THREE.Vector3());
  const sourceMinY = template.bounds.min.y;
  const sourceLength = Math.max(0.0001, sourceSize.y);
  const quantize = (value, precision = 10000) => Math.round(value * precision);
  const seamData = new Map();
  const sourceUvBounds = { min: new THREE.Vector2(Infinity, Infinity), max: new THREE.Vector2(-Infinity, -Infinity) };
  if (sourceUv) {
    for (let index = 0; index < sourceUv.count; index += 1) {
      sourceUvBounds.min.x = Math.min(sourceUvBounds.min.x, sourceUv.getX(index));
      sourceUvBounds.min.y = Math.min(sourceUvBounds.min.y, sourceUv.getY(index));
      sourceUvBounds.max.x = Math.max(sourceUvBounds.max.x, sourceUv.getX(index));
      sourceUvBounds.max.y = Math.max(sourceUvBounds.max.y, sourceUv.getY(index));
    }
  }
  if (sourceNormal) {
    const sourceNormalAt = (sourceIndex) => new THREE.Vector3(
      sourceNormal.getX(sourceIndex), sourceNormal.getY(sourceIndex), sourceNormal.getZ(sourceIndex)
    ).normalize();
    const clusterBoundary = (boundaryY) => {
      const clusters = new Map();
      for (let sourceIndex = 0; sourceIndex < sourcePosition.count; sourceIndex += 1) {
        if (Math.abs(sourcePosition.getY(sourceIndex) - boundaryY) > 0.0001) continue;
        const partIndex = sourcePart ? Math.round(sourcePart.getX(sourceIndex)) : 0;
        const key = [partIndex, quantize(sourcePosition.getX(sourceIndex), 100000), quantize(sourcePosition.getZ(sourceIndex), 100000)].join("|");
        if (!clusters.has(key)) {
          clusters.set(key, {
            partIndex,
            position: new THREE.Vector2(sourcePosition.getX(sourceIndex), sourcePosition.getZ(sourceIndex)),
            indices: []
          });
        }
        clusters.get(key).indices.push(sourceIndex);
      }
      return [...clusters.values()];
    };
    const normalBuckets = (indices) => {
      const buckets = [];
      indices.forEach((sourceIndex) => {
        const normal = sourceNormalAt(sourceIndex);
        let bucket = buckets.find((candidate) => candidate.normal.dot(normal) > 0.9999);
        if (!bucket) {
          bucket = { normal, indices: [] };
          buckets.push(bucket);
        }
        bucket.indices.push(sourceIndex);
      });
      return buckets;
    };
    const startClusters = clusterBoundary(sourceMinY);
    const endClusters = clusterBoundary(template.bounds.max.y);
    const unusedEndClusters = new Set(endClusters);
    startClusters.forEach((startCluster) => {
      let endCluster = null;
      let nearestDistance = Infinity;
      unusedEndClusters.forEach((candidate) => {
        if (candidate.partIndex !== startCluster.partIndex) return;
        const distance = startCluster.position.distanceToSquared(candidate.position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          endCluster = candidate;
        }
      });
      if (!endCluster || nearestDistance > 0.001 * 0.001) return;
      unusedEndClusters.delete(endCluster);
      const canonicalPosition = startCluster.position.clone().add(endCluster.position).multiplyScalar(0.5);
      const startBuckets = normalBuckets(startCluster.indices);
      const endBuckets = normalBuckets(endCluster.indices);
      const applyBucketPair = (bucket, candidates) => {
        const counterpart = candidates.reduce((best, candidate) => (
          !best || bucket.normal.dot(candidate.normal) > bucket.normal.dot(best.normal) ? candidate : best
        ), null);
        const normal = counterpart ? bucket.normal.clone().add(counterpart.normal).normalize() : bucket.normal.clone();
        bucket.indices.forEach((sourceIndex) => seamData.set(sourceIndex, {
          x: canonicalPosition.x,
          z: canonicalPosition.y,
          normal
        }));
      };
      startBuckets.forEach((bucket) => applyBucketPair(bucket, endBuckets));
      endBuckets.forEach((bucket) => applyBucketPair(bucket, startBuckets));
    });
  }
  return {
    sourcePosition,
    sourceNormal,
    sourceUv,
    sourcePart,
    sourceSize,
    sourceCenter,
    sourceMinY,
    sourceLength,
    sourceUvBounds,
    uvHeight: Math.max(0.0001, sourceUvBounds.max.y - sourceUvBounds.min.y),
    seamData
  };
}

function registerBraidMeshPreset(id, obj, { authoredCaps = false } = {}) {
  const entries = braidMeshEntries(obj);
  if (!entries.length) throw new Error(`${id} braid preset contains no mesh geometry`);
  const startEntries = authoredCaps ? entries.slice(0, 1) : [];
  const endEntries = authoredCaps ? entries.slice(-1) : [];
  const bodyEntries = authoredCaps ? entries.slice(1, -1) : entries;
  if (!bodyEntries.length) throw new Error(`${id} braid preset contains no repeatable body geometry`);
  const body = braidTemplateFromEntries(bodyEntries);
  const start = braidTemplateFromEntries(startEntries);
  const end = braidTemplateFromEntries(endEntries);
  body.cache = prepareBraidBodyCache(body);
  braidMeshPresets.set(id, { id, body, start, end, authoredCaps });
  if (id === DEFAULT_BRAID_MESH_PRESET) {
    braidSegmentTemplate = body.geometry;
    braidSegmentBounds = body.bounds;
  }
  locks.filter((lock) => lock.geometryType === "braid" && (lock.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET) === id)
    .forEach(updateLockGeometry);
  updatePlacementStatus();
}

function loadBraidMeshPreset(id, path, options) {
  new OBJLoader().load(path, (obj) => {
    try {
      registerBraidMeshPreset(id, obj, options);
    } catch (error) {
      console.error(`Could not prepare ${id} braid mesh preset`, error);
    }
  }, undefined, (error) => {
    console.error(`Could not load ${id} braid mesh preset`, error);
  });
}

loadBraidMeshPreset(DEFAULT_BRAID_MESH_PRESET, "./assets/braid-segment.obj?v=20260720-1");
loadBraidMeshPreset("chain-links", "./assets/chainlinks.obj?v=20260720-1", { authoredCaps: true });

function frameGuideModel({ distanceScale = 1, targetYOffset = 0.18 } = {}) {
  const box = guideHeadBounds(guideModel);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.62;
  camera.up.set(0, 1, 0);
  controls.target.copy(center);
  controls.target.y += targetYOffset;
  camera.position.set(center.x, center.y + 0.28, center.z + Math.max(4.2, radius * 2.8) * distanceScale);
  camera.near = 0.05;
  camera.far = 100;
  camera.updateProjectionMatrix();
}

function syncScalpInputs() {
  Object.entries(scalpInputs).forEach(([key, input]) => {
    input.value = scalpSurface[key];
  });
}

function syncScalpArtistInputs() {
  scalpArtistInputs.mirrorX.checked = scalpArtistShape.mirrorX;
  ["sideFlatten", "topHeight", "bottomHeight", "hairlineRows", "sideBangRows", "rootScalpOffset", "topWidth", "topDepth", "middleWidth", "middleDepth", "bottomWidth", "bottomDepth"].forEach((key) => {
    scalpArtistInputs[key].value = scalpArtistShape[key];
  });
  document.querySelector("#scalpRootOffsetValue").textContent = Number(scalpArtistShape.rootScalpOffset).toFixed(2);
}

function rootScalpOffsetDistance(localOffset = 0) {
  const combinedOffset = Number(scalpArtistShape.rootScalpOffset) + Number(localOffset || 0);
  return THREE.MathUtils.clamp(combinedOffset, -1, 1) * ROOT_SCALP_OFFSET_DISTANCE;
}

function applyLockRootScalpOffset(lock) {
  if (!lock?.rootSurfacePoint || !lock?.rootSurfaceNormal || !lock.points?.length) return;
  const previousRoot = lock.points[0].clone();
  lock.points[0].copy(lock.rootSurfacePoint).addScaledVector(
    lock.rootSurfaceNormal,
    rootScalpOffsetDistance(lock.rootScalpOffset) + layerOffsetForLock(lock) * layerRootOffsetFactor(lock.hairLayer)
  );
  const rootDelta = lock.points[0].clone().sub(previousRoot);
  if (rootDelta.lengthSq() > 0.0000001) {
    lock.clumpRestPoints?.[0]?.add(rootDelta);
    lock.clumpGuideRestPoints?.[0]?.add(rootDelta);
  }
  lock.placementFrame?.root.copy(lock.points[0]);
  syncLockFromCurve(lock);
}

function normalizeHairLayer(layerId) {
  return HAIR_LAYERS.some((layer) => layer.id === layerId) ? layerId : DEFAULT_HAIR_LAYER;
}

function layerOffsetForLock(lock) {
  const layerId = normalizeHairLayer(lock?.hairLayer);
  return Number(groupDefaultsFor(lock?.scalpRegion || "unassigned").layerOffsets?.[layerId] ?? 0);
}

function layerRootOffsetFactor(layerId) {
  return Number(LAYER_ROOT_OFFSET_FACTORS[normalizeHairLayer(layerId)] ?? 0.42);
}

function layerOffsetWeight(pointIndex, pointCount, rootFactor) {
  if (pointCount <= 1) return rootFactor;
  const t = pointIndex / (pointCount - 1);
  return THREE.MathUtils.lerp(rootFactor, 1, THREE.MathUtils.smoothstep(t, 0, 0.38));
}

function applyLayerOffsetDeltaToPoints(points, direction, currentOffset, currentRootFactor, nextOffset, nextRootFactor) {
  if (!points?.length) return;
  points.forEach((point, index) => {
    const current = currentOffset * layerOffsetWeight(index, points.length, currentRootFactor);
    const next = nextOffset * layerOffsetWeight(index, points.length, nextRootFactor);
    point.addScaledVector(direction, next - current);
  });
}

function pointsWithLayerOffset(points, direction, offset, layerId) {
  const rootFactor = layerRootOffsetFactor(layerId);
  return points.map((point, index) => point.clone().addScaledVector(
    direction,
    offset * layerOffsetWeight(index, points.length, rootFactor)
  ));
}

function layerDirectionForLock(lock) {
  if (lock?.rootSurfaceNormal?.lengthSq()) return lock.rootSurfaceNormal.clone().normalize();
  const root = lock?.points?.[0];
  if (root) {
    const center = scalpSurfaceGroup.getWorldPosition(new THREE.Vector3());
    const radial = root.clone().sub(center);
    if (radial.lengthSq() > 0.0001) return radial.normalize();
  }
  return new THREE.Vector3(0, 0, 1);
}

function applyLayerOffset(lock, targetOffset = layerOffsetForLock(lock)) {
  if (!lock?.points?.length) return;
  const currentOffset = Number(lock.layerOffsetApplied ?? 0);
  const nextOffset = Number(targetOffset || 0);
  const currentRootFactor = Number(lock.layerOffsetRootFactorApplied ?? 1);
  const nextRootFactor = layerRootOffsetFactor(lock.hairLayer);
  if (Math.abs(nextOffset - currentOffset) > 0.000001 || Math.abs(nextRootFactor - currentRootFactor) > 0.000001) {
    const direction = layerDirectionForLock(lock);
    applyLayerOffsetDeltaToPoints(lock.points, direction, currentOffset, currentRootFactor, nextOffset, nextRootFactor);
    applyLayerOffsetDeltaToPoints(lock.groupLatticeBasePoints, direction, currentOffset, currentRootFactor, nextOffset, nextRootFactor);
    applyLayerOffsetDeltaToPoints(lock.clumpRestPoints, direction, currentOffset, currentRootFactor, nextOffset, nextRootFactor);
    applyLayerOffsetDeltaToPoints(lock.clumpGuideRestPoints, direction, currentOffset, currentRootFactor, nextOffset, nextRootFactor);
    if (lock.placementFrame) {
      lock.placementFrame.root.addScaledVector(
        direction,
        nextOffset * nextRootFactor - currentOffset * currentRootFactor
      );
    }
  }
  lock.layerOffsetApplied = nextOffset;
  lock.layerOffsetRootFactorApplied = nextRootFactor;
  syncLockFromCurve(lock);
}

function setLockHairLayer(lock, layerId) {
  if (!lock) return;
  const targets = lock.clumpId ? locks.filter((item) => item.clumpId === lock.clumpId) : [lock];
  clumpUpdateInProgress = true;
  targets.forEach((item) => {
    item.hairLayer = normalizeHairLayer(layerId);
    applyLayerOffset(item);
    applyLockRootScalpOffset(item);
    updateLockGeometry(item);
  });
  clumpUpdateInProgress = false;
  const guide = clumpGuideForLock(lock);
  if (guide) updateClumpMembers(guide);
}

function setGroupLayerOffset(region, layerId, offset) {
  const defaults = groupDefaultsFor(region);
  defaults.layerOffsets = { ...DEFAULT_LAYER_OFFSETS, ...defaults.layerOffsets, [layerId]: Number(offset) };
  locks.forEach((lock) => {
    if ((lock.scalpRegion || "unassigned") !== region || normalizeHairLayer(lock.hairLayer) !== layerId) return;
    applyLayerOffset(lock, defaults.layerOffsets[layerId]);
    applyLockRootScalpOffset(lock);
    updateLockGeometry(lock);
  });
  renderLockList();
}

function scalpArtistWeight(y) {
  return THREE.MathUtils.smoothstep(Math.min(1, Math.abs(y)), 0, 1);
}

function scalpArtistScalesAt(y) {
  const weight = scalpArtistWeight(y);
  const widthTarget = y >= 0 ? scalpArtistShape.topWidth : scalpArtistShape.bottomWidth;
  const depthTarget = y >= 0 ? scalpArtistShape.topDepth : scalpArtistShape.bottomDepth;
  return {
    width: THREE.MathUtils.lerp(scalpArtistShape.middleWidth, widthTarget, weight),
    depth: THREE.MathUtils.lerp(scalpArtistShape.middleDepth, depthTarget, weight)
  };
}

function applyScalpArtistShape(point) {
  const sideFace = Math.abs(point.x) >= Math.abs(point.y) && Math.abs(point.x) >= Math.abs(point.z);
  const weight = scalpArtistWeight(point.y);
  const height = point.y >= 0 ? scalpArtistShape.topHeight : scalpArtistShape.bottomHeight;
  const regionScale = scalpArtistScalesAt(point.y);
  point.y *= THREE.MathUtils.lerp(1, height, weight);
  point.x *= regionScale.width;
  point.z *= regionScale.depth;

  const sign = Math.sign(point.x);
  if (sideFace && sign && scalpArtistShape.sideFlatten > 0) {
    const sidePlane = regionScale.width / Math.sqrt(2);
    const inwardTarget = sign * Math.min(Math.abs(point.x), sidePlane);
    point.x = THREE.MathUtils.lerp(point.x, inwardTarget, scalpArtistShape.sideFlatten);
  }
  return point;
}

function inverseScalpArtistShape(point) {
  const ySign = Math.sign(point.y) || 1;
  const targetY = Math.abs(point.y);
  let lowY = 0;
  let highY = 2.5;
  for (let step = 0; step < 14; step += 1) {
    const candidate = (lowY + highY) * 0.5;
    const transformedY = Math.abs(applyScalpArtistShape(new THREE.Vector3(0, candidate * ySign, 0)).y);
    if (transformedY < targetY) lowY = candidate;
    else highY = candidate;
  }
  const baseY = (lowY + highY) * 0.5 * ySign;
  const regionScale = scalpArtistScalesAt(baseY);
  const xSign = Math.sign(point.x) || 1;
  const targetX = Math.abs(point.x);
  let lowX = 0;
  let highX = 2.5;
  for (let step = 0; step < 14; step += 1) {
    const candidate = (lowX + highX) * 0.5;
    const transformedX = Math.abs(applyScalpArtistShape(new THREE.Vector3(candidate * xSign, baseY, 0)).x);
    if (transformedX < targetX) lowX = candidate;
    else highX = candidate;
  }
  point.set((lowX + highX) * 0.5 * xSign, baseY, point.z / Math.max(0.001, regionScale.depth));
  return point;
}

function updateScalpSurface() {
  scalpSurfaceGroup.position.set(scalpSurface.x, scalpSurface.y, scalpSurface.z);
  scalpSurfaceGroup.scale.set(
    scalpSurface.radius * scalpSurface.scaleX,
    scalpSurface.radius * scalpSurface.scaleY,
    scalpSurface.radius * scalpSurface.scaleZ
  );
  updateScalpLatticeObjects();
}

function setActiveScalpRegion(region) {
  if (!SCALP_REGIONS[region]) return;
  activeScalpRegion = region;
  scalpRegionButtons.forEach((button) => {
    const active = button.dataset.scalpRegion === region;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  scalpBrushCursor.material.color.set(SCALP_REGIONS[region].color);
  updatePlacementStatus();
}

function clearScalpRegions({ saveUndo = true } = {}) {
  if (saveUndo) pushUndoState();
  if (editedScalpSurfaceMesh && scalpGuideSource !== "custom") {
    editedScalpRegions.fill("unassigned");
    writeEditedScalpRegionColors();
    return;
  }
  if (scalpGuideSource === "custom" && customScalpSurfaceMesh) {
    customScalpRegions.fill("unassigned");
    writeCustomScalpRegionColors();
    return;
  }
  scalpRegionAssignments.fill("unassigned");
  scalpManualRegionQuads = new Set(scalpRegionAssignments.keys());
  writeScalpRegionColors();
}

function scalpHitFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(activeScalpSurfaceMesh(), false)[0];
}

function updateScalpBrushCursor(hit) {
  if (!scalpPaintEditing || !hit) {
    scalpBrushCursor.visible = false;
    return;
  }
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
  const size = Number(scalpBrushSizeInput.value);
  const averageScale = (scalpSurfaceGroup.scale.x + scalpSurfaceGroup.scale.y + scalpSurfaceGroup.scale.z) / 3;
  scalpBrushCursor.position.copy(hit.point).addScaledVector(normal, 0.012);
  scalpBrushCursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  scalpBrushCursor.scale.setScalar(size * averageScale);
  scalpBrushCursor.visible = true;
}

function paintScalpAt(hit) {
  if (!hit) return;
  const center = scalpSurfaceGroup.worldToLocal(hit.point.clone());
  const radius = Number(scalpBrushSizeInput.value);
  if (hit.object === customScalpSurfaceMesh || hit.object === editedScalpSurfaceMesh) {
    const editingAuthoredScalp = hit.object === editedScalpSurfaceMesh;
    const targetMesh = editingAuthoredScalp ? editedScalpSurfaceMesh : customScalpSurfaceMesh;
    const targetRegions = editingAuthoredScalp ? editedScalpRegions : customScalpRegions;
    const position = targetMesh.geometry.getAttribute("position");
    const triangleCenter = new THREE.Vector3();
    let nearestTriangle = hit.faceIndex ?? 0;
    let nearestDistance = Infinity;
    let painted = false;
    for (let triangleIndex = 0; triangleIndex < position.count / 3; triangleIndex += 1) {
      triangleCenter.set(0, 0, 0);
      for (let corner = 0; corner < 3; corner += 1) {
        const index = triangleIndex * 3 + corner;
        triangleCenter.x += position.getX(index);
        triangleCenter.y += position.getY(index);
        triangleCenter.z += position.getZ(index);
      }
      triangleCenter.multiplyScalar(1 / 3);
      const distance = triangleCenter.distanceTo(center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTriangle = triangleIndex;
      }
      if (distance > radius) continue;
      targetRegions[triangleIndex] = activeScalpRegion;
      painted = true;
    }
    if (!painted) targetRegions[nearestTriangle] = activeScalpRegion;
    if (editingAuthoredScalp) writeEditedScalpRegionColors();
    else writeCustomScalpRegionColors();
    return;
  }
  const position = scalpSurfaceGeometry.getAttribute("position");
  const quadCenter = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const hitQuadId = scalpRenderGeometry.userData.triangleQuadIds?.[hit.faceIndex];
  let nearestQuadId = hitQuadId ?? scalpVisibleQuads[0]?.id ?? 0;
  let nearestDistance = Infinity;
  let painted = false;
  for (const quad of scalpVisibleQuads) {
    quadCenter.set(0, 0, 0);
    quad.vertices.forEach((index) => {
      vertex.fromBufferAttribute(position, index);
      quadCenter.add(vertex);
    });
    quadCenter.multiplyScalar(0.25);
    const distance = quadCenter.distanceTo(center);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestQuadId = quad.id;
    }
    if (distance > radius) continue;
    scalpRegionAssignments[quad.id] = activeScalpRegion;
    scalpManualRegionQuads.add(quad.id);
    painted = true;
  }
  if (!painted) {
    scalpRegionAssignments[nearestQuadId] = activeScalpRegion;
    scalpManualRegionQuads.add(nearestQuadId);
  }
  writeScalpRegionColors();
}

function beginScalpPaint(event, hit) {
  pushUndoState();
  scalpPaintDrag = { pointerId: event.pointerId };
  renderer.domElement.setPointerCapture?.(event.pointerId);
  paintScalpAt(hit);
  updateScalpBrushCursor(hit);
  updateInteractionLocks();
}

function updateScalpPaint(event) {
  if (!scalpPaintEditing) return;
  const hit = scalpHitFromEvent(event);
  updateScalpBrushCursor(hit);
  if (!scalpPaintDrag || scalpPaintDrag.pointerId !== event.pointerId || !hit) return;
  paintScalpAt(hit);
  event.preventDefault();
}

function endScalpPaint(event) {
  if (!scalpPaintDrag || (event?.pointerId !== undefined && scalpPaintDrag.pointerId !== event.pointerId)) return;
  if (event && renderer.domElement.hasPointerCapture?.(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
  scalpPaintDrag = null;
  updateInteractionLocks();
}

function createScalpLattice() {
  const values = [-1, 0, 1];
  for (let z = 0; z < 3; z += 1) {
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        const index = x + y * 3 + z * 9;
        const point = new THREE.Vector3(values[x], values[y], values[z]);
        const handle = new THREE.Mesh(
          new THREE.SphereGeometry(0.045, 14, 10),
          new THREE.MeshBasicMaterial({ color: 0x58f6ff, transparent: true, opacity: 0.82, depthTest: false })
        );
        handle.userData.scalpLatticeIndex = index;
        handle.renderOrder = 8;
        scalpLatticePoints.push(point);
        scalpLatticeHandles.push(handle);
        scalpLatticeGroup.add(handle);
        if (x < 2) scalpLatticeConnections.push([index, index + 1]);
        if (y < 2) scalpLatticeConnections.push([index, index + 3]);
        if (z < 2) scalpLatticeConnections.push([index, index + 9]);
      }
    }
  }
  updateScalpLatticeObjects();
}

function resetScalpLattice() {
  const values = [-1, 0, 1];
  scalpLatticePoints.forEach((point, index) => {
    const x = index % 3;
    const y = Math.floor(index / 3) % 3;
    const z = Math.floor(index / 9);
    point.set(values[x], values[y], values[z]);
  });
  applyScalpLatticeDeformation();
  updateScalpLatticeObjects();
}

function updateScalpLatticeObjects() {
  scalpSurfaceGroup.updateMatrixWorld(true);
  scalpLatticeHandles.forEach((handle, index) => {
    const shapedPoint = applyScalpArtistShape(scalpLatticePoints[index].clone());
    handle.position.copy(scalpSurfaceGroup.localToWorld(shapedPoint));
  });
  const positions = [];
  scalpLatticeConnections.forEach(([a, b]) => {
    positions.push(...scalpLatticeHandles[a].position.toArray(), ...scalpLatticeHandles[b].position.toArray());
  });
  scalpLatticeLine.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  scalpLatticeLine.geometry.computeBoundingSphere();
}

function quadraticWeights(t) {
  const inverse = 1 - t;
  return [inverse * inverse, 2 * inverse * t, t * t];
}

function applyScalpLatticeDeformation() {
  const position = scalpSurfaceGeometry.getAttribute("position");
  const deformed = new THREE.Vector3();
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const offset = vertex * 3;
    const wx = quadraticWeights(THREE.MathUtils.clamp((scalpBasePositions[offset] + 1) * 0.5, 0, 1));
    const wy = quadraticWeights(THREE.MathUtils.clamp((scalpBasePositions[offset + 1] + 1) * 0.5, 0, 1));
    const wz = quadraticWeights(THREE.MathUtils.clamp((scalpBasePositions[offset + 2] + 1) * 0.5, 0, 1));
    deformed.set(0, 0, 0);
    for (let z = 0; z < 3; z += 1) {
      for (let y = 0; y < 3; y += 1) {
        for (let x = 0; x < 3; x += 1) {
          deformed.addScaledVector(scalpLatticePoints[x + y * 3 + z * 9], wx[x] * wy[y] * wz[z]);
        }
      }
    }
    applyScalpArtistShape(deformed);
    position.setXYZ(vertex, deformed.x, deformed.y, deformed.z);
  }
  position.needsUpdate = true;
  scalpSurfaceGeometry.computeVertexNormals();
  scalpSurfaceGeometry.computeBoundingBox();
  scalpSurfaceGeometry.computeBoundingSphere();
  updateScalpRenderGeometry();
  updateScalpQuadWire();
}

function updateScalpLatticeFromHandle(handle) {
  const index = handle.userData.scalpLatticeIndex;
  const localPoint = inverseScalpArtistShape(scalpSurfaceGroup.worldToLocal(handle.position.clone()));
  const xIndex = index % 3;
  if (scalpArtistShape.mirrorX && xIndex === 1) localPoint.x = 0;
  scalpLatticePoints[index].copy(localPoint);
  if (scalpArtistShape.mirrorX && xIndex !== 1) {
    const mirrorIndex = (2 - xIndex) + Math.floor(index / 3) % 3 * 3 + Math.floor(index / 9) * 9;
    scalpLatticePoints[mirrorIndex].copy(localPoint);
    scalpLatticePoints[mirrorIndex].x *= -1;
  }
  applyScalpLatticeDeformation();
  updateScalpLatticeObjects();
}

function selectScalpLatticePoint(index) {
  selectedScalpLatticeIndex = index;
  scalpLatticeHandles.forEach((handle, handleIndex) => {
    handle.material.color.set(handleIndex === index ? 0xffc64d : 0x58f6ff);
    handle.material.opacity = handleIndex === index ? 1 : 0.64;
  });
  transformControls.detach();
  transformControls.setMode("translate");
  transformControls.setSpace("world");
  transformControls.showX = true;
  transformControls.showY = true;
  transformControls.showZ = true;
  transformControls.attach(scalpLatticeHandles[index]);
}

function beginScalpLatticeDrag(handle, event) {
  const plane = new THREE.Plane();
  const cameraDirection = camera.getWorldDirection(new THREE.Vector3());
  plane.setFromNormalAndCoplanarPoint(cameraDirection, handle.position);
  const intersection = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  if (!intersection) return;
  scalpLatticeDrag = {
    handle,
    plane,
    startIntersection: intersection,
    startPosition: handle.position.clone(),
    startX: event.clientX,
    startY: event.clientY,
    undoCaptured: false
  };
  updateInteractionLocks();
}

function updateScalpLatticeDrag(event) {
  if (!scalpLatticeDrag) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const intersection = raycaster.ray.intersectPlane(scalpLatticeDrag.plane, new THREE.Vector3());
  if (!intersection) return;
  const moved = Math.hypot(event.clientX - scalpLatticeDrag.startX, event.clientY - scalpLatticeDrag.startY);
  if (moved > 2 && !scalpLatticeDrag.undoCaptured) {
    pushUndoState();
    scalpLatticeDrag.undoCaptured = true;
  }
  scalpLatticeDrag.handle.position.copy(scalpLatticeDrag.startPosition).add(intersection.sub(scalpLatticeDrag.startIntersection));
  updateScalpLatticeFromHandle(scalpLatticeDrag.handle);
  event.preventDefault();
}

function endScalpLatticeDrag() {
  if (!scalpLatticeDrag) return;
  scalpLatticeDrag = null;
  updateInteractionLocks();
}

function setHeadReferenceTransparency(enabled) {
  guideModel?.traverse((child) => {
    if (!child.isMesh) return;
    child.material.transparent = enabled;
    child.material.opacity = enabled ? 0.76 : 1;
    child.material.depthWrite = !enabled;
    child.material.needsUpdate = true;
  });
}

function disposeScalpBuilderVisuals() {
  scalpBuilderCurveLatticeLoadToken += 1;
  if (
    transformControls.object?.userData.scalpBuilderPlane
    || transformControls.object?.userData.scalpBuilderLatticeIndex !== undefined
  ) transformControls.detach();
  while (scalpBuilderGroup.children.length) {
    const child = scalpBuilderGroup.children.pop();
    child.traverse((item) => {
      item.geometry?.dispose();
      if (Array.isArray(item.material)) item.material.forEach((material) => material.dispose());
      else item.material?.dispose();
    });
  }
  scalpBuilderPlane = null;
  scalpBuilderCurveLattice = null;
}

function updateScalpBuilderPositionReadout() {
  const step = SCALP_BUILDER_STEPS[scalpBuilderStep];
  const position = step
    ? scalpBuilderPlane?.position[step.axis] ?? scalpBuilderPlanePositions[scalpBuilderStep] ?? 0
    : 0;
  scalpBuilderPositionOutput.textContent = Number(position).toFixed(2);
}

function trianglePlaneIntersections(a, b, c, axis, planePosition) {
  const points = [];
  const epsilon = 1e-5;
  [[a, b], [b, c], [c, a]].forEach(([start, end]) => {
    const startDistance = start[axis] - planePosition;
    const endDistance = end[axis] - planePosition;
    if (Math.abs(startDistance) <= epsilon && Math.abs(endDistance) <= epsilon) return;
    let point = null;
    if (Math.abs(startDistance) <= epsilon) point = start.clone();
    else if (Math.abs(endDistance) <= epsilon) point = end.clone();
    else if (startDistance * endDistance < 0) {
      const amount = startDistance / (startDistance - endDistance);
      point = start.clone().lerp(end, amount);
    }
    if (point && !points.some((candidate) => candidate.distanceToSquared(point) < epsilon * epsilon)) {
      points.push(point);
    }
  });
  return points.slice(0, 2);
}

function headPlaneIntersectionSegments(axis, planePosition) {
  const segments = [];
  const triangle = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const intersectionMeshes = scalpBuilderHeadMeshes();
  intersectionMeshes.forEach((mesh) => {
    const geometry = mesh.geometry;
    const position = geometry?.getAttribute("position");
    if (!position) return;
    mesh.updateMatrixWorld(true);
    const index = geometry.index;
    const triangleCount = index ? index.count / 3 : position.count / 3;
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      for (let corner = 0; corner < 3; corner += 1) {
        const vertexIndex = index ? index.getX(triangleIndex * 3 + corner) : triangleIndex * 3 + corner;
        triangle[corner].fromBufferAttribute(position, vertexIndex).applyMatrix4(mesh.matrixWorld);
      }
      const intersections = trianglePlaneIntersections(
        triangle[0], triangle[1], triangle[2], axis, planePosition
      );
      if (intersections.length !== 2) continue;
      segments.push(intersections.map((point) => point.clone()));
    }
  });
  return segments;
}

function scalpBuilderHeadMeshes() {
  const availableMeshes = headMeshes().filter((mesh) => !GUIDE_BOUNDS_EXCLUDED_GROUPS.has(mesh.name));
  const namedHeadMeshes = availableMeshes.filter((mesh) => /face_retopo_geo/i.test(mesh.name));
  return namedHeadMeshes.length
    ? namedHeadMeshes
    : availableMeshes.slice().sort((a, b) => (
      (b.geometry?.getAttribute("position")?.count || 0) - (a.geometry?.getAttribute("position")?.count || 0)
    )).slice(0, 1);
}

function scalpBuilderIntersectionPositions(group, step) {
  const positions = [];
  group.updateMatrixWorld(true);
  headPlaneIntersectionSegments(step.axis, group.position[step.axis]).forEach((segment) => {
    segment.forEach((point) => {
      const local = group.worldToLocal(point.clone());
      positions.push(local.x, local.y, local.z);
    });
  });
  return positions;
}

function rebuildScalpBuilderIntersection(group, step) {
  const oldLine = group.children.find((child) => child.userData.scalpBuilderIntersection);
  oldLine?.geometry.dispose();
  oldLine?.material.dispose();
  oldLine?.removeFromParent();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(
    scalpBuilderIntersectionPositions(group, step), 3
  ));
  const line = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: step.color,
      transparent: true,
      opacity: group.userData.scalpBuilderPlane ? 0.95 : 0.2,
      depthTest: true,
      depthWrite: false
    })
  );
  line.userData.scalpBuilderIntersection = true;
  line.renderOrder = 20;
  group.add(line);
}

function createScalpBuilderPlaneVisual(position, stepIndex, active = false) {
  const step = SCALP_BUILDER_STEPS[stepIndex];
  const bounds = guideHeadBounds(guideModel);
  const center = bounds.getCenter(new THREE.Vector3());
  const group = new THREE.Group();
  group.userData.scalpBuilderCalibrationPlane = true;
  group.userData.scalpBuilderPlane = active;
  group.userData.scalpBuilderAxis = step.axis;
  group.position.copy(center);
  group.position[step.axis] = position;
  scalpBuilderGroup.add(group);
  rebuildScalpBuilderIntersection(group, step);
  return group;
}

function createScalpBuilderPlanes() {
  disposeScalpBuilderVisuals();
  if (!guideModel) return;
  const bounds = guideHeadBounds(guideModel);
  const size = bounds.getSize(new THREE.Vector3());
  for (let index = 0; index < Math.min(scalpBuilderStep, SCALP_BUILDER_STEPS.length); index += 1) {
    if (Number.isFinite(scalpBuilderPlanePositions[index])) {
      createScalpBuilderPlaneVisual(scalpBuilderPlanePositions[index], index, false);
    }
  }
  if (scalpBuilderStep < SCALP_BUILDER_STEPS.length) {
    const step = SCALP_BUILDER_STEPS[scalpBuilderStep];
    if (!Number.isFinite(scalpBuilderPlanePositions[scalpBuilderStep])) {
      const minimum = bounds.min[step.axis];
      scalpBuilderPlanePositions[scalpBuilderStep] = minimum + size[step.axis] * step.ratio;
    }
    scalpBuilderPlane = createScalpBuilderPlaneVisual(
      scalpBuilderPlanePositions[scalpBuilderStep],
      scalpBuilderStep,
      true
    );
    transformControls.attach(scalpBuilderPlane);
    transformControls.setMode("translate");
    transformControls.setSpace("world");
    transformControls.showX = false;
    transformControls.showY = step.axis === "y";
    transformControls.showZ = step.axis === "z";
  }
  updateScalpBuilderStepUi();
  updateScalpBuilderPositionReadout();
}

function updateScalpBuilderStepUi() {
  const complete = scalpBuilderStep >= SCALP_BUILDER_STEPS.length;
  generateScalpBuilderButton.classList.toggle("hidden", !complete);
  if (complete) {
    generateScalpBuilderButton.textContent = "Generate Surface Preview";
    scalpBuilderStepLabel.textContent = "Placement Planes";
    scalpBuilderStepName.textContent = "Calibration Complete";
    scalpBuilderAxisLabel.textContent = "Position";
    scalpBuilderInstruction.textContent = "All placement boundaries have been recorded. Generate the curve-based surface preview and inspect it from every angle.";
    confirmScalpBuilderButton.disabled = true;
    confirmScalpBuilderButton.textContent = "All Planes Confirmed";
    return;
  }
  const step = SCALP_BUILDER_STEPS[scalpBuilderStep];
  scalpBuilderStepLabel.textContent = `${step.phase} Plane ${step.phaseIndex} of ${step.phaseCount}`;
  scalpBuilderStepName.textContent = step.name;
  scalpBuilderInstruction.textContent = step.instruction;
  scalpBuilderAxisLabel.textContent = step.axis === "y" ? "Height" : "Depth";
  confirmScalpBuilderButton.disabled = false;
  confirmScalpBuilderButton.textContent = "Confirm Plane";
}

const SCALP_TEMPLATE_MATERIAL_REGIONS = {
  lambert2SG: "bangs",
  lambert6SG: "side-bangs-left",
  lambert3SG: "side-bangs-right",
  lambert7SG: "side-left",
  lambert4SG: "side-right",
  lambert5SG: "back",
  bangs: "bangs",
  "front-bangs": "bangs",
  "side-bangs-left": "side-bangs-left",
  "side-bangs-right": "side-bangs-right",
  "side-left": "side-left",
  "side-right": "side-right",
  back: "back"
};
let scalpTopologyTemplatePromise = null;

function parseScalpTopologyTemplate(content) {
  const vertices = [];
  const faces = [];
  let material = "";
  content.split(/\r?\n/).forEach((line) => {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "v" && parts.length >= 4) {
      vertices.push(new THREE.Vector3(Number(parts[1]), Number(parts[2]), Number(parts[3])));
    } else if (parts[0] === "usemtl") {
      material = parts.slice(1).join(" ");
    } else if (parts[0] === "f" && parts.length === 5) {
      const indices = parts.slice(1).map((token) => Number(token.split("/")[0]) - 1);
      const normalizedMaterial = material.trim().toLowerCase().replace(/[\s_]+/g, "-");
      const region = SCALP_TEMPLATE_MATERIAL_REGIONS[material]
        || SCALP_TEMPLATE_MATERIAL_REGIONS[normalizedMaterial]
        || "unassigned";
      faces.push({ indices, region });
    }
  });
  if (!vertices.length || !faces.length) throw new Error("Scalp topology template contains no usable quad mesh");
  return { vertices, faces };
}

function loadScalpTopologyTemplate() {
  if (!scalpTopologyTemplatePromise) {
    scalpTopologyTemplatePromise = fetch("./assets/scalp-topology-template.obj?v=20260720-1")
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load scalp topology template (${response.status})`);
        return response.text();
      })
      .then(parseScalpTopologyTemplate);
  }
  return scalpTopologyTemplatePromise;
}

function loadScalpBuilderCurveLatticeTemplate() {
  if (!scalpBuilderCurveLatticePromise) {
    scalpBuilderCurveLatticePromise = fetch("./assets/scalpcurvelatticeguide.obj?v=20260720-1")
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load scalp curve lattice (${response.status})`);
        return response.text();
      })
      .then(parseScalpTopologyTemplate);
  }
  return scalpBuilderCurveLatticePromise;
}

function scalpBuilderCurveLatticeWorldPoints(template) {
  const authoredMatrix = authoredScalpGuideMatrix || guideModel.matrixWorld;
  return template.vertices.map((vertex) => vertex.clone().applyMatrix4(authoredMatrix));
}

function scalpBuilderCurveLatticeEdges(faces) {
  const edges = new Map();
  faces.forEach((face) => {
    face.indices.forEach((start, corner) => {
      const end = face.indices[(corner + 1) % face.indices.length];
      const key = start < end ? `${start}:${end}` : `${end}:${start}`;
      if (!edges.has(key)) edges.set(key, { start, end, region: face.region });
    });
  });
  return [...edges.values()];
}

function subdivideScalpBuilderCage(sourcePoints, sourceFaces, iterations = 2) {
  let points = sourcePoints.map((point) => point.clone());
  let faces = sourceFaces.map((face) => ({ indices: [...face.indices], region: face.region }));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const facePoints = faces.map((face) => {
      const point = new THREE.Vector3();
      face.indices.forEach((index) => point.add(points[index]));
      return point.multiplyScalar(1 / face.indices.length);
    });
    const incidentFaces = Array.from({ length: points.length }, () => []);
    const incidentEdges = Array.from({ length: points.length }, () => []);
    const edgeMap = new Map();
    faces.forEach((face, faceIndex) => {
      face.indices.forEach((start, corner) => {
        const end = face.indices[(corner + 1) % face.indices.length];
        const key = start < end ? `${start}:${end}` : `${end}:${start}`;
        if (!edgeMap.has(key)) edgeMap.set(key, { start: Math.min(start, end), end: Math.max(start, end), faces: [] });
        edgeMap.get(key).faces.push(faceIndex);
        incidentFaces[start].push(faceIndex);
      });
    });
    const edges = [...edgeMap.values()];
    edges.forEach((edge, edgeIndex) => {
      incidentEdges[edge.start].push(edgeIndex);
      incidentEdges[edge.end].push(edgeIndex);
    });
    const vertexPoints = points.map((point, index) => {
      const boundaryNeighbors = [];
      incidentEdges[index].forEach((edgeIndex) => {
        const edge = edges[edgeIndex];
        if (edge.faces.length === 1) boundaryNeighbors.push(edge.start === index ? edge.end : edge.start);
      });
      if (boundaryNeighbors.length >= 2) {
        return point.clone().multiplyScalar(6)
          .add(points[boundaryNeighbors[0]])
          .add(points[boundaryNeighbors[boundaryNeighbors.length - 1]])
          .multiplyScalar(1 / 8);
      }
      const faceSet = [...new Set(incidentFaces[index])];
      const n = faceSet.length;
      if (!n) return point.clone();
      const faceAverage = new THREE.Vector3();
      faceSet.forEach((faceIndex) => faceAverage.add(facePoints[faceIndex]));
      faceAverage.multiplyScalar(1 / n);
      const edgeAverage = new THREE.Vector3();
      incidentEdges[index].forEach((edgeIndex) => {
        const edge = edges[edgeIndex];
        edgeAverage.add(points[edge.start]).add(points[edge.end]);
      });
      edgeAverage.multiplyScalar(1 / Math.max(1, incidentEdges[index].length * 2));
      return point.clone().multiplyScalar(n - 3)
        .addScaledVector(edgeAverage, 2)
        .add(faceAverage)
        .multiplyScalar(1 / n);
    });
    const nextPoints = [...vertexPoints];
    const edgePointIndices = new Map();
    edges.forEach((edge) => {
      const edgePoint = points[edge.start].clone().add(points[edge.end]);
      if (edge.faces.length === 2) {
        edgePoint.add(facePoints[edge.faces[0]]).add(facePoints[edge.faces[1]]).multiplyScalar(0.25);
      } else {
        edgePoint.multiplyScalar(0.5);
      }
      const key = `${edge.start}:${edge.end}`;
      edgePointIndices.set(key, nextPoints.length);
      nextPoints.push(edgePoint);
    });
    const facePointIndices = facePoints.map((point) => {
      const index = nextPoints.length;
      nextPoints.push(point);
      return index;
    });
    const nextFaces = [];
    faces.forEach((face, faceIndex) => {
      face.indices.forEach((vertexIndex, corner) => {
        const nextIndex = face.indices[(corner + 1) % face.indices.length];
        const previousIndex = face.indices[(corner + face.indices.length - 1) % face.indices.length];
        const nextKey = vertexIndex < nextIndex ? `${vertexIndex}:${nextIndex}` : `${nextIndex}:${vertexIndex}`;
        const previousKey = previousIndex < vertexIndex ? `${previousIndex}:${vertexIndex}` : `${vertexIndex}:${previousIndex}`;
        nextFaces.push({
          indices: [vertexIndex, edgePointIndices.get(nextKey), facePointIndices[faceIndex], edgePointIndices.get(previousKey)],
          region: face.region
        });
      });
    });
    points = nextPoints;
    faces = nextFaces;
  }
  return { points, faces };
}

function scalpBuilderSurfaceGeometry(points, faces, materialIndices) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap((point) => [point.x, point.y, point.z]), 3));
  const indices = [];
  const facesByRegion = new Map();
  faces.forEach((face) => {
    const region = materialIndices.has(face.region) ? face.region : "unassigned";
    if (!facesByRegion.has(region)) facesByRegion.set(region, []);
    facesByRegion.get(region).push(face);
  });
  materialIndices.forEach((materialIndex, region) => {
    const regionFaces = facesByRegion.get(region) || [];
    if (!regionFaces.length) return;
    const indexOffset = indices.length;
    regionFaces.forEach((face) => {
      indices.push(face.indices[0], face.indices[1], face.indices[2], face.indices[0], face.indices[2], face.indices[3]);
    });
    geometry.addGroup(indexOffset, regionFaces.length * 6, materialIndex);
  });
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function writeEditedScalpRegionColors() {
  if (!editedScalpSurfaceMesh) return;
  const colorAttribute = editedScalpSurfaceMesh.geometry.getAttribute("color");
  if (!colorAttribute) return;
  const color = new THREE.Color();
  editedScalpRegions.forEach((region, triangleIndex) => {
    color.set(SCALP_REGIONS[region]?.color || SCALP_REGIONS.unassigned.color);
    for (let corner = 0; corner < 3; corner += 1) {
      colorAttribute.setXYZ(triangleIndex * 3 + corner, color.r, color.g, color.b);
    }
  });
  colorAttribute.needsUpdate = true;
  editedScalpSurfaceMesh.geometry.userData.triangleRegions = editedScalpRegions;
}

function syncEditedScalpSurface(subdivided) {
  if (!subdivided?.points?.length || !subdivided?.faces?.length) return;
  scalpBuilderGroup.updateMatrixWorld(true);
  scalpSurfaceGroup.updateMatrixWorld(true);
  const inverseScalpMatrix = scalpSurfaceGroup.matrixWorld.clone().invert();
  const points = subdivided.points.map((point) => point.clone()
    .applyMatrix4(scalpBuilderGroup.matrixWorld)
    .applyMatrix4(inverseScalpMatrix));
  const sourceGeometry = new THREE.BufferGeometry();
  sourceGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points.flatMap((point) => [point.x, point.y, point.z]), 3)
  );
  sourceGeometry.setIndex(subdivided.faces.flatMap((face) => [
    face.indices[0], face.indices[1], face.indices[2],
    face.indices[0], face.indices[2], face.indices[3]
  ]));
  sourceGeometry.computeVertexNormals();
  const geometry = sourceGeometry.toNonIndexed();
  sourceGeometry.dispose();
  const defaultRegions = subdivided.faces.flatMap((face) => [face.region, face.region]);
  if (editedScalpRegions.length !== defaultRegions.length) editedScalpRegions = defaultRegions;
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute("position").count * 3), 3));
  geometry.userData.triangleRegions = editedScalpRegions;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  if (!editedScalpSurfaceMesh) {
    editedScalpSurfaceMesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x111116,
        roughness: 0.72,
        vertexColors: true,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        side: THREE.FrontSide
      })
    );
    editedScalpSurfaceMesh.renderOrder = 1;
    editedScalpSurfaceWire = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x62f3ff, transparent: true, opacity: 0.14, depthWrite: false })
    );
    editedScalpSurfaceWire.renderOrder = 2;
    editedScalpSelectionOutline = createScalpSelectionOutline(geometry);
    scalpSurfaceGroup.add(editedScalpSurfaceMesh, editedScalpSurfaceWire, editedScalpSelectionOutline);
  } else {
    const previousGeometry = editedScalpSurfaceMesh.geometry;
    editedScalpSurfaceMesh.geometry = geometry;
    editedScalpSelectionOutline.geometry = geometry;
    previousGeometry.dispose();
  }

  const wirePositions = [];
  scalpBuilderCurveLatticeEdges(subdivided.faces).forEach((edge) => {
    const start = points[edge.start];
    const end = points[edge.end];
    wirePositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
  });
  const previousWireGeometry = editedScalpSurfaceWire.geometry;
  editedScalpSurfaceWire.geometry = new THREE.BufferGeometry();
  editedScalpSurfaceWire.geometry.setAttribute("position", new THREE.Float32BufferAttribute(wirePositions, 3));
  editedScalpSurfaceWire.geometry.computeBoundingSphere();
  previousWireGeometry.dispose();
  writeEditedScalpRegionColors();
  updateScalpEditingVisibility();
}

async function ensureEditedScalpSurface() {
  if (!guideModel) return;
  const template = await loadScalpBuilderCurveLatticeTemplate();
  const defaultPoints = scalpBuilderCurveLatticeWorldPoints(template);
  const points = scalpBuilderEditedPoints?.length === defaultPoints.length
    ? scalpBuilderEditedPoints.map((point) => point.clone())
    : defaultPoints;
  const bounds = new THREE.Box3().setFromPoints(points);
  bounds.getCenter(scalpRoughScalePivot);
  const size = bounds.getSize(new THREE.Vector3());
  const displayCenter = bounds.getCenter(new THREE.Vector3());
  const displayOffset = Math.max(size.x, size.y, size.z) * 0.008;
  const subdivided = subdivideScalpBuilderCage(points, template.faces, 2);
  subdivided.points.forEach((point) => {
    const direction = point.clone().sub(displayCenter);
    if (direction.lengthSq() > 0.000001) point.addScaledVector(direction.normalize(), displayOffset);
  });
  const { x, y, z } = scalpRoughScale;
  scalpBuilderGroup.scale.set(x, y, z);
  scalpBuilderGroup.position.set(
    scalpRoughScalePivot.x * (1 - x),
    scalpRoughScalePivot.y * (1 - y),
    scalpRoughScalePivot.z * (1 - z)
  );
  syncEditedScalpSurface(subdivided);
}

function updateScalpBuilderCurveLatticeGeometry() {
  if (!scalpBuilderCurveLattice) return;
  const subdivided = subdivideScalpBuilderCage(
    scalpBuilderCurveLattice.points,
    scalpBuilderCurveLattice.template.faces,
    2
  );
  subdivided.points.forEach((point) => {
    const direction = point.clone().sub(scalpBuilderCurveLattice.displayCenter);
    if (direction.lengthSq() > 0.000001) point.addScaledVector(direction.normalize(), scalpBuilderCurveLattice.displayOffset);
  });
  scalpBuilderCurveLattice.lastSubdivided = subdivided;
  syncEditedScalpSurface(subdivided);
  const smoothEdges = scalpBuilderCurveLatticeEdges(subdivided.faces);
  const positions = [];
  const colors = [];
  const color = new THREE.Color();
  smoothEdges.forEach((edge) => {
    const start = subdivided.points[edge.start];
    const end = subdivided.points[edge.end];
    color.set(SCALP_REGIONS[edge.region]?.color || SCALP_REGIONS.unassigned.color);
    positions.push(start.x, start.y, start.z, end.x, end.y, end.z);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  });
  const geometry = scalpBuilderCurveLattice.line.geometry;
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  const surface = scalpBuilderCurveLattice.surface;
  const previousSurfaceGeometry = surface.geometry;
  surface.geometry = scalpBuilderSurfaceGeometry(
    subdivided.points,
    subdivided.faces,
    scalpBuilderCurveLattice.materialIndices
  );
  scalpBuilderCurveLattice.outline.geometry = surface.geometry;
  const symmetryPositions = [];
  const symmetryX = scalpBuilderCurveLattice.displayCenter.x;
  subdivided.faces.forEach((face) => {
    for (let corner = 1; corner < face.indices.length - 1; corner += 1) {
      const intersections = trianglePlaneIntersections(
        subdivided.points[face.indices[0]],
        subdivided.points[face.indices[corner]],
        subdivided.points[face.indices[corner + 1]],
        "x",
        symmetryX
      );
      if (intersections.length === 2) {
        symmetryPositions.push(
          intersections[0].x, intersections[0].y, intersections[0].z,
          intersections[1].x, intersections[1].y, intersections[1].z
        );
      }
    }
  });
  scalpBuilderCurveLattice.symmetryLine.geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(symmetryPositions, 3)
  );
  scalpBuilderCurveLattice.symmetryLine.geometry.computeBoundingSphere();
  scalpBuilderCurveLattice.symmetryLine.visible = scalpBuilderEditing && mirrorXEditing;
  scalpBuilderGroup.updateMatrixWorld(true);
  const symmetryWorldX = scalpBuilderGroup.localToWorld(
    new THREE.Vector3(symmetryX, scalpBuilderCurveLattice.displayCenter.y, scalpBuilderCurveLattice.displayCenter.z)
  ).x;
  const headSymmetryPositions = [];
  headPlaneIntersectionSegments("x", symmetryWorldX).forEach((segment) => {
    segment.forEach((point) => {
      const local = scalpBuilderGroup.worldToLocal(point.clone());
      headSymmetryPositions.push(local.x, local.y, local.z);
    });
  });
  scalpBuilderCurveLattice.headSymmetryLine.geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(headSymmetryPositions, 3)
  );
  scalpBuilderCurveLattice.headSymmetryLine.geometry.computeBoundingSphere();
  scalpBuilderCurveLattice.headSymmetryLine.visible = scalpBuilderEditing && mirrorXEditing;
  previousSurfaceGeometry.dispose();
}

function scalpBuilderLatticeNeighbors() {
  if (!scalpBuilderCurveLattice) return [];
  const neighbors = Array.from({ length: scalpBuilderCurveLattice.points.length }, () => new Set());
  scalpBuilderCurveLattice.template.faces.forEach((face) => {
    face.indices.forEach((index, corner) => {
      const next = face.indices[(corner + 1) % face.indices.length];
      neighbors[index].add(next);
      neighbors[next].add(index);
    });
  });
  return neighbors;
}

function scalpBuilderLatticeDistances(originIndex) {
  const neighbors = scalpBuilderLatticeNeighbors();
  const distances = new Array(neighbors.length).fill(Infinity);
  distances[originIndex] = 0;
  const queue = [originIndex];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    neighbors[index].forEach((neighbor) => {
      if (distances[neighbor] !== Infinity) return;
      distances[neighbor] = distances[index] + 1;
      queue.push(neighbor);
    });
  }
  return distances;
}

function scalpBuilderProportionalWeight(distance) {
  const radius = Number(proportionalRadiusInput?.value || 2.5);
  if (!proportionalEditing) return distance === 0 ? 1 : 0;
  if (distance > radius) return 0;
  if (distance === 0) return 1;
  const linear = THREE.MathUtils.clamp(1 - distance / Math.max(0.001, radius), 0, 1);
  const smooth = linear * linear * (3 - 2 * linear);
  return THREE.MathUtils.lerp(1, smooth, Number(proportionalFalloffInput?.value || 0.65));
}

function scalpBuilderMirrorMap(points) {
  const bounds = new THREE.Box3().setFromPoints(points);
  const centerX = bounds.getCenter(new THREE.Vector3()).x;
  return points.map((point, index) => {
    const target = new THREE.Vector3(2 * centerX - point.x, point.y, point.z);
    let closestIndex = index;
    let closestDistance = Infinity;
    points.forEach((candidate, candidateIndex) => {
      const distance = candidate.distanceToSquared(target);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = candidateIndex;
      }
    });
    return closestIndex;
  });
}

function beginScalpBuilderCurveLatticeEdit(handle) {
  if (!scalpBuilderCurveLattice) return;
  const selectedIndex = handle.userData.scalpBuilderLatticeIndex;
  const startPoints = scalpBuilderCurveLattice.points.map((point) => point.clone());
  activeScalpBuilderCurveLatticeEdit = {
    selectedIndex,
    startPoints,
    distances: scalpBuilderLatticeDistances(selectedIndex),
    mirrorMap: scalpBuilderMirrorMap(startPoints),
    centerX: new THREE.Box3().setFromPoints(startPoints).getCenter(new THREE.Vector3()).x
  };
}

function commitScalpBuilderCurveLatticeEdit() {
  if (scalpBuilderCurveLattice) {
    scalpBuilderEditedPoints = scalpBuilderCurveLattice.points.map((point) => point.clone());
  }
  activeScalpBuilderCurveLatticeEdit = null;
}

function updateScalpBuilderHandleColors() {
  if (!scalpBuilderCurveLattice) return;
  const selectedIndex = scalpBuilderCurveLattice.selectedIndex;
  const distances = selectedIndex == null ? [] : scalpBuilderLatticeDistances(selectedIndex);
  const mirrorMap = selectedIndex == null ? [] : scalpBuilderMirrorMap(scalpBuilderCurveLattice.points);
  const mirroredIndex = selectedIndex == null ? null : mirrorMap[selectedIndex];
  scalpBuilderCurveLattice.handles.forEach((handle, index) => {
    if (index === selectedIndex) {
      handle.material.color.set(0xff4fd8);
      handle.material.opacity = 1;
      return;
    }
    const weight = selectedIndex == null ? 0 : scalpBuilderProportionalWeight(distances[index]);
    const mirrored = mirrorXEditing && index === mirroredIndex;
    handle.material.color.set(mirrored || weight > 0 ? 0xffd65a : 0x58f6ff);
    handle.material.opacity = mirrored ? 0.9 : weight > 0 ? THREE.MathUtils.lerp(0.42, 0.82, weight) : 0.42;
  });
}

function selectScalpBuilderCurveLatticePoint(index) {
  if (!scalpBuilderCurveLattice) return;
  scalpBuilderCurveLattice.selectedIndex = index;
  updateScalpBuilderHandleColors();
  const handle = scalpBuilderCurveLattice.handles[index];
  if (!handle) return;
  transformControls.attach(handle);
  transformControls.setMode("translate");
  transformControls.setSpace("world");
  transformControls.showX = true;
  transformControls.showY = true;
  transformControls.showZ = true;
}

function updateScalpBuilderCurveLatticeFromHandle(handle) {
  if (!scalpBuilderCurveLattice) return;
  const index = handle.userData.scalpBuilderLatticeIndex;
  if (!scalpBuilderCurveLattice.points[index]) return;
  if (!activeScalpBuilderCurveLatticeEdit || activeScalpBuilderCurveLatticeEdit.selectedIndex !== index) {
    scalpBuilderCurveLattice.points[index].copy(handle.position);
    scalpBuilderEditedPoints = scalpBuilderCurveLattice.points.map((point) => point.clone());
    updateScalpBuilderCurveLatticeGeometry();
    return;
  }
  const edit = activeScalpBuilderCurveLatticeEdit;
  const delta = handle.position.clone().sub(edit.startPoints[index]);
  const selectedSide = Math.sign(edit.startPoints[index].x - edit.centerX);
  edit.startPoints.forEach((startPoint, pointIndex) => {
    const pointSide = Math.sign(startPoint.x - edit.centerX);
    if (mirrorXEditing && selectedSide !== 0 && pointSide !== selectedSide) return;
    const weight = scalpBuilderProportionalWeight(edit.distances[pointIndex]);
    scalpBuilderCurveLattice.points[pointIndex].copy(startPoint).addScaledVector(delta, weight);
  });
  if (mirrorXEditing) {
    edit.startPoints.forEach((startPoint, pointIndex) => {
      const pointSide = Math.sign(startPoint.x - edit.centerX);
      if (selectedSide !== 0 && pointSide !== selectedSide) return;
      const mirrorIndex = edit.mirrorMap[pointIndex];
      if (mirrorIndex === pointIndex) {
        scalpBuilderCurveLattice.points[pointIndex].x = edit.centerX;
        return;
      }
      const sourceDelta = scalpBuilderCurveLattice.points[pointIndex].clone().sub(startPoint);
      scalpBuilderCurveLattice.points[mirrorIndex].copy(edit.startPoints[mirrorIndex]);
      scalpBuilderCurveLattice.points[mirrorIndex].add(new THREE.Vector3(-sourceDelta.x, sourceDelta.y, sourceDelta.z));
    });
  }
  scalpBuilderCurveLattice.points.forEach((point, pointIndex) => {
    scalpBuilderCurveLattice.handles[pointIndex].position.copy(point);
  });
  scalpBuilderEditedPoints = scalpBuilderCurveLattice.points.map((point) => point.clone());
  updateScalpBuilderHandleColors();
  updateScalpBuilderCurveLatticeGeometry();
}

function beginScalpBuilderCurveLatticeSelection() {
  if (!scalpBuilderCurveLattice) return false;
  const headHit = guideModel ? raycaster.intersectObject(guideModel, true)[0] : null;
  const hit = raycaster.intersectObjects(scalpBuilderCurveLattice.handles, false)
    .find((candidate) => !headHit || candidate.distance <= headHit.distance + scalpBuilderCurveLattice.handleRadius * 0.75);
  if (!hit) {
    if (transformControls.object?.userData.scalpBuilderLatticeIndex !== undefined) transformControls.detach();
    scalpBuilderCurveLattice.selectedIndex = null;
    updateScalpBuilderHandleColors();
    return false;
  }
  selectScalpBuilderCurveLatticePoint(hit.object.userData.scalpBuilderLatticeIndex);
  return true;
}

async function createScalpBuilderCurveLattice() {
  disposeScalpBuilderVisuals();
  if (!guideModel || !(scalpBuilderEditing || headSetupEditing)) return;
  const loadToken = scalpBuilderCurveLatticeLoadToken;
  scalpBuilderStepLabel.textContent = "Curve Lattice";
  scalpBuilderStepName.textContent = "Loading Scalp Guide";
  scalpBuilderAxisLabel.textContent = "Move";
  scalpBuilderInstruction.textContent = "Loading the authored scalp curve lattice...";
  confirmScalpBuilderButton.classList.add("hidden");
  generateScalpBuilderButton.classList.add("hidden");
  try {
    const template = await loadScalpBuilderCurveLatticeTemplate();
    if (!(scalpBuilderEditing || headSetupEditing) || loadToken !== scalpBuilderCurveLatticeLoadToken) return;
    const defaultPoints = scalpBuilderCurveLatticeWorldPoints(template);
    const points = scalpBuilderEditedPoints?.length === defaultPoints.length
      ? scalpBuilderEditedPoints.map((point) => point.clone())
      : defaultPoints;
    const edges = scalpBuilderCurveLatticeEdges(template.faces);
    const line = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.82,
        depthTest: true,
        depthWrite: false
      })
    );
    line.renderOrder = 15;
    const materialRegions = ["bangs", "side-bangs-left", "side-bangs-right", "side-left", "side-right", "back", "unassigned"];
    const materialIndices = new Map(materialRegions.map((region, index) => [region, index]));
    const surfaceMaterials = materialRegions.map((region) => new THREE.MeshStandardMaterial({
      color: SCALP_REGIONS[region]?.color || SCALP_REGIONS.unassigned.color,
      transparent: true,
      opacity: 0.28,
      roughness: 0.88,
      metalness: 0,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    }));
    const surface = new THREE.Mesh(new THREE.BufferGeometry(), surfaceMaterials);
    surface.renderOrder = 14;
    const latticeBounds = new THREE.Box3().setFromPoints(points);
    latticeBounds.getCenter(scalpRoughScalePivot);
    const latticeSize = latticeBounds.getSize(new THREE.Vector3());
    const latticeSpan = Math.max(latticeSize.x, latticeSize.y, latticeSize.z);
    const handleRadius = latticeSpan * 0.008;
    const handleGeometry = new THREE.SphereGeometry(handleRadius, 10, 8);
    const handles = points.map((point, index) => {
      const handle = new THREE.Mesh(
        handleGeometry,
        new THREE.MeshBasicMaterial({
          color: 0x58f6ff,
          transparent: true,
          opacity: 0.42,
          depthTest: true,
          depthWrite: false
        })
      );
      handle.position.copy(point);
      handle.renderOrder = 16;
      handle.userData.scalpBuilderLatticeIndex = index;
      handle.visible = scalpBuilderEditing;
      scalpBuilderGroup.add(handle);
      return handle;
    });
    const outline = createScalpSelectionOutline(new THREE.BufferGeometry());
    outline.visible = headSetupEditing;
    const symmetryLine = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xff4fd8,
        transparent: true,
        opacity: 0.9,
        depthTest: true,
        depthWrite: false
      })
    );
    symmetryLine.renderOrder = 20;
    symmetryLine.visible = scalpBuilderEditing && mirrorXEditing;
    const headSymmetryLine = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xff4fd8,
        transparent: true,
        opacity: 0.9,
        depthTest: true,
        depthWrite: false
      })
    );
    headSymmetryLine.renderOrder = 21;
    headSymmetryLine.visible = scalpBuilderEditing && mirrorXEditing;
    scalpBuilderCurveLattice = {
      template,
      points,
      edges,
      line,
      surface,
      outline,
      symmetryLine,
      headSymmetryLine,
      materialIndices,
      handles,
      selectedIndex: null,
      handleRadius,
      displayCenter: latticeBounds.getCenter(new THREE.Vector3()),
      displayOffset: latticeSpan * 0.008
    };
    scalpBuilderGroup.add(surface);
    scalpBuilderGroup.add(line);
    scalpBuilderGroup.add(outline);
    scalpBuilderGroup.add(symmetryLine);
    scalpBuilderGroup.add(headSymmetryLine);
    applyScalpRoughScale();
    updateScalpBuilderCurveLatticeGeometry();
    scalpBuilderStepLabel.textContent = "Curve Lattice";
    scalpBuilderStepName.textContent = "Scalp Curve Guide";
    scalpBuilderAxisLabel.textContent = "Move";
    scalpBuilderInstruction.textContent = "Select a cyan control point and use the gizmo to shape the region-colored scalp curves. Hold Alt and drag to orbit.";
    updatePlacementStatus();
  } catch (error) {
    console.error("Could not create scalp builder curve lattice", error);
    scalpBuilderStepName.textContent = "Curve Lattice Unavailable";
    scalpBuilderInstruction.textContent = "The authored scalp curve guide could not be loaded.";
  }
}

function clearScalpBuilderTemplateOverlay() {
  while (scalpBuilderTemplateOverlay.children.length) {
    const child = scalpBuilderTemplateOverlay.children.pop();
    child.geometry?.dispose();
    child.material?.dispose();
  }
}

function scalpTemplateNeighbors(vertexCount, faces) {
  const neighbors = Array.from({ length: vertexCount }, () => new Set());
  faces.forEach((face) => {
    face.indices.forEach((index, corner) => {
      const next = face.indices[(corner + 1) % face.indices.length];
      neighbors[index].add(next);
      neighbors[next].add(index);
    });
  });
  return neighbors;
}

function smoothScalpVectorField(values, neighbors, iterations = 2, strength = 0.42) {
  let current = values.map((value) => value.clone());
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    current = current.map((value, index) => {
      if (!neighbors[index].size) return value.clone();
      const average = new THREE.Vector3();
      neighbors[index].forEach((neighbor) => average.add(current[neighbor]));
      average.multiplyScalar(1 / neighbors[index].size);
      return value.clone().lerp(average, strength);
    });
  }
  return current;
}

function templatePlaneIntersectionSegments(template, axis, planePosition) {
  const segments = [];
  template.faces.forEach((face) => {
    [[0, 1, 2], [0, 2, 3]].forEach((corners) => {
      const intersections = trianglePlaneIntersections(
        template.vertices[face.indices[corners[0]]],
        template.vertices[face.indices[corners[1]]],
        template.vertices[face.indices[corners[2]]],
        axis,
        planePosition
      );
      if (intersections.length === 2) segments.push(intersections);
    });
  });
  return segments;
}

function upperContourCurve(segments, axis, planePosition, sampleCount = 17) {
  const endpoints = segments.flat();
  if (!endpoints.length) return null;
  const minX = Math.min(...endpoints.map((point) => point.x));
  const maxX = Math.max(...endpoints.map((point) => point.x));
  const span = Math.max(0.0001, maxX - minX);
  const points = [];
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const x = THREE.MathUtils.lerp(minX, maxX, sample / (sampleCount - 1));
    const candidates = [];
    segments.forEach(([start, end]) => {
      const minimum = Math.min(start.x, end.x) - span * 0.0001;
      const maximum = Math.max(start.x, end.x) + span * 0.0001;
      if (x < minimum || x > maximum) return;
      const delta = end.x - start.x;
      if (Math.abs(delta) < 0.00001) {
        candidates.push(start.y, end.y);
        return;
      }
      const amount = THREE.MathUtils.clamp((x - start.x) / delta, 0, 1);
      candidates.push(THREE.MathUtils.lerp(start.y, end.y, amount));
    });
    if (!candidates.length) {
      const nearest = endpoints.reduce((best, point) => (
        Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best
      ), endpoints[0]);
      candidates.push(nearest.y);
    }
    const point = new THREE.Vector3(x, Math.max(...candidates), 0);
    point[axis] = planePosition;
    points.push(point);
  }
  return { position: planePosition, points };
}

function hermitePoint(start, end, previous, next, amount, segmentSpan, previousSpan, nextSpan) {
  const startTangent = end.clone().sub(previous).multiplyScalar(segmentSpan / Math.max(0.0001, previousSpan));
  const endTangent = next.clone().sub(start).multiplyScalar(segmentSpan / Math.max(0.0001, nextSpan));
  const t2 = amount * amount;
  const t3 = t2 * amount;
  return start.clone().multiplyScalar(2 * t3 - 3 * t2 + 1)
    .add(startTangent.multiplyScalar(t3 - 2 * t2 + amount))
    .add(end.clone().multiplyScalar(-2 * t3 + 3 * t2))
    .add(endTangent.multiplyScalar(t3 - t2));
}

function curveNetworkSection(curves, position) {
  const ordered = curves.slice().sort((a, b) => a.position - b.position);
  if (position <= ordered[0].position) return ordered[0].points.map((point) => point.clone());
  if (position >= ordered.at(-1).position) return ordered.at(-1).points.map((point) => point.clone());
  let upperIndex = ordered.findIndex((curve) => curve.position >= position);
  upperIndex = Math.max(1, upperIndex);
  const lowerIndex = upperIndex - 1;
  const lower = ordered[lowerIndex];
  const upper = ordered[upperIndex];
  const previous = ordered[Math.max(0, lowerIndex - 1)];
  const next = ordered[Math.min(ordered.length - 1, upperIndex + 1)];
  const span = Math.max(0.0001, upper.position - lower.position);
  const amount = THREE.MathUtils.clamp((position - lower.position) / span, 0, 1);
  return lower.points.map((point, index) => {
    const result = hermitePoint(
      point,
      upper.points[index],
      previous.points[index],
      next.points[index],
      amount,
      span,
      Math.max(0.0001, upper.position - previous.position),
      Math.max(0.0001, next.position - lower.position)
    );
    result.z = position;
    return result;
  });
}

function pointAlongSection(section, amount) {
  const scaled = THREE.MathUtils.clamp(amount, 0, 1) * (section.length - 1);
  const index = Math.min(section.length - 2, Math.floor(scaled));
  return section[index].clone().lerp(section[index + 1], scaled - index);
}

function longestStitchedContour(segments) {
  if (!segments.length) return [];
  const endpoints = segments.flat();
  const bounds = new THREE.Box3().setFromPoints(endpoints);
  const size = bounds.getSize(new THREE.Vector3());
  const tolerance = Math.max(size.x, size.y, size.z) * 0.00025 || 0.0001;
  const nodes = new Map();
  const edges = [];
  const nodeForPoint = (point) => {
    const key = `${Math.round(point.x / tolerance)},${Math.round(point.y / tolerance)},${Math.round(point.z / tolerance)}`;
    if (!nodes.has(key)) nodes.set(key, { point: point.clone(), neighbors: new Set() });
    return key;
  };
  segments.forEach(([start, end]) => {
    const startKey = nodeForPoint(start);
    const endKey = nodeForPoint(end);
    if (startKey === endKey) return;
    nodes.get(startKey).neighbors.add(endKey);
    nodes.get(endKey).neighbors.add(startKey);
    edges.push([startKey, endKey]);
  });
  const visitedNodes = new Set();
  const components = [];
  nodes.forEach((node, key) => {
    if (visitedNodes.has(key)) return;
    const stack = [key];
    const component = [];
    visitedNodes.add(key);
    while (stack.length) {
      const current = stack.pop();
      component.push(current);
      nodes.get(current).neighbors.forEach((neighbor) => {
        if (visitedNodes.has(neighbor)) return;
        visitedNodes.add(neighbor);
        stack.push(neighbor);
      });
    }
    components.push(component);
  });
  const component = components.sort((a, b) => b.length - a.length)[0] || [];
  const componentSet = new Set(component);
  const start = component.find((key) => [...nodes.get(key).neighbors].filter((item) => componentSet.has(item)).length === 1)
    || component[0];
  const ordered = [];
  const usedEdges = new Set();
  let previous = null;
  let current = start;
  while (current) {
    ordered.push(nodes.get(current).point.clone());
    const candidates = [...nodes.get(current).neighbors].filter((neighbor) => {
      if (!componentSet.has(neighbor) || neighbor === previous) return false;
      const edgeKey = [current, neighbor].sort().join("|");
      return !usedEdges.has(edgeKey);
    });
    if (!candidates.length) break;
    const next = candidates[0];
    usedEdges.add([current, next].sort().join("|"));
    previous = current;
    current = next;
    if (current === start) break;
    if (ordered.length > edges.length + 2) break;
  }
  return ordered;
}

function constructionCurveFromSegments(segments, step, planePosition) {
  if (step.axis === "z") {
    return upperContourCurve(segments, "z", planePosition, 33)?.points || [];
  }
  const contour = longestStitchedContour(segments);
  if (contour.length < 3) return contour;
  const curve = new THREE.CatmullRomCurve3(contour, true, "centripetal");
  return curve.getSpacedPoints(95).slice(0, -1);
}

function displayScalpBuilderConstructionCurves() {
  if (!guideModel || scalpBuilderPlanePositions.some((value) => !Number.isFinite(value))) return;
  const bounds = guideHeadBounds(guideModel);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const clearance = Math.max(size.x, size.y, size.z) * 0.015;
  const orderedRange = (a, b) => [Math.min(a, b), Math.max(a, b)];
  const curveRanges = [
    { axis: "z", min: scalpBuilderPlanePositions[5], max: bounds.max.z },
    { axis: "z", ...(() => {
      const [min, max] = orderedRange(scalpBuilderPlanePositions[8], scalpBuilderPlanePositions[6]);
      return { min, max };
    })() },
    { axis: "z", ...(() => {
      const [min, max] = orderedRange(scalpBuilderPlanePositions[9], scalpBuilderPlanePositions[7]);
      return { min, max };
    })() },
    { axis: "z", ...(() => {
      const [min, max] = orderedRange(scalpBuilderPlanePositions[9], scalpBuilderPlanePositions[7]);
      return { min, max };
    })() },
    { axis: "z", min: bounds.min.z, max: scalpBuilderPlanePositions[10] },
    { axis: "y", min: scalpBuilderPlanePositions[0], max: bounds.max.y },
    { axis: "y", min: scalpBuilderPlanePositions[1], max: bounds.max.y },
    { axis: "y", min: scalpBuilderPlanePositions[1], max: bounds.max.y },
    { axis: "y", min: scalpBuilderPlanePositions[1], max: bounds.max.y },
    { axis: "y", min: scalpBuilderPlanePositions[3], max: bounds.max.y },
    { axis: "y", min: scalpBuilderPlanePositions[4], max: bounds.max.y }
  ];
  const clipSegment = (segment, range) => {
    const start = segment[0];
    const end = segment[1];
    const delta = end[range.axis] - start[range.axis];
    let startT = 0;
    let endT = 1;
    if (Math.abs(delta) < 0.000001) {
      return start[range.axis] >= range.min && start[range.axis] <= range.max ? segment : null;
    }
    const minT = (range.min - start[range.axis]) / delta;
    const maxT = (range.max - start[range.axis]) / delta;
    startT = Math.max(startT, Math.min(minT, maxT));
    endT = Math.min(endT, Math.max(minT, maxT));
    if (startT > endT) return null;
    return [start.clone().lerp(end, startT), start.clone().lerp(end, endT)];
  };
  const clippedCurves = SCALP_BUILDER_STEPS.map((step, index) => {
    const sourceSegments = scalpBuilderContours[index]
      || headPlaneIntersectionSegments(step.axis, scalpBuilderPlanePositions[index]);
    return sourceSegments
      .map((segment) => clipSegment(segment, curveRanges[index]))
      .filter(Boolean);
  });
  const liftedPoint = (point, normal = null) => {
    const direction = normal?.clone() || point.clone().sub(center);
    if (direction.lengthSq() < 0.000001) return point.clone();
    return point.clone().addScaledVector(direction.normalize(), clearance);
  };
  const boundaryCorner = (segments, axis, boundary, sideSign) => {
    const candidates = segments.flat().filter((point) => (
      (sideSign < 0 ? point.x <= center.x : point.x >= center.x)
    ));
    return candidates.sort((a, b) => (
      Math.abs(a[axis] - boundary) - Math.abs(b[axis] - boundary)
      || Math.abs(b.x - center.x) - Math.abs(a.x - center.x)
    ))[0]?.clone() || null;
  };
  const surfaceCurveBetween = (start, end) => {
    const meshes = scalpBuilderHeadMeshes();
    const surfaceRaycaster = new THREE.Raycaster();
    const points = [];
    const sampleCount = 28;
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const t = sampleIndex / (sampleCount - 1);
      const target = start.clone().lerp(end, t);
      const direction = target.clone().sub(center);
      if (direction.lengthSq() < 0.000001) continue;
      direction.normalize();
      surfaceRaycaster.set(center, direction);
      const hit = surfaceRaycaster.intersectObjects(meshes, false)[0];
      if (!hit) {
        points.push(liftedPoint(target));
        continue;
      }
      const normal = hit.face?.normal?.clone();
      if (normal && hit.object) normal.transformDirection(hit.object.matrixWorld);
      points.push(liftedPoint(hit.point, normal));
    }
    return points;
  };
  const addSurfaceConnector = (start, end, color) => {
    if (!start || !end) return;
    const points = surfaceCurveBetween(start, end);
    if (points.length < 2) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.98,
      depthTest: true,
      depthWrite: false
    }));
    line.userData.scalpBuilderConstructionCurve = true;
    line.renderOrder = 23;
    scalpBuilderGroup.add(line);
  };
  disposeScalpBuilderVisuals();
  scalpBuilderTemplateOverlay.visible = false;
  SCALP_BUILDER_STEPS.forEach((step, index) => {
    const segments = clippedCurves[index];
    const positions = [];
    segments.forEach((segment) => segment.forEach((point) => {
      const lifted = liftedPoint(point);
      positions.push(lifted.x, lifted.y, lifted.z);
    }));
    if (positions.length < 6) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      color: step.color,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
      depthWrite: false
    }));
    line.userData.scalpBuilderConstructionCurve = true;
    line.renderOrder = 22;
    scalpBuilderGroup.add(line);
  });
  [-1, 1].forEach((sideSign) => {
    const foreheadCorner = boundaryCorner(
      clippedCurves[0],
      "z",
      scalpBuilderPlanePositions[5],
      sideSign
    );
    const sideburnCorner = boundaryCorner(
      clippedCurves[1],
      "z",
      scalpBuilderPlanePositions[6],
      sideSign
    );
    addSurfaceConnector(foreheadCorner, sideburnCorner, SCALP_REGIONS["side-bangs-right"].color);

    const sideHairTopCorner = boundaryCorner(
      clippedCurves[2],
      "z",
      scalpBuilderPlanePositions[7],
      sideSign
    );
    const sideHairBottomCorner = boundaryCorner(
      clippedCurves[3],
      "z",
      scalpBuilderPlanePositions[7],
      sideSign
    );
    addSurfaceConnector(sideHairTopCorner, sideHairBottomCorner, SCALP_REGIONS["side-right"].color);
  });
  const sideContourAtDepth = (depth, bottom, sideSign, sampleCount = 18) => {
    const segments = headPlaneIntersectionSegments("z", depth);
    const endpoints = segments.flat();
    if (!endpoints.length) return [];
    const top = Math.max(...endpoints.map((point) => point.y));
    const floor = Math.min(top - 0.0001, bottom);
    const span = Math.max(0.0001, top - floor);
    const points = [];
    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
      const amount = sampleIndex / (sampleCount - 1);
      const y = THREE.MathUtils.lerp(top, floor, amount);
      const candidates = [];
      segments.forEach(([start, end]) => {
        const minimum = Math.min(start.y, end.y) - span * 0.0001;
        const maximum = Math.max(start.y, end.y) + span * 0.0001;
        if (y < minimum || y > maximum) return;
        const delta = end.y - start.y;
        if (Math.abs(delta) < 0.00001) {
          candidates.push(start.x, end.x);
          return;
        }
        const segmentAmount = THREE.MathUtils.clamp((y - start.y) / delta, 0, 1);
        candidates.push(THREE.MathUtils.lerp(start.x, end.x, segmentAmount));
      });
      const sideCandidates = candidates.filter((x) => sideSign < 0 ? x <= center.x : x >= center.x);
      const x = sampleIndex === 0
        ? center.x - sideSign * size.x * 0.025
        : sideCandidates.length
          ? (sideSign < 0 ? Math.min(...sideCandidates) : Math.max(...sideCandidates))
          : center.x;
      points.push(liftedPoint(new THREE.Vector3(x, y, depth)));
    }
    return points;
  };
  const addSurfacePatch = ({ startDepth, endDepth, startBottom, endBottom, region, sideSign }) => {
    const depthSamples = 14;
    const sideSamples = 18;
    const points = [];
    for (let depthIndex = 0; depthIndex < depthSamples; depthIndex += 1) {
      const amount = depthIndex / (depthSamples - 1);
      const depth = THREE.MathUtils.lerp(startDepth, endDepth, amount);
      const bottom = THREE.MathUtils.lerp(startBottom, endBottom, amount);
      const contour = sideContourAtDepth(depth, bottom, sideSign, sideSamples);
      if (contour.length !== sideSamples) return;
      points.push(...contour);
    }
    const positions = points.flatMap((point) => [point.x, point.y, point.z]);
    const indices = [];
    const wirePositions = [];
    for (let depthIndex = 0; depthIndex < depthSamples - 1; depthIndex += 1) {
      for (let sideIndex = 0; sideIndex < sideSamples - 1; sideIndex += 1) {
        const a = depthIndex * sideSamples + sideIndex;
        const b = a + 1;
        const c = (depthIndex + 1) * sideSamples + sideIndex + 1;
        const d = c - 1;
        indices.push(a, b, c, a, c, d);
      }
    }
    for (let depthIndex = 0; depthIndex < depthSamples; depthIndex += 1) {
      for (let sideIndex = 0; sideIndex < sideSamples - 1; sideIndex += 1) {
        const start = points[depthIndex * sideSamples + sideIndex];
        const end = points[depthIndex * sideSamples + sideIndex + 1];
        wirePositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
      }
    }
    for (let sideIndex = 0; sideIndex < sideSamples; sideIndex += 1) {
      for (let depthIndex = 0; depthIndex < depthSamples - 1; depthIndex += 1) {
        const start = points[depthIndex * sideSamples + sideIndex];
        const end = points[(depthIndex + 1) * sideSamples + sideIndex];
        wirePositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
      }
    }
    const color = SCALP_REGIONS[region]?.color || SCALP_REGIONS.unassigned.color;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const surface = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide
    }));
    surface.userData.scalpBuilderConstructionSurface = true;
    surface.renderOrder = 18;
    const wireGeometry = new THREE.BufferGeometry();
    wireGeometry.setAttribute("position", new THREE.Float32BufferAttribute(wirePositions, 3));
    const wire = new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.24,
      depthTest: true,
      depthWrite: false
    }));
    wire.userData.scalpBuilderConstructionSurface = true;
    wire.renderOrder = 19;
    scalpBuilderGroup.add(surface, wire);
  };
  const depthInset = size.z * 0.002;
  const frontHairlinePoints = clippedCurves[0].flat();
  const backHairlinePoints = clippedCurves[4].flat();
  const frontDepth = Math.max(...frontHairlinePoints.map((point) => point.z)) - depthInset;
  const backDepth = Math.min(...backHairlinePoints.map((point) => point.z)) + depthInset;
  const surfaceBands = [
    { startDepth: frontDepth, endDepth: scalpBuilderPlanePositions[5], startBottom: scalpBuilderPlanePositions[0], endBottom: scalpBuilderPlanePositions[0], region: "bangs" },
    { startDepth: scalpBuilderPlanePositions[5], endDepth: scalpBuilderPlanePositions[6], startBottom: scalpBuilderPlanePositions[0], endBottom: scalpBuilderPlanePositions[1], region: "side-bangs" },
    { startDepth: scalpBuilderPlanePositions[6], endDepth: scalpBuilderPlanePositions[7], startBottom: scalpBuilderPlanePositions[1], endBottom: scalpBuilderPlanePositions[1], region: "side-bangs" },
    { startDepth: scalpBuilderPlanePositions[7], endDepth: scalpBuilderPlanePositions[8], startBottom: scalpBuilderPlanePositions[1], endBottom: scalpBuilderPlanePositions[1], region: "side-bangs" },
    { startDepth: scalpBuilderPlanePositions[8], endDepth: scalpBuilderPlanePositions[9], startBottom: scalpBuilderPlanePositions[3], endBottom: scalpBuilderPlanePositions[3], region: "side" },
    { startDepth: scalpBuilderPlanePositions[9], endDepth: scalpBuilderPlanePositions[10], startBottom: scalpBuilderPlanePositions[3], endBottom: scalpBuilderPlanePositions[4], region: "side" },
    { startDepth: scalpBuilderPlanePositions[10], endDepth: backDepth, startBottom: scalpBuilderPlanePositions[4], endBottom: scalpBuilderPlanePositions[4], region: "back" }
  ];
  const addCenterBridgePatch = (band) => {
    const depthSamples = 14;
    const widthSamples = 5;
    const bridgeContourIndex = 10;
    const bridgeMeshes = scalpBuilderHeadMeshes();
    const bridgeRaycaster = new THREE.Raycaster();
    const bridgeRayDistance = Math.max(size.x, size.y, size.z) * 1.8;
    const bridgeRows = [];
    for (let depthIndex = 0; depthIndex < depthSamples; depthIndex += 1) {
      const amount = depthIndex / (depthSamples - 1);
      const depth = THREE.MathUtils.lerp(band.startDepth, band.endDepth, amount);
      const bottom = THREE.MathUtils.lerp(band.startBottom, band.endBottom, amount);
      const left = sideContourAtDepth(depth, bottom, -1, 18);
      const right = sideContourAtDepth(depth, bottom, 1, 18);
      if (left.length <= bridgeContourIndex || right.length <= bridgeContourIndex) continue;
      const row = [];
      for (let widthIndex = 0; widthIndex < widthSamples; widthIndex += 1) {
        const target = left[bridgeContourIndex].clone().lerp(
          right[bridgeContourIndex],
          widthIndex / (widthSamples - 1)
        );
        const direction = target.clone().sub(center);
        if (direction.lengthSq() < 0.000001) {
          row.push(target);
          continue;
        }
        direction.normalize();
        bridgeRaycaster.set(
          center.clone().addScaledVector(direction, bridgeRayDistance),
          direction.clone().negate()
        );
        const hit = bridgeRaycaster.intersectObjects(bridgeMeshes, false)[0];
        if (!hit) {
          row.push(target);
          continue;
        }
        const normal = hit.face?.normal?.clone();
        if (normal && hit.object) normal.transformDirection(hit.object.matrixWorld);
        row.push(liftedPoint(hit.point, normal));
      }
      bridgeRows.push(row);
    }
    if (bridgeRows.length < 2) return;
    const points = bridgeRows.flat();
    const rowCount = bridgeRows.length;
    const indices = [];
    const wirePositions = [];
    for (let depthIndex = 0; depthIndex < rowCount - 1; depthIndex += 1) {
      for (let widthIndex = 0; widthIndex < widthSamples - 1; widthIndex += 1) {
        const a = depthIndex * widthSamples + widthIndex;
        const b = a + 1;
        const c = (depthIndex + 1) * widthSamples + widthIndex + 1;
        const d = c - 1;
        indices.push(a, b, c, a, c, d);
        const horizontalStart = points[a];
        const horizontalEnd = points[b];
        const verticalEnd = points[d];
        wirePositions.push(
          horizontalStart.x, horizontalStart.y, horizontalStart.z,
          horizontalEnd.x, horizontalEnd.y, horizontalEnd.z,
          horizontalStart.x, horizontalStart.y, horizontalStart.z,
          verticalEnd.x, verticalEnd.y, verticalEnd.z
        );
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap((point) => [point.x, point.y, point.z]), 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const color = SCALP_REGIONS.bangs.color;
    const surface = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    }));
    const wireGeometry = new THREE.BufferGeometry();
    wireGeometry.setAttribute("position", new THREE.Float32BufferAttribute(wirePositions, 3));
    const wire = new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.24,
      depthTest: false,
      depthWrite: false
    }));
    surface.userData.scalpBuilderConstructionSurface = true;
    wire.userData.scalpBuilderConstructionSurface = true;
    surface.renderOrder = 18;
    wire.renderOrder = 19;
    scalpBuilderGroup.add(surface, wire);
  };
  surfaceBands.forEach((band) => [-1, 1].forEach((sideSign) => {
    let region = band.region;
    if (region === "side-bangs") region = sideSign < 0 ? "side-bangs-left" : "side-bangs-right";
    if (region === "side") region = sideSign < 0 ? "side-left" : "side-right";
    addSurfacePatch({ ...band, region, sideSign });
  }));
  addCenterBridgePatch(surfaceBands[0]);
  scalpBuilderGroup.visible = true;
  scalpBuilderInstruction.textContent = "Construction surfaces generated from the curve network. Orbit around the head and inspect the patch flow before building final topology.";
  scalpBuilderStepLabel.textContent = "Curve Preview";
  scalpBuilderStepName.textContent = "Curve Surface Preview";
  generateScalpBuilderButton.textContent = "Regenerate Preview";
  updatePlacementStatus();
}

function keepScalpShellOutsideHead(points, faces, shellCenter, headSize, clearance) {
  const meshes = headMeshes().filter((mesh) => !GUIDE_BOUNDS_EXCLUDED_GROUPS.has(mesh.name));
  if (!meshes.length) return points.map((point) => point.clone());
  const raycaster = new THREE.Raycaster();
  const rayDistance = Math.max(headSize.x, headSize.y, headSize.z) * 1.8;
  const directions = [];
  const requiredOffsets = points.map((point) => {
    const direction = point.clone().sub(shellCenter);
    if (direction.lengthSq() < 0.000001) direction.set(0, 1, 0);
    direction.normalize();
    directions.push(direction);
    raycaster.set(
      shellCenter.clone().addScaledVector(direction, rayDistance),
      direction.clone().negate()
    );
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return 0;
    const surfaceDistance = hit.point.distanceTo(shellCenter);
    const pointDistance = point.distanceTo(shellCenter);
    return Math.max(0, surfaceDistance + clearance - pointDistance);
  });
  const neighbors = scalpTemplateNeighbors(points.length, faces);
  let smoothedOffsets = requiredOffsets.slice();
  for (let iteration = 0; iteration < 4; iteration += 1) {
    smoothedOffsets = smoothedOffsets.map((offset, index) => {
      if (!neighbors[index].size) return offset;
      let average = 0;
      neighbors[index].forEach((neighbor) => { average += smoothedOffsets[neighbor]; });
      average /= neighbors[index].size;
      return Math.max(requiredOffsets[index], THREE.MathUtils.lerp(offset, average, 0.48));
    });
  }
  return points.map((point, index) => point.clone().addScaledVector(directions[index], smoothedOffsets[index]));
}

async function rebuildScalpBuilderTemplateOverlay() {
  clearScalpBuilderTemplateOverlay();
  if (!guideModel || !scalpBuilderEditing || !scalpBuilderShowTemplateInput.checked) {
    scalpBuilderTemplateOverlay.visible = false;
    return;
  }
  try {
    const template = await loadScalpTopologyTemplate();
    if (!scalpBuilderEditing || !scalpBuilderShowTemplateInput.checked) return;
    guideModel.updateMatrixWorld(true);
    const templateBounds = new THREE.Box3().setFromPoints(template.vertices);
    const templateCenter = templateBounds.getCenter(new THREE.Vector3());
    const templateSize = templateBounds.getSize(new THREE.Vector3());
    const headBounds = guideHeadBounds(guideModel);
    const headCenter = headBounds.getCenter(new THREE.Vector3());
    const headSize = headBounds.getSize(new THREE.Vector3());
    const useAuthoredCoordinates = !importedHeadAsset;
    const mappedPoints = template.vertices.map((vertex) => {
      if (useAuthoredCoordinates) return vertex.clone().applyMatrix4(guideModel.matrixWorld);
      return new THREE.Vector3(
        headCenter.x + ((vertex.x - templateCenter.x) / Math.max(0.0001, templateSize.x * 0.5)) * headSize.x * 0.51,
        THREE.MathUtils.lerp(
          headBounds.min.y + headSize.y * 0.38,
          headBounds.max.y,
          (vertex.y - templateBounds.min.y) / Math.max(0.0001, templateSize.y)
        ),
        headCenter.z + ((vertex.z - templateCenter.z) / Math.max(0.0001, templateSize.z * 0.5)) * headSize.z * 0.51
      );
    });
    const shellClearance = Math.max(headSize.x, headSize.y, headSize.z) * 0.003;
    const worldPoints = keepScalpShellOutsideHead(
      mappedPoints,
      template.faces,
      headCenter,
      headSize,
      shellClearance
    );
    const positions = [];
    const colors = [];
    const wirePositions = [];
    const color = new THREE.Color();
    template.faces.forEach((face) => {
      color.set(SCALP_REGIONS[face.region]?.color || SCALP_REGIONS.unassigned.color);
      [[0, 1, 2], [0, 2, 3]].forEach((corners) => corners.forEach((corner) => {
        const point = worldPoints[face.indices[corner]];
        positions.push(point.x, point.y, point.z);
        colors.push(color.r, color.g, color.b);
      }));
      for (let edge = 0; edge < 4; edge += 1) {
        const start = worldPoints[face.indices[edge]];
        const end = worldPoints[face.indices[(edge + 1) % 4]];
        wirePositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
      }
    });
    const surfaceGeometry = new THREE.BufferGeometry();
    surfaceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    surfaceGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    surfaceGeometry.computeVertexNormals();
    const surface = new THREE.Mesh(surfaceGeometry, new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.24,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide
    }));
    surface.renderOrder = 12;
    const wireGeometry = new THREE.BufferGeometry();
    wireGeometry.setAttribute("position", new THREE.Float32BufferAttribute(wirePositions, 3));
    const wire = new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({
      color: 0x78f3f7,
      transparent: true,
      opacity: 0.58,
      depthTest: true,
      depthWrite: false
    }));
    wire.renderOrder = 13;
    scalpBuilderTemplateOverlay.add(surface, wire);
    scalpBuilderTemplateOverlay.visible = true;
  } catch (error) {
    console.error("Could not display scalp topology reference", error);
    scalpBuilderTemplateOverlay.visible = false;
  }
}

function generatedScalpObjContent(points, faces) {
  const lines = ["# Anime Hair Studio generated scalp guide"];
  points.forEach((point) => lines.push(`v ${point.x} ${point.y} ${point.z}`));
  let activeRegion = "";
  faces.forEach((face) => {
    if (face.region !== activeRegion) {
      activeRegion = face.region;
      lines.push(`usemtl ${activeRegion}`);
    }
    lines.push(`f ${face.indices.map((index) => index + 1).join(" ")}`);
  });
  return `${lines.join("\n")}\n`;
}

async function generateScalpFromBuilder() {
  if (!guideModel || scalpBuilderPlanePositions.some((value) => !Number.isFinite(value))) return;
  generateScalpBuilderButton.disabled = true;
  generateScalpBuilderButton.textContent = "Generating...";
  try {
    const template = await loadScalpTopologyTemplate();
    pushUndoState();
    const bounds = guideHeadBounds(guideModel);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const templateBounds = new THREE.Box3().setFromPoints(template.vertices);
    const templateCenter = templateBounds.getCenter(new THREE.Vector3());
    const templateSize = templateBounds.getSize(new THREE.Vector3());
    const bottomByRegion = {
      bangs: scalpBuilderPlanePositions[0],
      "side-bangs-left": scalpBuilderPlanePositions[1],
      "side-bangs-right": scalpBuilderPlanePositions[1],
      "side-left": scalpBuilderPlanePositions[3],
      "side-right": scalpBuilderPlanePositions[3],
      back: scalpBuilderPlanePositions[4],
      unassigned: Math.min(...scalpBuilderPlanePositions.slice(0, 5))
    };
    const incidentRegions = Array.from({ length: template.vertices.length }, () => new Set());
    const sourceBottomByRegion = {};
    const sourceDepthByRegion = {};
    template.faces.forEach((face) => face.indices.forEach((index) => {
      incidentRegions[index].add(face.region);
      sourceBottomByRegion[face.region] = Math.min(
        sourceBottomByRegion[face.region] ?? Infinity,
        template.vertices[index].y
      );
      const depth = sourceDepthByRegion[face.region] || { min: Infinity, max: -Infinity };
      depth.min = Math.min(depth.min, template.vertices[index].z);
      depth.max = Math.max(depth.max, template.vertices[index].z);
      sourceDepthByRegion[face.region] = depth;
    }));
    const orderedDepthRange = (a, b) => ({ min: Math.min(a, b), max: Math.max(a, b) });
    const targetDepthByRegion = {
      bangs: orderedDepthRange(scalpBuilderPlanePositions[5], bounds.max.z),
      "side-bangs-left": orderedDepthRange(scalpBuilderPlanePositions[8], scalpBuilderPlanePositions[6]),
      "side-bangs-right": orderedDepthRange(scalpBuilderPlanePositions[8], scalpBuilderPlanePositions[6]),
      "side-left": orderedDepthRange(scalpBuilderPlanePositions[9], scalpBuilderPlanePositions[7]),
      "side-right": orderedDepthRange(scalpBuilderPlanePositions[9], scalpBuilderPlanePositions[7]),
      back: orderedDepthRange(bounds.min.z, scalpBuilderPlanePositions[10]),
      unassigned: orderedDepthRange(bounds.min.z, bounds.max.z)
    };
    const shellClearance = Math.max(size.x, size.y, size.z) * 0.003;
    guideModel.updateMatrixWorld(true);
    scalpSurfaceGroup.updateMatrixWorld(true);
    const inset = size.z * 0.018;
    const targetStations = [
      { position: bounds.min.z + inset, segments: headPlaneIntersectionSegments("z", bounds.min.z + inset) },
      ...scalpBuilderPlanePositions.slice(5).map((position, index) => ({
        position,
        segments: scalpBuilderContours[index + 5] || headPlaneIntersectionSegments("z", position)
      })),
      { position: bounds.max.z - inset, segments: headPlaneIntersectionSegments("z", bounds.max.z - inset) }
    ].sort((a, b) => a.position - b.position)
      .filter((station, index, stations) => index === 0 || Math.abs(station.position - stations[index - 1].position) > 0.0001);
    const targetCurves = targetStations
      .map((station) => upperContourCurve(station.segments, "z", station.position))
      .filter(Boolean);
    if (targetCurves.length < 3) throw new Error("Not enough valid intersection curves to loft the scalp.");
    const sourceCurves = targetCurves.map((curve) => {
      const normalizedDepth = THREE.MathUtils.clamp(
        (curve.position - bounds.min.z) / Math.max(0.0001, size.z),
        0,
        1
      );
      const sourcePosition = THREE.MathUtils.lerp(templateBounds.min.z, templateBounds.max.z, normalizedDepth);
      return upperContourCurve(
        templatePlaneIntersectionSegments(template, "z", sourcePosition),
        "z",
        sourcePosition
      );
    }).filter(Boolean);
    if (sourceCurves.length !== targetCurves.length) {
      throw new Error("The scalp topology template could not be matched to the intersection curves.");
    }
    const curveFittedWorld = template.vertices.map((vertex, index) => {
      const regions = [...incidentRegions[index]];
      const fittedZ = regions.reduce((sum, region) => {
        const sourceDepth = sourceDepthByRegion[region] || { min: templateBounds.min.z, max: templateBounds.max.z };
        const targetDepth = targetDepthByRegion[region] || targetDepthByRegion.unassigned;
        const amount = THREE.MathUtils.clamp(
          (vertex.z - sourceDepth.min) / Math.max(0.0001, sourceDepth.max - sourceDepth.min),
          0,
          1
        );
        return sum + THREE.MathUtils.lerp(targetDepth.min, targetDepth.max, amount);
      }, 0) / Math.max(1, regions.length);
      const sourceSection = curveNetworkSection(sourceCurves, vertex.z);
      const sourceAmount = THREE.MathUtils.clamp(
        (vertex.x - sourceSection[0].x) / Math.max(0.0001, sourceSection.at(-1).x - sourceSection[0].x),
        0,
        1
      );
      const sourceSurfacePoint = pointAlongSection(sourceSection, sourceAmount);
      const targetSection = curveNetworkSection(targetCurves, fittedZ);
      const targetSurfacePoint = pointAlongSection(targetSection, sourceAmount);
      let surfaceWeight = 0;
      const fittedY = regions.reduce((sum, region) => {
        const sourceBottom = sourceBottomByRegion[region] ?? templateBounds.min.y;
        const amount = THREE.MathUtils.clamp(
          (vertex.y - sourceBottom) / Math.max(0.0001, sourceSurfacePoint.y - sourceBottom),
          0,
          1
        );
        surfaceWeight += amount;
        return sum + THREE.MathUtils.lerp(
          bottomByRegion[region] ?? bottomByRegion.unassigned,
          targetSurfacePoint.y,
          amount
        );
      }, 0) / Math.max(1, regions.length);
      surfaceWeight /= Math.max(1, regions.length);
      const point = new THREE.Vector3(targetSurfacePoint.x, fittedY, fittedZ);
      const outward = targetSurfacePoint.clone().sub(center);
      if (outward.lengthSq() > 0.000001) {
        point.addScaledVector(outward.normalize(), shellClearance * surfaceWeight);
      }
      return point;
    });
    const projectedWorld = curveFittedWorld;
    const projectedLocal = projectedWorld.map((point) => scalpSurfaceGroup.worldToLocal(point.clone()));
    const positions = [];
    const regions = [];
    const quadWirePositions = [];
    template.faces.forEach((face) => {
      [[0, 1, 2], [0, 2, 3]].forEach((corners) => {
        corners.forEach((corner) => {
          const point = projectedLocal[face.indices[corner]];
          positions.push(point.x, point.y, point.z);
        });
        regions.push(face.region);
      });
      for (let edge = 0; edge < 4; edge += 1) {
        const start = projectedLocal[face.indices[edge]];
        const end = projectedLocal[face.indices[(edge + 1) % 4]];
        quadWirePositions.push(start.x, start.y, start.z, end.x, end.y, end.z);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.userData.quadWirePositions = quadWirePositions;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const content = generatedScalpObjContent(projectedLocal, template.faces);
    installCustomScalpGeometry(geometry, regions, { name: "generated-scalp.obj", content });
    importedScalpGuideAsset.preserveCoordinates = true;
    importedScalpGuideAsset.quadWirePositions = [...quadWirePositions];
    setScalpBuilderEditing(false);
    setScalpShapeEditing(true);
    setScalpGuideVisibility(true);
    updatePlacementStatus();
  } catch (error) {
    console.error("Could not generate scalp guide", error);
    window.alert("The fitted scalp guide could not be generated. Please check the scalp topology template.");
  } finally {
    generateScalpBuilderButton.disabled = false;
    generateScalpBuilderButton.textContent = "Generate Scalp Guide";
  }
}

function resetScalpBuilder() {
  if (scalpBuilderEditing && (scalpBuilderCurveLattice || scalpBuilderEditedPoints)) pushUndoState();
  scalpBuilderEditedPoints = null;
  activeScalpBuilderCurveLatticeEdit = null;
  scalpBuilderStep = 0;
  scalpBuilderStroke = null;
  scalpBuilderPlanePositions.fill(null);
  scalpBuilderContours.fill(null);
  generateScalpBuilderButton.textContent = "Generate Surface Preview";
  if (scalpBuilderEditing) createScalpBuilderCurveLattice();
  else updateScalpBuilderStepUi();
  updatePlacementStatus();
  updateInteractionLocks();
}

function confirmScalpBuilderPlane() {
  if (!scalpBuilderEditing || !scalpBuilderPlane) return;
  const step = SCALP_BUILDER_STEPS[scalpBuilderStep];
  scalpBuilderPlanePositions[scalpBuilderStep] = scalpBuilderPlane.position[step.axis];
  scalpBuilderContours[scalpBuilderStep] = headPlaneIntersectionSegments(
    step.axis,
    scalpBuilderPlane.position[step.axis]
  );
  transformControls.detach();
  scalpBuilderStep += 1;
  createScalpBuilderPlanes();
  updatePlacementStatus();
}

function beginScalpBuilderInput() { return beginScalpBuilderCurveLatticeSelection(); }
function updateScalpBuilderStroke() {}
function finishScalpBuilderStroke() {}

function setScalpBuilderEditing(enabled) {
  if (enabled && scalpShapeEditing) setScalpShapeEditing(false);
  if (enabled && scalpPaintEditing) setScalpPaintEditing(false);
  if (enabled && headSetupEditing) headSetupEditing = false;
  scalpBuilderEditing = Boolean(enabled);
  scalpBuilderGroup.visible = scalpBuilderEditing;
  if (enabled) {
    setMirrorXEditing(true);
    setScalpGuideVisibility(false);
    setHeadReferenceTransparency(false);
    createScalpBuilderCurveLattice();
    scalpBuilderTemplateOverlay.visible = false;
  } else {
    if (
      transformControls.object?.userData.scalpBuilderPlane
      || transformControls.object?.userData.scalpBuilderLatticeIndex !== undefined
    ) transformControls.detach();
    disposeScalpBuilderVisuals();
    scalpBuilderGroup.visible = false;
    scalpBuilderTemplateOverlay.visible = false;
    configureTransformControls(activeTool);
  }
  setHeadReferenceTransparency(false);
  updateScalpEditingVisibility();
  updatePlacementStatus();
}

function updateScalpEditingVisibility() {
  scalpSurfaceGroup.visible = scalpGuideVisible && !headSetupEditing;
  const usingCustomGuide = scalpGuideSource === "custom" && Boolean(customScalpSurfaceMesh);
  const usingEditedGuide = !usingCustomGuide && Boolean(editedScalpSurfaceMesh);
  scalpSurfaceMesh.visible = !usingCustomGuide && !usingEditedGuide;
  scalpSurfaceWire.visible = !usingCustomGuide && !usingEditedGuide;
  scalpSelectionOutline.visible = !usingCustomGuide && !usingEditedGuide && headSetupEditing;
  if (editedScalpSurfaceMesh) editedScalpSurfaceMesh.visible = usingEditedGuide;
  if (editedScalpSurfaceWire) editedScalpSurfaceWire.visible = usingEditedGuide;
  if (editedScalpSelectionOutline) editedScalpSelectionOutline.visible = usingEditedGuide && headSetupEditing;
  if (customScalpSurfaceMesh) customScalpSurfaceMesh.visible = usingCustomGuide;
  if (customScalpSurfaceWire) customScalpSurfaceWire.visible = usingCustomGuide;
  if (customScalpSelectionOutline) customScalpSelectionOutline.visible = usingCustomGuide && headSetupEditing;
  scalpPanel.classList.toggle("hidden", !scalpShapeEditing || scalpPaintEditing);
  scalpPaintPanel.classList.toggle("hidden", !scalpPaintEditing);
  headPanel.classList.toggle("hidden", !headSetupEditing);
  scalpBuilderPanel.classList.toggle("hidden", !scalpBuilderEditing);
  const setupActive = scalpShapeEditing || scalpPaintEditing || headSetupEditing || scalpBuilderEditing;
  const setupEditorName = scalpPaintEditing
    ? "Scalp Painting"
    : headSetupEditing
      ? "Edit Head"
      : scalpBuilderEditing
        ? "Edit Scalp"
        : scalpShapeEditing
          ? "Scalp Guide"
          : "Editor";
  exitSetupEditor.classList.toggle("hidden", !setupActive);
  exitSetupEditorLabel.textContent = `Exit ${setupEditorName}`;
  modeToolButtons.forEach((button) => {
    const tool = button.dataset.tool;
    const usefulInScalpEditor = scalpBuilderEditing && ["select", "move", "rotate", "scale"].includes(tool);
    button.classList.toggle("setup-tool-hidden", setupActive && !usefulInScalpEditor);
  });
  const scalpTransformEditing = scalpBuilderEditing;
  mirrorXToggle.classList.toggle("setup-mode-hidden", setupActive && !scalpTransformEditing);
  proportionalToggle.classList.toggle("setup-mode-hidden", setupActive && !scalpTransformEditing);
  spaceToggle.classList.toggle("setup-mode-hidden", setupActive);
  hierarchyToggle.classList.toggle("setup-mode-hidden", setupActive);
  scalpSetupToggle.classList.toggle("active", setupActive);
  scalpPaintToggle.classList.toggle("active", scalpPaintEditing);
  headSetupMode.classList.toggle("active", headSetupEditing);
  scalpBuilderMode.classList.toggle("active", scalpBuilderEditing);
  scalpBuilderGroup.visible = scalpBuilderEditing || headSetupEditing;
  if (scalpBuilderCurveLattice) {
    scalpBuilderCurveLattice.surface.visible = true;
    scalpBuilderCurveLattice.line.visible = true;
    scalpBuilderCurveLattice.outline.visible = headSetupEditing;
    scalpBuilderCurveLattice.handles.forEach((handle) => {
      handle.visible = scalpBuilderEditing;
    });
  }
  scalpLatticeGroup.visible = scalpShapeEditing && scalpLatticeEditing;
  const surfaceOpacity = scalpPaintEditing
      ? 0.46
      : ["place", "draw", "braid"].includes(activeTool)
        ? 0.28
        : 0.12;
  const activeMesh = activeScalpSurfaceMesh();
  const activeWire = activeScalpSurfaceWire();
  const activeOutline = activeScalpSelectionOutline();
  const showScalp = scalpGuideVisible || headSetupEditing;
  activeMesh.material.opacity = showScalp ? surfaceOpacity : 0;
  activeWire.material.opacity = showScalp ? (scalpPaintEditing ? 0.12 : 0.14) : 0;
  activeOutline.material.uniforms.outlineOpacity.value = headSetupEditing ? 0.96 : 0;
  activeMesh.material.depthTest = true;
  activeWire.material.depthTest = true;
  activeMesh.renderOrder = headSetupEditing ? 19 : scalpSurfaceMesh.renderOrder;
  activeMesh.material.needsUpdate = true;
  activeWire.material.needsUpdate = true;
  activeOutline.material.needsUpdate = true;
  pinActiveToolSettingsPanel();
}

function exitSetupEditors() {
  setScalpSetupMenuOpen(false);
  if (scalpBuilderEditing) setScalpBuilderEditing(false);
  if (scalpPaintEditing) setScalpPaintEditing(false);
  if (headSetupEditing) setHeadSetupEditing(false);
  if (scalpShapeEditing) setScalpShapeEditing(false);
}

function setScalpSetupMenuOpen(open) {
  scalpSetupMenu.classList.toggle("hidden", !open);
  scalpSetupToggle.setAttribute("aria-expanded", String(open));
  placementStatus.style.visibility = open ? "hidden" : "";
}

function setHeadSetupEditing(enabled) {
  if (enabled && scalpBuilderEditing) setScalpBuilderEditing(false);
  if (enabled && scalpShapeEditing) setScalpShapeEditing(false);
  if (enabled && scalpPaintEditing) setScalpPaintEditing(false);
  headSetupEditing = Boolean(enabled);
  setHeadReferenceTransparency(false);
  if (headSetupEditing) createScalpBuilderCurveLattice();
  else if (!scalpBuilderEditing) disposeScalpBuilderVisuals();
  updateScalpEditingVisibility();
  updatePlacementStatus();
}

function activeToolUsesScalpGuide(tool = activeTool) {
  if (tool === "place") return true;
  if (tool === "draw") return drawStrandSurfaceInput.value !== "contextual-plane";
  if (tool === "braid") return braidSurfaceInput.value !== "contextual-plane";
  return scalpShapeEditing || scalpPaintEditing;
}

function toolAutoShowsScalpGuide(tool = activeTool) {
  if (tool === "place") return placeAutoShowScalpInput.checked;
  if (tool === "draw") return drawAutoShowScalpInput.checked;
  if (tool === "braid") return braidAutoShowScalpInput.checked;
  return scalpShapeEditing || scalpPaintEditing;
}

function autoShowScalpGuideForActiveTool() {
  if (activeToolUsesScalpGuide() && toolAutoShowsScalpGuide()) {
    setScalpGuideVisibility(true);
  }
}

function setScalpGuideVisibility(visible) {
  scalpGuideVisible = Boolean(visible);
  scalpGuideVisibilityToggle.classList.toggle("active", scalpGuideVisible);
  scalpGuideVisibilityToggle.setAttribute("aria-pressed", String(scalpGuideVisible));
  scalpGuideVisibilityToggle.title = scalpGuideVisible ? "Hide scalp guide" : "Show scalp guide";
  scalpGuideVisibilityToggle.setAttribute("aria-label", scalpGuideVisibilityToggle.title);
  updateScalpEditingVisibility();
}

function setScalpLatticeEditing(enabled) {
  if (enabled && !scalpShapeEditing) setScalpShapeEditing(true);
  scalpLatticeEditing = enabled && scalpShapeEditing;
  advancedLatticeButton.classList.toggle("active", scalpLatticeEditing);
  advancedLatticeButton.setAttribute("aria-pressed", String(scalpLatticeEditing));
  advancedLatticeButton.textContent = scalpLatticeEditing ? "Close advanced lattice" : "Advanced lattice";
  if (!enabled && transformControls.object?.userData.scalpLatticeIndex !== undefined) {
    transformControls.detach();
    selectedScalpLatticeIndex = null;
  }
  if (!enabled) endScalpLatticeDrag();
  updateScalpEditingVisibility();
  updatePlacementStatus();
}

function setScalpShapeEditing(enabled) {
  if (enabled && scalpBuilderEditing) setScalpBuilderEditing(false);
  if (enabled && scalpPaintEditing) setScalpPaintEditing(false);
  if (enabled && headSetupEditing) headSetupEditing = false;
  if (enabled && selectedStrandGroup) {
    selectedStrandGroup = null;
    updateAttributeEditorMode();
    renderLockList();
  }
  scalpShapeEditing = enabled;
  if (enabled) setScalpGuideVisibility(true);
  if (!enabled) setScalpLatticeEditing(false);
  setHeadReferenceTransparency(enabled);
  updateScalpEditingVisibility();
  updatePlacementStatus();
}

function setScalpPaintEditing(enabled) {
  if (enabled && scalpBuilderEditing) setScalpBuilderEditing(false);
  if (enabled && scalpShapeEditing) setScalpShapeEditing(false);
  if (enabled && headSetupEditing) headSetupEditing = false;
  if (enabled && selectedStrandGroup) {
    selectedStrandGroup = null;
    updateAttributeEditorMode();
    renderLockList();
  }
  scalpPaintEditing = enabled;
  if (enabled) setScalpGuideVisibility(true);
  scalpPaintToggle.classList.toggle("active", enabled);
  scalpPaintToggle.setAttribute("aria-pressed", String(enabled));
  scalpPaintToggle.title = enabled ? "Close scalp region paint" : "Paint scalp regions";
  if (!enabled) {
    endScalpPaint();
    scalpBrushCursor.visible = false;
  }
  setHeadReferenceTransparency(scalpShapeEditing);
  updateScalpEditingVisibility();
  updatePlacementStatus();
}

function defaultCurveLatticePoints(columns = 3, rows = 3) {
  const points = [];
  scalpSurfaceGroup.updateMatrixWorld(true);
  const probe = new THREE.Raycaster();
  for (let row = 0; row < rows; row += 1) {
    const v = row / Math.max(1, rows - 1);
    const y = THREE.MathUtils.lerp(1.35, 0.08, v);
    for (let column = 0; column < columns; column += 1) {
      const u = column / Math.max(1, columns - 1);
      const x = THREE.MathUtils.lerp(-0.78, 0.78, u);
      probe.set(new THREE.Vector3(x, y, 4), new THREE.Vector3(0, 0, -1));
      const hit = probe.intersectObject(activeScalpSurfaceMesh(), false)[0];
      if (hit) {
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
        const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        if (normal.z < 0) normal.negate();
        points.push(hit.point.clone().addScaledVector(normal, 0.035));
      } else {
        const normalizedX = x / 0.9;
        points.push(new THREE.Vector3(x, y, 0.62 + Math.sqrt(Math.max(0, 1 - normalizedX * normalizedX)) * 0.28));
      }
    }
  }
  return points;
}

function scalpRegionSurfaceSamples(region) {
  scalpSurfaceGroup.updateMatrixWorld(true);
  const position = scalpSurfaceGeometry.getAttribute("position");
  const normal = scalpSurfaceGeometry.getAttribute("normal");
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(scalpSurfaceGroup.matrixWorld);
  return scalpVisibleQuads
    .filter((quad) => scalpRegionAssignments[quad.id] === region)
    .map((quad) => {
      const point = new THREE.Vector3();
      const surfaceNormal = new THREE.Vector3();
      quad.vertices.forEach((vertexIndex) => {
        point.x += position.getX(vertexIndex);
        point.y += position.getY(vertexIndex);
        point.z += position.getZ(vertexIndex);
        surfaceNormal.x += normal.getX(vertexIndex);
        surfaceNormal.y += normal.getY(vertexIndex);
        surfaceNormal.z += normal.getZ(vertexIndex);
      });
      point.multiplyScalar(0.25).applyMatrix4(scalpSurfaceGroup.matrixWorld);
      surfaceNormal.multiplyScalar(0.25).applyMatrix3(normalMatrix).normalize();
      return { point, normal: surfaceNormal, face: quad.face };
    });
}

function curveLatticePointsForScalpRegion(region, columns = 3, rows = 3) {
  const samples = scalpRegionSurfaceSamples(region);
  if (!samples.length) return defaultCurveLatticePoints(columns, rows);
  const sideRegion = region.includes("side-");
  const topFaceSamples = sideRegion ? samples.filter((sample) => sample.face === "top") : [];
  const horizontalValue = (sample) => sideRegion ? sample.point.z : sample.point.x;
  const horizontalValues = samples.map(horizontalValue);
  const verticalValues = samples.map((sample) => sample.point.y);
  const horizontalMin = Math.min(...horizontalValues);
  const horizontalMax = Math.max(...horizontalValues);
  const verticalMin = Math.min(...verticalValues);
  const verticalMax = Math.max(...verticalValues);
  const horizontalRange = Math.max(0.001, horizontalMax - horizontalMin);
  const verticalRange = Math.max(0.001, verticalMax - verticalMin);
  const points = [];

  const blendedSample = (candidates, targetHorizontal, targetY) => {
    const nearest = candidates.map((sample) => {
      const du = (horizontalValue(sample) - targetHorizontal) / horizontalRange;
      const dv = (sample.point.y - targetY) / verticalRange;
      return { sample, distance: du * du + dv * dv };
    }).sort((a, b) => a.distance - b.distance).slice(0, Math.min(6, candidates.length));
    const point = new THREE.Vector3();
    const normal = new THREE.Vector3();
    let totalWeight = 0;
    nearest.forEach(({ sample, distance }) => {
      const weight = 1 / Math.pow(distance + 0.025, 2);
      point.addScaledVector(sample.point, weight);
      normal.addScaledVector(sample.normal, weight);
      totalWeight += weight;
    });
    point.divideScalar(Math.max(1e-6, totalWeight));
    normal.normalize();
    return point.addScaledVector(normal, 0.075);
  };

  for (let row = 0; row < rows; row += 1) {
    const v = rows === 1 ? 0.5 : row / (rows - 1);
    const targetY = THREE.MathUtils.lerp(verticalMax, verticalMin, v);
    for (let column = 0; column < columns; column += 1) {
      const u = columns === 1 ? 0.5 : THREE.MathUtils.lerp(0.04, 0.96, column / (columns - 1));
      const targetHorizontal = THREE.MathUtils.lerp(horizontalMin, horizontalMax, u);
      const candidates = row === 0 && topFaceSamples.length ? topFaceSamples : samples;
      points.push(blendedSample(candidates, targetHorizontal, targetY));
    }
  }
  return points;
}

function createCurveLatticeGuideSet() {
  const regions = STRAND_GROUPS.map((group) => group.id).filter((region) => region !== "unassigned");
  return regions.map((region) => {
    const columns = 3;
    const rows = region === "bangs" ? 3 : 4;
    return addCurveLattice({
      columns,
      rows,
      scalpRegion: region,
      color: SCALP_REGIONS[region].color,
      points: curveLatticePointsForScalpRegion(region, columns, rows)
    }, { deferUi: true });
  });
}

function curveLatticeControlPoint(guide, column, row) {
  return guide.points[row * guide.columns + column];
}

function circularArcTangent(rowPoints, column) {
  if (rowPoints.length < 3) return null;
  const first = THREE.MathUtils.clamp(column - 1, 0, rowPoints.length - 3);
  const a = rowPoints[first];
  const b = rowPoints[first + 1];
  const c = rowPoints[first + 2];
  const ab = b.clone().sub(a);
  const ac = c.clone().sub(a);
  const planeNormal = new THREE.Vector3().crossVectors(ab, ac);
  const bendStrength = planeNormal.length() / Math.max(1e-8, ab.length() * ac.length());
  if (bendStrength < 0.035) return null;
  const denominator = 2 * planeNormal.lengthSq();
  if (denominator < 1e-8) return null;

  const center = a.clone().add(
    new THREE.Vector3().crossVectors(ac, planeNormal).multiplyScalar(ab.lengthSq())
      .add(new THREE.Vector3().crossVectors(planeNormal, ab).multiplyScalar(ac.lengthSq()))
      .divideScalar(denominator)
  );
  const point = rowPoints[column];
  const radiusVector = point.clone().sub(center);
  const radius = radiusVector.length();
  const localSpan = Math.max(ab.length(), b.distanceTo(c));
  if (radius < 1e-5 || radius > localSpan * 8 || !Number.isFinite(radius)) return null;

  const direction = new THREE.Vector3().crossVectors(planeNormal, radiusVector).normalize();
  const previous = rowPoints[Math.max(0, column - 1)];
  const next = rowPoints[Math.min(rowPoints.length - 1, column + 1)];
  const travelDirection = next.clone().sub(previous);
  if (direction.dot(travelDirection) < 0) direction.negate();

  const arcLengthTo = (neighbor) => {
    const chord = point.distanceTo(neighbor);
    const angle = 2 * Math.asin(THREE.MathUtils.clamp(chord / (2 * radius), 0, 1));
    return radius * angle;
  };
  const lengths = [];
  if (column > 0) lengths.push(arcLengthTo(previous));
  if (column < rowPoints.length - 1) lengths.push(arcLengthTo(next));
  const tangentLength = lengths.reduce((sum, length) => sum + length, 0) / Math.max(1, lengths.length);
  return direction.multiplyScalar(tangentLength);
}

function defaultCurveLatticeFrames(points, columns, rows) {
  const tangents = [];
  const verticalTangents = [];
  const normals = [];
  for (let row = 0; row < rows; row += 1) {
    const rowPoints = Array.from({ length: columns }, (_, column) => points[row * columns + column]);
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const left = points[row * columns + Math.max(0, column - 1)];
      const right = points[row * columns + Math.min(columns - 1, column + 1)];
      const circularTangent = circularArcTangent(rowPoints, column);
      const tangent = circularTangent || right.clone().sub(left);
      if (!circularTangent && column > 0 && column < columns - 1) tangent.multiplyScalar(0.5);

      const above = points[Math.max(0, row - 1) * columns + column];
      const below = points[Math.min(rows - 1, row + 1) * columns + column];
      const normal = above.clone().sub(below);
      const tangentDirection = tangent.clone().normalize();
      normal.addScaledVector(tangentDirection, -normal.dot(tangentDirection));
      if (normal.lengthSq() < 1e-6) normal.set(0, 1, 0);
      normals[index] = normal.normalize();
      tangents[index] = tangent;
    }
  }
  for (let column = 0; column < columns; column += 1) {
    const columnPoints = Array.from({ length: rows }, (_, row) => points[row * columns + column]);
    for (let row = 0; row < rows; row += 1) {
      const index = row * columns + column;
      const above = columnPoints[Math.max(0, row - 1)];
      const below = columnPoints[Math.min(rows - 1, row + 1)];
      const circularTangent = circularArcTangent(columnPoints, row);
      const tangent = circularTangent || below.clone().sub(above);
      if (!circularTangent && row > 0 && row < rows - 1) tangent.multiplyScalar(0.5);
      verticalTangents[index] = tangent;
    }
  }
  return { tangents, verticalTangents, normals };
}

function sampleHermiteCurve(points, tangents, t) {
  if (points.length === 1) return points[0].clone();
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * (points.length - 1);
  const segment = Math.min(points.length - 2, Math.floor(scaled));
  const u = scaled - segment;
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  return points[segment].clone().multiplyScalar(h00)
    .addScaledVector(tangents[segment], h10)
    .addScaledVector(points[segment + 1], h01)
    .addScaledVector(tangents[segment + 1], h11);
}

function sampleCurveLattice(guide, u, v) {
  const across = [];
  const acrossTangents = [];
  for (let column = 0; column < guide.columns; column += 1) {
    const columnPoints = Array.from({ length: guide.rows }, (_, row) => curveLatticeControlPoint(guide, column, row));
    const columnCurveTangents = Array.from(
      { length: guide.rows },
      (_, row) => guide.verticalTangents[row * guide.columns + column]
    );
    across.push(sampleHermiteCurve(columnPoints, columnCurveTangents, v));
    const columnTangents = Array.from(
      { length: guide.rows },
      (_, row) => guide.acrossTangents[row * guide.columns + column]
    );
    acrossTangents.push(new THREE.CatmullRomCurve3(columnTangents, false, "centripetal", 0.5).getPoint(v));
  }
  return sampleHermiteCurve(across, acrossTangents, u);
}

function curveLatticeNormal(guide, u, v) {
  const step = 0.002;
  const left = sampleCurveLattice(guide, Math.max(0, u - step), v);
  const right = sampleCurveLattice(guide, Math.min(1, u + step), v);
  const top = sampleCurveLattice(guide, u, Math.max(0, v - step));
  const bottom = sampleCurveLattice(guide, u, Math.min(1, v + step));
  const normal = right.sub(left).cross(bottom.sub(top)).normalize();
  if (normal.z < 0) normal.negate();
  return normal;
}

function createCurveLatticeGeometry(guide) {
  const uSegments = Math.max(12, (guide.columns - 1) * 10);
  const vSegments = Math.max(18, (guide.rows - 1) * 10);
  const vertices = [];
  const indices = [];
  for (let row = 0; row <= vSegments; row += 1) {
    const v = row / vSegments;
    for (let column = 0; column <= uSegments; column += 1) {
      const point = sampleCurveLattice(guide, column / uSegments, v);
      vertices.push(point.x, point.y, point.z);
    }
  }
  const stride = uSegments + 1;
  for (let row = 0; row < vSegments; row += 1) {
    for (let column = 0; column < uSegments; column += 1) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCurveLatticeLineGeometry(guide) {
  const vertices = [];
  const appendCurve = (points, segments, tangents = null) => {
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
    const sample = (t) => tangents ? sampleHermiteCurve(points, tangents, t) : curve.getPoint(t);
    let previous = sample(0);
    for (let index = 1; index <= segments; index += 1) {
      const next = sample(index / segments);
      vertices.push(previous.x, previous.y, previous.z, next.x, next.y, next.z);
      previous = next;
    }
  };
  for (let column = 0; column < guide.columns; column += 1) {
    appendCurve(
      Array.from({ length: guide.rows }, (_, row) => curveLatticeControlPoint(guide, column, row)),
      36,
      Array.from({ length: guide.rows }, (_, row) => guide.verticalTangents[row * guide.columns + column])
    );
  }
  for (let row = 0; row < guide.rows; row += 1) {
    appendCurve(
      Array.from({ length: guide.columns }, (_, column) => curveLatticeControlPoint(guide, column, row)),
      28,
      Array.from({ length: guide.columns }, (_, column) => guide.acrossTangents[row * guide.columns + column])
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

function curveLatticeHasRootExtension(guide) {
  return ["side-bangs-left", "side-bangs-right", "side-left", "side-right"].includes(guide.scalpRegion);
}

function defaultCurveLatticeRootPoints(guide) {
  if (!curveLatticeHasRootExtension(guide)) return [];
  const probe = new THREE.Raycaster();
  return Array.from({ length: guide.columns }, (_, column) => {
    const boundary = curveLatticeControlPoint(guide, column, 0);
    probe.set(new THREE.Vector3(0, 4, boundary.z), new THREE.Vector3(0, -1, 0));
    let hit = probe.intersectObject(activeScalpSurfaceMesh(), false)[0];
    if (!hit) {
      probe.set(new THREE.Vector3(0, boundary.y, 4), new THREE.Vector3(0, 0, -1));
      hit = probe.intersectObject(activeScalpSurfaceMesh(), false)[0];
    }
    if (!hit) return boundary.clone().setX(0);
    const point = hit.point.clone();
    point.x = 0;
    return point;
  });
}

function curveLatticeEditablePoint(guide, pointIndex) {
  if (pointIndex < guide.points.length) return guide.points[pointIndex];
  const rootIndex = pointIndex - guide.points.length;
  if (rootIndex < (guide.rootPoints?.length || 0)) return guide.rootPoints[rootIndex];
  return guide.bottomPoints?.[rootIndex - (guide.rootPoints?.length || 0)];
}

function curveLatticePointSection(guide, pointIndex) {
  if (pointIndex < guide.points.length) {
    return { type: "lattice", localIndex: pointIndex };
  }
  const afterLattice = pointIndex - guide.points.length;
  if (afterLattice < (guide.rootPoints?.length || 0)) {
    return { type: "root", localIndex: afterLattice };
  }
  return { type: "bottom", localIndex: afterLattice - (guide.rootPoints?.length || 0) };
}

function curveLatticeRestPoint(guide, pointIndex) {
  const section = curveLatticePointSection(guide, pointIndex);
  if (section.type === "root") return guide.deformRestRootPoints?.[section.localIndex] || null;
  if (section.type === "bottom") return guide.deformRestBottomPoints?.[section.localIndex] || null;
  return guide.deformRestPoints?.[section.localIndex] || null;
}

function editingCurveLatticeDeformation(guide) {
  if ((!CURVE_LATTICE_FEATURE_ENABLED && !GROUP_CURVE_FEATURE_ENABLED) || !selectedStrandGroup || !guide) return false;
  return guide.scalpRegion === selectedStrandGroup
    || (mirrorXEditing && guide.scalpRegion === mirroredScalpRegion(selectedStrandGroup));
}

function curveLatticeRootColumns(guide) {
  return Array.from({ length: guide.columns }, (_, column) => {
    const boundary = curveLatticeControlPoint(guide, column, 0).clone();
    return { boundary, root: guide.rootPoints[column].clone() };
  });
}

function curveTangentsForPoints(points) {
  return points.map((point, index) => {
    const circularTangent = circularArcTangent(points, index);
    if (circularTangent) return circularTangent;
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const tangent = next.clone().sub(previous);
    if (index > 0 && index < points.length - 1) tangent.multiplyScalar(0.5);
    return tangent;
  });
}

function createCurveLatticeRootGeometry(guide) {
  const columns = curveLatticeRootColumns(guide);
  const boundaryPoints = columns.map((column) => column.boundary);
  const rootPoints = columns.map((column) => column.root);
  const boundaryTangents = curveTangentsForPoints(boundaryPoints);
  const rootTangents = curveTangentsForPoints(rootPoints);
  const uSegments = Math.max(16, (guide.columns - 1) * 10);
  const vSegments = 6;
  const vertices = [];
  const indices = [];
  for (let row = 0; row <= vSegments; row += 1) {
    const v = row / vSegments;
    for (let column = 0; column <= uSegments; column += 1) {
      const u = column / uSegments;
      const boundary = sampleHermiteCurve(boundaryPoints, boundaryTangents, u);
      const root = sampleHermiteCurve(rootPoints, rootTangents, u);
      const point = boundary.lerp(root, v);
      vertices.push(point.x, point.y, point.z);
    }
  }
  const stride = uSegments + 1;
  for (let row = 0; row < vSegments; row += 1) {
    for (let column = 0; column < uSegments; column += 1) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCurveLatticeRootLineGeometry(guide) {
  const columns = curveLatticeRootColumns(guide);
  const boundaryPoints = columns.map((column) => column.boundary);
  const rootPoints = columns.map((column) => column.root);
  const boundaryTangents = curveTangentsForPoints(boundaryPoints);
  const rootTangents = curveTangentsForPoints(rootPoints);
  const vertices = [];
  const appendCurve = (points, tangents) => {
    let previous = sampleHermiteCurve(points, tangents, 0);
    for (let index = 1; index <= 30; index += 1) {
      const next = sampleHermiteCurve(points, tangents, index / 30);
      vertices.push(previous.x, previous.y, previous.z, next.x, next.y, next.z);
      previous = next;
    }
  };
  appendCurve(boundaryPoints, boundaryTangents);
  appendCurve(rootPoints, rootTangents);
  columns.forEach(({ boundary, root }) => {
    vertices.push(boundary.x, boundary.y, boundary.z, root.x, root.y, root.z);
  });
  return new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
}

function defaultCurveLatticeBottomPoints(guide, rows = guide.bottomRows) {
  const boundaryY = Array.from(
    { length: guide.columns },
    (_, column) => curveLatticeControlPoint(guide, column, guide.rows - 1).y
  );
  const flatBottomY = average(boundaryY) - guide.bottomExtrude;
  return Array.from({ length: rows }, (_, row) => (
    Array.from({ length: guide.columns }, (_, column) => {
      const boundary = curveLatticeControlPoint(guide, column, guide.rows - 1);
      const weight = (row + 1) / rows;
      return boundary.clone().setY(THREE.MathUtils.lerp(boundary.y, flatBottomY, weight));
    })
  )).flat();
}

function flattenCurveLatticeBottomEdge(guide, y) {
  const start = (guide.bottomRows - 1) * guide.columns;
  const targetY = y ?? average(
    guide.bottomPoints.slice(start, start + guide.columns).map((point) => point.y)
  );
  for (let column = 0; column < guide.columns; column += 1) {
    guide.bottomPoints[start + column].y = targetY;
  }
}

function curveLatticeBottomControlRows(guide) {
  const boundary = Array.from(
    { length: guide.columns },
    (_, column) => curveLatticeControlPoint(guide, column, guide.rows - 1).clone()
  );
  const rows = Array.from({ length: guide.bottomRows }, (_, row) => (
    Array.from({ length: guide.columns }, (_, column) => guide.bottomPoints[row * guide.columns + column].clone())
  ));
  return [boundary, ...rows];
}

function sampleCurveLatticeBottom(guide, u, v) {
  const acrossSamples = curveLatticeBottomControlRows(guide).map((points) => (
    sampleHermiteCurve(points, curveTangentsForPoints(points), u)
  ));
  return sampleHermiteCurve(acrossSamples, curveTangentsForPoints(acrossSamples), v);
}

function createCurveLatticeBottomGeometry(guide) {
  const uSegments = Math.max(16, (guide.columns - 1) * 10);
  const vSegments = Math.max(6, guide.bottomRows * 6);
  const vertices = [];
  const indices = [];
  for (let row = 0; row <= vSegments; row += 1) {
    const v = row / vSegments;
    for (let column = 0; column <= uSegments; column += 1) {
      const u = column / uSegments;
      const point = sampleCurveLatticeBottom(guide, u, v);
      vertices.push(point.x, point.y, point.z);
    }
  }
  const stride = uSegments + 1;
  for (let row = 0; row < vSegments; row += 1) {
    for (let column = 0; column < uSegments; column += 1) {
      const a = row * stride + column;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createCurveLatticeBottomLineGeometry(guide) {
  const rows = curveLatticeBottomControlRows(guide);
  const vertices = [];
  const appendCurve = (points, tangents) => {
    let previous = sampleHermiteCurve(points, tangents, 0);
    for (let index = 1; index <= 30; index += 1) {
      const next = sampleHermiteCurve(points, tangents, index / 30);
      vertices.push(previous.x, previous.y, previous.z, next.x, next.y, next.z);
      previous = next;
    }
  };
  rows.forEach((points) => appendCurve(points, curveTangentsForPoints(points)));
  for (let column = 0; column < guide.columns; column += 1) {
    const points = rows.map((row) => row[column]);
    appendCurve(points, curveTangentsForPoints(points));
  }
  return new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
}

function setCurveLatticeBottomExtrude(guide, distance) {
  const nextDistance = Math.max(0, Number(distance));
  const delta = nextDistance - guide.bottomExtrude;
  for (let row = 0; row < guide.bottomRows; row += 1) {
    const weight = (row + 1) / guide.bottomRows;
    for (let column = 0; column < guide.columns; column += 1) {
      guide.bottomPoints[row * guide.columns + column].y -= delta * weight;
      const restPoint = guide.deformRestBottomPoints?.[row * guide.columns + column];
      if (restPoint) restPoint.y -= delta * weight;
    }
  }
  guide.bottomExtrude = nextDistance;
}

function setCurveLatticeBottomRows(guide, rowCount) {
  const nextRows = THREE.MathUtils.clamp(Math.round(rowCount), 1, 12);
  if (nextRows === guide.bottomRows) return;
  const oldRows = curveLatticeBottomControlRows(guide);
  const oldRowCount = guide.bottomRows;
  const nextPoints = [];
  const restBoundary = Array.from({ length: guide.columns }, (_, column) => (
    guide.deformRestPoints?.[(guide.rows - 1) * guide.columns + column]
      || curveLatticeControlPoint(guide, column, guide.rows - 1)
  ).clone());
  const oldRestRows = [restBoundary];
  for (let row = 0; row < oldRowCount; row += 1) {
    oldRestRows.push(Array.from({ length: guide.columns }, (_, column) => (
      guide.deformRestBottomPoints?.[row * guide.columns + column]
        || oldRows[row + 1][column]
    ).clone()));
  }
  const nextRestPoints = [];
  for (let row = 1; row <= nextRows; row += 1) {
    const t = row / nextRows;
    const scaled = t * oldRowCount;
    const lower = Math.floor(scaled);
    const upper = Math.min(oldRowCount, lower + 1);
    const blend = scaled - lower;
    for (let column = 0; column < guide.columns; column += 1) {
      nextPoints.push(oldRows[lower][column].clone().lerp(oldRows[upper][column], blend));
      nextRestPoints.push(oldRestRows[lower][column].clone().lerp(oldRestRows[upper][column], blend));
    }
  }
  guide.bottomRows = nextRows;
  guide.bottomPoints = nextPoints;
  guide.deformRestBottomPoints = nextRestPoints;
  flattenCurveLatticeBottomEdge(guide);
}

function rebuildCurveLatticeHandles(guide) {
  const wasVisible = guide.handlesGroup?.visible ?? false;
  if (guide.handlesGroup?.children.includes(transformControls.object)) transformControls.detach();
  if (guide.handlesGroup) {
    guideSurfaceGroup.remove(guide.handlesGroup);
    guide.handlesGroup.children.forEach((handle) => {
      handle.geometry.dispose();
      handle.material.dispose();
    });
  }
  selectedCurveLatticePoint = null;
  selectedControlPoints = selectedControlPoints.filter((point) => point.type !== "lattice" || point.guideId !== guide.id);
  guide.handlesGroup = createCurveLatticeHandles(guide);
  guide.handlesGroup.visible = wasVisible;
  guideSurfaceGroup.add(guide.handlesGroup);
}

function controlPointIsSelected(type, ownerId, pointIndex) {
  return selectedControlPoints.some((point) => (
    point.type === type
    && (type === "lattice" ? point.guideId === ownerId : point.lockId === ownerId)
    && point.pointIndex === pointIndex
  ));
}

function clearMultiPointSelection() {
  selectedControlPoints = [];
}

function createCurveLatticeHandles(guide) {
  const group = new THREE.Group();
  const editablePoints = [...guide.points, ...(guide.rootPoints || []), ...(guide.bottomPoints || [])];
  editablePoints.forEach((point, index) => {
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x58f6ff, transparent: true, opacity: 0.72, depthTest: false })
    );
    handle.position.copy(point);
    handle.renderOrder = 10;
    handle.userData.guideId = guide.id;
    handle.userData.curveLatticeGuideId = guide.id;
    handle.userData.curveLatticePointIndex = index;
    handle.userData.curveLatticeRootPointIndex = index >= guide.points.length
      && index < guide.points.length + (guide.rootPoints?.length || 0)
      ? index - guide.points.length
      : undefined;
    handle.userData.curveLatticeBottomPointIndex = index >= guide.points.length + (guide.rootPoints?.length || 0)
      ? index - guide.points.length - (guide.rootPoints?.length || 0)
      : undefined;
    if (handle.userData.curveLatticeBottomPointIndex !== undefined) {
      handle.visible = guide.bottomExtrude > 0.001;
    }
    group.add(handle);
  });
  return group;
}

function addCurveLattice(overrides = {}, options = {}) {
  const columns = Number(overrides.columns || 3);
  const rows = Number(overrides.rows || 3);
  const points = overrides.points?.map((point) => point.clone?.() || dataToVector(point)) || defaultCurveLatticePoints(columns, rows);
  const frames = defaultCurveLatticeFrames(points, columns, rows);
  const scalpRegion = overrides.scalpRegion || "bangs";
  const color = new THREE.Color(
    overrides.color ?? SCALP_REGIONS[scalpRegion]?.color ?? SCALP_REGIONS.bangs.color
  ).getHex();
  const guide = {
    id: overrides.id || crypto.randomUUID(),
    type: "curve-lattice",
    columns,
    rows,
    opacity: Number(overrides.opacity ?? 0.12),
    bottomExtrude: Number(overrides.bottomExtrude ?? 0),
    bottomRows: THREE.MathUtils.clamp(Math.round(Number(overrides.bottomRows ?? 1)), 1, 12),
    scalpRegion,
    color,
    points,
    acrossTangents: frames.tangents,
    verticalTangents: frames.verticalTangents,
    pointNormals: frames.normals
  };
  guide.rootPoints = curveLatticeHasRootExtension(guide)
    ? overrides.rootPoints?.length === columns
      ? overrides.rootPoints.map((point) => point.clone?.() || dataToVector(point))
      : defaultCurveLatticeRootPoints(guide)
    : [];
  guide.bottomPoints = overrides.bottomPoints?.length === guide.bottomRows * columns
    ? overrides.bottomPoints.map((point) => point.clone?.() || dataToVector(point))
    : defaultCurveLatticeBottomPoints(guide);
  guide.deformRestPoints = overrides.deformRestPoints?.length === guide.points.length
    ? overrides.deformRestPoints.map((point) => point.clone?.() || dataToVector(point))
    : guide.points.map((point) => point.clone());
  guide.deformRestRootPoints = overrides.deformRestRootPoints?.length === guide.rootPoints.length
    ? overrides.deformRestRootPoints.map((point) => point.clone?.() || dataToVector(point))
    : guide.rootPoints.map((point) => point.clone());
  guide.deformRestBottomPoints = overrides.deformRestBottomPoints?.length === guide.bottomPoints.length
    ? overrides.deformRestBottomPoints.map((point) => point.clone?.() || dataToVector(point))
    : guide.bottomPoints.map((point) => point.clone());
  flattenCurveLatticeBottomEdge(guide);
  if (overrides.deformRestBottomPoints?.length !== guide.bottomPoints.length) {
    guide.deformRestBottomPoints = guide.bottomPoints.map((point) => point.clone());
  }
  guide.mesh = new THREE.Mesh(
    createCurveLatticeGeometry(guide),
    new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: guide.opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  guide.mesh.userData.guideId = guide.id;
  guide.mesh.userData.curveLatticeGuideId = guide.id;
  guide.wire = new THREE.LineSegments(
    createCurveLatticeLineGeometry(guide),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false })
  );
  guide.wire.userData.guideId = guide.id;
  guide.wire.userData.curveLatticeGuideId = guide.id;
  if (curveLatticeHasRootExtension(guide)) {
    guide.rootMesh = new THREE.Mesh(
      createCurveLatticeRootGeometry(guide),
      new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity: guide.opacity,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    guide.rootWire = new THREE.LineSegments(
      createCurveLatticeRootLineGeometry(guide),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false })
    );
    [guide.rootMesh, guide.rootWire].forEach((object) => {
      object.userData.guideId = guide.id;
      object.userData.curveLatticeGuideId = guide.id;
    });
  }
  guide.bottomMesh = new THREE.Mesh(
    createCurveLatticeBottomGeometry(guide),
    new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: guide.opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  guide.bottomWire = new THREE.LineSegments(
    createCurveLatticeBottomLineGeometry(guide),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.78, depthWrite: false })
  );
  [guide.bottomMesh, guide.bottomWire].forEach((object) => {
    object.userData.guideId = guide.id;
    object.userData.curveLatticeGuideId = guide.id;
    object.visible = guide.bottomExtrude > 0.001;
  });
  guide.handlesGroup = createCurveLatticeHandles(guide);
  guide.handlesGroup.visible = false;
  guideSurfaceGroup.add(
    guide.mesh,
    guide.wire,
    ...(guide.rootMesh ? [guide.rootMesh, guide.rootWire] : []),
    guide.bottomMesh,
    guide.bottomWire,
    guide.handlesGroup
  );
  if (!CURVE_LATTICE_FEATURE_ENABLED) {
    [guide.mesh, guide.wire, guide.rootMesh, guide.rootWire, guide.bottomMesh, guide.bottomWire]
      .filter(Boolean)
      .forEach((object) => { object.visible = false; });
    guide.handlesGroup.visible = false;
  }
  guides.push(guide);
  if (!options.deferUi) {
    selectGuide(guide.id);
    updateCount();
  }
  return guide;
}

function updateCurveLatticeGeometry(guide, options = {}) {
  const frames = defaultCurveLatticeFrames(guide.points, guide.columns, guide.rows);
  guide.acrossTangents = frames.tangents;
  guide.verticalTangents = frames.verticalTangents;
  guide.pointNormals = frames.normals;
  guide.mesh.geometry.dispose();
  guide.wire.geometry.dispose();
  guide.mesh.geometry = createCurveLatticeGeometry(guide);
  guide.wire.geometry = createCurveLatticeLineGeometry(guide);
  guide.mesh.material.opacity = guide.opacity;
  if (guide.rootMesh) {
    guide.rootMesh.geometry.dispose();
    guide.rootWire.geometry.dispose();
    guide.rootMesh.geometry = createCurveLatticeRootGeometry(guide);
    guide.rootWire.geometry = createCurveLatticeRootLineGeometry(guide);
    guide.rootMesh.material.opacity = guide.opacity;
  }
  guide.bottomMesh.geometry.dispose();
  guide.bottomWire.geometry.dispose();
  guide.bottomMesh.geometry = createCurveLatticeBottomGeometry(guide);
  guide.bottomWire.geometry = createCurveLatticeBottomLineGeometry(guide);
  guide.bottomMesh.material.opacity = guide.opacity;
  const latticeVisible = guide.viewportGroupVisible !== false;
  guide.bottomMesh.visible = latticeVisible && guide.bottomExtrude > 0.001;
  guide.bottomWire.visible = latticeVisible && guide.bottomExtrude > 0.001;
  if (options.syncHandles !== false) {
    guide.handlesGroup.children.forEach((handle, index) => {
      const point = curveLatticeEditablePoint(guide, index);
      if (point) handle.position.copy(point);
      if (handle.userData.curveLatticeBottomPointIndex !== undefined) {
        handle.visible = guide.bottomExtrude > 0.001;
      }
    });
  }
  updateGroupCurveDisplay(guide);
  if (GROUP_CURVE_FEATURE_ENABLED && selectedStrandGroup) {
    filterCurveLatticesToGroup(activeCurveLatticeGuideId);
  }
  updateBoundCurveLatticeStrands(guide);
}

function mirroredCurveLatticePointIndex(guide, pointIndex) {
  const row = Math.floor(pointIndex / guide.columns);
  const column = pointIndex % guide.columns;
  return row * guide.columns + (guide.columns - 1 - column);
}

function mirroredCurveLatticeTarget(guide, pointIndex) {
  const mirroredRegion = mirroredScalpRegion(guide.scalpRegion);
  const section = curveLatticePointSection(guide, pointIndex);
  if (mirroredRegion === guide.scalpRegion) {
    if (section.type === "root") {
      return {
        guide,
        pointIndex: guide.points.length + (guide.columns - 1 - section.localIndex)
      };
    }
    if (section.type === "bottom") {
      const row = Math.floor(section.localIndex / guide.columns);
      const column = section.localIndex % guide.columns;
      return {
        guide,
        pointIndex: guide.points.length + guide.rootPoints.length
          + row * guide.columns + (guide.columns - 1 - column)
      };
    }
    return { guide, pointIndex: mirroredCurveLatticePointIndex(guide, pointIndex) };
  }
  const targetGuide = guides.find((item) => (
    item.type === "curve-lattice" && item.scalpRegion === mirroredRegion
  ));
  if (!targetGuide) return null;
  if (section.type === "root") {
    const targetRootIndex = Math.round(
      (section.localIndex / Math.max(1, guide.columns - 1)) * Math.max(0, targetGuide.columns - 1)
    );
    return {
      guide: targetGuide,
      pointIndex: targetGuide.points.length + targetRootIndex
    };
  }
  if (section.type === "bottom") {
    const sourceRow = Math.floor(section.localIndex / guide.columns);
    const sourceColumn = section.localIndex % guide.columns;
    const targetRow = Math.round(
      (sourceRow / Math.max(1, guide.bottomRows - 1)) * Math.max(0, targetGuide.bottomRows - 1)
    );
    const targetColumn = Math.round(
      (sourceColumn / Math.max(1, guide.columns - 1)) * Math.max(0, targetGuide.columns - 1)
    );
    return {
      guide: targetGuide,
      pointIndex: targetGuide.points.length + targetGuide.rootPoints.length
        + targetRow * targetGuide.columns + targetColumn
    };
  }
  const sourceRow = Math.floor(section.localIndex / guide.columns);
  const sourceColumn = section.localIndex % guide.columns;
  const targetRow = Math.round(
    (sourceRow / Math.max(1, guide.rows - 1)) * Math.max(0, targetGuide.rows - 1)
  );
  const targetColumn = Math.round(
    (sourceColumn / Math.max(1, guide.columns - 1)) * Math.max(0, targetGuide.columns - 1)
  );
  return {
    guide: targetGuide,
    pointIndex: targetRow * targetGuide.columns + targetColumn
  };
}

function updateCurveLatticeHandleColors(guide) {
  if (!guide?.handlesGroup) return;
  const selectedIndex = selectedCurveLatticePoint?.guideId === guide.id
    ? selectedCurveLatticePoint.pointIndex
    : -1;
  const selectedGuide = selectedCurveLatticePoint
    ? guides.find((item) => item.id === selectedCurveLatticePoint.guideId)
    : null;
  const mirroredTarget = mirrorXEditing && selectedGuide
    ? mirroredCurveLatticeTarget(selectedGuide, selectedCurveLatticePoint.pointIndex)
    : null;
  const mirroredIndex = mirroredTarget?.guide.id === guide.id ? mirroredTarget.pointIndex : -1;

  guide.handlesGroup.children.forEach((handle, index) => {
    const isSelected = index === selectedIndex || controlPointIsSelected("lattice", guide.id, index);
    const isMirrored = index === mirroredIndex && mirroredIndex !== selectedIndex;
    handle.material.color.set(isSelected ? 0xff5bd1 : isMirrored ? 0xf0d95d : 0x58f6ff);
    handle.material.opacity = isSelected ? 1 : isMirrored ? 0.9 : 0.58;
  });
}

function selectCurveLatticePoint(guide, pointIndex, attachTransform = activeTool === "move", preserveMulti = false) {
  if (!guide?.handlesGroup?.children[pointIndex]) return;
  selectedCurveLatticePoint = { guideId: guide.id, pointIndex };
  selectedPoint = null;
  if (!preserveMulti) selectedControlPoints = [{ type: "lattice", guideId: guide.id, pointIndex }];
  guides.filter((item) => item.type === "curve-lattice").forEach(updateCurveLatticeHandleColors);
  if (attachTransform) {
    transformControls.setMode("translate");
    transformControls.setSpace("world");
    transformControls.attach(guide.handlesGroup.children[pointIndex]);
  } else {
    transformControls.detach();
  }
}

function updateCurveLatticeFromHandle(handle) {
  const guide = guides.find((item) => item.id === handle.userData.curveLatticeGuideId);
  const pointIndex = handle.userData.curveLatticePointIndex;
  if (!guide || pointIndex === undefined) return;
  const editedPoint = curveLatticeEditablePoint(guide, pointIndex);
  if (!editedPoint) return;
  const previousPoint = editedPoint.clone();
  const pointSection = curveLatticePointSection(guide, pointIndex);
  editedPoint.copy(handle.position);
  const guideOnlyEdit = !editingCurveLatticeDeformation(guide);
  const editDelta = editedPoint.clone().sub(previousPoint);
  if (guideOnlyEdit) curveLatticeRestPoint(guide, pointIndex)?.add(editDelta);
  if (pointSection.type === "lattice") {
    const row = Math.floor(pointSection.localIndex / guide.columns);
    const column = pointSection.localIndex % guide.columns;
    if (row === guide.rows - 1) {
      const delta = editedPoint.clone().sub(previousPoint);
      for (let bottomRow = 0; bottomRow < guide.bottomRows; bottomRow += 1) {
        guide.bottomPoints[bottomRow * guide.columns + column].add(delta);
        if (guideOnlyEdit) guide.deformRestBottomPoints?.[bottomRow * guide.columns + column]?.add(delta);
      }
      flattenCurveLatticeBottomEdge(guide);
    }
  } else if (pointSection.type === "bottom") {
    const row = Math.floor(pointSection.localIndex / guide.columns);
    if (row === guide.bottomRows - 1) flattenCurveLatticeBottomEdge(guide, editedPoint.y);
  }

  if (mirrorXEditing) {
    const mirroredTarget = mirroredCurveLatticeTarget(guide, pointIndex);
    if (mirroredTarget?.guide.id === guide.id && mirroredTarget.pointIndex === pointIndex) {
      editedPoint.x = 0;
      handle.position.x = 0;
      if (guideOnlyEdit) {
        const restPoint = curveLatticeRestPoint(guide, pointIndex);
        if (restPoint) restPoint.x = 0;
      }
    } else if (mirroredTarget) {
      const mirroredPoint = curveLatticeEditablePoint(mirroredTarget.guide, mirroredTarget.pointIndex);
      if (!mirroredPoint) return;
      const previousMirroredPoint = mirroredPoint.clone();
      mirroredPoint.set(-handle.position.x, handle.position.y, handle.position.z);
      const mirroredGuideOnlyEdit = !editingCurveLatticeDeformation(mirroredTarget.guide);
      const mirroredDelta = mirroredPoint.clone().sub(previousMirroredPoint);
      if (mirroredGuideOnlyEdit) {
        curveLatticeRestPoint(mirroredTarget.guide, mirroredTarget.pointIndex)?.add(mirroredDelta);
      }
      const mirroredSection = curveLatticePointSection(mirroredTarget.guide, mirroredTarget.pointIndex);
      if (mirroredSection.type === "lattice"
        && Math.floor(mirroredSection.localIndex / mirroredTarget.guide.columns) === mirroredTarget.guide.rows - 1) {
        const mirroredColumn = mirroredSection.localIndex % mirroredTarget.guide.columns;
        const delta = mirroredPoint.clone().sub(previousMirroredPoint);
        for (let bottomRow = 0; bottomRow < mirroredTarget.guide.bottomRows; bottomRow += 1) {
          mirroredTarget.guide.bottomPoints[bottomRow * mirroredTarget.guide.columns + mirroredColumn].add(delta);
          if (mirroredGuideOnlyEdit) {
            mirroredTarget.guide.deformRestBottomPoints?.[
              bottomRow * mirroredTarget.guide.columns + mirroredColumn
            ]?.add(delta);
          }
        }
        flattenCurveLatticeBottomEdge(mirroredTarget.guide);
      } else if (mirroredSection.type === "bottom"
        && Math.floor(mirroredSection.localIndex / mirroredTarget.guide.columns) === mirroredTarget.guide.bottomRows - 1) {
        flattenCurveLatticeBottomEdge(mirroredTarget.guide, mirroredPoint.y);
      }
      mirroredTarget.guide.handlesGroup.children[mirroredTarget.pointIndex]?.position.copy(mirroredPoint);
      if (mirroredTarget.guide.id !== guide.id) {
        updateCurveLatticeGeometry(mirroredTarget.guide);
      }
    }
  }

  updateCurveLatticeGeometry(guide);
  guides.filter((item) => item.type === "curve-lattice").forEach(updateCurveLatticeHandleColors);
}

function beginCurveLatticeMultiEdit(handle) {
  const guide = guides.find((item) => item.id === handle?.userData.curveLatticeGuideId);
  if (!guide) return;
  const selectedIndices = selectedControlPoints
    .filter((point) => point.type === "lattice" && point.guideId === guide.id)
    .map((point) => point.pointIndex);
  if (selectedIndices.length < 2 || !selectedIndices.includes(handle.userData.curveLatticePointIndex)) {
    activeLatticeMultiEdit = null;
    return;
  }
  activeLatticeMultiEdit = {
    guideId: guide.id,
    pointIndex: handle.userData.curveLatticePointIndex,
    selectedIndices,
    points: selectedIndices.map((index) => ({ index, point: curveLatticeEditablePoint(guide, index).clone() })),
    handlePosition: handle.position.clone(),
    handleQuaternion: handle.quaternion.clone(),
    handleScale: handle.scale.clone()
  };
}

function applyCurveLatticeMultiTransform(handle) {
  const edit = activeLatticeMultiEdit;
  const guide = guides.find((item) => item.id === edit?.guideId);
  if (!guide) return;
  const pivot = edit.points.find((item) => item.index === edit.pointIndex)?.point || edit.handlePosition;
  const selectedSet = new Set(edit.selectedIndices);
  const delta = handle.position.clone().sub(edit.handlePosition);
  const deltaQuaternion = handle.quaternion.clone().multiply(edit.handleQuaternion.clone().invert());
  const ratio = new THREE.Vector3(
    Math.max(0.18, handle.scale.x) / Math.max(0.18, edit.handleScale.x),
    Math.max(0.18, handle.scale.y) / Math.max(0.18, edit.handleScale.y),
    Math.max(0.18, handle.scale.z) / Math.max(0.18, edit.handleScale.z)
  );
  const inverseFrame = edit.handleQuaternion.clone().invert();

  edit.points.forEach(({ index, point }) => {
    const target = curveLatticeEditablePoint(guide, index);
    if (activeTool === "move") {
      target.copy(point).add(delta);
    } else if (activeTool === "rotate") {
      target.copy(point).sub(pivot).applyQuaternion(deltaQuaternion).add(pivot);
    } else if (activeTool === "scale") {
      target.copy(point).sub(pivot).applyQuaternion(inverseFrame).multiply(ratio)
        .applyQuaternion(edit.handleQuaternion).add(pivot);
    }
  });

  const guideOnlyEdit = !editingCurveLatticeDeformation(guide);
  if (guideOnlyEdit) {
    edit.points.forEach(({ index, point }) => {
      const target = curveLatticeEditablePoint(guide, index);
      curveLatticeRestPoint(guide, index)?.add(target.clone().sub(point));
    });
  }

  edit.points.forEach(({ index, point }) => {
    const section = curveLatticePointSection(guide, index);
    if (section.type !== "lattice" || Math.floor(section.localIndex / guide.columns) !== guide.rows - 1) return;
    const column = section.localIndex % guide.columns;
    const movedPoint = curveLatticeEditablePoint(guide, index);
    const pointDelta = movedPoint.clone().sub(point);
    for (let row = 0; row < guide.bottomRows; row += 1) {
      const bottomLocalIndex = row * guide.columns + column;
      const bottomGlobalIndex = guide.points.length + guide.rootPoints.length + bottomLocalIndex;
      if (!selectedSet.has(bottomGlobalIndex)) guide.bottomPoints[bottomLocalIndex].add(pointDelta);
      if (guideOnlyEdit && !selectedSet.has(bottomGlobalIndex)) {
        guide.deformRestBottomPoints?.[bottomLocalIndex]?.add(pointDelta);
      }
    }
  });
  flattenCurveLatticeBottomEdge(guide);

  const mirroredGuides = new Set();
  if (mirrorXEditing) {
    edit.selectedIndices.forEach((index) => {
      const mirrored = mirroredCurveLatticeTarget(guide, index);
      if (!mirrored || (mirrored.guide.id === guide.id && selectedSet.has(mirrored.pointIndex))) return;
      const source = curveLatticeEditablePoint(guide, index);
      const target = curveLatticeEditablePoint(mirrored.guide, mirrored.pointIndex);
      if (!source || !target) return;
      const previousTarget = target.clone();
      target.set(-source.x, source.y, source.z);
      if (!editingCurveLatticeDeformation(mirrored.guide)) {
        curveLatticeRestPoint(mirrored.guide, mirrored.pointIndex)?.add(target.clone().sub(previousTarget));
      }
      mirroredGuides.add(mirrored.guide);
    });
  }
  updateCurveLatticeGeometry(guide);
  mirroredGuides.forEach((mirroredGuide) => {
    flattenCurveLatticeBottomEdge(mirroredGuide);
    updateCurveLatticeGeometry(mirroredGuide);
  });
  guides.filter((item) => item.type === "curve-lattice").forEach(updateCurveLatticeHandleColors);
}

function curveLatticeColumnPoints(guide, column, count = guide.rows) {
  const controlPoints = Array.from({ length: guide.rows }, (_, row) => curveLatticeControlPoint(guide, column, row));
  if (guide.bottomExtrude > 0.001) {
    for (let row = 0; row < guide.bottomRows; row += 1) {
      controlPoints.push(guide.bottomPoints[row * guide.columns + column].clone());
    }
  }
  const tangents = curveTangentsForPoints(controlPoints);
  return Array.from(
    { length: count },
    (_, index) => sampleHermiteCurve(controlPoints, tangents, index / Math.max(1, count - 1))
  );
}

function groupCurveControlIndices(guide) {
  const column = Math.floor(guide.columns / 2);
  const indices = Array.from({ length: guide.rows }, (_, row) => row * guide.columns + column);
  if (guide.bottomExtrude > 0.001) {
    for (let row = 0; row < guide.bottomRows; row += 1) {
      indices.push(guide.points.length + guide.rootPoints.length + row * guide.columns + column);
    }
  }
  return indices;
}

function groupCurveControlPoints(guide) {
  return groupCurveControlIndices(guide)
    .map((index) => curveLatticeEditablePoint(guide, index))
    .filter(Boolean);
}

function updateGroupCurveDisplay(guide) {
  if (!guide.groupCurveLine) return;
  const points = groupCurveControlPoints(guide);
  const displayPoints = points.length > 1
    ? new THREE.CatmullRomCurve3(points).getPoints(48)
    : points;
  guide.groupCurveLine.geometry.dispose();
  guide.groupCurveLine.geometry = new THREE.BufferGeometry().setFromPoints(displayPoints);
}

function ensureGroupCurveDisplay(guide) {
  if (!guide.groupCurveLine) {
    guide.groupCurveLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: guide.color,
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false
      })
    );
    guide.groupCurveLine.renderOrder = 9;
    guide.groupCurveLine.visible = false;
    guideSurfaceGroup.add(guide.groupCurveLine);
  }
  updateGroupCurveDisplay(guide);
  return guide.groupCurveLine;
}

function groupCurveDeformationPairs(guide) {
  return groupCurveControlIndices(guide).map((index) => ({
    rest: curveLatticeRestPoint(guide, index),
    current: curveLatticeEditablePoint(guide, index)
  })).filter((pair) => pair.rest && pair.current);
}

function curveLatticeDeformationPairs(guide) {
  const pairs = [];
  const appendPairs = (restPoints, currentPoints) => {
    const count = Math.min(restPoints?.length || 0, currentPoints?.length || 0);
    for (let index = 0; index < count; index += 1) {
      pairs.push({ rest: restPoints[index], current: currentPoints[index] });
    }
  };
  appendPairs(guide.deformRestPoints, guide.points);
  appendPairs(guide.deformRestRootPoints, guide.rootPoints);
  appendPairs(guide.deformRestBottomPoints, guide.bottomPoints);
  return pairs;
}

function groupLatticeOffsetAtPoint(point, deformationPairs) {
  const nearest = deformationPairs
    .map((pair) => ({ pair, distanceSq: point.distanceToSquared(pair.rest) }))
    .sort((a, b) => a.distanceSq - b.distanceSq)
    .slice(0, Math.min(6, deformationPairs.length));
  if (!nearest.length) return new THREE.Vector3();
  if (nearest[0].distanceSq < 1e-8) {
    return nearest[0].pair.current.clone().sub(nearest[0].pair.rest);
  }
  const offset = new THREE.Vector3();
  let totalWeight = 0;
  nearest.forEach(({ pair, distanceSq }) => {
    const weight = 1 / Math.pow(distanceSq + 0.0125, 1.5);
    offset.addScaledVector(pair.current.clone().sub(pair.rest), weight);
    totalWeight += weight;
  });
  return offset.divideScalar(Math.max(1e-8, totalWeight));
}

function updateGroupCurveLatticeStrands(guide) {
  if (!editingCurveLatticeDeformation(guide)) return;
  const deformationPairs = GROUP_CURVE_FEATURE_ENABLED
    ? groupCurveDeformationPairs(guide)
    : curveLatticeDeformationPairs(guide);
  if (!deformationPairs.length) return;
  locks
    .filter((lock) => (lock.scalpRegion || "unassigned") === guide.scalpRegion)
    .forEach((lock) => {
      if (!lock.groupLatticeBasePoints || lock.groupLatticeBasePoints.length !== lock.points.length) {
        lock.groupLatticeBasePoints = lock.points.map((point) => point.clone());
      }
      lock.points.forEach((point, index) => {
        const basePoint = lock.groupLatticeBasePoints[index];
        point.copy(basePoint).add(groupLatticeOffsetAtPoint(basePoint, deformationPairs));
      });
      syncLockFromCurve(lock);
      updateLockGeometry(lock);
    });
}

function updateBoundCurveLatticeStrands(guide) {
  locks.filter((lock) => (
    CURVE_LATTICE_FEATURE_ENABLED
    && editingCurveLatticeDeformation(guide)
    && lock.curveLatticeBinding?.guideId === guide.id
  )).forEach((lock) => {
    const column = THREE.MathUtils.clamp(lock.curveLatticeBinding.column, 0, guide.columns - 1);
    const pointCount = Math.max(4, guide.rows + (guide.bottomExtrude > 0.001 ? guide.bottomRows : 0));
    lock.points = curveLatticeColumnPoints(guide, column, pointCount);
    fitPointAttributes(lock, lock.points.length);
    if (lock.curveObjects.handles.length !== lock.points.length) rebuildCurveObjects(lock);
    syncLockFromCurve(lock);
    updateLockGeometry(lock);
    syncActiveMirror(lock);
  });
  updateGroupCurveLatticeStrands(guide);
  updateTopologyStats();
}

function createStrandsFromCurveLattice(guide) {
  if (!guide || guide.type !== "curve-lattice") return;
  pushUndoState();
  const created = [];
  for (let column = 0; column < guide.columns; column += 1) {
    const existing = locks.find((lock) => lock.curveLatticeBinding?.guideId === guide.id && lock.curveLatticeBinding.column === column);
    if (existing) {
      created.push(existing);
      continue;
    }
    const pointCount = Math.max(4, guide.rows + (guide.bottomExtrude > 0.001 ? guide.bottomRows : 0));
    const points = curveLatticeColumnPoints(guide, column, pointCount);
    const root = points[0];
    const lock = addLock("front", {
      x: root.x,
      y: root.y,
      z: root.z,
      length: new THREE.CatmullRomCurve3(points).getLength(),
      curve: points.at(-1).x - root.x,
      width: Number(drawStrandBrushSizeInput.value),
      scalpRegion: guide.scalpRegion || "bangs",
      color: DEFAULT_HAIR_COLOR,
      points,
      curveLatticeBinding: { guideId: guide.id, column }
    }, { deferUi: true });
    applyPlacedStrandScaleProfile(lock);
    updateLockGeometry(lock);
    created.push(lock);
  }
  renderLockList();
  updateCount();
  if (created.length) selectLock(created[Math.floor(created.length / 2)].id);
}

function addGuide(overrides = {}) {
  const guide = {
    id: crypto.randomUUID(),
    x: 0,
    y: 0.72,
    z: 0.42,
    width: 1.7,
    height: 1.5,
    depth: 1,
    bend: 95,
    verticalBend: 0,
    topCurve: 0,
    bottomCurve: 0,
    density: 12,
    opacity: 0.28,
    ...overrides
  };
  guide.mesh = new THREE.Mesh(
    createGuideGeometry(guide),
    new THREE.MeshStandardMaterial({
      color: 0x75c9ff,
      roughness: 0.54,
      metalness: 0,
      transparent: true,
      opacity: guide.opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  guide.mesh.position.set(guide.x, guide.y, guide.z);
  guide.mesh.userData.guideId = guide.id;
  guide.wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(guide.mesh.geometry),
    new THREE.LineBasicMaterial({ color: 0xb8e7ff, transparent: true, opacity: 0.62, depthWrite: false })
  );
  guide.wire.position.copy(guide.mesh.position);
  guide.wire.userData.guideId = guide.id;
  guideSurfaceGroup.add(guide.mesh, guide.wire);
  guides.push(guide);
  selectGuide(guide.id);
  updateCount();
}

function createGuideGeometry(guide) {
  const bendRadians = THREE.MathUtils.degToRad(guide.bend);
  const verticalRadians = THREE.MathUtils.degToRad(guide.verticalBend);
  const xSegments = Math.max(2, Math.ceil(guide.width * guide.density));
  const ySegments = Math.max(2, Math.ceil(guide.height * guide.density));
  const vertices = [];
  const indices = [];

  for (let iy = 0; iy <= ySegments; iy += 1) {
    const v = iy / ySegments;
    const flatY = (v - 0.5) * guide.height;
    for (let ix = 0; ix <= xSegments; ix += 1) {
      const u = ix / xSegments;
      const flatX = (u - 0.5) * guide.width;
      let x = flatX;
      let y = flatY;
      let z = 0;
      if (Math.abs(bendRadians) > 0.001) {
        const radius = guide.width / bendRadians;
        const phi = (u - 0.5) * bendRadians;
        x = Math.sin(phi) * radius;
        z = (Math.cos(phi) - 1) * radius * guide.depth;
      }
      if (Math.abs(verticalRadians) > 0.001) {
        const edgeCurve = THREE.MathUtils.lerp(guide.bottomCurve, guide.topCurve, v);
        const phiY = (v - 0.5) * verticalRadians;
        const radiusY = guide.height / Math.max(Math.abs(verticalRadians), 0.001);
        const influence = Math.min(1, Math.abs(edgeCurve));
        const curvedY = Math.sin(phiY) * radiusY;
        const curvedZ = (Math.cos(phiY) - 1) * radiusY * guide.depth * Math.sign(verticalRadians);
        y = THREE.MathUtils.lerp(flatY, curvedY, influence);
        z += curvedZ * edgeCurve;
      }
      vertices.push(x, y, z);
    }
  }

  const row = xSegments + 1;
  for (let iy = 0; iy < ySegments; iy += 1) {
    for (let ix = 0; ix < xSegments; ix += 1) {
      const a = iy * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function selectGuide(id) {
  clearMultiPointSelection();
  selectedId = undefined;
  clumpViewportSelection = false;
  selectedStrandGroup = null;
  selectedGuideId = id;
  selectedPoint = null;
  selectedCurveLatticePoint = null;
  updateSelectedPointLabel();
  const guide = getSelectedGuide();
  if (guide?.type === "curve-lattice") activeCurveLatticeGuideId = guide.id;
  const editingCurveLattice = guide?.type === "curve-lattice";
  curveLatticeToggle.classList.toggle("active", editingCurveLattice);
  curveLatticeToggle.setAttribute("aria-pressed", String(editingCurveLattice));
  filterCurveLatticesToGroup(editingCurveLattice ? guide.id : null);
  updateGuideControlsVisibility();
  transformControls.detach();
  locks.forEach((lock) => {
    lock.mesh.material.emissive?.set(0x000000);
    updateCurveObjects(lock, { visible: false });
  });
  renderLockList();
  updateAttributeEditorMode();
  guides.forEach((item) => {
    const selected = item.id === id;
    if (item.type === "curve-lattice") {
      const displayColor = new THREE.Color(item.color);
      if (selected) displayColor.lerp(new THREE.Color(0xffffff), 0.18);
      item.mesh.material.color.copy(displayColor);
      item.wire.material.color.copy(displayColor);
      item.rootMesh?.material.color.copy(displayColor);
      item.rootWire?.material.color.copy(displayColor);
      item.bottomMesh?.material.color.copy(displayColor);
      item.bottomWire?.material.color.copy(displayColor);
    } else {
      item.mesh.material.color.set(selected ? 0x75c9ff : 0x60707a);
    }
    item.mesh.material.opacity = selected ? item.opacity : Math.min(item.opacity, 0.16);
    if (item.rootMesh) item.rootMesh.material.opacity = item.mesh.material.opacity;
    if (item.bottomMesh) item.bottomMesh.material.opacity = item.mesh.material.opacity;
    item.wire.material.opacity = selected ? 0.7 : 0.25;
    if (item.rootWire) item.rootWire.material.opacity = item.wire.material.opacity;
    if (item.bottomWire) item.bottomWire.material.opacity = item.wire.material.opacity;
    if (item.handlesGroup) item.handlesGroup.visible = selected;
  });
  if (!guide) return;
  syncGuideInputs(guide);
  updatePlacementStatus();
}

function updateGuideControlsVisibility() {
  const guide = getSelectedGuide();
  const hasSelectedGuide = Boolean(guide);
  guideControls.forEach((element) => {
    element.classList.toggle("hidden", !hasSelectedGuide);
  });
  document.querySelector("#guideControls").classList.toggle("hidden", !hasSelectedGuide || guide?.type === "curve-lattice");
  curveLatticeControls.classList.toggle(
    "hidden",
    !CURVE_LATTICE_FEATURE_ENABLED || guide?.type !== "curve-lattice"
  );
  guidePanelTitle.textContent = guide?.type === "curve-lattice" ? "Curve Lattice" : "Curve Guides";
}

function getSelectedGuide() {
  return guides.find((guide) => guide.id === selectedGuideId);
}

function syncGuideInputs(guide) {
  if (guide.type === "curve-lattice") {
    curveLatticeOpacityInput.value = guide.opacity;
    curveLatticeBottomExtrudeInput.value = guide.bottomExtrude;
    curveLatticeBottomExtrudeValue.value = guide.bottomExtrude.toFixed(2);
    curveLatticeBottomRowsInput.value = guide.bottomRows;
    curveLatticeBottomRowsValue.value = String(guide.bottomRows);
    return;
  }
  guideInputs.x.value = guide.x;
  guideInputs.y.value = guide.y;
  guideInputs.z.value = guide.z;
  guideInputs.width.value = guide.width;
  guideInputs.height.value = guide.height;
  guideInputs.depth.value = guide.depth;
  guideInputs.bend.value = guide.bend;
  guideInputs.verticalBend.value = guide.verticalBend;
  guideInputs.topCurve.value = guide.topCurve;
  guideInputs.bottomCurve.value = guide.bottomCurve;
  guideInputs.density.value = guide.density;
  guideInputs.opacity.value = guide.opacity;
}

function updateGuideGeometry(guide) {
  if (guide.type === "curve-lattice") {
    updateCurveLatticeGeometry(guide);
    selectGuide(guide.id);
    return;
  }
  guide.mesh.geometry.dispose();
  guide.wire.geometry.dispose();
  guide.mesh.geometry = createGuideGeometry(guide);
  guide.wire.geometry = new THREE.WireframeGeometry(guide.mesh.geometry);
  guide.mesh.position.set(guide.x, guide.y, guide.z);
  guide.wire.position.copy(guide.mesh.position);
  guide.mesh.material.opacity = guide.opacity;
  selectGuide(guide.id);
}

function setActiveTool(tool) {
  // Place Strand is retained internally for legacy project compatibility only.
  if (tool === "place") tool = "select";
  if (scalpBuilderEditing || scalpPaintEditing || headSetupEditing || scalpShapeEditing) {
    exitSetupEditors();
  }
  if (tool !== "place") finishPlacementFlow();
  if (!["draw", "braid"].includes(tool)) finishDrawStrandStroke(null, { cancel: true });
  if (!["draw", "braid"].includes(tool)) drawStrandBrushCursor.visible = false;
  if (["place", "draw", "braid"].includes(tool) && scalpShapeEditing) setScalpShapeEditing(false);
  if (tool !== "move") endViewPlaneMove();
  activeTool = tool;
  autoShowScalpGuideForActiveTool();
  if (tool !== "select") {
    altOrbitDrag = null;
    selectPointerCapture = null;
  }
  updateInteractionLocks();
  updateScalpEditingVisibility();
  modeToolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  transformControls.detach();
  if (!["relax", "place", "draw", "braid"].includes(tool)) configureTransformControls(tool);
  locks.forEach((lock) => updateCurveObjects(lock, { visible: lock.id === selectedId }));
  if (["move", "rotate", "scale"].includes(tool) && selectedControlPoints.length) {
    const strandSelection = selectedControlPoints.find((point) => point.type === "strand");
    const latticeSelection = selectedControlPoints.find((point) => point.type === "lattice");
    if (strandSelection) {
      selectedPoint = { lockId: strandSelection.lockId, pointIndex: strandSelection.pointIndex };
      const lock = locks.find((item) => item.id === strandSelection.lockId);
      const handle = lock?.curveObjects?.handles[strandSelection.pointIndex];
      if (handle && !(tool === "move" && viewPlaneMoveActiveForView())) {
        attachTransformForCurvePoint(lock, strandSelection.pointIndex, handle);
      }
    } else if (latticeSelection) {
      selectedCurveLatticePoint = { guideId: latticeSelection.guideId, pointIndex: latticeSelection.pointIndex };
      const guide = guides.find((item) => item.id === latticeSelection.guideId);
      const handle = guide?.handlesGroup?.children[latticeSelection.pointIndex];
      if (handle && !(tool === "move" && viewPlaneMoveActiveForView())) transformControls.attach(handle);
    }
  }
  updateAttributeEditorMode();
  updateViewPlaneGrid();
  updatePlacementStatus();
}

function setDrawStrandMode(mode) {
  if (!["standard", "clump", "coil"].includes(mode)) return;
  finishDrawStrandStroke(null, { cancel: true });
  drawStrandMode = mode;
  drawBrushPresetInput.value = mode;
  syncDrawCurlControls();
  updatePlacementStatus();
}

function setObjectSpaceEditing(enabled) {
  objectSpaceEditing = enabled;
  spaceToggle.classList.toggle("active", objectSpaceEditing);
  spaceToggle.title = objectSpaceEditing ? "Transform space: Object (O)" : "Transform space: World (O)";
  transformSpaceButtons.forEach((button) => {
    const active = button.dataset.transformSpace === (objectSpaceEditing ? "object" : "world");
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  configureTransformControls(activeTool);
  updatePlacementStatus();
}

function setHierarchyEditing(enabled) {
  hierarchyEditing = enabled;
  if (hierarchyEditing) proportionalEditing = false;
  if (!proportionalEditing) endProportionalSizeEdit();
  hierarchyToggle.classList.toggle("active", hierarchyEditing);
  proportionalToggle.classList.toggle("active", proportionalEditing);
  locks.forEach((lock) => updateLockGeometry(lock));
  locks.forEach((lock) => updateCurveObjects(lock, { visible: lock.id === selectedId }));
  updateAttributeEditorMode();
  updatePlacementStatus();
}

function setProportionalEditing(enabled) {
  proportionalEditing = enabled;
  if (proportionalEditing) hierarchyEditing = false;
  proportionalToggle.classList.toggle("active", proportionalEditing);
  hierarchyToggle.classList.toggle("active", hierarchyEditing);
  locks.forEach((lock) => updateLockGeometry(lock));
  locks.forEach((lock) => updateCurveObjects(lock, { visible: lock.id === selectedId }));
  updateScalpBuilderHandleColors();
  if (!proportionalEditing) endProportionalSizeEdit();
  updateAttributeEditorMode();
  updatePlacementStatus();
}

function beginProportionalSizeEdit(event) {
  if (!proportionalEditing || proportionalSizeEdit) return;
  proportionalSizeEdit = {
    startX: event.clientX ?? lastPointer.x,
    startY: event.clientY ?? lastPointer.y,
    startRadius: Number(proportionalRadiusInput.value),
    didDrag: false
  };
  updateInteractionLocks();
  updatePlacementStatus();
}

function updateProportionalSizeEdit(event) {
  if (!proportionalSizeEdit) return;
  const drag = (event.clientX - proportionalSizeEdit.startX) - (event.clientY - proportionalSizeEdit.startY);
  if (Math.abs(drag) >= 3) proportionalSizeEdit.didDrag = true;
  const nextRadius = THREE.MathUtils.clamp(proportionalSizeEdit.startRadius + drag / 70, Number(proportionalRadiusInput.min), Number(proportionalRadiusInput.max));
  proportionalRadiusInput.value = nextRadius.toFixed(1);
  refreshProportionalPreview();
  updatePlacementStatus();
  event.preventDefault();
}

function endProportionalSizeEdit() {
  if (!proportionalSizeEdit) return;
  proportionalSizeEdit = null;
  updateInteractionLocks();
  updatePlacementStatus();
}

function activateProportionalHotkeyHold() {
  const press = proportionalHotkeyPress;
  if (!press || press.wasEnabled || press.activatedByHold) return;
  press.activatedByHold = true;
  setProportionalEditing(true);
  beginProportionalSizeEdit({ clientX: press.startX, clientY: press.startY });
}

function refreshProportionalPreview() {
  locks.forEach((lock) => updateLockGeometry(lock));
  locks.forEach((lock) => updateCurveObjects(lock, { visible: lock.id === selectedId }));
  updateScalpBuilderHandleColors();
}

function updateInteractionLocks() {
  controls.enabled = !selectPointerCapture && !transformDragging && !relaxEdit && !proportionalSizeEdit && !proportionalHotkeyPress && !scalpLatticeDrag && !scalpPaintDrag && !scalpBuilderStroke && !viewSnapDrag && !viewPlaneMoveDrag && !drawStrandStroke && !selectionMarqueeDrag;
  transformControls.enabled = !proportionalSizeEdit && !proportionalHotkeyPress && !scalpBuilderStroke && !viewSnapDrag && !viewPlaneMoveDrag && !drawStrandStroke;
}

function configureTransformControls(tool) {
  transformControls.setMode(toolModes[tool]);
  transformControls.setSpace(objectSpaceEditing ? "local" : "world");
  transformControls.showX = true;
  transformControls.showY = tool !== "scale";
  transformControls.showZ = true;
}

function pullMoveActive() {
  return activeTool === "move" && pullMoveEnabled;
}

function updatePullGuideVisual() {
  const lockId = pullTarget.userData.lockId;
  const pointIndex = pullTarget.userData.pointIndex;
  const lock = locks.find((item) => item.id === lockId);
  const point = lock?.points?.[pointIndex];
  const usingPullTarget = transformControls.object === pullTarget || viewPlaneMoveDrag?.handle === pullTarget;
  const visible = pullMoveActive() && usingPullTarget && Boolean(point);
  pullGuide.visible = visible;
  if (!visible) return;
  const position = pullGuide.geometry.getAttribute("position");
  position.setXYZ(0, point.x, point.y, point.z);
  position.setXYZ(1, pullTarget.position.x, pullTarget.position.y, pullTarget.position.z);
  position.needsUpdate = true;
  pullGuide.geometry.computeBoundingSphere();
}

function attachTransformForCurvePoint(lock, pointIndex, handle) {
  if (!lock || !handle) return;
  if (!pullMoveActive()) {
    pullGuide.visible = false;
    transformControls.attach(handle);
    return;
  }
  pullTarget.position.copy(lock.points[pointIndex]);
  pullTarget.quaternion.identity();
  pullTarget.scale.set(1, 1, 1);
  pullTarget.userData.lockId = lock.id;
  pullTarget.userData.pointIndex = pointIndex;
  pullTarget.userData.pullTarget = true;
  transformControls.setMode("translate");
  transformControls.setSpace("world");
  transformControls.showX = true;
  transformControls.showY = true;
  transformControls.showZ = true;
  transformControls.attach(pullTarget);
  updatePullGuideVisual();
}

function pointerHitsTransformGizmo(event) {
  if (!transformControls.enabled || !transformControls.object || !transformControls.visible) return false;
  if (transformControls.dragging) return true;
  const picker = transformControls._gizmo?.picker?.[transformControls.mode];
  if (!picker) return Boolean(transformControls.axis);
  rayFromViewportEvent(event);
  return raycaster.intersectObject(picker, true).some((hit) => {
    let pickerHandle = hit.object;
    while (pickerHandle && pickerHandle !== picker) {
      if (pickerHandle.visible === false) return false;
      pickerHandle = pickerHandle.parent;
    }
    return true;
  });
}

function beginHandleEdit(handle = transformControls.object) {
  if (!handle?.userData?.lockId) return;
  const lock = locks.find((item) => item.id === handle.userData.lockId);
  if (!lock) return;
  const hadMirrorPartner = Boolean(mirrorPartnerFor(lock));
  syncActiveMirror(lock, { refreshUi: !hadMirrorPartner });
  const selectedIndices = selectedControlPoints
    .filter((point) => point.type === "strand" && point.lockId === lock.id)
    .map((point) => point.pointIndex);
  if (!selectedIndices.includes(handle.userData.pointIndex)) selectedIndices.splice(0, selectedIndices.length, handle.userData.pointIndex);
  activeHandleEdit = {
    lockId: lock.id,
    pointIndex: handle.userData.pointIndex,
    tool: activeTool,
    points: lock.points.map((point) => point.clone()),
    groupLatticeBasePoints: lock.groupLatticeBasePoints?.map((point) => point.clone()) || null,
    pointTwists: [...lock.pointTwists],
    pointScales: lock.pointScales.map((scale) => ({ x: scale.x, z: scale.z })),
    handlePosition: handle.position.clone(),
    handleQuaternion: handle.quaternion.clone(),
    handleScale: handle.scale.clone(),
    selectedIndices
  };
}

function updateGroupLatticeBaseFromHandleEdit(lock) {
  const edit = activeHandleEdit;
  if (!lock.groupLatticeBasePoints || !edit?.groupLatticeBasePoints) return;
  if (lock.groupLatticeBasePoints.length !== lock.points.length || edit.points.length !== lock.points.length) return;
  lock.points.forEach((point, index) => {
    lock.groupLatticeBasePoints[index]
      .copy(edit.groupLatticeBasePoints[index])
      .add(point.clone().sub(edit.points[index]));
  });
}

function multiPointHandleEditActive() {
  return (activeHandleEdit?.selectedIndices?.length || 0) > 1;
}

function applyMultiMove(lock, handle) {
  const edit = activeHandleEdit;
  const delta = handle.position.clone().sub(edit.handlePosition);
  edit.selectedIndices.forEach((index) => lock.points[index].copy(edit.points[index]).add(delta));
}

function applyMultiRotate(lock, pointIndex, handle) {
  const edit = activeHandleEdit;
  const activeTwist = twistFromHandle(lock, pointIndex, handle);
  const deltaTwist = activeTwist - edit.pointTwists[pointIndex];
  edit.selectedIndices.forEach((index) => {
    lock.pointTwists[index] = edit.pointTwists[index] + deltaTwist;
  });
}

function applyMultiScale(lock, handle) {
  const edit = activeHandleEdit;
  const ratioX = Math.max(0.18, handle.scale.x) / Math.max(0.18, edit.handleScale.x);
  const ratioZ = Math.max(0.18, handle.scale.z) / Math.max(0.18, edit.handleScale.z);
  edit.selectedIndices.forEach((index) => {
    setPointScale(lock, index, edit.pointScales[index].x * ratioX, edit.pointScales[index].z * ratioZ);
  });
}

function applyHierarchicalMove(lock, pointIndex, handle) {
  const edit = activeHandleEdit;
  const delta = handle.position.clone().sub(edit.handlePosition);
  for (let i = pointIndex; i < lock.points.length; i += 1) {
    const depth = recursiveHierarchyTransforms ? i - pointIndex + 1 : 1;
    lock.points[i].copy(edit.points[i]).addScaledVector(delta, depth);
  }
}

function applySingleMove(lock, pointIndex, handle) {
  lock.points[pointIndex].copy(handle.position);
}

function applyPullMove(lock, pointIndex, handle) {
  const edit = activeHandleEdit;
  if (!edit?.points?.length || pointIndex < 0 || pointIndex >= edit.points.length) return;
  const solved = solvePulledStrand(edit.points, pointIndex, handle.position, 0, pullRigidity);
  const constrained = pullCollisionEnabled ? constrainPullPointsOutsideHead(solved, lock) : solved;
  constrained.forEach((point, index) => lock.points[index].copy(point));
}

function pullHeadCollisionContext() {
  const edit = activeHandleEdit;
  if (edit?.pullHeadCollisionContext) return edit.pullHeadCollisionContext;
  const meshes = scalpBuilderHeadMeshes();
  if (!meshes.length) return null;
  const bounds = new THREE.Box3();
  meshes.forEach((mesh) => bounds.expandByObject(mesh));
  if (bounds.isEmpty()) return null;
  const size = bounds.getSize(new THREE.Vector3());
  const context = {
    meshes,
    center: bounds.getCenter(new THREE.Vector3()),
    rayDistance: Math.max(size.x, size.y, size.z) * 1.6,
    raycaster: new THREE.Raycaster()
  };
  if (edit) edit.pullHeadCollisionContext = context;
  return context;
}

function constrainPullPointsOutsideHead(points, lock) {
  const context = pullHeadCollisionContext();
  if (!context) return points;
  const margin = Math.max(0.018, Number(lock.width ?? lock.baseWidth ?? 0.16) * 0.24);
  return points.map((point, index) => {
    if (index === 0) return point;
    const direction = point.clone().sub(context.center);
    if (direction.lengthSq() < 0.000001) direction.set(0, 1, 0);
    direction.normalize();
    context.raycaster.set(
      context.center.clone().addScaledVector(direction, context.rayDistance),
      direction.clone().negate()
    );
    context.raycaster.near = 0;
    context.raycaster.far = context.rayDistance * 2;
    const hit = context.raycaster.intersectObjects(context.meshes, false)[0];
    if (!hit) return point;
    const requiredDistance = hit.point.distanceTo(context.center) + margin;
    if (point.distanceTo(context.center) >= requiredDistance) return point;
    return context.center.clone().addScaledVector(direction, requiredDistance);
  });
}

function applyProportionalMove(lock, pointIndex, handle) {
  const edit = activeHandleEdit;
  const delta = handle.position.clone().sub(edit.handlePosition);
  for (let i = 0; i < lock.points.length; i += 1) {
    const weight = proportionalWeight(i, pointIndex);
    if (weight <= 0) continue;
    lock.points[i].copy(edit.points[i]).add(delta.clone().multiplyScalar(weight));
  }
}

function viewPlaneNormal() {
  return nearestCardinalAxis(camera.position.clone().sub(controls.target));
}

function isCameraInSnappedView() {
  if (!shiftSnappedViewActive) return false;
  const direction = camera.position.clone().sub(controls.target).normalize();
  const stillSnapped = direction.dot(nearestCardinalAxis(direction)) >= 0.9995;
  if (!stillSnapped) shiftSnappedViewActive = false;
  return stillSnapped;
}

function viewPlaneMoveActiveForView() {
  return viewPlaneMoveEnabled && (!viewPlaneMoveSnappedOnly || isCameraInSnappedView());
}

function updateViewPlaneGrid() {
  const lock = selectedPoint
    ? locks.find((item) => item.id === selectedPoint.lockId)
    : null;
  const point = lock?.points[selectedPoint?.pointIndex];
  const latticeGuide = selectedCurveLatticePoint
    ? guides.find((item) => item.id === selectedCurveLatticePoint.guideId)
    : null;
  const latticePoint = latticeGuide && selectedCurveLatticePoint
    ? curveLatticeEditablePoint(latticeGuide, selectedCurveLatticePoint.pointIndex)
    : null;
  const selectedMovePoint = latticePoint || point;
  const selectedMoveHandle = latticePoint
    ? latticeGuide?.handlesGroup?.children[selectedCurveLatticePoint.pointIndex]
    : lock?.curveObjects?.handles[selectedPoint?.pointIndex];
  const directMoveActive = viewPlaneMoveActiveForView() && activeTool === "move";
  const strokeToolActive = ["draw", "braid"].includes(activeTool);
  const freeDrawActive = strokeToolActive && Boolean(drawStrandStroke?.freePlane);
  const originPlaneActive = strokeToolActive && activeStrokeSurfaceValue() === "contextual-plane";
  const strandPointActive = Boolean(point) && lock.id === selectedId;
  const latticePointActive = Boolean(latticePoint) && latticeGuide.id === activeCurveLatticeGuideId;
  const expectedMoveHandle = strandPointActive && pullMoveActive() ? pullTarget : selectedMoveHandle;
  const visible = originPlaneActive || freeDrawActive || (directMoveActive && (strandPointActive || latticePointActive));
  viewPlaneFill.visible = visible;
  viewPlaneGrid.visible = visible;
  if (!visible) {
    if (
      activeTool === "move" &&
      selectedMovePoint &&
      (strandPointActive || latticePointActive) &&
      !viewPlaneMoveDrag &&
      transformControls.object !== expectedMoveHandle
    ) {
      if (selectedMoveHandle) {
        configureTransformControls("move");
        if (strandPointActive) attachTransformForCurvePoint(lock, selectedPoint.pointIndex, selectedMoveHandle);
        else transformControls.attach(selectedMoveHandle);
      }
    }
    return;
  }
  if (!viewPlaneMoveDrag && transformControls.object) transformControls.detach();
  const normal = drawStrandStroke?.freePlane?.normal || viewPlaneMoveDrag?.normal || viewPlaneNormal();
  const origin = originPlaneActive
    ? new THREE.Vector3(0, 0, 0)
    : drawStrandStroke?.freePlane?.origin || viewPlaneMoveDrag?.planeOrigin || selectedMovePoint;
  viewPlaneGrid.position.copy(origin);
  viewPlaneGrid.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  viewPlaneFill.position.copy(origin);
  viewPlaneFill.quaternion.copy(viewPlaneGrid.quaternion);
}

function setViewPlaneMove(enabled) {
  endViewPlaneMove();
  viewPlaneMoveEnabled = Boolean(enabled);
  viewPlaneMoveInput.checked = viewPlaneMoveEnabled;
  viewPlaneMoveSnappedOnlyInput.disabled = !viewPlaneMoveEnabled;
  viewPlaneMoveSnappedSetting.classList.toggle("disabled", !viewPlaneMoveEnabled);
  if (viewPlaneMoveEnabled) transformControls.detach();
  updateViewPlaneGrid();
  updateInteractionLocks();
}

function setViewPlaneMoveSnappedOnly(enabled) {
  endViewPlaneMove();
  viewPlaneMoveSnappedOnly = Boolean(enabled);
  viewPlaneMoveSnappedOnlyInput.checked = viewPlaneMoveSnappedOnly;
  updateViewPlaneGrid();
  updateInteractionLocks();
}

function rayFromViewportEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray;
}

function beginViewPlaneMove(lock, handle, event) {
  if (!viewPlaneMoveActiveForView() || activeTool !== "move" || event.button !== 0) return false;
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;
  const latticeGuideId = handle.userData.curveLatticeGuideId;
  const latticePointIndex = handle.userData.curveLatticePointIndex;
  const isLatticePoint = latticeGuideId !== undefined && latticePointIndex !== undefined;
  if (!isLatticePoint && !lock) return false;
  const normal = viewPlaneNormal();
  const planeOrigin = handle.position.clone();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, planeOrigin);
  const startIntersection = rayFromViewportEvent(event).intersectPlane(plane, new THREE.Vector3());
  if (!startIntersection) return false;

  pushUndoState();
  transformControls.detach();
  if (isLatticePoint) beginCurveLatticeMultiEdit(handle);
  else beginHandleEdit(handle);
  const dragHandle = !isLatticePoint && pullMoveActive() ? pullTarget : handle;
  if (dragHandle === pullTarget) {
    pullTarget.position.copy(handle.position);
    pullTarget.quaternion.identity();
    pullTarget.scale.set(1, 1, 1);
    pullTarget.userData.lockId = lock.id;
    pullTarget.userData.pointIndex = handle.userData.pointIndex;
    pullTarget.userData.pullTarget = true;
  }
  viewPlaneMoveDrag = {
    pointerId: event.pointerId,
    kind: isLatticePoint ? "curve-lattice" : "strand",
    lockId: lock?.id,
    guideId: latticeGuideId,
    pointIndex: isLatticePoint ? latticePointIndex : handle.userData.pointIndex,
    handle: dragHandle,
    handlePosition: dragHandle.position.clone(),
    normal,
    planeOrigin,
    plane,
    startIntersection
  };
  renderer.domElement.setPointerCapture?.(event.pointerId);
  renderer.domElement.style.cursor = "move";
  updateViewPlaneGrid();
  updateInteractionLocks();
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}

function updateViewPlaneMove(event) {
  if (!viewPlaneMoveDrag || event.pointerId !== viewPlaneMoveDrag.pointerId) return;
  const intersection = rayFromViewportEvent(event).intersectPlane(viewPlaneMoveDrag.plane, new THREE.Vector3());
  if (!intersection) return;
  viewPlaneMoveDrag.handle.position
    .copy(viewPlaneMoveDrag.handlePosition)
    .add(intersection.sub(viewPlaneMoveDrag.startIntersection));

  if (viewPlaneMoveDrag.kind === "curve-lattice") {
    const guide = guides.find((item) => item.id === viewPlaneMoveDrag.guideId);
    if (!guide) {
      endViewPlaneMove(event);
      return;
    }
    if (activeLatticeMultiEdit) applyCurveLatticeMultiTransform(viewPlaneMoveDrag.handle);
    else updateCurveLatticeFromHandle(viewPlaneMoveDrag.handle);
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  const lock = locks.find((item) => item.id === viewPlaneMoveDrag.lockId);
  if (!lock || !activeHandleEdit) {
    endViewPlaneMove(event);
    return;
  }

  if (pullMoveActive()) applyPullMove(lock, viewPlaneMoveDrag.pointIndex, viewPlaneMoveDrag.handle);
  else if (multiPointHandleEditActive()) applyMultiMove(lock, viewPlaneMoveDrag.handle);
  else if (hierarchyEditing) applyHierarchicalMove(lock, viewPlaneMoveDrag.pointIndex, viewPlaneMoveDrag.handle);
  else if (proportionalEditing) applyProportionalMove(lock, viewPlaneMoveDrag.pointIndex, viewPlaneMoveDrag.handle);
  else applySingleMove(lock, viewPlaneMoveDrag.pointIndex, viewPlaneMoveDrag.handle);
  updateGroupLatticeBaseFromHandleEdit(lock);
  syncLockFromCurve(lock);
  updateLockGeometry(lock);
  syncActiveMirror(lock);
  syncInputs(lock);
  event.preventDefault();
  event.stopImmediatePropagation();
}

function endViewPlaneMove(event) {
  if (!viewPlaneMoveDrag || (event?.pointerId !== undefined && event.pointerId !== viewPlaneMoveDrag.pointerId)) return;
  const pointerId = viewPlaneMoveDrag.pointerId;
  const editedLock = locks.find((item) => item.id === activeHandleEdit?.lockId);
  commitClumpMemberRestState(editedLock);
  commitClumpMemberRestState(mirrorPartnerFor(editedLock));
  viewPlaneMoveDrag = null;
  flushPendingLockGeometryUpdates();
  scheduleStrandCollisionResolve();
  activeHandleEdit = null;
  activeLatticeMultiEdit = null;
  if (renderer.domElement.hasPointerCapture?.(pointerId)) renderer.domElement.releasePointerCapture(pointerId);
  renderer.domElement.style.cursor = "";
  updateViewPlaneGrid();
  updateInteractionLocks();
  event?.preventDefault();
  event?.stopImmediatePropagation();
}

function applyHierarchicalRotate(lock, pointIndex, handle) {
  const edit = activeHandleEdit;
  const pivot = edit.points[pointIndex];
  const deltaQ = handle.quaternion.clone().multiply(edit.handleQuaternion.clone().invert());
  const originalFrame = curveFrameAtSnapshot(lock, edit.points, edit.pointTwists, pointIndex, 0);
  const originalHandleZ = new THREE.Vector3(0, 0, 1).applyQuaternion(edit.handleQuaternion).normalize();
  const handleZ = new THREE.Vector3(0, 0, 1).applyQuaternion(handle.quaternion).normalize();
  const deltaTwist = signedAngleAroundAxis(originalHandleZ, handleZ, originalFrame.y);

  lock.points[pointIndex].copy(edit.points[pointIndex]);
  if (recursiveHierarchyTransforms) {
    const accumulatedQ = new THREE.Quaternion();
    for (let i = pointIndex + 1; i < lock.points.length; i += 1) {
      accumulatedQ.multiply(deltaQ);
      const segment = edit.points[i].clone().sub(edit.points[i - 1]).applyQuaternion(accumulatedQ);
      lock.points[i].copy(lock.points[i - 1]).add(segment);
    }
  } else {
    for (let i = pointIndex + 1; i < lock.points.length; i += 1) {
      lock.points[i].copy(edit.points[i]).sub(pivot).applyQuaternion(deltaQ).add(pivot);
    }
  }
  for (let i = pointIndex; i < lock.pointTwists.length; i += 1) {
    const depth = recursiveHierarchyTransforms ? i - pointIndex + 1 : 1;
    lock.pointTwists[i] = edit.pointTwists[i] + deltaTwist * depth;
  }
}

function applySingleRotate(lock, pointIndex, handle) {
  lock.pointTwists[pointIndex] = twistFromHandle(lock, pointIndex, handle);
}

function applyProportionalRotate(lock, pointIndex, handle) {
  const edit = activeHandleEdit;
  const pivot = edit.points[pointIndex];
  const deltaQ = handle.quaternion.clone().multiply(edit.handleQuaternion.clone().invert());
  const originalFrame = curveFrameAtSnapshot(lock, edit.points, edit.pointTwists, pointIndex, 0);
  const originalHandleZ = new THREE.Vector3(0, 0, 1).applyQuaternion(edit.handleQuaternion).normalize();
  const handleZ = new THREE.Vector3(0, 0, 1).applyQuaternion(handle.quaternion).normalize();
  const deltaTwist = signedAngleAroundAxis(originalHandleZ, handleZ, originalFrame.y);
  const identity = new THREE.Quaternion();

  for (let i = 0; i < lock.points.length; i += 1) {
    const weight = proportionalWeight(i, pointIndex);
    if (weight <= 0) continue;
    const weightedQ = identity.clone().slerp(deltaQ, weight);
    lock.points[i].copy(edit.points[i]).sub(pivot).applyQuaternion(weightedQ).add(pivot);
    lock.pointTwists[i] = edit.pointTwists[i] + deltaTwist * weight;
  }
}

function applyHierarchicalScale(lock, pointIndex, handle) {
  const edit = activeHandleEdit;
  const ratioX = Math.max(0.18, handle.scale.x) / Math.max(0.18, edit.handleScale.x);
  const ratioZ = Math.max(0.18, handle.scale.z) / Math.max(0.18, edit.handleScale.z);
  for (let i = pointIndex; i < lock.pointScales.length; i += 1) {
    const depth = recursiveHierarchyTransforms ? i - pointIndex + 1 : 1;
    setPointScale(lock, i, edit.pointScales[i].x * Math.pow(ratioX, depth), edit.pointScales[i].z * Math.pow(ratioZ, depth));
  }
}

function applySingleScale(lock, pointIndex, handle) {
  setPointScale(lock, pointIndex, handle.scale.x, handle.scale.z);
}

function applyProportionalScale(lock, pointIndex, handle) {
  const edit = activeHandleEdit;
  const ratioX = Math.max(0.18, handle.scale.x) / Math.max(0.18, edit.handleScale.x);
  const ratioZ = Math.max(0.18, handle.scale.z) / Math.max(0.18, edit.handleScale.z);
  for (let i = 0; i < lock.pointScales.length; i += 1) {
    const weight = proportionalWeight(i, pointIndex);
    if (weight <= 0) continue;
    setPointScale(
      lock,
      i,
      edit.pointScales[i].x * (1 + (ratioX - 1) * weight),
      edit.pointScales[i].z * (1 + (ratioZ - 1) * weight)
    );
  }
}

function setPointScale(lock, pointIndex, x, z) {
  const nextScale = {
    x: Math.max(0.18, x),
    z: Math.max(0.18, z)
  };
  lock.pointScales[pointIndex] = nextScale;
  lock.pointWidths[pointIndex] = (nextScale.x + nextScale.z) / 2;
}

function proportionalWeight(index, originIndex) {
  if (proportionalRootLocked && Math.abs(index) < 0.0001) return 0;
  const radius = Number(proportionalRadiusInput?.value || 2.5);
  const falloff = Number(proportionalFalloffInput?.value || 0.65);
  const distance = Math.abs(index - originIndex);
  if (distance > radius) return 0;
  if (distance === 0) return 1;
  const linear = THREE.MathUtils.clamp(1 - distance / Math.max(0.001, radius), 0, 1);
  const smooth = linear * linear * (3 - 2 * linear);
  return THREE.MathUtils.lerp(1, smooth, falloff);
}

function strandInfluenceColor(lock, t) {
  if (!proportionalEditing || selectedPoint?.lockId !== lock.id) {
    return new THREE.Color(1, 1, 1);
  }
  const scaledIndex = t * (lock.points.length - 1);
  const weight = proportionalWeight(scaledIndex, selectedPoint.pointIndex);
  const stops = [
    { weight: 0, color: new THREE.Color(0x77777d) },
    { weight: 0.16, color: new THREE.Color(0x4d84ff) },
    { weight: 0.38, color: new THREE.Color(0x36d87c) },
    { weight: 0.6, color: new THREE.Color(0xffe35a) },
    { weight: 0.8, color: new THREE.Color(0xff8b2f) },
    { weight: 1, color: new THREE.Color(0xff3030) }
  ];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const start = stops[i];
    const end = stops[i + 1];
    if (weight <= end.weight) {
      const blend = THREE.MathUtils.clamp((weight - start.weight) / (end.weight - start.weight), 0, 1);
      return start.color.clone().lerp(end.color, blend);
    }
  }
  return stops.at(-1).color.clone();
}

function beginRelaxEdit(lock, pointIndex, event) {
  if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;
  if (pointIndex <= 0 || pointIndex >= lock.points.length - 1) return false;
  pushUndoState();
  const hadMirrorPartner = Boolean(mirrorPartnerFor(lock));
  syncActiveMirror(lock, { refreshUi: !hadMirrorPartner });
  const originalPoints = lock.points.map((point) => point.clone());
  const originalScales = lock.pointScales.map((scale) => ({ x: scale.x, z: scale.z }));
  relaxEdit = {
    lockId: lock.id,
    pointIndex,
    startX: event.clientX,
    startY: event.clientY,
    originalPoints,
    originalGroupLatticeBasePoints: lock.groupLatticeBasePoints?.map((point) => point.clone()) || null,
    originalScales
  };
  updateInteractionLocks();
  return true;
}

function updateRelaxEdit(event) {
  if (!relaxEdit || proportionalSizeEdit) return;
  const lock = locks.find((item) => item.id === relaxEdit.lockId);
  if (!lock) return;
  const drag = (event.clientX - relaxEdit.startX) - (event.clientY - relaxEdit.startY);
  const amount = THREE.MathUtils.clamp(drag / 180, 0, 1);
  let relaxedPoints = relaxEdit.originalPoints.map((point) => point.clone());
  let relaxedScales = relaxEdit.originalScales.map((scale) => ({ ...scale }));
  const passStrength = amount * 0.35;
  for (let pass = 0; pass < 6; pass += 1) {
    const sourcePoints = relaxedPoints.map((point) => point.clone());
    const sourceScales = relaxedScales.map((scale) => ({ ...scale }));
    for (let index = 1; index < relaxedPoints.length - 1; index += 1) {
      const weight = proportionalEditing ? proportionalWeight(index, relaxEdit.pointIndex) : index === relaxEdit.pointIndex ? 1 : 0;
      const strength = passStrength * weight;
      if (strength <= 0) continue;
      const midpoint = sourcePoints[index - 1].clone().add(sourcePoints[index + 1]).multiplyScalar(0.5);
      relaxedPoints[index].lerpVectors(sourcePoints[index], midpoint, strength);
      relaxedScales[index] = {
        x: THREE.MathUtils.lerp(sourceScales[index].x, (sourceScales[index - 1].x + sourceScales[index + 1].x) * 0.5, strength),
        z: THREE.MathUtils.lerp(sourceScales[index].z, (sourceScales[index - 1].z + sourceScales[index + 1].z) * 0.5, strength)
      };
    }
  }
  for (let index = 0; index < lock.points.length; index += 1) {
    lock.points[index].copy(relaxedPoints[index]);
    if (lock.groupLatticeBasePoints && relaxEdit.originalGroupLatticeBasePoints) {
      lock.groupLatticeBasePoints[index]
        .copy(relaxEdit.originalGroupLatticeBasePoints[index])
        .add(relaxedPoints[index].clone().sub(relaxEdit.originalPoints[index]));
    }
    setPointScale(lock, index, relaxedScales[index].x, relaxedScales[index].z);
  }
  lock.width = Math.max(0.04, lock.baseWidth * average(lock.pointWidths));
  syncLockFromCurve(lock);
  updateLockGeometry(lock);
  syncActiveMirror(lock);
  syncInputs(lock);
}

function endRelaxEdit() {
  if (!relaxEdit) return;
  const editedLock = locks.find((item) => item.id === relaxEdit.lockId);
  commitClumpMemberRestState(editedLock);
  commitClumpMemberRestState(mirrorPartnerFor(editedLock));
  relaxEdit = null;
  flushPendingLockGeometryUpdates();
  scheduleStrandCollisionResolve();
  updateInteractionLocks();
}

function disposeGuide(guide) {
  guide.mesh.geometry.dispose();
  guide.mesh.material.dispose();
  guide.wire.geometry.dispose();
  guide.wire.material.dispose();
  guide.rootMesh?.geometry.dispose();
  guide.rootMesh?.material.dispose();
  guide.rootWire?.geometry.dispose();
  guide.rootWire?.material.dispose();
  guide.bottomMesh?.geometry.dispose();
  guide.bottomMesh?.material.dispose();
  guide.bottomWire?.geometry.dispose();
  guide.bottomWire?.material.dispose();
  guide.groupCurveLine?.geometry.dispose();
  guide.groupCurveLine?.material.dispose();
  guide.handlesGroup?.children.forEach((handle) => {
    handle.geometry.dispose();
    handle.material.dispose();
  });
}

function removeGuideObjects(guide) {
  guideSurfaceGroup.remove(
    guide.mesh,
    guide.wire,
    guide.rootMesh,
    guide.rootWire,
    guide.bottomMesh,
    guide.bottomWire,
    guide.groupCurveLine
  );
  if (guide.handlesGroup) guideSurfaceGroup.remove(guide.handlesGroup);
}

function strandRadiusAt(lock, t, axis, radiusScale = 1) {
  const shapeCurve = axis === "z" ? lock.depthCurve : lock.taperCurve;
  const axisScale = axis === "z" ? Number(lock.depthScale ?? 1) : Number(lock.widthScale ?? 1);
  return Math.max(0, lock.baseWidth * sampleTaperCurve(shapeCurve, t) * axisScale * radiusScale);
}

function strandCurveParameters(lock, curve, segmentLimit, start = 0, end = 1, minimumSegments = 4) {
  if (!lock.dynamicDensity) return uniformCurveParameters(segmentLimit, start, end);
  return adaptiveCurveParameters(curve, segmentLimit, lock.densityAggression, start, end, minimumSegments);
}

function braidFrameAt(lock, curve, t) {
  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const normal = outwardNormalAtPoint(point, tangent);
  const twist = strandTwistAt(lock, t) + THREE.MathUtils.degToRad(Number(lock.braidRotation ?? 0));
  const z = normal.applyAxisAngle(tangent, twist).normalize();
  const x = new THREE.Vector3().crossVectors(tangent, z).normalize();
  return { point, x, y: tangent, z };
}

function braidFrameAtExtended(lock, curve, t, curveLength = curve.getLength()) {
  const clampedT = THREE.MathUtils.clamp(t, 0, 1);
  const frame = braidFrameAt(lock, curve, clampedT);
  if (t !== clampedT) {
    frame.point.addScaledVector(frame.y, curveLength * (t - clampedT));
  }
  return frame;
}

function createBraidProfileProjector(lock) {
  const profile = lock.sweepProfile?.length >= 4 ? lock.sweepProfile : DEFAULT_SWEEP_PROFILE;
  const offset = Number(lock.profileOffset || 0);
  const bounds = profile.reduce((result, point) => ({
    minX: Math.min(result.minX, point.x),
    maxX: Math.max(result.maxX, point.x),
    minZ: Math.min(result.minZ, point.z + offset),
    maxZ: Math.max(result.maxZ, point.z + offset)
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
  const halfWidth = Math.max(0.0001, (bounds.maxX - bounds.minX) * 0.5);
  const halfDepth = Math.max(0.0001, (bounds.maxZ - bounds.minZ) * 0.5);
  const centerX = (bounds.minX + bounds.maxX) * 0.25;
  const centerZ = (bounds.minZ + bounds.maxZ) * 0.25;

  // Preserve the authored braid topology. Radially projecting it into a sharp
  // strand profile folds isolated seam vertices around profile corners.
  const project = (normalizedX, normalizedZ) => new THREE.Vector2(
    normalizedX * halfWidth + centerX,
    normalizedZ * halfDepth + centerZ
  );
  project.scaleX = halfWidth;
  project.scaleZ = halfDepth;
  return project;
}

function createBraidGeometry(lock) {
  const presetId = lock.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET;
  const preset = braidMeshPresets.get(presetId) || braidMeshPresets.get(DEFAULT_BRAID_MESH_PRESET);
  if (!preset?.body?.geometry || lock.points.length < 2) return null;
  const {
    sourcePosition,
    sourceNormal,
    sourceUv,
    sourcePart,
    sourceSize,
    sourceCenter,
    sourceMinY,
    sourceLength,
    sourceUvBounds,
    uvHeight,
    seamData
  } = preset.body.cache;
  const curve = new THREE.CatmullRomCurve3(lock.points);
  const curveLength = Math.max(0.01, curve.getLength());
  const requestedSegmentLength = THREE.MathUtils.clamp(Number(lock.braidSegmentLength || 0.28), 0.08, 1.2);
  const repeatCount = THREE.MathUtils.clamp(Math.round(curveLength / requestedSegmentLength), 1, 96);
  const projectThroughProfile = createBraidProfileProjector(lock);
  const vertices = [];
  const normals = [];
  const tangents = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const vertexMap = new Map();
  const boundaryVertices = { start: new Map(), end: new Map() };
  const quantize = (value, precision = 10000) => Math.round(value * precision);
  const deformationRows = new Map();
  function deformationAt(t, extended = false) {
    const sampleT = THREE.MathUtils.clamp(t, 0, 1);
    const key = `${extended ? "e" : "b"}|${quantize(t, 1000000)}`;
    if (deformationRows.has(key)) return deformationRows.get(key);
    const frame = extended
      ? braidFrameAtExtended(lock, curve, t, curveLength)
      : braidFrameAt(lock, curve, t);
    const deformation = {
      frame,
      sampleT,
      width: Number(lock.braidWidth || 0.34)
        * sampleTaperCurve(lock.taperCurve, sampleT)
        * Number(lock.widthScale ?? 1)
        * sampleScale(lock.pointScales, sampleT, "x"),
      depth: Number(lock.braidDepth || 0.44)
        * sampleTaperCurve(lock.depthCurve, sampleT)
        * Number(lock.depthScale ?? 1)
        * sampleScale(lock.pointScales, sampleT, "z")
    };
    deformationRows.set(key, deformation);
    return deformation;
  }

  function outputVertex(segmentIndex, sourceIndex) {
    const boundaryData = seamData.get(sourceIndex);
    const sourceX = boundaryData?.x ?? sourcePosition.getX(sourceIndex);
    const sourceY = sourcePosition.getY(sourceIndex);
    const sourceZ = boundaryData?.z ?? sourcePosition.getZ(sourceIndex);
    const partIndex = sourcePart ? Math.round(sourcePart.getX(sourceIndex)) : 0;
    const localT = THREE.MathUtils.clamp((sourceY - sourceMinY) / sourceLength, 0, 1);
    const t = (segmentIndex + localT) / repeatCount;
    const { frame, width, depth } = deformationAt(t);
    const normalizedX = (sourceX - sourceCenter.x) / Math.max(0.0001, sourceSize.x);
    const normalizedZ = (sourceZ - sourceCenter.z) / Math.max(0.0001, sourceSize.z);
    const profilePosition = projectThroughProfile(normalizedX, normalizedZ);
    const position = frame.point.clone()
      .addScaledVector(frame.x, profilePosition.x * width)
      .addScaledVector(frame.z, profilePosition.y * depth);
    const authoredNormal = boundaryData?.normal;
    const sourceNormalX = authoredNormal?.x ?? (sourceNormal ? sourceNormal.getX(sourceIndex) : normalizedX);
    const sourceNormalY = authoredNormal?.y ?? (sourceNormal ? sourceNormal.getY(sourceIndex) : 0);
    const sourceNormalZ = authoredNormal?.z ?? (sourceNormal ? sourceNormal.getZ(sourceIndex) : normalizedZ);
    const longitudinalScale = curveLength / repeatCount / sourceLength;
    const profileWidthScale = Math.max(0.0001, projectThroughProfile.scaleX || 1);
    const profileDepthScale = Math.max(0.0001, projectThroughProfile.scaleZ || 1);
    const worldNormal = new THREE.Vector3()
      .addScaledVector(frame.x, sourceNormalX / Math.max(0.0001, width * profileWidthScale / sourceSize.x))
      .addScaledVector(frame.y, sourceNormalY / Math.max(0.0001, longitudinalScale))
      .addScaledVector(frame.z, sourceNormalZ / Math.max(0.0001, depth * profileDepthScale / sourceSize.z))
      .normalize();
    const uvX = sourceUv ? sourceUv.getX(sourceIndex) : normalizedX + 0.5;
    const sourceV = sourceUv ? (sourceUv.getY(sourceIndex) - sourceUvBounds.min.y) / uvHeight : localT;
    const uvY = segmentIndex + sourceV;
    const seamCoordinate = segmentIndex + localT;
    const key = [
      quantize(seamCoordinate, 100000),
      partIndex,
      quantize(normalizedX),
      quantize(normalizedZ),
      quantize(sourceNormalX),
      quantize(sourceNormalY),
      quantize(sourceNormalZ),
      quantize(uvX, 100000),
      quantize(uvY, 100000)
    ].join("|");
    let outputIndex = vertexMap.get(key);
    if (outputIndex === undefined) {
      outputIndex = vertices.length / 3;
      vertexMap.set(key, outputIndex);
      vertices.push(position.x, position.y, position.z);
      normals.push(worldNormal.x, worldNormal.y, worldNormal.z);
      tangents.push(frame.y.x, frame.y.y, frame.y.z, 1);
      uvs.push(uvX, uvY);
      const color = strandInfluenceColor(lock, t);
      colors.push(color.r, color.g, color.b);
      if (seamCoordinate < 0.0001 || Math.abs(seamCoordinate - repeatCount) < 0.0001) {
        const boundary = seamCoordinate < 0.0001 ? boundaryVertices.start : boundaryVertices.end;
        if (!boundary.has(partIndex)) boundary.set(partIndex, new Map());
        boundary.get(partIndex).set(`${quantize(normalizedX)}|${quantize(normalizedZ)}`, outputIndex);
      }
    }
    return outputIndex;
  }

  for (let segmentIndex = 0; segmentIndex < repeatCount; segmentIndex += 1) {
    for (let sourceIndex = 0; sourceIndex < sourcePosition.count; sourceIndex += 3) {
      indices.push(
        outputVertex(segmentIndex, sourceIndex),
        outputVertex(segmentIndex, sourceIndex + 1),
        outputVertex(segmentIndex, sourceIndex + 2)
      );
    }
  }

  function appendAuthoredCap(template, atStart) {
    if (!template?.geometry) return;
    const capPosition = template.geometry.getAttribute("position");
    const capNormal = template.geometry.getAttribute("normal");
    const capUv = template.geometry.getAttribute("uv");
    const seamY = atStart ? template.bounds.max.y : template.bounds.min.y;
    for (let sourceIndex = 0; sourceIndex < capPosition.count; sourceIndex += 1) {
      const sourceX = capPosition.getX(sourceIndex);
      const sourceY = capPosition.getY(sourceIndex);
      const sourceZ = capPosition.getZ(sourceIndex);
      const moduleOffset = (sourceY - seamY) / sourceLength;
      const t = atStart ? moduleOffset / repeatCount : 1 + moduleOffset / repeatCount;
      const { frame, width, depth, sampleT } = deformationAt(t, true);
      const normalizedX = (sourceX - sourceCenter.x) / Math.max(0.0001, sourceSize.x);
      const normalizedZ = (sourceZ - sourceCenter.z) / Math.max(0.0001, sourceSize.z);
      const profilePosition = projectThroughProfile(normalizedX, normalizedZ);
      const position = frame.point.clone()
        .addScaledVector(frame.x, profilePosition.x * width)
        .addScaledVector(frame.z, profilePosition.y * depth);
      const normalX = capNormal ? capNormal.getX(sourceIndex) : normalizedX;
      const normalY = capNormal ? capNormal.getY(sourceIndex) : 0;
      const normalZ = capNormal ? capNormal.getZ(sourceIndex) : normalizedZ;
      const longitudinalScale = curveLength / repeatCount / sourceLength;
      const worldNormal = new THREE.Vector3()
        .addScaledVector(frame.x, normalX / Math.max(0.0001, width * projectThroughProfile.scaleX / sourceSize.x))
        .addScaledVector(frame.y, normalY / Math.max(0.0001, longitudinalScale))
        .addScaledVector(frame.z, normalZ / Math.max(0.0001, depth * projectThroughProfile.scaleZ / sourceSize.z))
        .normalize();
      vertices.push(position.x, position.y, position.z);
      normals.push(worldNormal.x, worldNormal.y, worldNormal.z);
      tangents.push(frame.y.x, frame.y.y, frame.y.z, 1);
      uvs.push(capUv ? capUv.getX(sourceIndex) : normalizedX + 0.5, capUv ? capUv.getY(sourceIndex) : sampleT);
      const color = strandInfluenceColor(lock, sampleT);
      colors.push(color.r, color.g, color.b);
      indices.push(vertices.length / 3 - 1);
    }
  }

  if (preset.authoredCaps) {
    appendAuthoredCap(preset.start, true);
    appendAuthoredCap(preset.end, false);
  }

  function capBoundary(boundary, t, reverse) {
    const frame = braidFrameAt(lock, curve, t);
    boundary.forEach((partBoundary) => {
      const ring = [...partBoundary.values()];
      if (ring.length < 3) return;
      ring.sort((a, b) => {
        const aPosition = new THREE.Vector3(vertices[a * 3], vertices[a * 3 + 1], vertices[a * 3 + 2]).sub(frame.point);
        const bPosition = new THREE.Vector3(vertices[b * 3], vertices[b * 3 + 1], vertices[b * 3 + 2]).sub(frame.point);
        return Math.atan2(aPosition.dot(frame.z), aPosition.dot(frame.x))
          - Math.atan2(bPosition.dot(frame.z), bPosition.dot(frame.x));
      });
      const center = ring.reduce((sum, vertexIndex) => sum.add(
        new THREE.Vector3(vertices[vertexIndex * 3], vertices[vertexIndex * 3 + 1], vertices[vertexIndex * 3 + 2])
      ), new THREE.Vector3()).multiplyScalar(1 / ring.length);
      const capNormal = frame.y.clone().multiplyScalar(reverse ? -1 : 1);
      const capRing = ring.map((vertexIndex) => {
        const capVertexIndex = vertices.length / 3;
        vertices.push(vertices[vertexIndex * 3], vertices[vertexIndex * 3 + 1], vertices[vertexIndex * 3 + 2]);
        normals.push(capNormal.x, capNormal.y, capNormal.z);
        tangents.push(frame.x.x, frame.x.y, frame.x.z, 1);
        uvs.push(uvs[vertexIndex * 2], uvs[vertexIndex * 2 + 1]);
        colors.push(colors[vertexIndex * 3], colors[vertexIndex * 3 + 1], colors[vertexIndex * 3 + 2]);
        return capVertexIndex;
      });
      const centerIndex = vertices.length / 3;
      vertices.push(center.x, center.y, center.z);
      normals.push(capNormal.x, capNormal.y, capNormal.z);
      tangents.push(frame.y.x, frame.y.y, frame.y.z, 1);
      uvs.push(0.5, t * repeatCount);
      const color = strandInfluenceColor(lock, t);
      colors.push(color.r, color.g, color.b);
      for (let index = 0; index < capRing.length; index += 1) {
        const current = capRing[index];
        const next = capRing[(index + 1) % capRing.length];
        if (reverse) indices.push(centerIndex, next, current);
        else indices.push(centerIndex, current, next);
      }
    });
  }

  if (!preset.authoredCaps) {
    capBoundary(boundaryVertices.start, 0, true);
    capBoundary(boundaryVertices.end, 1, false);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("tangent", new THREE.Float32BufferAttribute(tangents, 4));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.userData.braidRepeatCount = repeatCount;
  geometry.userData.braidMeshPreset = preset.id;
  geometry.userData.sideTriangleCount = indices.length / 3;
  return geometry;
}

function strandGeometryCurve(lock) {
  const baseCurve = new THREE.CatmullRomCurve3(lock.points);
  if (!lock.curlEnabled || lock.geometryType === "braid") return baseCurve;
  const curlCount = THREE.MathUtils.clamp(Number(lock.curlCount ?? 4), 0.25, 24);
  const displacement = THREE.MathUtils.clamp(Number(lock.curlDisplacement ?? 0.18), 0, 1.2);
  if (displacement <= 0.0001) return baseCurve;

  const sampleCount = THREE.MathUtils.clamp(Math.ceil(Math.max(48, curlCount * 18)), 48, 384);
  const points = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const point = baseCurve.getPoint(t);
    const tangent = baseCurve.getTangent(t).normalize();
    const normal = outwardNormalAtPoint(point, tangent)
      .applyAxisAngle(tangent, strandTwistAt(lock, t))
      .normalize();
    const side = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    const angle = Math.PI * 2 * curlCount * t;
    const rootBlend = THREE.MathUtils.smoothstep(t, 0, Math.min(0.12, 0.45 / curlCount));
    point.addScaledVector(side, Math.cos(angle) * displacement * rootBlend);
    point.addScaledVector(normal, Math.sin(angle) * displacement * rootBlend);
    points.push(point);
  }
  return new THREE.CatmullRomCurve3(points, false, "centripetal", 0.5);
}

function strandGeometryFrameAt(lock, curve, t) {
  const point = curve.getPoint(t);
  const tangent = curve.getTangent(t).normalize();
  const baseFrame = curveFrameAt(lock, t, strandTwistAt(lock, t));
  let z = baseFrame.z.clone().projectOnPlane(tangent).normalize();
  if (z.lengthSq() < 0.01) z = outwardNormalAtPoint(point, tangent);
  const x = new THREE.Vector3().crossVectors(tangent, z).normalize();
  z = new THREE.Vector3().crossVectors(x, tangent).normalize();
  return { point, x, y: tangent, z };
}

function createHairGeometry(lock) {
  if (lock.geometryType === "braid") {
    const braidGeometry = createBraidGeometry(lock);
    if (braidGeometry) return braidGeometry;
  }
  const curve = strandGeometryCurve(lock);
  const profilePoints = (lock.sweepProfile?.length >= 4 ? lock.sweepProfile : DEFAULT_SWEEP_PROFILE)
    .map((point) => new THREE.Vector3(point.x, 0, point.z + Number(lock.profileOffset || 0)));
  const profileCurve = new THREE.CatmullRomCurve3(profilePoints, true, "centripetal", 0.5);
  const radialSegments = THREE.MathUtils.clamp(Math.round(lock.radialSegments || 10), 4, 24);
  const curlSegments = lock.curlEnabled ? Math.ceil(Number(lock.curlCount ?? 4) * 14) : 0;
  const lengthSegments = THREE.MathUtils.clamp(Math.max(Math.round(lock.lengthSegments || 26), curlSegments), 4, 256);
  const curveParameters = strandCurveParameters(lock, curve, lengthSegments);
  const actualLengthSegments = curveParameters.length - 1;
  const vertices = [];
  const normals = [];
  const tangents = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  curveParameters.forEach((t) => {
    const point = curve.getPoint(t);
    const frame = strandGeometryFrameAt(lock, curve, t);
    const scaleX = sampleScale(lock.pointScales, t, "x");
    const scaleZ = sampleScale(lock.pointScales, t, "z");
    const radiusX = strandRadiusAt(lock, t, "x");
    const radiusZ = strandRadiusAt(lock, t, "z");
    const color = strandInfluenceColor(lock, t);

    for (let j = 0; j < radialSegments; j += 1) {
      const profile = profileCurve.getPoint(j / radialSegments);
      const ring = frame.x.clone().multiplyScalar(profile.x * radiusX * scaleX);
      ring.add(frame.z.clone().multiplyScalar(profile.z * radiusZ * scaleZ));
      vertices.push(point.x + ring.x, point.y + ring.y, point.z + ring.z);
      normals.push(ring.x, ring.y, ring.z);
      tangents.push(frame.y.x, frame.y.y, frame.y.z, 1);
      uvs.push(j / radialSegments, t);
      colors.push(color.r, color.g, color.b);
    }
  });

  const startPoint = curve.getPoint(0);
  const endPoint = curve.getPoint(1);
  const startCenter = vertices.length / 3;
  vertices.push(startPoint.x, startPoint.y, startPoint.z);
  normals.push(0, 1, 0);
  const startFrame = strandGeometryFrameAt(lock, curve, 0);
  tangents.push(startFrame.x.x, startFrame.x.y, startFrame.x.z, 1);
  uvs.push(0.5, 0);
  const startColor = strandInfluenceColor(lock, 0);
  colors.push(startColor.r, startColor.g, startColor.b);
  const endCenter = vertices.length / 3;
  vertices.push(endPoint.x, endPoint.y, endPoint.z);
  normals.push(0, -1, 0);
  const endFrame = strandGeometryFrameAt(lock, curve, 1);
  tangents.push(endFrame.x.x, endFrame.x.y, endFrame.x.z, 1);
  uvs.push(0.5, 1);
  const endColor = strandInfluenceColor(lock, 1);
  colors.push(endColor.r, endColor.g, endColor.b);

  for (let i = 0; i < actualLengthSegments; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * radialSegments + j;
      const b = i * radialSegments + ((j + 1) % radialSegments);
      const c = (i + 1) * radialSegments + j;
      const d = (i + 1) * radialSegments + ((j + 1) % radialSegments);
      indices.push(a, c, b, b, c, d);
    }
  }

  for (let j = 0; j < radialSegments; j += 1) {
    const a = j;
    const b = (j + 1) % radialSegments;
    const c = actualLengthSegments * radialSegments + j;
    const d = actualLengthSegments * radialSegments + ((j + 1) % radialSegments);
    indices.push(startCenter, b, a);
    indices.push(endCenter, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("tangent", new THREE.Float32BufferAttribute(tangents, 4));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.userData.sideTriangleCount = actualLengthSegments * radialSegments * 2;
  geometry.userData.actualLengthSegments = actualLengthSegments;
  geometry.computeVertexNormals();
  return geometry;
}

function normalizeHairMaterialDefinition(material = {}) {
  return Object.assign(material, {
    ...DEFAULT_HAIR_MATERIAL_SETTINGS,
    ...material
  });
}

function hairMaterialDefinition(materialId) {
  return normalizeHairMaterialDefinition(hairMaterialDefinitions.find((material) => material.id === materialId) || hairMaterialDefinitions[0]);
}

function materialForLock(lock) {
  return hairMaterialDefinition(lock.materialId || DEFAULT_HAIR_MATERIAL_ID);
}

function strandDisplayColor(lock) {
  const layer = HAIR_LAYERS.find((item) => item.id === normalizeHairLayer(lock.hairLayer)) || HAIR_LAYERS[1];
  const region = SCALP_REGIONS[lock.scalpRegion || "unassigned"] || SCALP_REGIONS.unassigned;
  const color = new THREE.Color(showGroupColors ? region.color : materialForLock(lock).color);
  const adjustedFactor = showGroupColors
    ? layer.colorFactor
    : Number(MATERIAL_LAYER_COLOR_FACTORS[layer.id] ?? 1);
  color.offsetHSL(Number(LAYER_HUE_SHIFTS[layer.id] ?? 0), 0, 0);
  color.multiplyScalar(adjustedFactor);
  return `#${color.getHexString()}`;
}

function hairMaterialRoughness(value) {
  return THREE.MathUtils.clamp(Number(value), 0.2, 1);
}

function hairGlossAmount(value) {
  const roughness = hairMaterialRoughness(value);
  return 1 - THREE.MathUtils.smoothstep(roughness, 0.2, 1);
}

const animeHairVertexShader = /* glsl */`
  attribute vec3 color;
  attribute vec4 tangent;
  varying vec2 vUv;
  varying vec3 vVertexColor;
  varying vec3 vObjectPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vWorldTangent;

  void main() {
    vUv = uv;
    vVertexColor = color;
    vObjectPosition = position;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vWorldTangent = normalize(mat3(modelMatrix) * tangent.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const animeHairFragmentShader = /* glsl */`
  precision highp float;

  uniform vec3 uBaseColor;
  uniform vec3 uShadowColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uLightDirection;
  uniform vec3 uCameraPosition;

  uniform float uShadowThreshold;
  uniform float uShadowSoftness;
  uniform float uBackGradientStrength;
  uniform float uBackGradientPower;
  uniform float uHighlightWidth;
  uniform float uHighlightSoftness;
  uniform float uHighlightStrength;
  uniform float uHighlightShift;
  uniform float uHighlightJaggedness;
  uniform float uHighlightJaggedFrequency;

  varying vec2 vUv;
  varying vec3 vVertexColor;
  varying vec3 vObjectPosition;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying vec3 vWorldTangent;

  float saturate(float value) {
    return clamp(value, 0.0, 1.0);
  }

  float hash11(float value) {
    return fract(sin(value * 127.1) * 43758.5453);
  }

  float angularNoise(float value) {
    float cell = floor(value);
    float local = fract(value);
    local = local * local * (3.0 - 2.0 * local);
    return mix(hash11(cell), hash11(cell + 1.0), local);
  }

  float band(float value, float center, float width, float softness) {
    float distanceToCenter = abs(value - center);
    return 1.0 - smoothstep(width, width + softness, distanceToCenter);
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    if (!gl_FrontFacing) N = -N;

    vec3 L = normalize(uLightDirection);
    vec3 V = normalize(uCameraPosition - vWorldPosition);
    float NdotL = dot(N, L);

    float coreLight = smoothstep(
      uShadowThreshold - uShadowSoftness,
      uShadowThreshold + uShadowSoftness,
      NdotL
    );

    float backFacing = pow(saturate(-NdotL), uBackGradientPower);
    float ambientGradient = 1.0 - backFacing * uBackGradientStrength;

    vec3 baseColor = uBaseColor * vVertexColor;
    vec3 shadowedBase = baseColor * uShadowColor;
    vec3 color = mix(shadowedBase, baseColor, coreLight) * ambientGradient;
    color = max(color, baseColor * 0.34);

    vec3 T = normalize(vWorldTangent);
    if (dot(T, T) < 0.0001) {
      vec3 flow = vec3(0.0, 1.0, 0.0);
      T = flow - N * dot(flow, N);
      if (dot(T, T) < 0.0001) T = cross(N, vec3(1.0, 0.0, 0.0));
      T = normalize(T);
    }

    vec3 shiftedT = normalize(T + N * uHighlightShift);
    vec3 H = normalize(L + V);
    float TdotH = dot(shiftedT, H);
    float dynamicHighlight = band(TdotH, 0.0, uHighlightWidth, uHighlightSoftness);

    float objectSeed = hash11(floor((vObjectPosition.x + vObjectPosition.z) * 19.0));
    float strandFlow = vUv.y;
    float side = vUv.x;
    float slowWave = sin(strandFlow * 7.2 + objectSeed * 6.2831853) * 0.045;
    float staticCenter = 0.28 + slowWave + uHighlightShift * 0.12;
    float staticHighlight = band(side, staticCenter, uHighlightWidth * 0.72, uHighlightSoftness * 4.0);
    staticHighlight += band(side, 0.68 - slowWave * 0.55, uHighlightWidth * 0.38, uHighlightSoftness * 3.2) * 0.45;
    staticHighlight = saturate(staticHighlight);

    float streakNoise = angularNoise(strandFlow * uHighlightJaggedFrequency + objectSeed * 17.0);
    float fineNoise = angularNoise(strandFlow * uHighlightJaggedFrequency * 2.7 + side * 3.0);
    float detailMask = mix(1.0, 0.72 + 0.38 * streakNoise + 0.12 * fineNoise, uHighlightJaggedness);
    float lightMask = smoothstep(-0.12, 0.22, NdotL);
    float fresnel = pow(1.0 - saturate(dot(N, V)), 2.2);
    float dynamicLayer = dynamicHighlight * detailMask * lightMask;
    float staticLayer = staticHighlight * (0.42 + 0.58 * lightMask) * detailMask;
    float rimLayer = fresnel * smoothstep(-0.25, 0.45, NdotL);
    float highlightAmount = saturate((dynamicLayer * 0.46 + staticLayer * 0.055 + rimLayer * 0.12) * uHighlightStrength);
    vec3 highlightTint = mix(color, uHighlightColor, 0.55);
    color = mix(color, highlightTint, highlightAmount);

    gl_FragColor = vec4(color, 1.0);
  }
`;

function animeHairLightDirection() {
  return keyLight.position.clone().normalize();
}

function setAnimeHairBaseColor(material, color) {
  material.color.set(color);
}

function applyHairShaderUniforms(material, roughness) {
  if (!material?.uniforms?.uHighlightWidth) return;
  const definition = material.userData.definition || DEFAULT_HAIR_MATERIAL_SETTINGS;
  const clampedRoughness = hairMaterialRoughness(roughness ?? definition.roughness);
  const roughnessStrength = THREE.MathUtils.lerp(0.9, 0.46, clampedRoughness);
  material.uniforms.uShadowColor.value.set(definition.shadowColor || DEFAULT_HAIR_MATERIAL_SETTINGS.shadowColor);
  material.uniforms.uHighlightColor.value.set(definition.highlightColor || DEFAULT_HAIR_MATERIAL_SETTINGS.highlightColor);
  material.uniforms.uShadowThreshold.value = Number(definition.shadowThreshold ?? DEFAULT_HAIR_MATERIAL_SETTINGS.shadowThreshold);
  material.uniforms.uShadowSoftness.value = Number(definition.shadowSoftness ?? DEFAULT_HAIR_MATERIAL_SETTINGS.shadowSoftness);
  material.uniforms.uBackGradientStrength.value = Number(definition.backGradientStrength ?? DEFAULT_HAIR_MATERIAL_SETTINGS.backGradientStrength);
  material.uniforms.uBackGradientPower.value = Number(definition.backGradientPower ?? DEFAULT_HAIR_MATERIAL_SETTINGS.backGradientPower);
  material.uniforms.uHighlightWidth.value = Number(definition.highlightWidth ?? DEFAULT_HAIR_MATERIAL_SETTINGS.highlightWidth) * THREE.MathUtils.lerp(0.9, 1.55, clampedRoughness);
  material.uniforms.uHighlightSoftness.value = Number(definition.highlightSoftness ?? DEFAULT_HAIR_MATERIAL_SETTINGS.highlightSoftness) * THREE.MathUtils.lerp(0.9, 2.4, clampedRoughness);
  material.uniforms.uHighlightStrength.value = Number(definition.highlightStrength ?? DEFAULT_HAIR_MATERIAL_SETTINGS.highlightStrength) * roughnessStrength;
  material.uniforms.uHighlightShift.value = Number(definition.highlightShift ?? DEFAULT_HAIR_MATERIAL_SETTINGS.highlightShift);
  material.uniforms.uHighlightJaggedness.value = Number(definition.highlightJaggedness ?? DEFAULT_HAIR_MATERIAL_SETTINGS.highlightJaggedness);
  material.uniforms.uHighlightJaggedFrequency.value = Number(definition.highlightJaggedFrequency ?? DEFAULT_HAIR_MATERIAL_SETTINGS.highlightJaggedFrequency);
  material.uniforms.uLightDirection.value.copy(animeHairLightDirection());
}

function updateHairMaterialResponse(material, roughness) {
  // Lambert materials have no stylized highlight response to update.
}

function createHairMaterial(lock) {
  const definition = materialForLock(lock);
  const material = new THREE.MeshLambertMaterial({
    name: "HairLambertMaterial",
    color: strandDisplayColor(lock),
    vertexColors: true,
    side: THREE.FrontSide,
    transparent: false,
    depthWrite: true,
    depthTest: true
  });
  material.userData.definition = definition;
  return material;
}

function applyMaterialDefinitionToLock(lock) {
  const definition = materialForLock(lock);
  const showingProportionalRamp = proportionalEditing && selectedPoint?.lockId === lock.id;
  lock.mesh.material.userData.definition = definition;
  setAnimeHairBaseColor(lock.mesh.material, showingProportionalRamp ? 0xffffff : strandDisplayColor(lock));
  updateHairMaterialResponse(lock.mesh.material, definition.roughness);
}

function refreshMaterialUsers(materialId) {
  locks.forEach((lock) => {
    if ((lock.materialId || DEFAULT_HAIR_MATERIAL_ID) === materialId) applyMaterialDefinitionToLock(lock);
  });
  renderLockList();
}

function renderHairMaterialOptions(selectedMaterialId = DEFAULT_HAIR_MATERIAL_ID) {
  hairMaterialSelect.replaceChildren(...hairMaterialDefinitions.map((material) => {
    const option = document.createElement("option");
    option.value = material.id;
    option.textContent = material.name;
    return option;
  }));
  hairMaterialSelect.value = hairMaterialDefinition(selectedMaterialId).id;
}

function syncHairMaterialEditor(lock) {
  const definition = materialForLock(lock);
  renderHairMaterialOptions(definition.id);
  hairMaterialNameInput.value = definition.name;
  hairMaterialColorInput.value = definition.color;
  hairMaterialShadowColorInput.value = definition.shadowColor;
  hairMaterialHighlightColorInput.value = definition.highlightColor;
  hairMaterialRoughnessInput.value = definition.roughness;
  Object.entries(hairShaderInputs).forEach(([key, input]) => {
    input.value = definition[key] ?? DEFAULT_HAIR_MATERIAL_SETTINGS[key];
  });
  syncRoughnessValue();
  syncHairShaderValues();
}

function createHairTopologyGeometry(sourceGeometry) {
  const geometry = sourceGeometry.toNonIndexed();
  const vertexCount = geometry.getAttribute("position").count;
  const barycentric = new Float32Array(vertexCount * 3);
  const edgeMask = new Float32Array(vertexCount * 3);
  const sideTriangleCount = sourceGeometry.userData.sideTriangleCount || 0;
  for (let index = 0; index < vertexCount; index += 3) {
    barycentric.set([1, 0, 0, 0, 1, 0, 0, 0, 1], index * 3);
    const triangleIndex = index / 3;
    const mask = triangleIndex < sideTriangleCount
      ? triangleIndex % 2 === 0 ? [0, 1, 1] : [1, 1, 0]
      : [1, 1, 1];
    edgeMask.set([...mask, ...mask, ...mask], index * 3);
  }
  geometry.setAttribute("barycentric", new THREE.BufferAttribute(barycentric, 3));
  geometry.setAttribute("edgeMask", new THREE.BufferAttribute(edgeMask, 3));
  return geometry;
}

function createHairTopologyOverlay(sourceGeometry) {
  const overlay = new THREE.Mesh(
    createHairTopologyGeometry(sourceGeometry),
    new THREE.ShaderMaterial({
      uniforms: {
        lineColor: { value: new THREE.Color(0x66f5ff) },
        opacity: { value: 0.72 }
      },
      vertexShader: `
        attribute vec3 barycentric;
        attribute vec3 edgeMask;
        varying vec3 vBarycentric;
        varying vec3 vEdgeMask;
        void main() {
          vBarycentric = barycentric;
          vEdgeMask = edgeMask;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 lineColor;
        uniform float opacity;
        varying vec3 vBarycentric;
        varying vec3 vEdgeMask;
        void main() {
          vec3 edgeWidth = max(fwidth(vBarycentric) * 1.25, vec3(0.0001));
          vec3 edge = (vec3(1.0) - smoothstep(vec3(0.0), edgeWidth, vBarycentric)) * vEdgeMask;
          float edgeAlpha = max(max(edge.x, edge.y), edge.z);
          if (edgeAlpha < 0.04) discard;
          gl_FragColor = vec4(lineColor, edgeAlpha * opacity);
        }
      `,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.FrontSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      extensions: { derivatives: true }
    })
  );
  overlay.visible = hairTopologyVisible;
  overlay.renderOrder = 3;
  return overlay;
}

function groupDefaultsFor(region) {
  const defaults = strandGroupDefaults[region] || strandGroupDefaults.unassigned;
  defaults.layerOffsets = { ...DEFAULT_LAYER_OFFSETS, ...defaults.layerOffsets };
  return defaults;
}

function creationToolActive() {
  return activeTool === "place" || activeTool === "draw" || activeTool === "braid";
}

function activeCreationShapeDefaults() {
  return activeTool === "braid" ? braidCreationDefaults : strandCreationDefaults;
}

function activeStrandShapeTarget() {
  return getSelectedLock() || (creationToolActive() ? activeCreationShapeDefaults() : null);
}

function applyGroupDefaultsToExistingStrands(region) {
  const defaults = groupDefaultsFor(region);
  locks.forEach((lock) => {
    if ((lock.scalpRegion || "unassigned") !== region) return;
    lock.taperCurve = defaults.taperCurve.map((point) => ({ ...point }));
    lock.depthCurve = defaults.depthCurve.map((point) => ({ ...point }));
    lock.widthScale = Number(defaults.widthScale ?? 1);
    lock.depthScale = Number(defaults.depthScale ?? 1);
    lock.profileOffset = Number(defaults.profileOffset ?? 0);
    lock.rootScalpOffset = defaults.rootScalpOffset;
    lock.radialSegments = Math.round(defaults.radialSegments);
    lock.lengthSegments = Math.round(defaults.lengthSegments);
    lock.dynamicDensity = Boolean(defaults.dynamicDensity);
    lock.densityAggression = Number(defaults.densityAggression ?? 0.5);
    lock.sweepProfile = defaults.sweepProfile.map((point) => ({ ...point }));
    applyLockRootScalpOffset(lock);
    updateLockGeometry(lock);
  });
  const selectedLock = getSelectedLock();
  if (selectedLock) syncInputs(selectedLock);
  updateTopologyStats();
}

function requestGroupDefaultsWarning(event) {
  if (groupDefaultsWarningAcknowledged || !selectedStrandGroup) return;
  const hasExistingStrands = locks.some((lock) => (lock.scalpRegion || "unassigned") === selectedStrandGroup);
  if (!hasExistingStrands) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!groupDefaultsWarning.open) groupDefaultsWarning.showModal();
}

function activeSweepProfile() {
  if (!sweepProfileEdit) return null;
  if (sweepProfileEdit.type === "group") return strandGroupDefaults[sweepProfileEdit.id]?.sweepProfile || null;
  if (sweepProfileEdit.type === "creation") return activeCreationShapeDefaults().sweepProfile;
  return locks.find((lock) => lock.id === sweepProfileEdit.id)?.sweepProfile || null;
}

function activeProfileOffset() {
  if (!sweepProfileEdit) return 0;
  if (sweepProfileEdit.type === "group") return Number(strandGroupDefaults[sweepProfileEdit.id]?.profileOffset || 0);
  if (sweepProfileEdit.type === "creation") return Number(activeCreationShapeDefaults().profileOffset || 0);
  return Number(locks.find((lock) => lock.id === sweepProfileEdit.id)?.profileOffset || 0);
}

function profileToCanvas(point, offset = activeProfileOffset()) {
  return { x: 220 + point.x * 156, y: 220 - (point.z + offset) * 156 };
}

function renderProfilePreview(path, profile, offset = 0) {
  if (!path || !profile?.length) return;
  const curve = new THREE.CatmullRomCurve3(
    profile.map((point) => new THREE.Vector3(point.x, 0, point.z)),
    true,
    "centripetal",
    0.5
  );
  const sampled = curve.getPoints(48).map((point) => ({
    x: 43 + point.x * 30,
    y: 43 - (point.z + offset) * 30
  }));
  path.setAttribute("d", `${sampled.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")} Z`);
}

function activeTaperCurve() {
  if (!taperCurveEdit) return null;
  if (taperCurveEdit.type === "group") return strandGroupDefaults[taperCurveEdit.id]?.[taperCurveEdit.curveKey] || null;
  if (taperCurveEdit.type === "creation") return activeCreationShapeDefaults()[taperCurveEdit.curveKey];
  return locks.find((lock) => lock.id === taperCurveEdit.id)?.[taperCurveEdit.curveKey] || null;
}

function taperSamples(curve, count = 80) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const position = index / count;
    return { position, value: sampleTaperCurve(curve, position) };
  });
}

function renderTaperPreview(path, curve) {
  if (!path || !curve?.length) return;
  const sampled = taperSamples(curve, 48).map((point) => ({
    x: 9 + point.position * 142,
    y: 63 - (point.value / TAPER_VALUE_MAX) * 54
  }));
  const line = sampled.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  path.setAttribute("d", `${line} L151,63 L9,63 Z`);
}

function cloneShapePresetValue(value) {
  return value.map((point) => ({ ...point }));
}

function shapeValuesMatch(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return left.every((point, index) => Object.keys(point).every((key) => {
    const other = right[index]?.[key];
    return typeof point[key] === "number" ? Math.abs(point[key] - other) < 0.0001 : point[key] === other;
  }));
}

function shapeTargetForSelect(select) {
  if (select.closest("#groupSettingsPanel")) return selectedStrandGroup ? strandGroupDefaults[selectedStrandGroup] : null;
  return activeStrandShapeTarget();
}

function syncShapePresetSelects() {
  shapePresetSelects.forEach((select) => {
    const key = select.dataset.shapePreset;
    const value = shapeTargetForSelect(select)?.[key];
    const match = SHAPE_PRESETS[key].find((preset) => shapeValuesMatch(value, preset.value));
    select.value = match?.id || "custom";
  });
}

function populateShapePresetSelects() {
  shapePresetSelects.forEach((select) => {
    const presetsForShape = SHAPE_PRESETS[select.dataset.shapePreset];
    const options = presetsForShape.map((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.name;
      return option;
    });
    const custom = document.createElement("option");
    custom.value = "custom";
    custom.textContent = "Custom";
    custom.disabled = true;
    select.replaceChildren(...options, custom);
  });
  syncShapePresetSelects();
}

function applyShapePreset(select) {
  const key = select.dataset.shapePreset;
  const preset = SHAPE_PRESETS[key].find((item) => item.id === select.value);
  const target = shapeTargetForSelect(select);
  if (!preset || !target) return;
  pushUndoState();
  target[key] = cloneShapePresetValue(preset.value);
  if (select.closest("#groupSettingsPanel")) {
    applyGroupDefaultsToExistingStrands(selectedStrandGroup);
    syncGroupInputs();
  } else if (target === strandCreationDefaults || target === braidCreationDefaults) {
    syncCreationShapeInputs();
  } else {
    updateLockGeometry(target);
    syncActiveMirror(target, { refreshUi: true });
    syncInputs(target);
  }
  syncShapePresetSelects();
}

populateShapePresetSelects();
shapePresetSelects.forEach((select) => select.addEventListener("change", () => applyShapePreset(select)));

function taperPointToCanvas(point) {
  return { x: 30 + point.position * 460, y: 190 - (point.value / TAPER_VALUE_MAX) * 170 };
}

function canvasToTaperPoint(event, pointIndex) {
  const rect = taperCurveCanvas.getBoundingClientRect();
  const canvasX = (event.clientX - rect.left) * (520 / rect.width);
  const canvasY = (event.clientY - rect.top) * (220 / rect.height);
  const curve = activeTaperCurve();
  const isEndpoint = pointIndex === 0 || pointIndex === curve.length - 1;
  return {
    position: isEndpoint ? (pointIndex === 0 ? 0 : 1) : THREE.MathUtils.clamp((canvasX - 30) / 460, 0.01, 0.99),
    value: THREE.MathUtils.clamp(((190 - canvasY) / 170) * TAPER_VALUE_MAX, 0, TAPER_VALUE_MAX)
  };
}

function renderTaperCurveEditor() {
  const curve = activeTaperCurve();
  if (!curve?.length) return;
  const sampled = taperSamples(curve, 120).map(taperPointToCanvas);
  const line = sampled.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  taperCurvePath.setAttribute("d", `${line} L490,190 L30,190 Z`);
  taperCurvePoints.replaceChildren();
  curve.forEach((point, index) => {
    const canvasPoint = taperPointToCanvas(point);
    const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    handle.setAttribute("cx", canvasPoint.x);
    handle.setAttribute("cy", canvasPoint.y);
    handle.setAttribute("r", index === taperCurveEdit.selectedIndex ? 6 : 5);
    handle.setAttribute("class", `profile-point${index === taperCurveEdit.selectedIndex ? " selected" : ""}`);
    handle.dataset.taperPoint = index;
    taperCurvePoints.appendChild(handle);
  });
  const selected = curve[taperCurveEdit.selectedIndex];
  taperPointValue.value = selected.value.toFixed(2);
  taperPointPosition.value = selected.position.toFixed(2);
  taperPointPosition.disabled = taperCurveEdit.selectedIndex === 0 || taperCurveEdit.selectedIndex === curve.length - 1;
  taperPointInterpolation.value = selected.interpolation;
  document.querySelector("#deleteTaperPoint").disabled = curve.length <= 2 || taperPointPosition.disabled;
}

function applyTaperCurveEdit() {
  if (!taperCurveEdit) return;
  if (taperCurveEdit.type === "group") {
    applyGroupDefaultsToExistingStrands(taperCurveEdit.id);
    renderTaperPreview(taperCurveEdit.curveKey === "depthCurve" ? taperPreviewPaths.groupDepth : taperPreviewPaths.group, activeTaperCurve());
  } else if (taperCurveEdit.type === "creation") {
    renderTaperPreview(taperCurveEdit.curveKey === "depthCurve" ? taperPreviewPaths.strandDepth : taperPreviewPaths.strand, activeTaperCurve());
    if (drawStrandStroke) updateDrawStrandPreview();
  } else {
    const lock = locks.find((item) => item.id === taperCurveEdit.id);
    if (lock) {
      updateLockGeometry(lock);
      syncActiveMirror(lock, { refreshUi: true });
    }
    renderTaperPreview(taperCurveEdit.curveKey === "depthCurve" ? taperPreviewPaths.strandDepth : taperPreviewPaths.strand, activeTaperCurve());
    updateTopologyStats();
  }
  renderTaperCurveEditor();
  syncShapePresetSelects();
}

function openTaperCurveEditor(curveKey = "taperCurve") {
  let nextEdit = null;
  const selectedLock = getSelectedLock();
  if (selectedLock) nextEdit = { type: "strand", id: selectedLock.id, curveKey, selectedIndex: 0, dragPointerId: null };
  else if (selectedStrandGroup) nextEdit = { type: "group", id: selectedStrandGroup, curveKey, selectedIndex: 0, dragPointerId: null };
  else if (creationToolActive()) nextEdit = { type: "creation", id: "new-strand", curveKey, selectedIndex: 0, dragPointerId: null };
  if (!nextEdit) return;
  if (sweepProfileEditor.open) closeSweepProfileEditor();
  if (nextEdit.type === "group" && !groupDefaultsWarningAcknowledged) {
    const hasExistingStrands = locks.some((lock) => (lock.scalpRegion || "unassigned") === nextEdit.id);
    if (hasExistingStrands) {
      groupDefaultsWarningContinuation = () => openTaperCurveEditor(curveKey);
      groupDefaultsWarning.showModal();
      return;
    }
  }
  taperCurveEdit = nextEdit;
  const group = STRAND_GROUPS.find((item) => item.id === nextEdit.id);
  const lock = locks.find((item) => item.id === nextEdit.id);
  document.querySelector("#taperCurveTitle").textContent = curveKey === "depthCurve" ? "Depth Curve" : "Width Curve";
  taperCurveTarget.textContent = nextEdit.type === "creation"
    ? "New strand defaults"
    : nextEdit.type === "group" ? `${group?.label || "Group"} defaults` : lock?.name || "Selected strand";
  renderTaperCurveEditor();
  taperCurveEditor.show();
  updateViewportStatsVisibility();
}

function closeTaperCurveEditor() {
  if (taperCurveEdit?.dragPointerId !== null && taperCurveCanvas.hasPointerCapture?.(taperCurveEdit.dragPointerId)) {
    taperCurveCanvas.releasePointerCapture(taperCurveEdit.dragPointerId);
  }
  taperCurveEdit = null;
  if (taperCurveEditor.open) taperCurveEditor.close();
  updateViewportStatsVisibility();
}

function updateViewportStatsVisibility() {
  viewportStats.classList.toggle("hidden", sweepProfileEditor.open || taperCurveEditor.open || !presetLibrary.classList.contains("hidden"));
}

function canvasToProfile(event) {
  const rect = sweepProfileCanvas.getBoundingClientRect();
  const canvasX = (event.clientX - rect.left) * (440 / rect.width);
  const canvasY = (event.clientY - rect.top) * (440 / rect.height);
  return {
    x: THREE.MathUtils.clamp((canvasX - 220) / 156, -1.25, 1.25),
    z: THREE.MathUtils.clamp((220 - canvasY) / 156 - activeProfileOffset(), -1.25, 1.25)
  };
}

function renderSweepProfileEditor() {
  const profile = activeSweepProfile();
  if (!profile?.length) return;
  const curve = new THREE.CatmullRomCurve3(
    profile.map((point) => new THREE.Vector3(point.x, 0, point.z)),
    true,
    "centripetal",
    0.5
  );
  const sampled = curve.getPoints(96).map((point) => profileToCanvas({ x: point.x, z: point.z }));
  sweepProfilePath.setAttribute("d", `${sampled.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")} Z`);
  sweepProfilePoints.replaceChildren();
  profile.forEach((point, index) => {
    const canvasPoint = profileToCanvas(point);
    const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    handle.setAttribute("cx", canvasPoint.x);
    handle.setAttribute("cy", canvasPoint.y);
    handle.setAttribute("r", index === sweepProfileEdit.selectedIndex ? 6 : 5);
    handle.setAttribute("class", `profile-point${index === sweepProfileEdit.selectedIndex ? " selected" : ""}`);
    handle.dataset.profilePoint = index;
    sweepProfilePoints.appendChild(handle);
  });
}

function applySweepProfileEdit() {
  if (!sweepProfileEdit) return;
  if (sweepProfileEdit.type === "group") {
    applyGroupDefaultsToExistingStrands(sweepProfileEdit.id);
  } else if (sweepProfileEdit.type === "creation") {
    if (drawStrandStroke) updateDrawStrandPreview();
  } else {
    const lock = locks.find((item) => item.id === sweepProfileEdit.id);
    if (lock) {
      updateLockGeometry(lock);
      syncActiveMirror(lock, { refreshUi: true });
      updateTopologyStats();
    }
  }
  const previewPath = sweepProfileEdit.type === "group" ? profilePreviewPaths.group : profilePreviewPaths.strand;
  renderProfilePreview(previewPath, activeSweepProfile(), activeProfileOffset());
  renderSweepProfileEditor();
  syncShapePresetSelects();
}

function openSweepProfileEditor() {
  let nextEdit = null;
  const selectedLock = getSelectedLock();
  if (selectedLock) {
    nextEdit = { type: "strand", id: selectedLock.id, selectedIndex: 0, dragPointerId: null };
  } else if (selectedStrandGroup) {
    nextEdit = { type: "group", id: selectedStrandGroup, selectedIndex: 0, dragPointerId: null };
  } else if (creationToolActive()) {
    nextEdit = { type: "creation", id: "new-strand", selectedIndex: 0, dragPointerId: null };
  }
  if (!nextEdit) return;
  if (taperCurveEditor.open) closeTaperCurveEditor();

  if (nextEdit.type === "group" && !groupDefaultsWarningAcknowledged) {
    const hasExistingStrands = locks.some((lock) => (lock.scalpRegion || "unassigned") === nextEdit.id);
    if (hasExistingStrands) {
      groupDefaultsWarningContinuation = openSweepProfileEditor;
      groupDefaultsWarning.showModal();
      return;
    }
  }

  sweepProfileEdit = nextEdit;
  const group = STRAND_GROUPS.find((item) => item.id === nextEdit.id);
  const lock = locks.find((item) => item.id === nextEdit.id);
  sweepProfileTarget.textContent = nextEdit.type === "creation"
    ? "New strand defaults"
    : nextEdit.type === "group" ? `${group?.label || "Group"} defaults` : lock?.name || "Selected strand";
  renderSweepProfileEditor();
  sweepProfileEditor.show();
  updateViewportStatsVisibility();
}

function closeSweepProfileEditor() {
  if (sweepProfileEdit?.dragPointerId !== null && sweepProfileCanvas.hasPointerCapture?.(sweepProfileEdit.dragPointerId)) {
    sweepProfileCanvas.releasePointerCapture(sweepProfileEdit.dragPointerId);
  }
  sweepProfileEdit = null;
  if (sweepProfileEditor.open) sweepProfileEditor.close();
  updateViewportStatsVisibility();
}

function addLock(presetName, overrides = {}, options = {}) {
  const base = { ...presets[presetName], ...overrides };
  const scalpRegion = base.scalpRegion || "unassigned";
  const lock = {
    id: crypto.randomUUID(),
    ...base,
    scalpRegion,
    materialId: base.materialId || DEFAULT_HAIR_MATERIAL_ID,
    name: nextStrandName(scalpRegion)
  };
  lockIndex += 1;
  const topologyDefaults = groupDefaultsFor(lock.scalpRegion);
  lock.radialSegments = Math.round(base.radialSegments ?? topologyDefaults.radialSegments);
  lock.lengthSegments = Math.round(base.lengthSegments ?? topologyDefaults.lengthSegments);
  lock.dynamicDensity = Boolean(base.dynamicDensity ?? topologyDefaults.dynamicDensity);
  lock.densityAggression = THREE.MathUtils.clamp(Number(base.densityAggression ?? topologyDefaults.densityAggression ?? 0.5), 0, 1);
  lock.taperCurve = normalizeTaperCurve(base.taperCurve || topologyDefaults.taperCurve, base);
  lock.depthCurve = normalizeTaperCurve(base.depthCurve || topologyDefaults.depthCurve, base);
  lock.widthScale = Number(base.widthScale ?? topologyDefaults.widthScale ?? 1);
  lock.depthScale = Number(base.depthScale ?? topologyDefaults.depthScale ?? 1);
  lock.profileOffset = Number(base.profileOffset ?? topologyDefaults.profileOffset ?? 0);
  lock.geometryType = base.geometryType === "braid" ? "braid" : "strand";
  lock.braidMeshPreset = base.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET;
  lock.braidWidth = Number(base.braidWidth ?? base.width ?? 0.34);
  lock.braidDepth = Number(base.braidDepth ?? 0.44);
  lock.braidSegmentLength = Number(base.braidSegmentLength ?? 0.28);
  lock.braidRotation = Number(base.braidRotation ?? 0);
  lock.curlEnabled = Boolean(base.curlEnabled);
  lock.curlCount = THREE.MathUtils.clamp(Number(base.curlCount ?? 4), 0.25, 24);
  lock.curlDisplacement = THREE.MathUtils.clamp(Number(base.curlDisplacement ?? 0.18), 0, 1.2);
  lock.rootScalpOffset = Number(base.rootScalpOffset ?? topologyDefaults.rootScalpOffset ?? 0);
  lock.hairLayer = normalizeHairLayer(base.hairLayer ?? strandCreationDefaults.hairLayer);
  lock.layerOffsetApplied = Number(base.layerOffsetApplied ?? 0);
  lock.layerOffsetRootFactorApplied = Number(base.layerOffsetRootFactorApplied ?? 1);
  lock.rootSurfacePoint = base.rootSurfacePoint?.clone() || null;
  lock.rootSurfaceNormal = base.rootSurfaceNormal?.clone()?.normalize() || null;
  lock.sweepProfile = (base.sweepProfile || topologyDefaults.sweepProfile).map((point) => ({ ...point }));
  lock.points = base.points ? base.points.map((point) => point.clone()) : createCurvePoints(lock);
  lock.rootAttachment = rootAttachmentFromData(base.rootAttachment || null, lock);
  if (lock.rootAttachment) {
    lock.rootSurfacePoint = lock.rootAttachment.surfacePoint.clone();
    lock.rootSurfaceNormal = lock.rootAttachment.normal.clone();
  }
  lock.groupLatticeBasePoints = base.groupLatticeBasePoints?.map((point) => point.clone()) || null;
  lock.pointScales = lock.points.map(() => ({ x: 1, z: 1 }));
  lock.pointWidths = lock.points.map(() => 1);
  lock.baseWidth = lock.width;
  fitPointAttributes(lock, lock.points.length);
  if (base.layerOffsetApplied == null) applyLayerOffset(lock);
  lock.mesh = new THREE.Mesh(
    createHairGeometry(lock),
    createHairMaterial(lock)
  );
  lock.wireOverlay = createHairTopologyOverlay(lock.mesh.geometry);
  lock.mesh.add(lock.wireOverlay);
  lock.mesh.castShadow = true;
  lock.mesh.userData.lockId = lock.id;
  lock.curveObjects = createCurveObjects(lock);
  locks.push(lock);
  hairGroup.add(lock.mesh);
  curveGroup.add(lock.curveObjects.group);
  if (!options.deferUi) {
    selectLock(lock.id);
    renderLockList();
    updateCount();
  }
  return lock;
}

function mirroredScalpRegion(region) {
  return ({
    "side-bangs-left": "side-bangs-right",
    "side-bangs-right": "side-bangs-left",
    "side-left": "side-right",
    "side-right": "side-left"
  })[region] || region || "unassigned";
}

function mirroredVector(vector) {
  return vector ? new THREE.Vector3(-vector.x, vector.y, vector.z) : null;
}

function mirroredPlacementFrame(frame) {
  if (!frame) return null;
  return {
    root: mirroredVector(frame.root),
    normal: mirroredVector(frame.normal).normalize(),
    flow: mirroredVector(frame.flow).normalize(),
    side: mirroredVector(frame.side).normalize(),
    sideSign: -Number(frame.sideSign || 1),
    gravity: mirroredVector(frame.gravity || new THREE.Vector3(0, -1, 0)).normalize(),
    orientationStrength: Number(frame.orientationStrength || 0)
  };
}

function mirrorPartnerFor(lock) {
  return lock?.mirrorPartnerId ? locks.find((item) => item.id === lock.mirrorPartnerId) : null;
}

function createMirrorPartner(lock, options = {}) {
  if (!lock) return null;
  const existing = mirrorPartnerFor(lock);
  if (existing) return existing;
  const mirrored = addLock("front", {
    materialId: lock.materialId || DEFAULT_HAIR_MATERIAL_ID,
    scalpRegion: mirroredScalpRegion(lock.scalpRegion),
    hairLayer: normalizeHairLayer(lock.hairLayer),
    layerOffsetApplied: Number(lock.layerOffsetApplied ?? 0),
    layerOffsetRootFactorApplied: Number(lock.layerOffsetRootFactorApplied ?? layerRootOffsetFactor(lock.hairLayer)),
    x: -lock.x,
    y: lock.y,
    z: lock.z,
    length: lock.length,
    curve: -lock.curve,
    width: lock.width,
    geometryType: lock.geometryType,
    braidMeshPreset: lock.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET,
    braidWidth: lock.braidWidth,
    braidDepth: lock.braidDepth,
    braidSegmentLength: lock.braidSegmentLength,
    braidRotation: -Number(lock.braidRotation ?? 0),
    curlEnabled: Boolean(lock.curlEnabled),
    curlCount: Number(lock.curlCount ?? 4),
    curlDisplacement: Number(lock.curlDisplacement ?? 0.18),
    widthScale: lock.widthScale,
    depthScale: lock.depthScale,
    taperCurve: lock.taperCurve.map((point) => ({ ...point })),
    depthCurve: lock.depthCurve.map((point) => ({ ...point })),
    rootScalpOffset: lock.rootScalpOffset,
    rootSurfacePoint: mirroredVector(lock.rootSurfacePoint),
    rootSurfaceNormal: mirroredVector(lock.rootSurfaceNormal),
    twist: -lock.twist,
    radialSegments: lock.radialSegments,
    lengthSegments: lock.lengthSegments,
    dynamicDensity: lock.dynamicDensity,
    densityAggression: lock.densityAggression,
    profileOffset: lock.profileOffset,
    sweepProfile: lock.sweepProfile.map((point) => ({ ...point })),
    points: lock.points.map(mirroredVector),
    groupLatticeBasePoints: lock.groupLatticeBasePoints?.map(mirroredVector) || null
  }, { deferUi: true });
  lock.mirrorPartnerId = mirrored.id;
  mirrored.mirrorPartnerId = lock.id;
  syncMirrorPartnerFromLock(lock, mirrored);
  if (!options.deferUi) {
    renderLockList();
    updateCount();
  }
  return mirrored;
}

function syncMirrorPartnerFromLock(lock, partner = mirrorPartnerFor(lock), options = {}) {
  if (!lock || !partner || partner === lock) return null;
  partner.materialId = lock.materialId || DEFAULT_HAIR_MATERIAL_ID;
  partner.scalpRegion = mirroredScalpRegion(lock.scalpRegion);
  partner.hairLayer = normalizeHairLayer(lock.hairLayer);
  partner.layerOffsetApplied = Number(lock.layerOffsetApplied ?? 0);
  partner.layerOffsetRootFactorApplied = Number(lock.layerOffsetRootFactorApplied ?? layerRootOffsetFactor(lock.hairLayer));
  if (lock.clumpGuide && partner.clumpGuide) {
    partner.clumpInfluence = Number(lock.clumpInfluence ?? 1);
    partner.clumpSpread = Number(lock.clumpSpread ?? 1);
    partner.clumpDepthSpread = Number(lock.clumpDepthSpread ?? 1);
    partner.clumpTipFan = Number(lock.clumpTipFan ?? 0);
    partner.clumpRoll = -Number(lock.clumpRoll ?? 0);
    partner.clumpStrandWidth = Number(lock.clumpStrandWidth ?? 1);
    partner.clumpStrandDepth = Number(lock.clumpStrandDepth ?? 1);
    partner.clumpVariation = Number(lock.clumpVariation ?? 0);
  }
  partner.width = lock.width;
  partner.baseWidth = lock.baseWidth;
  partner.geometryType = lock.geometryType;
  partner.braidMeshPreset = lock.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET;
  partner.braidWidth = lock.braidWidth;
  partner.braidDepth = lock.braidDepth;
  partner.braidSegmentLength = lock.braidSegmentLength;
  partner.braidRotation = -Number(lock.braidRotation ?? 0);
  partner.curlEnabled = Boolean(lock.curlEnabled);
  partner.curlCount = Number(lock.curlCount ?? 4);
  partner.curlDisplacement = Number(lock.curlDisplacement ?? 0.18);
  partner.widthScale = Number(lock.widthScale ?? 1);
  partner.depthScale = Number(lock.depthScale ?? 1);
  partner.twist = -Number(lock.twist || 0);
  partner.taperCurve = lock.taperCurve.map((point) => ({ ...point }));
  partner.depthCurve = lock.depthCurve.map((point) => ({ ...point }));
  partner.sweepProfile = lock.sweepProfile.map((point) => ({ ...point }));
  partner.profileOffset = Number(lock.profileOffset || 0);
  partner.rootScalpOffset = Number(lock.rootScalpOffset || 0);
  partner.rootSurfacePoint = mirroredVector(lock.rootSurfacePoint);
  partner.rootSurfaceNormal = mirroredVector(lock.rootSurfaceNormal)?.normalize() || null;
  partner.rootAttachment = createRootAttachment(partner);
  partner.radialSegments = lock.radialSegments;
  partner.lengthSegments = lock.lengthSegments;
  partner.dynamicDensity = Boolean(lock.dynamicDensity);
  partner.densityAggression = Number(lock.densityAggression ?? 0.5);
  partner.points = lock.points.map(mirroredVector);
  partner.groupLatticeBasePoints = lock.groupLatticeBasePoints?.map(mirroredVector) || null;
  partner.pointScales = lock.pointScales.map((scale) => ({ x: scale.x, z: scale.z }));
  partner.pointWidths = [...lock.pointWidths];
  partner.pointTwists = lock.pointTwists.map((twist) => -twist);
  partner.placementFrame = mirroredPlacementFrame(lock.placementFrame);
  fitPointAttributes(partner, partner.points.length);
  if (partner.curveObjects.handles.length !== partner.points.length) rebuildCurveObjects(partner);
  syncLockFromCurve(partner);
  applyMaterialDefinitionToLock(partner);
  updateLockGeometry(partner, { defer: Boolean(options.deferGeometry) });
  return partner;
}

function syncActiveMirror(lock, options = {}) {
  if (!mirrorXEditing || !lock) return null;
  const partner = mirrorPartnerFor(lock) || createMirrorPartner(lock, { deferUi: true });
  const result = syncMirrorPartnerFromLock(lock, partner, options);
  if (result && options.refreshUi) {
    renderLockList();
    updateCount();
  }
  return result;
}

function setMirrorXEditing(enabled) {
  mirrorXEditing = Boolean(enabled);
  mirrorXToggle.classList.toggle("active", mirrorXEditing);
  mirrorXToggle.setAttribute("aria-pressed", String(mirrorXEditing));
  mirrorXToggle.title = mirrorXEditing
    ? "X axis mirror is active"
    : "Mirror edits and new strands across the X axis";
  if (drawStrandStroke) updateDrawStrandPreview();
  guides.filter((guide) => guide.type === "curve-lattice").forEach(updateCurveLatticeHandleColors);
  updateScalpBuilderHandleColors();
  if (scalpBuilderCurveLattice) {
    scalpBuilderCurveLattice.symmetryLine.visible = scalpBuilderEditing && mirrorXEditing;
    scalpBuilderCurveLattice.headSymmetryLine.visible = scalpBuilderEditing && mirrorXEditing;
  }
}

function snapshotState() {
  return {
    scalpAttachmentVersion: 4,
    lockIndex,
    hairMaterialIndex,
    hairMaterials: hairMaterialDefinitions.map((material) => ({ ...material })),
    selectedId,
    clumpViewportSelection,
    selectedGuideId,
    activeCurveLatticeGuideId,
    selectedStrandGroup,
    selectedPoint: selectedPoint ? { ...selectedPoint } : null,
    selectedCurveLatticePoint: selectedCurveLatticePoint ? { ...selectedCurveLatticePoint } : null,
    selectedControlPoints: selectedControlPoints.map((point) => ({ ...point })),
    pendingPlacedLockId,
    mirrorXEditing,
    strandCollisionEnabled,
    headTransform: { ...headTransform },
    scalpRoughScale: { ...scalpRoughScale },
    scalpBuilderEditedPoints: (scalpBuilderCurveLattice?.points || scalpBuilderEditedPoints || []).map(vectorToData),
    editedScalpRegions: [...editedScalpRegions],
    scalpGuideSource,
    customScalpRegions: [...customScalpRegions],
    scalpSurface: { ...scalpSurface },
    scalpArtistShape: { ...scalpArtistShape },
    scalpLatticePoints: scalpLatticePoints.map(vectorToData),
    scalpRegionAssignments: [...scalpRegionAssignments],
    scalpManualRegionQuads: [...scalpManualRegionQuads],
    strandGroupDefaults: Object.fromEntries(Object.entries(strandGroupDefaults).map(([region, defaults]) => [region, {
      ...defaults,
      layerOffsets: { ...DEFAULT_LAYER_OFFSETS, ...defaults.layerOffsets },
      taperCurve: defaults.taperCurve.map((point) => ({ ...point })),
      depthCurve: defaults.depthCurve.map((point) => ({ ...point })),
      sweepProfile: defaults.sweepProfile.map((point) => ({ ...point }))
    }])),
    locks: locks.map((lock) => ({
      id: lock.id,
      mirrorPartnerId: lock.mirrorPartnerId || null,
      name: lock.name,
      materialId: lock.materialId || DEFAULT_HAIR_MATERIAL_ID,
      x: lock.x,
      y: lock.y,
      z: lock.z,
      length: lock.length,
      curve: lock.curve,
      width: lock.width,
      baseWidth: lock.baseWidth,
      geometryType: lock.geometryType || "strand",
      braidMeshPreset: lock.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET,
      braidWidth: Number(lock.braidWidth ?? 0.34),
      braidDepth: Number(lock.braidDepth ?? 0.44),
      braidSegmentLength: Number(lock.braidSegmentLength ?? 0.28),
      braidRotation: Number(lock.braidRotation ?? 0),
      curlEnabled: Boolean(lock.curlEnabled),
      curlCount: Number(lock.curlCount ?? 4),
      curlDisplacement: Number(lock.curlDisplacement ?? 0.18),
      widthScale: Number(lock.widthScale ?? 1),
      depthScale: Number(lock.depthScale ?? 1),
      taperCurve: lock.taperCurve.map((point) => ({ ...point })),
      depthCurve: lock.depthCurve.map((point) => ({ ...point })),
      profileOffset: Number(lock.profileOffset ?? 0),
      rootScalpOffset: lock.rootScalpOffset,
      hairLayer: normalizeHairLayer(lock.hairLayer),
      layerOffsetApplied: Number(lock.layerOffsetApplied ?? 0),
      layerOffsetRootFactorApplied: Number(lock.layerOffsetRootFactorApplied ?? layerRootOffsetFactor(lock.hairLayer)),
      clumpId: lock.clumpId || null,
      clumpName: lock.clumpName || null,
      clumpGuide: Boolean(lock.clumpGuide),
      clumpGuideId: lock.clumpGuideId || null,
      clumpInfluence: Number(lock.clumpInfluence ?? 1),
      clumpSpread: Number(lock.clumpSpread ?? 1),
      clumpDepthSpread: Number(lock.clumpDepthSpread ?? 1),
      clumpTipFan: Number(lock.clumpTipFan ?? 0),
      clumpRoll: Number(lock.clumpRoll ?? 0),
      clumpStrandWidth: Number(lock.clumpStrandWidth ?? 1),
      clumpStrandDepth: Number(lock.clumpStrandDepth ?? 1),
      clumpVariation: Number(lock.clumpVariation ?? 0),
      clumpRestPoints: lock.clumpRestPoints?.map(vectorToData) || null,
      clumpGuideRestPoints: lock.clumpGuideRestPoints?.map(vectorToData) || null,
      clumpRestTwists: lock.clumpRestTwists ? [...lock.clumpRestTwists] : null,
      clumpGuideRestTwists: lock.clumpGuideRestTwists ? [...lock.clumpGuideRestTwists] : null,
      clumpRestScales: lock.clumpRestScales?.map((scale) => ({ x: scale.x, z: scale.z })) || null,
      clumpGuideRestScales: lock.clumpGuideRestScales?.map((scale) => ({ x: scale.x, z: scale.z })) || null,
      rootSurfacePoint: lock.rootSurfacePoint ? vectorToData(lock.rootSurfacePoint) : null,
      rootSurfaceNormal: lock.rootSurfaceNormal ? vectorToData(lock.rootSurfaceNormal) : null,
      rootAttachment: rootAttachmentToData(syncRootAttachmentMetadata(lock)),
      twist: lock.twist,
      radialSegments: lock.radialSegments,
      lengthSegments: lock.lengthSegments,
      dynamicDensity: Boolean(lock.dynamicDensity),
      densityAggression: Number(lock.densityAggression ?? 0.5),
      sweepProfile: lock.sweepProfile.map((point) => ({ ...point })),
      scalpRegion: lock.scalpRegion || "unassigned",
      points: lock.points.map(vectorToData),
      pointWidths: [...lock.pointWidths],
      pointScales: lock.pointScales.map((scale) => ({ x: scale.x, z: scale.z })),
      pointTwists: [...lock.pointTwists],
      curveLatticeBinding: lock.curveLatticeBinding ? { ...lock.curveLatticeBinding } : null,
      groupLatticeBasePoints: lock.groupLatticeBasePoints?.map(vectorToData) || null,
      placementFrame: lock.placementFrame ? frameToData(lock.placementFrame) : null
    })),
    guides: guides.map((guide) => guide.type === "curve-lattice" ? {
      id: guide.id,
      type: guide.type,
      columns: guide.columns,
      rows: guide.rows,
      opacity: guide.opacity,
      bottomExtrude: guide.bottomExtrude,
      bottomRows: guide.bottomRows,
      scalpRegion: guide.scalpRegion || "bangs",
      color: guide.color,
      points: guide.points.map(vectorToData),
      rootPoints: (guide.rootPoints || []).map(vectorToData),
      bottomPoints: (guide.bottomPoints || []).map(vectorToData),
      deformRestPoints: (guide.deformRestPoints || guide.points).map(vectorToData),
      deformRestRootPoints: (guide.deformRestRootPoints || guide.rootPoints || []).map(vectorToData),
      deformRestBottomPoints: (guide.deformRestBottomPoints || guide.bottomPoints || []).map(vectorToData)
    } : ({
      id: guide.id,
      x: guide.x,
      y: guide.y,
      z: guide.z,
      width: guide.width,
      height: guide.height,
      depth: guide.depth,
      bend: guide.bend,
      verticalBend: guide.verticalBend,
      topCurve: guide.topCurve,
      bottomCurve: guide.bottomCurve,
      density: guide.density,
      opacity: guide.opacity
    }))
  };
}

function scalpTriangleRegion(mesh, triangleIndex) {
  if (mesh === customScalpSurfaceMesh) {
    return customScalpRegions[triangleIndex] || "unassigned";
  }
  if (mesh === editedScalpSurfaceMesh) {
    return editedScalpRegions[triangleIndex]
      || mesh.geometry.userData.triangleRegions?.[triangleIndex]
      || "unassigned";
  }
  const quadId = mesh.geometry.userData.triangleQuadIds?.[triangleIndex];
  return scalpRegionAssignments[quadId] || "unassigned";
}

function closestPointOnActiveScalp(worldPoint, preferredRegion = null) {
  const mesh = activeScalpSurfaceMesh();
  const geometry = mesh?.geometry;
  const position = geometry?.getAttribute("position");
  if (!mesh || !position) return null;

  mesh.updateMatrixWorld(true);
  geometry.computeBoundingBox();
  const inverseMatrix = mesh.matrixWorld.clone().invert();
  const localPoint = worldPoint.clone().applyMatrix4(inverseMatrix);
  const index = geometry.getIndex();
  const triangle = new THREE.Triangle();
  const closest = new THREE.Vector3();
  const bestPoint = new THREE.Vector3();
  const bestNormal = new THREE.Vector3();
  const bestBarycentric = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let bestDistanceSq = Infinity;
  let bestTriangleIndex = -1;
  let bestTriangleVertices = null;
  const triangleCount = index ? index.count / 3 : position.count / 3;

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    if (preferredRegion && scalpTriangleRegion(mesh, triangleIndex) !== preferredRegion) continue;
    const offset = triangleIndex * 3;
    const ia = index ? index.getX(offset) : offset;
    const ib = index ? index.getX(offset + 1) : offset + 1;
    const ic = index ? index.getX(offset + 2) : offset + 2;
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    triangle.set(a, b, c);
    triangle.closestPointToPoint(localPoint, closest);
    const distanceSq = closest.distanceToSquared(localPoint);
    if (distanceSq >= bestDistanceSq) continue;
    bestDistanceSq = distanceSq;
    bestPoint.copy(closest);
    triangle.getNormal(bestNormal);
    triangle.getBarycoord(closest, bestBarycentric);
    bestTriangleIndex = triangleIndex;
    bestTriangleVertices = [ia, ib, ic];
  }

  if (!Number.isFinite(bestDistanceSq) && preferredRegion) {
    return closestPointOnActiveScalp(worldPoint);
  }
  if (!Number.isFinite(bestDistanceSq)) return null;
  const point = bestPoint.applyMatrix4(mesh.matrixWorld);
  const normal = bestNormal.applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
  const center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
  if (normal.dot(point.clone().sub(center)) < 0) normal.negate();
  const uv = geometry.getAttribute("uv");
  let regionPosition = null;
  if (uv && bestTriangleVertices) {
    const [ia, ib, ic] = bestTriangleVertices;
    regionPosition = {
      u: uv.getX(ia) * bestBarycentric.x + uv.getX(ib) * bestBarycentric.y + uv.getX(ic) * bestBarycentric.z,
      v: uv.getY(ia) * bestBarycentric.x + uv.getY(ib) * bestBarycentric.y + uv.getY(ic) * bestBarycentric.z
    };
  }
  return {
    point,
    normal,
    center,
    triangleIndex: bestTriangleIndex,
    barycentric: bestBarycentric.clone(),
    regionPosition
  };
}

function rootAttachmentFrame(lock, normal) {
  const tangent = lock.placementFrame?.flow?.clone()
    || lock.points?.[1]?.clone().sub(lock.points[0])
    || new THREE.Vector3(0, -1, 0);
  tangent.projectOnPlane(normal);
  if (tangent.lengthSq() < 0.000001) tangent.set(0, -1, 0).projectOnPlane(normal);
  if (tangent.lengthSq() < 0.000001) tangent.set(1, 0, 0).projectOnPlane(normal);
  tangent.normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  return { tangent, bitangent };
}

function rootAttachmentLocalFrame(normal, tangent, bitangent) {
  const mesh = activeScalpSurfaceMesh();
  if (!mesh) {
    return {
      normal: normal.clone(),
      tangent: tangent.clone(),
      bitangent: bitangent.clone()
    };
  }
  mesh.updateMatrixWorld(true);
  const inverseWorld = mesh.matrixWorld.clone().invert();
  return {
    normal: normal.clone().transformDirection(inverseWorld).normalize(),
    tangent: tangent.clone().transformDirection(inverseWorld).normalize(),
    bitangent: bitangent.clone().transformDirection(inverseWorld).normalize()
  };
}

function resolveRootAttachment(attachment) {
  const mesh = activeScalpSurfaceMesh();
  const geometry = mesh?.geometry;
  const position = geometry?.getAttribute("position");
  const triangleIndex = Number(attachment?.surfaceLocation?.triangleIndex);
  const barycentric = attachment?.surfaceLocation?.barycentric;
  if (!mesh || !position || !Number.isInteger(triangleIndex) || triangleIndex < 0 || !barycentric) return null;

  const index = geometry.getIndex();
  const offset = triangleIndex * 3;
  if (offset + 2 >= (index?.count ?? position.count)) return null;
  const ia = index ? index.getX(offset) : offset;
  const ib = index ? index.getX(offset + 1) : offset + 1;
  const ic = index ? index.getX(offset + 2) : offset + 2;
  const a = new THREE.Vector3().fromBufferAttribute(position, ia);
  const b = new THREE.Vector3().fromBufferAttribute(position, ib);
  const c = new THREE.Vector3().fromBufferAttribute(position, ic);
  const weightTotal = barycentric.x + barycentric.y + barycentric.z || 1;
  const localPoint = a.multiplyScalar(barycentric.x / weightTotal)
    .addScaledVector(b, barycentric.y / weightTotal)
    .addScaledVector(c, barycentric.z / weightTotal);

  mesh.updateMatrixWorld(true);
  const point = localPoint.applyMatrix4(mesh.matrixWorld);
  const localFrame = attachment.localFrame;
  if (!localFrame) return { point };
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const normal = localFrame.normal.clone().applyMatrix3(normalMatrix).normalize();
  const tangent = localFrame.tangent.clone().transformDirection(mesh.matrixWorld).projectOnPlane(normal).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  return { point, normal, tangent, bitangent };
}

const ROOT_LOCAL_CURVE_FIELDS = Object.freeze({
  points: "points",
  clumpRestPoints: "clumpRestPoints",
  clumpGuideRestPoints: "clumpGuideRestPoints",
  groupLatticeBasePoints: "groupLatticeBasePoints"
});

function curvePointsToRootLocal(points, origin, frame) {
  if (!points?.length || !origin || !frame) return null;
  return points.map((point) => {
    const delta = point.clone().sub(origin);
    return new THREE.Vector3(
      delta.dot(frame.bitangent),
      delta.dot(frame.tangent),
      delta.dot(frame.normal)
    );
  });
}

function curvePointsFromRootLocal(points, origin, frame) {
  if (!points?.length || !origin || !frame) return null;
  return points.map((point) => origin.clone()
    .addScaledVector(frame.bitangent, point.x)
    .addScaledVector(frame.tangent, point.y)
    .addScaledVector(frame.normal, point.z));
}

function syncRootAttachmentLocalCurves(lock, attachment) {
  if (!lock?.points?.length || !attachment) return;
  const resolved = resolveRootAttachment(attachment);
  const frame = {
    normal: resolved?.normal || attachment.normal,
    tangent: resolved?.tangent || attachment.tangent,
    bitangent: resolved?.bitangent || attachment.bitangent
  };
  const origin = lock.points[0];
  attachment.localCurves = {};
  Object.entries(ROOT_LOCAL_CURVE_FIELDS).forEach(([attachmentKey, lockKey]) => {
    const localPoints = curvePointsToRootLocal(lock[lockKey], origin, frame);
    if (localPoints) attachment.localCurves[attachmentKey] = localPoints;
  });
}

function applyRootAttachmentLocalCurves(lock) {
  const attachment = lock?.rootAttachment;
  if (!attachment?.localCurves?.points?.length) return false;
  const resolved = resolveRootAttachment(attachment);
  if (!resolved?.point || !resolved.normal || !resolved.tangent || !resolved.bitangent) return false;
  const rootOffset = rootScalpOffsetDistance(attachment.localOffset)
    + layerOffsetForLock(lock) * layerRootOffsetFactor(attachment.hairLayer);
  const origin = resolved.point.clone().addScaledVector(resolved.normal, rootOffset);
  const frame = {
    normal: resolved.normal,
    tangent: resolved.tangent,
    bitangent: resolved.bitangent
  };

  Object.entries(ROOT_LOCAL_CURVE_FIELDS).forEach(([attachmentKey, lockKey]) => {
    const restored = curvePointsFromRootLocal(attachment.localCurves[attachmentKey], origin, frame);
    if (restored) lock[lockKey] = restored;
  });
  lock.rootSurfacePoint = resolved.point.clone();
  lock.rootSurfaceNormal = resolved.normal.clone();
  if (lock.placementFrame) {
    lock.placementFrame.root.copy(origin);
    lock.placementFrame.normal.copy(resolved.normal);
    lock.placementFrame.flow.copy(resolved.tangent);
    lock.placementFrame.side.copy(resolved.bitangent);
  }
  return true;
}

function createRootAttachment(lock, sourceOverride = null) {
  const sourcePoint = sourceOverride?.clone() || lock.rootSurfacePoint?.clone() || lock.points?.[0]?.clone();
  if (!sourcePoint) return null;
  const surface = closestPointOnActiveScalp(sourcePoint, lock.scalpRegion || null);
  const point = surface?.point || sourcePoint;
  const normal = surface?.normal
    || lock.rootSurfaceNormal?.clone()?.normalize()
    || new THREE.Vector3(0, 1, 0);
  const frame = rootAttachmentFrame(lock, normal);
  const localFrame = rootAttachmentLocalFrame(normal, frame.tangent, frame.bitangent);
  return {
    version: 3,
    coordinateSpace: "scalp-local",
    scalpRegion: lock.scalpRegion || "unassigned",
    regionPosition: surface?.regionPosition ? { ...surface.regionPosition } : null,
    surfaceLocation: surface ? {
      triangleIndex: surface.triangleIndex,
      barycentric: surface.barycentric.clone()
    } : null,
    surfacePoint: point.clone(),
    normal: normal.clone(),
    tangent: frame.tangent,
    bitangent: frame.bitangent,
    localFrame,
    hairLayer: normalizeHairLayer(lock.hairLayer),
    localOffset: Number(lock.rootScalpOffset ?? 0)
  };
}

function syncRootAttachmentMetadata(lock) {
  if (!lock) return null;
  if (!lock.rootAttachment) lock.rootAttachment = createRootAttachment(lock);
  if (!lock.rootAttachment) return null;
  lock.rootAttachment.scalpRegion = lock.scalpRegion || "unassigned";
  lock.rootAttachment.hairLayer = normalizeHairLayer(lock.hairLayer);
  lock.rootAttachment.localOffset = Number(lock.rootScalpOffset ?? 0);
  if (lock.rootSurfacePoint) lock.rootAttachment.surfacePoint.copy(lock.rootSurfacePoint);
  if (lock.rootSurfaceNormal) lock.rootAttachment.normal.copy(lock.rootSurfaceNormal).normalize();
  const frame = rootAttachmentFrame(lock, lock.rootAttachment.normal);
  lock.rootAttachment.tangent.copy(frame.tangent);
  lock.rootAttachment.bitangent.copy(frame.bitangent);
  lock.rootAttachment.localFrame = rootAttachmentLocalFrame(
    lock.rootAttachment.normal,
    lock.rootAttachment.tangent,
    lock.rootAttachment.bitangent
  );
  lock.rootAttachment.version = 3;
  lock.rootAttachment.coordinateSpace = "scalp-local";
  syncRootAttachmentLocalCurves(lock, lock.rootAttachment);
  return lock.rootAttachment;
}

function rootAttachmentToData(attachment) {
  if (!attachment) return null;
  return {
    version: Number(attachment.version || 1),
    coordinateSpace: attachment.coordinateSpace || "scalp-local",
    scalpRegion: attachment.scalpRegion || "unassigned",
    regionPosition: attachment.regionPosition ? { ...attachment.regionPosition } : null,
    surfaceLocation: attachment.surfaceLocation ? {
      triangleIndex: Number(attachment.surfaceLocation.triangleIndex),
      barycentric: vectorToData(attachment.surfaceLocation.barycentric)
    } : null,
    surfacePoint: vectorToData(attachment.surfacePoint),
    normal: vectorToData(attachment.normal),
    tangent: vectorToData(attachment.tangent),
    bitangent: vectorToData(attachment.bitangent),
    localFrame: attachment.localFrame ? {
      normal: vectorToData(attachment.localFrame.normal),
      tangent: vectorToData(attachment.localFrame.tangent),
      bitangent: vectorToData(attachment.localFrame.bitangent)
    } : null,
    localCurves: attachment.localCurves ? Object.fromEntries(
      Object.entries(attachment.localCurves).map(([key, points]) => [key, points.map(vectorToData)])
    ) : null,
    hairLayer: normalizeHairLayer(attachment.hairLayer),
    localOffset: Number(attachment.localOffset ?? 0)
  };
}

function rootAttachmentFromData(data, lock) {
  if (!data) return createRootAttachment(lock);
  const normal = dataToVector(data.normal || vectorToData(lock.rootSurfaceNormal || new THREE.Vector3(0, 1, 0))).normalize();
  const tangent = dataToVector(data.tangent || { x: 0, y: -1, z: 0 }).normalize();
  const bitangent = dataToVector(data.bitangent || { x: 1, y: 0, z: 0 }).normalize();
  const attachment = {
    version: Number(data.version || 1),
    coordinateSpace: data.coordinateSpace || "scalp-local",
    scalpRegion: data.scalpRegion || lock.scalpRegion || "unassigned",
    regionPosition: data.regionPosition ? { ...data.regionPosition } : null,
    surfaceLocation: data.surfaceLocation ? {
      triangleIndex: Number(data.surfaceLocation.triangleIndex),
      barycentric: dataToVector(data.surfaceLocation.barycentric)
    } : null,
    surfacePoint: dataToVector(data.surfacePoint || vectorToData(lock.rootSurfacePoint || lock.points[0])),
    normal,
    tangent,
    bitangent,
    localFrame: data.localFrame ? {
      normal: dataToVector(data.localFrame.normal).normalize(),
      tangent: dataToVector(data.localFrame.tangent).normalize(),
      bitangent: dataToVector(data.localFrame.bitangent).normalize()
    } : rootAttachmentLocalFrame(normal, tangent, bitangent),
    localCurves: data.localCurves ? Object.fromEntries(
      Object.entries(data.localCurves).map(([key, points]) => [key, points.map(dataToVector)])
    ) : null,
    hairLayer: normalizeHairLayer(data.hairLayer ?? lock.hairLayer),
    localOffset: Number(data.localOffset ?? lock.rootScalpOffset ?? 0)
  };
  const resolved = resolveRootAttachment(attachment);
  if (resolved) {
    attachment.surfacePoint.copy(resolved.point);
    if (resolved.normal) attachment.normal.copy(resolved.normal);
    if (resolved.tangent) attachment.tangent.copy(resolved.tangent);
    if (resolved.bitangent) attachment.bitangent.copy(resolved.bitangent);
  }
  return attachment;
}

function remapLegacyPresetToActiveScalp() {
  if (!locks.length) return;
  const scalpCenter = new THREE.Box3().setFromObject(activeScalpSurfaceMesh()).getCenter(new THREE.Vector3());

  locks.forEach((lock) => {
    const oldSurfacePoint = lock.rootSurfacePoint?.clone() || lock.points?.[0]?.clone();
    if (!oldSurfacePoint || !lock.points?.length) return;
    const attachment = closestPointOnActiveScalp(oldSurfacePoint, lock.scalpRegion || null);
    if (!attachment) return;

    const oldNormal = lock.rootSurfaceNormal?.clone()?.normalize()
      || oldSurfacePoint.clone().sub(scalpCenter).normalize();
    if (oldNormal.dot(oldSurfacePoint.clone().sub(scalpCenter)) < 0) oldNormal.negate();
    const rotation = new THREE.Quaternion().setFromUnitVectors(oldNormal, attachment.normal);
    const remapPoint = (point) => point.sub(oldSurfacePoint).applyQuaternion(rotation).add(attachment.point);
    const remapVector = (vector) => vector.applyQuaternion(rotation).normalize();

    lock.points.forEach(remapPoint);
    lock.clumpRestPoints?.forEach(remapPoint);
    lock.clumpGuideRestPoints?.forEach(remapPoint);
    lock.groupLatticeBasePoints?.forEach(remapPoint);
    if (lock.placementFrame) {
      if (lock.placementFrame.root) remapPoint(lock.placementFrame.root);
      if (lock.placementFrame.normal) remapVector(lock.placementFrame.normal);
      if (lock.placementFrame.flow) remapVector(lock.placementFrame.flow);
      if (lock.placementFrame.side) remapVector(lock.placementFrame.side);
    }
    lock.rootSurfacePoint = attachment.point.clone();
    lock.rootSurfaceNormal = attachment.normal.clone();
    lock.rootAttachment = createRootAttachment(lock);
    lock.x = lock.points[0].x;
    lock.y = lock.points[0].y;
    lock.z = lock.points[0].z;
    updateLockGeometry(lock);
    updateCurveObjects(lock, { visible: lock.id === selectedId });
  });
  renderLockList();
  updateCount();
}

function buildHairProjectFile(name) {
  return createHairProject({
    name,
    state: snapshotState(),
    strandGroups: STRAND_GROUPS,
    headAsset: importedHeadAsset,
    scalpGuideAsset: importedScalpGuideAsset
  });
}

async function importScalpGuideMeshFile(file) {
  try {
    const content = await file.text();
    const model = new OBJLoader().parse(content);
    installCustomScalpGuide(model, {
      name: file.name || "custom-scalp.obj",
      content
    });
  } catch (error) {
    console.error("Could not import scalp guide OBJ", error);
    window.alert("That OBJ could not be imported as a scalp guide. Please check that it contains valid polygon geometry.");
    setScalpGuideSource("default");
  } finally {
    scalpGuideMeshFileInput.value = "";
  }
}

async function importHeadMeshFile(file) {
  const importButton = document.querySelector("#importHeadMesh");
  try {
    const content = await file.text();
    const model = new OBJLoader().parse(content);
    installGuideModel(model, { normalize: true });
    importedHeadAsset = {
      format: "obj",
      name: file.name || "custom-head.obj",
      content
    };
    importButton.title = `Using ${importedHeadAsset.name}. Import another head mesh`;
  } catch (error) {
    console.error("Could not import head OBJ", error);
    window.alert("That OBJ could not be imported as a head mesh. Please check that it contains valid polygon geometry.");
  } finally {
    headMeshFileInput.value = "";
  }
}

async function saveHairProjectThroughLocalDialog(content, suggestedName) {
  const payload = JSON.stringify({ suggestedName, content });
  const origins = [
    location.protocol === "http:" && ["127.0.0.1", "localhost"].includes(location.hostname) ? location.origin : null,
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5173"
  ].filter((origin, index, all) => origin && all.indexOf(origin) === index);
  let lastError = null;
  for (const origin of origins) {
    try {
      const response = await fetch(`${origin}/api/save-project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save project");
      if (result.saved && result.fileName) {
        currentProjectName = result.fileName.replace(/\.animehair\.json$/i, "").replace(/\.json$/i, "") || currentProjectName;
      }
      return result;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Local Save As dialog is unavailable");
}

async function saveHairProjectFile() {
  if (projectSaveInProgress) return;
  const saveButton = document.querySelector("#saveCurrentPreset");
  projectSaveInProgress = true;
  saveButton.disabled = true;
  try {
    const suggestedName = projectFileName(currentProjectName);
    const content = `${JSON.stringify(buildHairProjectFile(currentProjectName))}\n`;

    await saveHairProjectThroughLocalDialog(content, suggestedName);
  } catch (error) {
    if (error?.name !== "AbortError") {
      console.error(error);
      window.alert("Save As could not be opened. Your project was not downloaded or overwritten. Please open Anime Hair Studio from its local app URL and try again.");
    }
  } finally {
    projectSaveInProgress = false;
    saveButton.disabled = false;
  }
}

async function openHairProjectFile(file) {
  try {
    const project = validateHairProject(JSON.parse(await file.text()));
    if (project.headAsset?.format === "obj" && typeof project.headAsset.content === "string") {
      const model = new OBJLoader().parse(project.headAsset.content);
      installGuideModel(model, { normalize: true });
      importedHeadAsset = { ...project.headAsset };
      document.querySelector("#importHeadMesh").title = `Using ${project.headAsset.name || "custom head"}. Import another head mesh`;
    } else if (Object.prototype.hasOwnProperty.call(project, "headAsset")) {
      await loadDefaultGuideModel();
      document.querySelector("#importHeadMesh").title = "Import head mesh from an OBJ file";
    }
    if (project.scalpGuideAsset?.format === "obj" && typeof project.scalpGuideAsset.content === "string") {
      const scalpModel = new OBJLoader().parse(project.scalpGuideAsset.content);
      installCustomScalpGuide(scalpModel, {
        name: project.scalpGuideAsset.name || "custom-scalp.obj",
        content: project.scalpGuideAsset.content,
        preserveCoordinates: Boolean(project.scalpGuideAsset.preserveCoordinates),
        quadWirePositions: project.scalpGuideAsset.quadWirePositions
      });
    } else if (Object.prototype.hasOwnProperty.call(project, "scalpGuideAsset")) {
      importedScalpGuideAsset = null;
      setScalpGuideSource("default");
    }
    pushUndoState();
    restoreState(project.state);
    if (project.metadata?.name) currentProjectName = project.metadata.name;
    presetLibraryStatus.textContent = `${project.metadata?.name || "Project"} opened`;
    setPresetLibraryOpen(false);
  } catch (error) {
    console.error(error);
    presetLibraryStatus.textContent = "Could not open project file";
  } finally {
    hairProjectFileInput.value = "";
  }
}

function pushUndoState() {
  if (restoringHistory) return;
  undoHistory.push(snapshotState());
  updateUndoButton();
}

function undoLastAction() {
  const state = undoHistory.pop();
  if (!state) return;
  restoreState(state);
  updateUndoButton();
}

function updateUndoButton() {
  if (!undoButton) return;
  undoButton.disabled = undoHistory.length === 0;
}

function restoreState(state, { preservePlacement = false } = {}) {
  restoringHistory = true;
  transformControls.detach();
  placeEdit = null;
  transformDragging = false;
  updateInteractionLocks();
  disposeAllEditableObjects();
  locks.length = 0;
  guides.length = 0;
  lockIndex = state.lockIndex;
  hairMaterialIndex = state.hairMaterialIndex || 1;
  hairMaterialDefinitions.splice(
    0,
    hairMaterialDefinitions.length,
    ...(state.hairMaterials?.length ? state.hairMaterials : [{
      id: DEFAULT_HAIR_MATERIAL_ID,
      name: "Default Purple",
      ...DEFAULT_HAIR_MATERIAL_SETTINGS
    }]).map((material) => normalizeHairMaterialDefinition({ ...material }))
  );
  selectedId = state.selectedId;
  clumpViewportSelection = Boolean(state.clumpViewportSelection);
  selectedGuideId = state.selectedGuideId;
  activeCurveLatticeGuideId = state.activeCurveLatticeGuideId || null;
  selectedStrandGroup = state.selectedStrandGroup || null;
  selectedPoint = state.selectedPoint ? { ...state.selectedPoint } : null;
  selectedCurveLatticePoint = state.selectedCurveLatticePoint ? { ...state.selectedCurveLatticePoint } : null;
  pendingPlacedLockId = state.pendingPlacedLockId;
  setMirrorXEditing(Boolean(state.mirrorXEditing));
  setStrandCollisionEnabled(Boolean(state.strandCollisionEnabled), { resolve: false });
  if (!preservePlacement) {
    scalpBuilderEditedPoints = state.scalpBuilderEditedPoints?.map(dataToVector) || null;
    if (scalpBuilderCurveLattice && scalpBuilderEditedPoints?.length === scalpBuilderCurveLattice.points.length) {
      scalpBuilderEditedPoints.forEach((point, index) => {
        scalpBuilderCurveLattice.points[index].copy(point);
        scalpBuilderCurveLattice.handles[index].position.copy(point);
      });
      updateScalpBuilderCurveLatticeGeometry();
      updateScalpBuilderHandleColors();
    }
  }
  if (!preservePlacement) {
    Object.assign(headTransform, {
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      uniformScale: 1,
      scaleX: 1,
      scaleY: 1,
      scaleZ: 1
    }, state.headTransform || {});
    syncHeadTransformInputs();
    applyHeadTransform();
    Object.assign(scalpRoughScale, { x: 1, y: 1, z: 1 }, state.scalpRoughScale || {});
    syncScalpRoughScaleInputs();
    applyScalpRoughScale();
    ensureEditedScalpSurface().then(() => {
      if (state.editedScalpRegions?.length === editedScalpRegions.length) {
        editedScalpRegions = [...state.editedScalpRegions];
        writeEditedScalpRegionColors();
      }
    }).catch((error) => console.error("Could not restore the authored scalp surface", error));
    if (state.scalpSurface) Object.assign(scalpSurface, state.scalpSurface);
    if (state.scalpArtistShape) Object.assign(scalpArtistShape, state.scalpArtistShape);
  }
  if (state.strandGroupDefaults) {
    Object.entries(state.strandGroupDefaults).forEach(([region, defaults]) => {
      if (!strandGroupDefaults[region]) return;
      Object.assign(strandGroupDefaults[region], defaults, {
        layerOffsets: { ...DEFAULT_LAYER_OFFSETS, ...defaults.layerOffsets },
        taperCurve: normalizeTaperCurve(defaults.taperCurve, defaults),
        depthCurve: normalizeTaperCurve(defaults.depthCurve, defaults),
        sweepProfile: (defaults.sweepProfile || DEFAULT_SWEEP_PROFILE).map((point) => ({ ...point }))
      });
    });
  }
  if (!preservePlacement) {
    if (state.scalpLatticePoints?.length === scalpLatticePoints.length) {
      state.scalpLatticePoints.forEach((point, index) => scalpLatticePoints[index].copy(dataToVector(point)));
    }
    if (state.scalpRegionAssignments?.length === scalpRegionAssignments.length) {
      scalpRegionAssignments = [...state.scalpRegionAssignments];
      scalpManualRegionQuads = new Set(state.scalpManualRegionQuads || []);
    }
    syncScalpInputs();
    syncScalpArtistInputs();
    updateScalpTopology();
    if (state.customScalpRegions?.length === customScalpRegions.length) {
      customScalpRegions = [...state.customScalpRegions];
      writeCustomScalpRegionColors();
    }
    setScalpGuideSource(state.scalpGuideSource || "default");
    updateScalpSurface();
    applyScalpLatticeDeformation();
    updateScalpLatticeObjects();
  }

  state.locks.forEach((snapshot) => restoreLock(snapshot));
  state.guides.forEach((snapshot) => restoreGuide(snapshot));

  if (!locks.some((lock) => lock.id === selectedId)) {
    selectedId = undefined;
    clumpViewportSelection = false;
  }
  if (!guides.some((guide) => guide.id === selectedGuideId)) selectedGuideId = undefined;
  if (!guides.some((guide) => guide.id === activeCurveLatticeGuideId && guide.type === "curve-lattice")) activeCurveLatticeGuideId = null;
  if (!CURVE_LATTICE_FEATURE_ENABLED) {
    if (guides.some((guide) => guide.id === selectedGuideId && guide.type === "curve-lattice")) {
      selectedGuideId = undefined;
    }
    activeCurveLatticeGuideId = null;
    selectedCurveLatticePoint = null;
  }
  if (!locks.some((lock) => lock.id === selectedPoint?.lockId)) selectedPoint = null;
  if (!locks.some((lock) => lock.id === pendingPlacedLockId)) pendingPlacedLockId = null;

  const pointToRestore = selectedPoint ? { ...selectedPoint } : null;
  const latticePointToRestore = selectedCurveLatticePoint ? { ...selectedCurveLatticePoint } : null;
  const controlsToRestore = (state.selectedControlPoints || []).map((point) => ({ ...point }));
  if (selectedId) selectLock(selectedId, { individualClumpMember: !clumpViewportSelection });
  else if (selectedStrandGroup) {
    const groupToRestore = selectedStrandGroup;
    selectedStrandGroup = null;
    selectStrandGroup(groupToRestore);
  } else if (selectedGuideId) selectGuide(selectedGuideId);
  else {
    updateGuideControlsVisibility();
    renderLockList();
    updateAttributeEditorMode();
    updateSelectedPointLabel();
  }
  if (pointToRestore) selectCurvePoint(pointToRestore.lockId, pointToRestore.pointIndex);
  else if (latticePointToRestore) {
    const guide = guides.find((item) => item.id === latticePointToRestore.guideId);
    if (guide) selectCurveLatticePoint(guide, latticePointToRestore.pointIndex, false);
  }
  if (controlsToRestore.length > 1) {
    selectedControlPoints = controlsToRestore.filter((point) => (
      point.type === "strand"
        ? locks.some((lock) => lock.id === point.lockId && point.pointIndex < lock.points.length)
        : guides.some((guide) => guide.id === point.guideId && curveLatticeEditablePoint(guide, point.pointIndex))
    ));
    locks.forEach((lock) => updateCurveObjects(lock, { visible: lock.id === selectedId }));
    guides.filter((guide) => guide.type === "curve-lattice").forEach(updateCurveLatticeHandleColors);
    updateSelectedPointLabel();
  }
  const editingCurveLattice = getSelectedGuide()?.type === "curve-lattice";
  curveLatticeToggle.classList.toggle("active", editingCurveLattice);
  curveLatticeToggle.setAttribute("aria-pressed", String(editingCurveLattice));
  updateCount();
  updatePlacementStatus();
  restoringHistory = false;
}

function disposeAllEditableObjects() {
  locks.forEach((lock) => {
    hairGroup.remove(lock.mesh);
    curveGroup.remove(lock.curveObjects.group);
    lock.mesh.geometry.dispose();
    lock.mesh.material.dispose();
    lock.wireOverlay?.geometry.dispose();
    lock.wireOverlay?.material.dispose();
    disposeCurveObjects(lock);
  });
  guides.forEach((guide) => {
    removeGuideObjects(guide);
    disposeGuide(guide);
  });
}

function restoreLock(snapshot) {
  const legacyUniformLayerOffset = snapshot.layerOffsetRootFactorApplied == null;
  const lock = {
    ...snapshot,
    materialId: snapshot.materialId || DEFAULT_HAIR_MATERIAL_ID,
    points: snapshot.points.map(dataToVector),
    pointWidths: [...snapshot.pointWidths],
    pointScales: snapshot.pointScales.map((scale) => ({ x: scale.x, z: scale.z })),
    pointTwists: [...snapshot.pointTwists],
    sweepProfile: (snapshot.sweepProfile || DEFAULT_SWEEP_PROFILE).map((point) => ({ ...point })),
    taperCurve: normalizeTaperCurve(snapshot.taperCurve, snapshot),
    depthCurve: normalizeTaperCurve(snapshot.depthCurve, snapshot),
    widthScale: Number(snapshot.widthScale ?? 1),
    depthScale: Number(snapshot.depthScale ?? 1),
    profileOffset: Number(snapshot.profileOffset ?? 0),
    geometryType: snapshot.geometryType === "braid" ? "braid" : "strand",
    braidMeshPreset: snapshot.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET,
    braidWidth: Number(snapshot.braidWidth ?? snapshot.width ?? 0.34),
    braidDepth: Number(snapshot.braidDepth ?? 0.44),
    braidSegmentLength: Number(snapshot.braidSegmentLength ?? 0.28),
    braidRotation: Number(snapshot.braidRotation ?? 0),
    curlEnabled: Boolean(snapshot.curlEnabled),
    curlCount: THREE.MathUtils.clamp(Number(snapshot.curlCount ?? 4), 0.25, 24),
    curlDisplacement: THREE.MathUtils.clamp(Number(snapshot.curlDisplacement ?? 0.18), 0, 1.2),
    dynamicDensity: Boolean(snapshot.dynamicDensity),
    densityAggression: THREE.MathUtils.clamp(Number(snapshot.densityAggression ?? 0.5), 0, 1),
    rootScalpOffset: Number(snapshot.rootScalpOffset ?? 0),
    hairLayer: normalizeHairLayer(snapshot.hairLayer),
    layerOffsetApplied: Number(snapshot.layerOffsetApplied ?? 0),
    layerOffsetRootFactorApplied: Number(snapshot.layerOffsetRootFactorApplied ?? 1),
    clumpId: snapshot.clumpId || null,
    clumpName: snapshot.clumpName || null,
    clumpGuide: Boolean(snapshot.clumpGuide),
    clumpGuideId: snapshot.clumpGuideId || null,
    clumpInfluence: Number(snapshot.clumpInfluence ?? 1),
    clumpSpread: Number(snapshot.clumpSpread ?? 1),
    clumpDepthSpread: Number(snapshot.clumpDepthSpread ?? 1),
    clumpTipFan: Number(snapshot.clumpTipFan ?? 0),
    clumpRoll: Number(snapshot.clumpRoll ?? 0),
    clumpStrandWidth: Number(snapshot.clumpStrandWidth ?? 1),
    clumpStrandDepth: Number(snapshot.clumpStrandDepth ?? 1),
    clumpVariation: Number(snapshot.clumpVariation ?? 0),
    clumpRestPoints: snapshot.clumpRestPoints?.map(dataToVector) || null,
    clumpGuideRestPoints: snapshot.clumpGuideRestPoints?.map(dataToVector) || null,
    clumpRestTwists: snapshot.clumpRestTwists ? [...snapshot.clumpRestTwists] : null,
    clumpGuideRestTwists: snapshot.clumpGuideRestTwists ? [...snapshot.clumpGuideRestTwists] : null,
    clumpRestScales: snapshot.clumpRestScales?.map((scale) => ({ x: scale.x, z: scale.z })) || null,
    clumpGuideRestScales: snapshot.clumpGuideRestScales?.map((scale) => ({ x: scale.x, z: scale.z })) || null,
    rootSurfacePoint: snapshot.rootSurfacePoint ? dataToVector(snapshot.rootSurfacePoint) : null,
    rootSurfaceNormal: snapshot.rootSurfaceNormal ? dataToVector(snapshot.rootSurfaceNormal).normalize() : null,
    groupLatticeBasePoints: snapshot.groupLatticeBasePoints?.map(dataToVector) || null,
    placementFrame: snapshot.placementFrame ? frameFromData(snapshot.placementFrame) : null
  };
  lock.rootAttachment = rootAttachmentFromData(snapshot.rootAttachment || null, lock);
  lock.rootSurfacePoint = lock.rootAttachment?.surfacePoint?.clone() || lock.rootSurfacePoint;
  lock.rootSurfaceNormal = lock.rootAttachment?.normal?.clone() || lock.rootSurfaceNormal;
  applyRootAttachmentLocalCurves(lock);
  lock.radialSegments = lock.radialSegments || 10;
  lock.lengthSegments = lock.lengthSegments || 26;
  if (legacyUniformLayerOffset) applyLayerOffset(lock, lock.layerOffsetApplied);
  lock.mesh = new THREE.Mesh(
    createHairGeometry(lock),
    createHairMaterial(lock)
  );
  lock.wireOverlay = createHairTopologyOverlay(lock.mesh.geometry);
  lock.mesh.add(lock.wireOverlay);
  lock.mesh.castShadow = true;
  lock.mesh.userData.lockId = lock.id;
  lock.curveObjects = createCurveObjects(lock);
  locks.push(lock);
  hairGroup.add(lock.mesh);
  curveGroup.add(lock.curveObjects.group);
}

function restoreGuide(snapshot) {
  if (snapshot.type === "curve-lattice") {
    addCurveLattice({
      ...snapshot,
      points: snapshot.points.map(dataToVector),
      rootPoints: snapshot.rootPoints?.map(dataToVector),
      bottomPoints: snapshot.bottomPoints?.map(dataToVector),
      deformRestPoints: snapshot.deformRestPoints?.map(dataToVector),
      deformRestRootPoints: snapshot.deformRestRootPoints?.map(dataToVector),
      deformRestBottomPoints: snapshot.deformRestBottomPoints?.map(dataToVector)
    }, { deferUi: true });
    return;
  }
  const guide = { ...snapshot };
  guide.mesh = new THREE.Mesh(
    createGuideGeometry(guide),
    new THREE.MeshStandardMaterial({
      color: 0x75c9ff,
      roughness: 0.54,
      metalness: 0,
      transparent: true,
      opacity: guide.opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  guide.mesh.position.set(guide.x, guide.y, guide.z);
  guide.mesh.userData.guideId = guide.id;
  guide.wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(guide.mesh.geometry),
    new THREE.LineBasicMaterial({ color: 0xb8e7ff, transparent: true, opacity: 0.62, depthWrite: false })
  );
  guide.wire.position.copy(guide.mesh.position);
  guide.wire.userData.guideId = guide.id;
  guides.push(guide);
  guideSurfaceGroup.add(guide.mesh, guide.wire);
}

function vectorToData(vector) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function dataToVector(data) {
  return new THREE.Vector3(data.x, data.y, data.z);
}

function frameToData(frame) {
  return {
    root: vectorToData(frame.root),
    normal: vectorToData(frame.normal),
    flow: vectorToData(frame.flow),
    side: vectorToData(frame.side),
    sideSign: frame.sideSign,
    gravity: vectorToData(frame.gravity),
    orientationStrength: frame.orientationStrength || 0
  };
}

function frameFromData(data) {
  return {
    root: dataToVector(data.root),
    normal: dataToVector(data.normal),
    flow: dataToVector(data.flow),
    side: dataToVector(data.side),
    sideSign: data.sideSign,
    gravity: dataToVector(data.gravity),
    orientationStrength: data.orientationStrength || 0
  };
}

async function applyPresetSelection(presetName) {
  const projectUrl = authoredPresetProjects.get(presetName);
  if (projectUrl) {
    const response = await fetch(projectUrl, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load preset project (${response.status})`);
    const project = await response.json();
    if (project?.format !== "anime-hair-studio-project" || Number(project.version) !== 1) {
      throw new Error("Unsupported Anime Hair Studio preset format");
    }
    if (!project.state || !Array.isArray(project.state.locks) || !Array.isArray(project.state.guides)) {
      throw new Error("Preset scene data is incomplete");
    }
    pushUndoState();
    restoreState(project.state, { preservePlacement: true });
    if (Number(project.state.scalpAttachmentVersion || 1) < 2) {
      remapLegacyPresetToActiveScalp();
    }
    currentProjectName = presetCatalog.find((preset) => preset.id === presetName)?.title || project.metadata?.name || currentProjectName;
    return;
  }

  pushUndoState();
  if (generatedPresetGroups.has(presetName)) {
    if (presetName === "bowl-cut") addBowlCutPreset();
    else if (presetName === "long-layered-curls") addLongLayeredCurlsPreset();
    else if (presetName === "braided-bob") addBraidedBobPreset();
    else addGeneratedBangPreset();
    return;
  }
  addLock(presetName);
}

function addPresetSelection() {
  applyPresetSelection(document.querySelector("#preset").value);
}

function drawPresetThumbnail(canvas, type) {
  const context = canvas.getContext("2d");
  const width = 360;
  const height = 220;
  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#29272e";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#34323a";
  context.beginPath();
  context.ellipse(180, 124, 55, 72, 0, 0, Math.PI * 2);
  context.fill();

  const fillHair = (path, alpha = 1) => {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = "#49375e";
    context.strokeStyle = "#70e8ef";
    context.lineWidth = 2;
    context.lineJoin = "round";
    context.fill(path);
    context.stroke(path);
    context.restore();
  };

  const strand = (rootX, rootY, bendX, tipX, tipY, halfWidth = 15, alpha = 1) => {
    const path = new Path2D();
    path.moveTo(rootX - halfWidth, rootY);
    path.bezierCurveTo(rootX - halfWidth + bendX, rootY + 34, tipX - halfWidth * 0.4, tipY - 34, tipX, tipY);
    path.bezierCurveTo(tipX + halfWidth * 0.4, tipY - 34, rootX + halfWidth + bendX, rootY + 34, rootX + halfWidth, rootY);
    path.closePath();
    fillHair(path, alpha);
  };

  if (type === "braided-buns") {
    const cap = new Path2D();
    cap.moveTo(109, 132);
    cap.bezierCurveTo(108, 43, 252, 43, 251, 132);
    cap.bezierCurveTo(245, 163, 216, 170, 199, 151);
    cap.bezierCurveTo(188, 169, 171, 169, 160, 151);
    cap.bezierCurveTo(142, 171, 115, 161, 109, 132);
    cap.closePath();
    fillHair(cap);
    const bun = (x, mirror) => {
      const outer = new Path2D();
      outer.moveTo(x, 115);
      outer.bezierCurveTo(x + mirror * 42, 111, x + mirror * 47, 169, x, 176);
      outer.bezierCurveTo(x - mirror * 16, 162, x - mirror * 15, 130, x, 115);
      outer.closePath();
      fillHair(outer, 0.9);
      for (let index = 0; index < 4; index += 1) {
        const y = 184 + index * 13;
        const radius = 14 - index * 2.2;
        const lobe = new Path2D();
        lobe.moveTo(x, y - radius);
        lobe.bezierCurveTo(x + mirror * radius, y - radius * 0.3, x + mirror * radius, y + radius * 0.3, x, y + radius);
        lobe.bezierCurveTo(x - mirror * radius, y + radius * 0.3, x - mirror * radius, y - radius * 0.3, x, y - radius);
        lobe.closePath();
        fillHair(lobe, 0.94);
      }
    };
    bun(127, -1);
    bun(233, 1);
    strand(151, 58, -5, 143, 141, 20, 0.92);
    strand(181, 51, 0, 181, 139, 25);
    strand(211, 58, 5, 219, 141, 20, 0.92);
  } else if (type === "braided-bob") {
    const cap = new Path2D();
    cap.moveTo(112, 126);
    cap.bezierCurveTo(112, 43, 248, 43, 248, 126);
    cap.bezierCurveTo(244, 154, 224, 166, 211, 158);
    cap.lineTo(194, 112);
    cap.lineTo(180, 154);
    cap.lineTo(163, 112);
    cap.lineTo(146, 158);
    cap.bezierCurveTo(126, 164, 115, 148, 112, 126);
    cap.closePath();
    fillHair(cap);
    const braid = (x, mirror = 1) => {
      for (let index = 0; index < 5; index += 1) {
        const y = 137 + index * 14;
        const radius = 14 - index * 2;
        const lobe = new Path2D();
        lobe.moveTo(x, y - radius);
        lobe.bezierCurveTo(x + mirror * radius, y - radius * 0.35, x + mirror * radius, y + radius * 0.35, x, y + radius);
        lobe.bezierCurveTo(x - mirror * radius, y + radius * 0.35, x - mirror * radius, y - radius * 0.35, x, y - radius);
        lobe.closePath();
        fillHair(lobe, 0.94);
      }
    };
    braid(125, -1);
    braid(235, 1);
    strand(151, 59, -4, 147, 137, 22, 0.9);
    strand(181, 52, 2, 182, 132, 26);
    strand(210, 59, 5, 214, 137, 22, 0.9);
  } else if (type === "long-layers") {
    for (let index = 0; index < 9; index += 1) {
      const x = 116 + index * 16;
      const tipX = x + Math.sin(index * 2.1) * 15;
      strand(x, 58 + Math.abs(index - 4) * 2, Math.sin(index * 1.7) * 8, tipX, 203 - Math.abs(index - 4) * 5, 13, 0.72 + (index % 3) * 0.1);
    }
    strand(130, 68, -25, 92, 177, 14);
    strand(230, 68, 25, 268, 177, 14);
    strand(157, 62, -6, 145, 143, 17);
    strand(181, 55, 7, 190, 151, 19);
    strand(206, 62, 11, 222, 140, 16);
  } else if (type === "bowl") {
    const cap = new Path2D();
    cap.moveTo(113, 129);
    cap.bezierCurveTo(116, 46, 244, 42, 249, 129);
    cap.lineTo(239, 167);
    cap.lineTo(222, 145);
    cap.lineTo(205, 176);
    cap.lineTo(183, 148);
    cap.lineTo(163, 177);
    cap.lineTo(143, 145);
    cap.lineTo(123, 166);
    cap.closePath();
    fillHair(cap);
    strand(132, 82, -16, 108, 178, 12, 0.82);
    strand(228, 82, 16, 252, 178, 12, 0.82);
  } else if (type === "bangs") {
    strand(144, 66, -8, 129, 183, 17, 0.85);
    strand(163, 59, -3, 157, 195, 19);
    strand(184, 58, 2, 185, 184, 20);
    strand(205, 62, 4, 215, 193, 18);
    strand(225, 69, 9, 240, 176, 15, 0.85);
  } else if (type === "front") {
    strand(181, 54, -6, 170, 197, 25);
  } else if (type === "side") {
    strand(171, 61, 48, 244, 185, 24);
    strand(184, 62, 38, 232, 165, 15, 0.72);
  } else if (type === "back") {
    strand(142, 70, -18, 118, 188, 18, 0.78);
    strand(164, 57, -12, 150, 202, 21);
    strand(190, 55, 7, 196, 203, 23);
    strand(216, 66, 15, 236, 190, 19, 0.85);
  } else if (type === "tail") {
    const base = new Path2D();
    base.arc(180, 86, 47, Math.PI, 0);
    base.lineTo(227, 126);
    base.lineTo(133, 126);
    base.closePath();
    fillHair(base, 0.8);
    strand(229, 92, 43, 286, 186, 27);
    strand(242, 105, 38, 300, 157, 15, 0.75);
  } else if (type === "ahoge") {
    const ahoge = new Path2D();
    ahoge.moveTo(178, 91);
    ahoge.bezierCurveTo(149, 56, 198, 52, 187, 19);
    ahoge.bezierCurveTo(212, 48, 172, 65, 186, 93);
    ahoge.closePath();
    fillHair(ahoge);
  }

  context.strokeStyle = "#55515a";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(28, 198.5);
  context.lineTo(332, 198.5);
  context.stroke();
}

function renderPresetLibrary() {
  const catalog = activePresetFilter === "custom" ? customPresetCatalog : presetCatalog.filter((preset) => preset.category === activePresetFilter);
  document.querySelector("#fullPresetCount").textContent = presetCatalog.filter((preset) => preset.category === "full").length;
  document.querySelector("#elementPresetCount").textContent = presetCatalog.filter((preset) => preset.category === "elements").length;
  document.querySelector("#customPresetCount").textContent = customPresetCatalog.length;
  presetFilterButtons.forEach((button) => {
    const active = button.dataset.presetFilter === activePresetFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const headings = { full: "Full Hair Presets", elements: "Hair Elements", custom: "Custom Presets" };
  presetLibraryStatus.textContent = headings[activePresetFilter];
  presetLibraryGrid.replaceChildren();
  if (!catalog.length) {
    const empty = document.createElement("div");
    empty.className = "preset-library-empty";
    empty.textContent = "No custom presets";
    presetLibraryGrid.append(empty);
    return;
  }
  catalog.forEach((preset) => {
    const button = document.createElement("button");
    button.className = "preset-card";
    button.type = "button";
    button.setAttribute("aria-label", `Add ${preset.title} preset`);
    const preview = preset.previewImage ? document.createElement("img") : document.createElement("canvas");
    preview.setAttribute("aria-hidden", "true");
    if (preset.previewImage) {
      preview.className = "preset-card-image";
      preview.src = preset.previewImage;
      preview.alt = "";
    }
    const label = document.createElement("span");
    label.className = "preset-card-label";
    const title = document.createElement("span");
    title.textContent = preset.title;
    const category = document.createElement("small");
    category.textContent = preset.category === "full" ? "Full Hair" : preset.category === "custom" ? "Custom" : "Element";
    label.append(title, category);
    button.append(preview, label);
    button.addEventListener("click", async () => {
      button.disabled = true;
      presetLibraryStatus.textContent = `Loading ${preset.title}`;
      try {
        await applyPresetSelection(preset.id);
        presetLibraryStatus.textContent = `${preset.title} added`;
        if (authoredPresetProjects.has(preset.id)) setPresetLibraryOpen(false);
      } catch (error) {
        console.error(error);
        presetLibraryStatus.textContent = `Could not load ${preset.title}`;
      } finally {
        button.disabled = false;
      }
    });
    presetLibraryGrid.append(button);
    if (!preset.previewImage) drawPresetThumbnail(preview, preset.thumbnail);
  });
}

function setPresetLibraryOpen(open) {
  presetLibrary.classList.toggle("hidden", !open);
  presetLibraryToggle.classList.toggle("active", open);
  presetLibraryToggle.setAttribute("aria-pressed", String(open));
  presetLibraryToggle.setAttribute("aria-label", open ? "Close preset library" : "Open preset library");
  presetLibraryToggle.title = open ? "Close preset library" : "Open preset library";
  if (open) {
    renderPresetLibrary();
    document.querySelector("#closePresetLibrary").focus();
  }
  updateViewportStatsVisibility();
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function fitPointAttributes(lock, count) {
  const oldWidths = lock.pointWidths || [1];
  const oldScales = lock.pointScales || [{ x: 1, z: 1 }];
  const oldTwists = lock.pointTwists || [0, 0];
  lock.pointWidths = [];
  lock.pointScales = [];
  lock.pointTwists = [];
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0 : i / (count - 1);
    const scale = {
      x: sampleScale(oldScales, t, "x"),
      z: sampleScale(oldScales, t, "z")
    };
    lock.pointScales.push(scale);
    lock.pointWidths.push(sampleArray(oldWidths, t) || (scale.x + scale.z) * 0.5);
    lock.pointTwists.push(sampleArray(oldTwists, t));
  }
}

function rebuildCurveObjects(lock) {
  if (lock.curveObjects) {
    curveGroup.remove(lock.curveObjects.group);
    disposeCurveObjects(lock);
    lock.curveObjects = null;
  }
  lock.curveObjects = createCurveObjects(lock);
  curveGroup.add(lock.curveObjects.group);
  updateCurveObjects(lock, { visible: lock.id === selectedId });
}

function createCurvePoints(lock) {
  return [
    new THREE.Vector3(lock.x, lock.y, lock.z),
    new THREE.Vector3(lock.x + lock.curve * 0.18, lock.y - lock.length * 0.34, lock.z + 0.1),
    new THREE.Vector3(lock.x + lock.curve * 0.34, lock.y - lock.length * 0.72, lock.z),
    new THREE.Vector3(lock.x + lock.curve * 0.52, lock.y - lock.length, lock.z - 0.08)
  ];
}

function addGeneratedBangPreset() {
  const color = getSelectedLock()?.color || "#2c223a";
  const strands = [
    {
      name: "Generated center bang",
      root: new THREE.Vector3(-0.05, 1.66, 0.86),
      offsets: [
        [0, 0, 0],
        [-0.04, -0.26, 0.09],
        [-0.08, -0.66, 0.17],
        [-0.02, -1.03, 0.15],
        [0.1, -1.32, 0.03]
      ],
      width: 0.19,
      twist: -0.12,
      scales: [0.45, 1.08, 1.0, 0.72, 0.2]
    },
    {
      name: "Generated left bang",
      root: new THREE.Vector3(-0.34, 1.58, 0.8),
      offsets: [
        [0, 0, 0],
        [-0.1, -0.25, 0.07],
        [-0.28, -0.59, 0.12],
        [-0.42, -0.9, 0.05],
        [-0.54, -1.1, -0.07]
      ],
      width: 0.17,
      twist: 0.18,
      scales: [0.44, 1.0, 0.9, 0.62, 0.18]
    },
    {
      name: "Generated right bang",
      root: new THREE.Vector3(0.25, 1.6, 0.82),
      offsets: [
        [0, 0, 0],
        [0.08, -0.22, 0.07],
        [0.25, -0.55, 0.12],
        [0.34, -0.88, 0.04],
        [0.38, -1.08, -0.08]
      ],
      width: 0.16,
      twist: -0.24,
      scales: [0.42, 0.96, 0.84, 0.58, 0.18]
    },
    {
      name: "Generated crown lock",
      root: new THREE.Vector3(0.06, 1.83, 0.52),
      offsets: [
        [0, 0, 0],
        [0.03, -0.2, 0.12],
        [0.14, -0.48, 0.2],
        [0.24, -0.78, 0.16],
        [0.3, -1, 0.02]
      ],
      width: 0.15,
      twist: 0.28,
      scales: [0.4, 0.92, 0.86, 0.58, 0.16]
    }
  ];

  const created = strands.map((strand) => {
    const points = strand.offsets.map(([x, y, z]) => pushPointOutsideHead(strand.root.clone().add(new THREE.Vector3(x, y, z)), new THREE.Vector3(0, 0, 1), 0.045));
    const lock = addLock("front", {
      x: points[0].x,
      y: points[0].y,
      z: points[0].z,
      length: points[0].distanceTo(points.at(-1)),
      curve: points.at(-1).x - points[0].x,
      width: strand.width,
      taper: 0.64,
      twist: strand.twist,
      color,
      scalpRegion: "bangs",
      points,
      pointScales: strand.scales.map((scale, index) => {
        const t = index / Math.max(1, strand.scales.length - 1);
        return { x: scale, z: scale * THREE.MathUtils.lerp(0.84, 0.68, t) };
      }),
      pointWidths: strand.scales,
      pointTwists: strand.scales.map((_, index) => strand.twist * (index / Math.max(1, strand.scales.length - 1)))
    });
    updateLockGeometry(lock);
    return lock;
  });

  const last = created.at(-1);
  if (last) {
    selectLock(last.id);
    selectCurvePoint(last.id, 1);
  }
}

function sampleScalpQuad(face, columnRatio, rowRatio) {
  const candidates = scalpVisibleQuads.filter((quad) => quad.face === face);
  if (!candidates.length) return null;
  const targetColumn = THREE.MathUtils.clamp(columnRatio, 0, 1) * (SCALP_SEGMENTS - 1);
  const targetRow = THREE.MathUtils.clamp(rowRatio, 0, 1) * (SCALP_SEGMENTS - 1);
  const quad = candidates.reduce((best, candidate) => {
    const distance = Math.hypot(candidate.column - targetColumn, candidate.row - targetRow);
    return !best || distance < best.distance ? { quad: candidate, distance } : best;
  }, null).quad;

  scalpSurfaceGroup.updateMatrixWorld(true);
  const position = scalpSurfaceGeometry.getAttribute("position");
  const corners = quad.vertices.map((index) => new THREE.Vector3().fromBufferAttribute(position, index));
  const localPoint = corners.reduce((sum, corner) => sum.add(corner), new THREE.Vector3()).multiplyScalar(0.25);
  const localNormal = corners[1].clone().sub(corners[0]).cross(corners[2].clone().sub(corners[0])).normalize();
  if (localNormal.dot(localPoint) < 0) localNormal.negate();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(scalpSurfaceGroup.matrixWorld);
  return {
    point: scalpSurfaceGroup.localToWorld(localPoint),
    normal: localNormal.applyMatrix3(normalMatrix).normalize(),
    region: scalpRegionAssignments[quad.id] || "unassigned"
  };
}

function createLongLayeredCurlPoints(sample, {
  length = 3.2,
  shell = 0.32,
  lateral = 0,
  wave = 0,
  tipOut = 0,
  tipCurl = 0,
  tipLift = 0,
  startAngle = 0,
  flowX = null,
  flowZ = null,
  layerOffset = 0,
  surfaceClearance = 0.12,
  rootScalpOffset = 0.12,
  fallPower = 1,
  count = 10
} = {}) {
  const root = sample.point.clone().addScaledVector(sample.normal, rootScalpOffsetDistance(rootScalpOffset));
  const surfaceCenter = scalpSurfaceGroup.getWorldPosition(new THREE.Vector3());
  const naturalOutward = root.clone().sub(surfaceCenter).setY(0);
  if (naturalOutward.lengthSq() < 0.001) naturalOutward.copy(sample.normal).setY(0);
  if (naturalOutward.lengthSq() < 0.001) naturalOutward.set(0, 0, 1);
  naturalOutward.normalize();
  const outward = naturalOutward.clone();
  if (Number.isFinite(flowX) && Number.isFinite(flowZ)) outward.set(flowX, 0, flowZ).normalize();
  outward.applyAxisAngle(new THREE.Vector3(0, 1, 0), startAngle);
  const across = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), outward).normalize();
  const down = new THREE.Vector3(0, -1, 0);
  const points = [];

  for (let index = 0; index < count; index += 1) {
    const t = index / Math.max(1, count - 1);
    const bodyT = Math.sin(Math.PI * Math.min(1, t * 0.92));
    const tipT = THREE.MathUtils.smoothstep(t, 0.68, 1);
    const flowT = THREE.MathUtils.smoothstep(t, 0.12, 0.56);
    const shellDirection = naturalOutward.clone().lerp(outward, flowT).normalize();
    const layerT = THREE.MathUtils.smoothstep(t, 0.02, 0.2) * (1 - THREE.MathUtils.smoothstep(t, 0.72, 1));
    const point = root.clone()
      .addScaledVector(down, length * Math.pow(t, fallPower))
      .addScaledVector(shellDirection, shell * bodyT + tipOut * tipT * tipT)
      .addScaledVector(sample.normal, layerOffset * layerT)
      .addScaledVector(across, lateral * t + wave * Math.sin(Math.PI * t) + tipCurl * tipT * tipT)
      .addScaledVector(new THREE.Vector3(0, 1, 0), tipLift * tipT * tipT);
    const clearance = surfaceClearance + (1 - Math.min(1, t / 0.62)) * 0.055;
    points.push(index === 0 ? point : pushPointOutsideHead(point, sample.normal, clearance));
  }
  return points;
}

function addLongLayeredCurlsPreset() {
  const columns = (count, inset = 0.06) => Array.from(
    { length: count },
    (_, index) => THREE.MathUtils.lerp(inset, 1 - inset, count <= 1 ? 0.5 : index / (count - 1))
  );
  const layer = (face, row, count, defaults, customize = () => ({})) => columns(count).map((column, index) => ({
    face,
    row,
    column,
    ...defaults,
    ...customize(column, index)
  }));

  const definitions = [
    // Deep back layers establish the long, continuous silhouette.
    ...layer("back", 0.82, 9, { length: 4.18, shell: 0.58, width: 0.22, widthScale: 1.08, depthScale: 0.72, region: "back", rootScalpOffset: 0.5, layerOffset: 0 }, (column, index) => ({
      lateral: (column - 0.5) * 0.18,
      wave: Math.sin((index + 1) * 1.8) * 0.09,
      tipCurl: Math.sin((index + 1) * 2.7) * 0.12,
      tipOut: index % 3 === 0 ? 0.34 : 0.1,
      tipLift: index % 3 === 0 ? 0.42 : 0.05
    })),
    ...layer("back", 0.57, 8, { length: 3.82, shell: 0.68, width: 0.3, widthScale: 1.12, depthScale: 0.94, region: "back", rootScalpOffset: 0.72, layerOffset: 0.025 }, (column, index) => ({
      lateral: (column - 0.5) * 0.24,
      wave: Math.sin((index + 2) * 2.2) * 0.12,
      tipCurl: Math.sin((index + 1) * 1.5) * 0.18,
      tipOut: index === 1 || index === 6 ? 0.48 : 0.14,
      tipLift: index === 1 || index === 6 ? 0.52 : 0.08
    })),
    // The front crown flows away from the part toward the face. Broad, close-set
    // roots overlap into a continuous cap before the locks separate lower down.
    ...layer("top", 0.16, 8, { shell: 0.46, width: 0.3, widthScale: 1.16, depthScale: 0.76, rootScalpOffset: 0.58, layerOffset: 0.04, surfaceClearance: 0.17 }, (column, index) => ({
      length: 2.28 + Math.abs(column - 0.5) * 1.48 + (index % 2) * 0.08,
      flowX: (column - 0.5) * 0.9,
      flowZ: 0.96,
      lateral: (column - 0.5) * 0.34,
      wave: Math.sin((index + 1) * 2.4) * 0.055,
      tipCurl: (column - 0.5) * 0.22 + Math.sin((index + 1) * 3.1) * 0.06,
      tipOut: index === 0 || index === 7 ? 0.28 : 0.12,
      tipLift: index === 0 || index === 7 ? 0.22 : 0.02,
      fallPower: 1.05
    })),
    ...layer("top", 0.5, 7, { length: 3.72, shell: 0.6, width: 0.31, widthScale: 1.12, depthScale: 0.9, rootScalpOffset: 0.68, layerOffset: 0.055 }, (column, index) => ({
      flowX: (column - 0.5) * 1.05,
      flowZ: -0.82,
      lateral: (column - 0.5) * 0.26,
      wave: Math.sin((index + 3) * 1.7) * 0.12,
      tipCurl: Math.sin((index + 2) * 2.5) * 0.2,
      tipOut: index % 3 === 0 ? 0.42 : 0.14,
      tipLift: index % 3 === 0 ? 0.48 : 0.06
    })),
    ...layer("top", 0.78, 6, { length: 3.42, shell: 0.54, width: 0.3, widthScale: 1.08, depthScale: 0.78, rootScalpOffset: 0.78, layerOffset: 0.075 }, (column, index) => ({
      flowX: (column - 0.5) * 0.92,
      flowZ: -0.86,
      lateral: (column - 0.5) * 0.34,
      wave: Math.sin((index + 1) * 2.8) * 0.1,
      tipCurl: Math.sin((index + 1) * 1.9) * 0.22,
      tipOut: index === 1 || index === 4 ? 0.44 : 0.12,
      tipLift: index === 1 || index === 4 ? 0.5 : 0.05
    })),
    // A front-flowing crown pass closes the scalp and overlaps into the fringe.
    ...layer("top", 0.08, 6, { shell: 0.38, width: 0.32, region: "bangs", rootScalpOffset: 0.72, layerOffset: 0.07, surfaceClearance: 0.17, fallPower: 1.08 }, (column, index) => ({
      length: 1.2 + Math.abs(column - 0.5) * 0.74 + (index % 2) * 0.08,
      widthScale: 1.06 + (index % 3) * 0.1,
      depthScale: 0.62 + (index % 2) * 0.16,
      flowX: (column - 0.5) * 0.68,
      flowZ: 0.94,
      lateral: (column - 0.5) * 0.76,
      wave: Math.sin((index + 1) * 1.7) * 0.045,
      tipCurl: (column - 0.5) * 0.18,
      tipOut: 0.14,
      tipLift: 0.02
    })),
    // Long side framing locks, with only a few conspicuous turned-up tips.
    ...layer("left", 0.68, 4, { length: 3.62, shell: 0.64, width: 0.23, widthScale: 0.9, depthScale: 0.7, region: "side-left", rootScalpOffset: 0.86 }, (column, index) => ({
      lateral: 0.08 + index * 0.04,
      wave: 0.1 - index * 0.035,
      tipCurl: 0.18 + index * 0.08,
      tipOut: index === 1 ? 0.4 : 0.16,
      tipLift: index === 1 ? 0.46 : 0.12
    })),
    ...layer("right", 0.68, 4, { length: 3.62, shell: 0.64, width: 0.23, widthScale: 0.9, depthScale: 0.7, region: "side-right", rootScalpOffset: 0.86 }, (column, index) => ({
      lateral: -0.08 - index * 0.04,
      wave: -0.1 + index * 0.035,
      tipCurl: -0.18 - index * 0.08,
      tipOut: index === 1 ? 0.4 : 0.16,
      tipLift: index === 1 ? 0.46 : 0.12
    })),
    ...layer("left", 0.42, 3, { length: 2.72, shell: 0.74, width: 0.16, widthScale: 0.78, depthScale: 1.08, region: "side-left", rootScalpOffset: 1 }, (_, index) => ({
      lateral: 0.14,
      wave: 0.12,
      tipCurl: 0.42 + index * 0.13,
      tipOut: 0.78,
      tipLift: 1.04
    })),
    ...layer("right", 0.42, 3, { length: 2.72, shell: 0.74, width: 0.16, widthScale: 0.78, depthScale: 1.08, region: "side-right", rootScalpOffset: 1 }, (_, index) => ({
      lateral: -0.14,
      wave: -0.12,
      tipCurl: -0.42 - index * 0.13,
      tipOut: 0.78,
      tipLift: 1.04
    })),
    // Temple-rooted locks stay in front of the cheeks and form the visible face frame.
    ...[0.06, 0.14, 0.22].map((column, index) => ({
      face: "front", row: 0.58 + index * 0.08, column,
      length: 1.82 + index * 0.3, shell: 0.3 + index * 0.035,
      width: 0.14 + index * 0.045, widthScale: 0.82 + index * 0.12,
      depthScale: 0.52 + index * 0.16, region: "side-bangs-left",
      rootScalpOffset: 1, layerOffset: 0.07 + index * 0.02, surfaceClearance: 0.15,
      flowX: -0.3, flowZ: 0.96, lateral: -0.06 - index * 0.035,
      wave: -0.025 - index * 0.015, tipCurl: -0.1 - index * 0.045,
      tipOut: 0.12 + index * 0.04, tipLift: index === 0 ? 0.12 : 0.02,
      fallPower: 1.04
    })),
    ...[0.94, 0.86, 0.78].map((column, index) => ({
      face: "front", row: 0.58 + index * 0.08, column,
      length: 1.82 + index * 0.3, shell: 0.3 + index * 0.035,
      width: 0.14 + index * 0.045, widthScale: 0.82 + index * 0.12,
      depthScale: 0.52 + index * 0.16, region: "side-bangs-right",
      rootScalpOffset: 1, layerOffset: 0.07 + index * 0.02, surfaceClearance: 0.15,
      flowX: 0.3, flowZ: 0.96, lateral: 0.06 + index * 0.035,
      wave: 0.025 + index * 0.015, tipCurl: 0.1 + index * 0.045,
      tipOut: 0.12 + index * 0.04, tipLift: index === 0 ? 0.12 : 0.02,
      fallPower: 1.04
    })),
    // Irregular pointed fringe.
    ...layer("front", 0.7, 7, { shell: 0.42, width: 0.17, depthScale: 0.58, region: "bangs", rootScalpOffset: 0.92, fallPower: 1.08 }, (column, index) => ({
      length: 0.88 + Math.abs(column - 0.5) * 0.82 + (index % 2) * 0.08,
      widthScale: 0.76 + (index % 3) * 0.16,
      lateral: (column - 0.5) * 0.98,
      wave: Math.sin((index + 1) * 1.9) * 0.08,
      tipCurl: (column - 0.5) * 0.2,
      tipOut: 0.16,
      tipLift: 0
    })),
    // Swept upper fringe pieces crossing the forehead.
    ...layer("front", 0.9, 3, { length: 0.94, shell: 0.5, width: 0.15, depthScale: 0.52, region: "bangs", rootScalpOffset: 1, fallPower: 1.12 }, (column, index) => ({
      widthScale: 0.82 + index * 0.12,
      lateral: 0.46 + index * 0.14,
      wave: 0.22,
      tipCurl: 0.12,
      tipOut: 0.12,
      tipLift: 0.02,
      startAngle: -0.08 + index * 0.04
    })),
    {
      face: "front", row: 0.94, column: 0.47, length: 1.12, shell: 0.5,
      width: 0.25, widthScale: 1.12, depthScale: 0.56, region: "bangs",
      rootScalpOffset: 1, fallPower: 1.1, lateral: -0.34, wave: -0.16,
      tipCurl: -0.12, tipOut: 0.16, tipLift: 0.02, startAngle: 0.04
    },
    {
      face: "front", row: 0.94, column: 0.53, length: 1.04, shell: 0.52,
      width: 0.24, widthScale: 1.08, depthScale: 0.54, region: "bangs",
      rootScalpOffset: 1, fallPower: 1.1, lateral: 0.36, wave: 0.17,
      tipCurl: 0.13, tipOut: 0.16, tipLift: 0.02, startAngle: -0.04
    }
  ];

  const created = definitions.map((definition, index) => {
    const sample = sampleScalpQuad(definition.face, definition.column, definition.row);
    if (!sample) return null;
    const variation = Math.sin((index + 1) * 2.39996);
    const options = {
      ...definition,
      length: definition.length * (1 + variation * 0.025),
      startAngle: (definition.startAngle || 0) + variation * 0.045
    };
    const points = createLongLayeredCurlPoints(sample, options);
    const scalpRegion = definition.region || sample.region;
    const lock = addLock("front", {
      x: points[0].x,
      y: points[0].y,
      z: points[0].z,
      length: points[0].distanceTo(points.at(-1)),
      curve: points.at(-1).x - points[0].x,
      width: definition.width,
      widthScale: definition.widthScale ?? 1,
      depthScale: definition.depthScale ?? (definition.region === "bangs" ? 0.68 : 0.88),
      taperCurve: definition.region === "bangs" ? [
        { position: 0, value: 0.68, interpolation: "smooth" },
        { position: 0.14, value: 0.96, interpolation: "smooth" },
        { position: 0.62, value: 0.88, interpolation: "smooth" },
        { position: 1, value: 0, interpolation: "smooth" }
      ] : [
        { position: 0, value: 0.74, interpolation: "smooth" },
        { position: 0.12, value: 1, interpolation: "smooth" },
        { position: 0.58, value: 1, interpolation: "smooth" },
        { position: 0.84, value: 0.7, interpolation: "smooth" },
        { position: 1, value: 0, interpolation: "smooth" }
      ],
      depthCurve: [
        { position: 0, value: 0.34, interpolation: "smooth" },
        { position: 0.2, value: 0.78, interpolation: "smooth" },
        { position: 0.66, value: 0.62, interpolation: "smooth" },
        { position: 1, value: 0, interpolation: "smooth" }
      ],
      twist: variation * 0.08,
      color: DEFAULT_HAIR_COLOR,
      scalpRegion,
      rootScalpOffset: definition.rootScalpOffset ?? 0.12,
      rootSurfacePoint: sample.point,
      rootSurfaceNormal: sample.normal,
      points
    }, { deferUi: true });
    lock.pointTwists = lock.points.map((_, pointIndex) => variation * 0.08 * (pointIndex / Math.max(1, lock.points.length - 1)));
    updateLockGeometry(lock);
    return lock;
  }).filter(Boolean);

  const last = created.at(-1);
  if (last) {
    selectLock(last.id);
    selectCurvePoint(last.id, 0);
    renderLockList();
    updateCount();
  }
}

function createBraidedBobShellPoints(sample, {
  length = 1.55,
  shell = 0.34,
  flowX = null,
  flowZ = null,
  sweep = 0,
  tipOut = 0.05,
  tipLift = 0,
  rootScalpOffset = 0.2,
  surfaceClearance = 0.1,
  count = 8
} = {}) {
  const root = sample.point.clone().addScaledVector(sample.normal, rootScalpOffsetDistance(rootScalpOffset));
  const surfaceCenter = scalpSurfaceGroup.getWorldPosition(new THREE.Vector3());
  const naturalOutward = root.clone().sub(surfaceCenter).setY(0);
  if (naturalOutward.lengthSq() < 0.001) naturalOutward.copy(sample.normal).setY(0);
  if (naturalOutward.lengthSq() < 0.001) naturalOutward.set(0, 0, 1);
  naturalOutward.normalize();
  const flow = naturalOutward.clone();
  if (Number.isFinite(flowX) && Number.isFinite(flowZ)) flow.set(flowX, 0, flowZ).normalize();
  const across = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), flow).normalize();
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / Math.max(1, count - 1);
    const settle = THREE.MathUtils.smoothstep(t, 0.05, 0.42);
    const tipT = THREE.MathUtils.smoothstep(t, 0.72, 1);
    const point = root.clone()
      .addScaledVector(new THREE.Vector3(0, -1, 0), length * Math.pow(t, 1.08))
      .addScaledVector(flow, shell * Math.sin(t * Math.PI * 0.5) + tipOut * tipT * tipT)
      .addScaledVector(across, sweep * Math.sin(Math.PI * t) * settle)
      .addScaledVector(new THREE.Vector3(0, 1, 0), tipLift * tipT * tipT);
    points.push(index === 0 ? point : pushPointOutsideHead(point, sample.normal, surfaceClearance + 0.025 * (1 - t)));
  }
  return points;
}

function addBraidedBobPreset() {
  const evenColumns = (count, inset = 0.06) => Array.from(
    { length: count },
    (_, index) => THREE.MathUtils.lerp(inset, 1 - inset, count <= 1 ? 0.5 : index / (count - 1))
  );
  const layer = (face, row, count, defaults, customize = () => ({})) => evenColumns(count).map((column, index) => ({
    face,
    row,
    column,
    ...defaults,
    ...customize(column, index)
  }));
  const shellDefinitions = [
    ...layer("back", 0.76, 12, { length: 1.66, shell: 0.29, width: 0.25, widthScale: 1.08, depthScale: 0.56, region: "back", hairLayer: "bottom", rootScalpOffset: 0.22 }, (column, index) => ({
      sweep: (column - 0.5) * 0.12,
      tipOut: 0.04 + (index % 2) * 0.03
    })),
    ...layer("top", 0.82, 11, { length: 1.62, shell: 0.25, width: 0.26, widthScale: 1.06, depthScale: 0.52, region: "back", hairLayer: "mid", rootScalpOffset: 0.32, flowZ: -1 }, (column, index) => ({
      flowX: (column - 0.5) * 0.7,
      sweep: Math.sin((index + 1) * 1.7) * 0.055
    })),
    ...layer("top", 0.5, 11, { length: 1.54, shell: 0.24, width: 0.25, widthScale: 1.06, depthScale: 0.5, region: "back", hairLayer: "top", rootScalpOffset: 0.4 }, (column, index) => ({
      flowX: (column - 0.5) * 1.35,
      flowZ: -0.32,
      sweep: Math.sin((index + 2) * 1.9) * 0.05,
      tipOut: 0.06
    })),
    ...layer("top", 0.2, 7, { length: 1.1, shell: 0.21, width: 0.24, widthScale: 1.05, depthScale: 0.48, region: "back", hairLayer: "top", rootScalpOffset: 0.42, flowZ: 0.68 }, (column, index) => ({
      flowX: (column - 0.5) * 1.1,
      sweep: Math.sin((index + 3) * 1.65) * 0.045,
      tipOut: 0.045
    })),
    ...layer("left", 0.62, 5, { length: 1.5, shell: 0.3, width: 0.23, widthScale: 1.06, depthScale: 0.56, region: "side-left", hairLayer: "mid", rootScalpOffset: 0.36, flowX: -1, flowZ: -0.42 }, (_, index) => ({
      sweep: 0.03 + index * 0.025,
      tipOut: 0.08
    })),
    ...layer("right", 0.62, 5, { length: 1.5, shell: 0.3, width: 0.23, widthScale: 1.06, depthScale: 0.56, region: "side-right", hairLayer: "mid", rootScalpOffset: 0.36, flowX: 1, flowZ: -0.42 }, (_, index) => ({
      sweep: -0.03 - index * 0.025,
      tipOut: 0.08
    })),
    ...layer("left", 0.84, 4, { length: 1.36, shell: 0.34, width: 0.22, widthScale: 1.04, depthScale: 0.56, region: "side-left", hairLayer: "top", rootScalpOffset: 0.44, flowX: -0.92, flowZ: -0.74 }, (_, index) => ({
      sweep: 0.08 + index * 0.02,
      tipOut: 0.12
    })),
    ...layer("right", 0.84, 4, { length: 1.36, shell: 0.34, width: 0.22, widthScale: 1.04, depthScale: 0.56, region: "side-right", hairLayer: "top", rootScalpOffset: 0.44, flowX: 0.92, flowZ: -0.74 }, (_, index) => ({
      sweep: -0.08 - index * 0.02,
      tipOut: 0.12
    })),
    { face: "top", row: 0.52, column: 0.48, length: 1.12, shell: 0.2, width: 0.4, widthScale: 1.1, depthScale: 0.48, region: "back", hairLayer: "top", rootScalpOffset: 0.44, flowX: -1, flowZ: 0.08, sweep: 0.025, tipOut: 0.03 },
    { face: "top", row: 0.52, column: 0.52, length: 1.12, shell: 0.2, width: 0.4, widthScale: 1.1, depthScale: 0.48, region: "back", hairLayer: "top", rootScalpOffset: 0.44, flowX: 1, flowZ: 0.08, sweep: -0.025, tipOut: 0.03 },
    { face: "top", row: 0.48, column: 0.5, length: 0.45, shell: 0.78, width: 0.46, widthScale: 1.12, depthScale: 0.62, region: "back", hairLayer: "top", rootScalpOffset: 0.46, flowX: 0, flowZ: 1, sweep: 0, tipOut: 0.025 }
  ];
  const capTaper = [
    { position: 0, value: 1.2, interpolation: "smooth" },
    { position: 0.12, value: 1.12, interpolation: "smooth" },
    { position: 0.72, value: 0.96, interpolation: "smooth" },
    { position: 0.9, value: 0.62, interpolation: "smooth" },
    { position: 1, value: 0, interpolation: "smooth" }
  ];
  const capDepth = [
    { position: 0, value: 1, interpolation: "smooth" },
    { position: 0.16, value: 0.9, interpolation: "smooth" },
    { position: 0.76, value: 0.66, interpolation: "smooth" },
    { position: 1, value: 0, interpolation: "smooth" }
  ];
  const fringeTaper = [
    { position: 0, value: 0.94, interpolation: "smooth" },
    { position: 0.14, value: 1.04, interpolation: "smooth" },
    { position: 0.78, value: 1, interpolation: "smooth" },
    { position: 0.93, value: 0.82, interpolation: "smooth" },
    { position: 1, value: 0.12, interpolation: "smooth" }
  ];
  const fringeDepth = [
    { position: 0, value: 0.38, interpolation: "smooth" },
    { position: 0.18, value: 0.48, interpolation: "smooth" },
    { position: 0.82, value: 0.42, interpolation: "smooth" },
    { position: 1, value: 0.1, interpolation: "smooth" }
  ];
  const flatFringeProfile = SHAPE_PRESETS.sweepProfile.find((preset) => preset.id === "flat-ribbon").value;
  const created = shellDefinitions.map((definition, index) => {
    const sample = sampleScalpQuad(definition.face, definition.column, definition.row);
    if (!sample) return null;
    const variation = Math.sin((index + 1) * 2.39996);
    const points = createBraidedBobShellPoints(sample, {
      ...definition,
      length: definition.length * (1 + variation * 0.018),
      sweep: (definition.sweep || 0) + variation * 0.025
    });
    const lock = addLock("front", {
      x: points[0].x,
      y: points[0].y,
      z: points[0].z,
      length: points[0].distanceTo(points.at(-1)),
      curve: points.at(-1).x - points[0].x,
      width: definition.width,
      widthScale: definition.widthScale,
      depthScale: definition.region === "bangs" ? 0.34 : definition.depthScale,
      taperCurve: cloneShapePresetValue(definition.region === "bangs" ? fringeTaper : capTaper),
      depthCurve: cloneShapePresetValue(definition.region === "bangs" ? fringeDepth : capDepth),
      sweepProfile: cloneShapePresetValue(definition.region === "bangs" ? flatFringeProfile : DEFAULT_SWEEP_PROFILE),
      twist: variation * 0.035,
      color: DEFAULT_HAIR_COLOR,
      scalpRegion: definition.region || sample.region,
      hairLayer: definition.hairLayer,
      rootScalpOffset: definition.rootScalpOffset,
      rootSurfacePoint: sample.point,
      rootSurfaceNormal: sample.normal,
      points
    }, { deferUi: true });
    updateLockGeometry(lock);
    return lock;
  }).filter(Boolean);

  const fringeDefinitions = [
    { name: "Braided Bob Center Fringe", region: "bangs", width: 0.31, points: [[-0.03, 1.68, 0.82], [-0.08, 1.36, 0.99], [-0.08, 0.92, 1.08], [-0.02, 0.48, 1.08], [0.08, 0.16, 1.01]] },
    { name: "Braided Bob Fringe Left", region: "bangs", width: 0.29, points: [[-0.2, 1.65, 0.82], [-0.3, 1.34, 0.98], [-0.39, 0.94, 1.06], [-0.4, 0.5, 1.05], [-0.31, 0.18, 0.98]] },
    { name: "Braided Bob Fringe Right", region: "bangs", width: 0.29, points: [[0.19, 1.65, 0.82], [0.29, 1.35, 0.98], [0.37, 0.95, 1.06], [0.38, 0.52, 1.05], [0.29, 0.2, 0.98]] },
    { name: "Braided Bob Outer Fringe Left", region: "side-bangs-left", width: 0.19, points: [[-0.45, 1.5, 0.8], [-0.58, 1.18, 0.94], [-0.66, 0.72, 1.01], [-0.68, 0.28, 0.99], [-0.62, -0.1, 0.89]] },
    { name: "Braided Bob Outer Fringe Right", region: "side-bangs-right", width: 0.19, points: [[0.45, 1.5, 0.8], [0.58, 1.18, 0.94], [0.66, 0.72, 1.01], [0.68, 0.28, 0.99], [0.62, -0.1, 0.89]] },
    { name: "Braided Bob Temple Left", region: "side-bangs-left", width: 0.085, points: [[-0.66, 1.24, 0.72], [-0.76, 0.82, 0.91], [-0.8, 0.34, 0.96], [-0.78, -0.16, 0.91], [-0.69, -0.58, 0.76]] },
    { name: "Braided Bob Temple Right", region: "side-bangs-right", width: 0.085, points: [[0.66, 1.24, 0.72], [0.76, 0.82, 0.91], [0.8, 0.34, 0.96], [0.78, -0.16, 0.91], [0.69, -0.58, 0.76]] }
  ];
  fringeDefinitions.forEach((definition) => {
    const normal = new THREE.Vector3(0, 0, 1);
    const points = definition.points.map(([x, y, z]) => pushPointOutsideHead(new THREE.Vector3(x, y, z), normal, 0.08));
    const lock = addLock("front", {
      name: definition.name,
      x: points[0].x,
      y: points[0].y,
      z: points[0].z,
      length: points[0].distanceTo(points.at(-1)),
      curve: points.at(-1).x - points[0].x,
      width: definition.width,
      widthScale: 1,
      depthScale: 0.34,
      taperCurve: cloneShapePresetValue(fringeTaper),
      depthCurve: cloneShapePresetValue(fringeDepth),
      sweepProfile: cloneShapePresetValue(flatFringeProfile),
      color: DEFAULT_HAIR_COLOR,
      scalpRegion: definition.region,
      hairLayer: definition.width < 0.12 ? "accent" : "top",
      rootScalpOffset: 0.35,
      points
    }, { deferUi: true });
    lock.name = definition.name;
    updateLockGeometry(lock);
    created.push(lock);
  });

  const braidWidthCurve = [
    { position: 0, value: 0.86, interpolation: "smooth" },
    { position: 0.1, value: 1, interpolation: "smooth" },
    { position: 0.36, value: 0.8, interpolation: "smooth" },
    { position: 0.62, value: 0.58, interpolation: "smooth" },
    { position: 0.84, value: 0.36, interpolation: "smooth" },
    { position: 1, value: 0.08, interpolation: "smooth" }
  ];
  const braidDepthCurve = [
    { position: 0, value: 0.8, interpolation: "smooth" },
    { position: 0.12, value: 1, interpolation: "smooth" },
    { position: 0.4, value: 0.76, interpolation: "smooth" },
    { position: 0.68, value: 0.5, interpolation: "smooth" },
    { position: 1, value: 0.08, interpolation: "smooth" }
  ];
  [-1, 1].forEach((side) => {
    const points = [
      [0.78 * side, -0.52, -0.2],
      [0.84 * side, -0.76, -0.18],
      [0.88 * side, -1.06, -0.17],
      [0.88 * side, -1.38, -0.2],
      [0.86 * side, -1.7, -0.24],
      [0.82 * side, -2.02, -0.28],
      [0.78 * side, -2.32, -0.31],
      [0.74 * side, -2.6, -0.34],
      [0.7 * side, -2.86, -0.37]
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const region = side < 0 ? "side-left" : "side-right";
    const lock = addLock("front", {
      name: side < 0 ? "Braided Bob Left Braid" : "Braided Bob Right Braid",
      geometryType: "braid",
      x: points[0].x,
      y: points[0].y,
      z: points[0].z,
      length: new THREE.CatmullRomCurve3(points).getLength(),
      curve: points.at(-1).x - points[0].x,
      width: 0.9,
      braidWidth: 0.9,
      braidDepth: 0.56,
      braidSegmentLength: 0.48,
      braidRotation: side < 0 ? -90 : 90,
      taperCurve: cloneShapePresetValue(braidWidthCurve),
      depthCurve: cloneShapePresetValue(braidDepthCurve),
      sweepProfile: cloneShapePresetValue(braidCreationDefaults.sweepProfile),
      profileOffset: braidCreationDefaults.profileOffset,
      widthScale: 1,
      depthScale: 1,
      twist: 0,
      color: DEFAULT_HAIR_COLOR,
      scalpRegion: region,
      hairLayer: "accent",
      rootScalpOffset: 0.12,
      points
    }, { deferUi: true });
    lock.name = side < 0 ? "Braided Bob Left Braid" : "Braided Bob Right Braid";
    updateLockGeometry(lock);
    created.push(lock);
  });

  const last = created.at(-1);
  if (last) {
    selectLock(last.id);
    selectCurvePoint(last.id, 0);
    renderLockList();
    updateCount();
  }
}

function createBowlCutPoints(sample, {
  length,
  spread,
  curl = 0,
  startAngle = 0,
  tipCurl = 0,
  tipOut = 0,
  tipLift = 0,
  layerOffset = 0,
  rootScalpOffset = 0,
  fallPower = 1.1,
  count = 6
}) {
  const root = sample.point.clone().addScaledVector(sample.normal, rootScalpOffsetDistance(rootScalpOffset));
  const surfaceCenter = scalpSurfaceGroup.getWorldPosition(new THREE.Vector3());
  const outward = root.clone().sub(surfaceCenter).setY(0);
  if (outward.lengthSq() < 0.001) outward.copy(sample.normal).setY(0);
  if (outward.lengthSq() < 0.001) outward.set(0, 0, 1);
  outward.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), startAngle);
  const around = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), outward).normalize();
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / Math.max(1, count - 1);
    const tipT = THREE.MathUtils.smoothstep(t, 0.62, 1);
    const layerT = THREE.MathUtils.smoothstep(t, 0.02, 0.32);
    const point = root.clone()
      .addScaledVector(outward, layerOffset * layerT)
      .addScaledVector(outward, spread * Math.sin(t * Math.PI * 0.5))
      .addScaledVector(around, curl * Math.sin(t * Math.PI))
      .addScaledVector(around, tipCurl * t * t)
      .addScaledVector(outward, tipOut * tipT * tipT)
      .addScaledVector(new THREE.Vector3(0, 1, 0), tipLift * tipT * tipT)
      .addScaledVector(new THREE.Vector3(0, -1, 0), length * Math.pow(t, fallPower));
    points.push(index === 0 ? point : pushPointOutsideHead(point, sample.normal, 0.05 + t * 0.04));
  }
  return points;
}

function addBowlCutPreset() {
  const evenColumns = (count, inset = 0.05) => Array.from(
    { length: count },
    (_, index) => THREE.MathUtils.lerp(inset, 1 - inset, count <= 1 ? 0.5 : index / (count - 1))
  );
  const layer = (face, row, columns, defaults, customize = () => ({})) => columns.map((column, index) => ({
    face,
    column,
    row,
    ...defaults,
    ...customize(column, index)
  }));
  const roots = [
    ...layer("top", 0.08, evenColumns(6, 0.07), { length: 1.34, spread: 0.58, width: 0.23, layerOffset: 0.16, fallPower: 1.5, tipOut: 0.11, tipLift: 0.08 }, (column) => ({ curl: (column - 0.5) * 0.12 })),
    ...layer("top", 0.42, evenColumns(7, 0.05), { length: 1.48, spread: 0.62, width: 0.24, layerOffset: 0.14, fallPower: 1.48, tipOut: 0.13, tipLift: 0.1 }, (column) => ({ curl: (column - 0.5) * 0.1 })),
    ...layer("top", 0.78, evenColumns(6, 0.07), { length: 1.56, spread: 0.6, width: 0.24, layerOffset: 0.12, fallPower: 1.42, tipOut: 0.15, tipLift: 0.12 }, (column) => ({ curl: (0.5 - column) * 0.08 })),
    ...layer("front", 0.78, evenColumns(6, 0.04), { length: 1.08, spread: 0.18, width: 0.22, layerOffset: 0.08, fallPower: 1.08, tipOut: 0.12, tipLift: 0.1 }, (column) => ({ curl: Math.sign(column - 0.5) * (0.06 + Math.abs(column - 0.5) * 0.12) })),
    ...layer("front", 0.58, evenColumns(6, 0.08), { length: 1.02, spread: 0.16, width: 0.21, layerOffset: 0.025, fallPower: 1.04, tipOut: 0.14, tipLift: 0.12 }, (column) => ({ curl: Math.sign(column - 0.5) * (0.08 + Math.abs(column - 0.5) * 0.1) })),
    ...layer("right", 0.78, evenColumns(4, 0.07), { length: 1.24, spread: 0.2, width: 0.23, layerOffset: 0.08, fallPower: 1.12, tipOut: 0.15, tipLift: 0.13 }, (column) => ({ curl: (column - 0.5) * 0.12 })),
    ...layer("right", 0.54, evenColumns(4, 0.1), { length: 1.14, spread: 0.18, width: 0.21, layerOffset: 0.025, fallPower: 1.05, tipOut: 0.16, tipLift: 0.14 }, (column) => ({ curl: (column - 0.5) * 0.14 })),
    ...layer("left", 0.78, evenColumns(4, 0.07), { length: 1.24, spread: 0.2, width: 0.23, layerOffset: 0.08, fallPower: 1.12, tipOut: 0.15, tipLift: 0.13 }, (column) => ({ curl: (0.5 - column) * 0.12 })),
    ...layer("left", 0.54, evenColumns(4, 0.1), { length: 1.14, spread: 0.18, width: 0.21, layerOffset: 0.025, fallPower: 1.05, tipOut: 0.16, tipLift: 0.14 }, (column) => ({ curl: (0.5 - column) * 0.14 })),
    ...layer("back", 0.8, evenColumns(6, 0.05), { length: 1.48, spread: 0.22, width: 0.24, layerOffset: 0.08, fallPower: 1.14, tipOut: 0.16, tipLift: 0.12 }, (column) => ({ curl: (0.5 - column) * 0.12 })),
    ...layer("back", 0.56, evenColumns(7, 0.04), { length: 1.36, spread: 0.2, width: 0.22, layerOffset: 0.025, fallPower: 1.06, tipOut: 0.18, tipLift: 0.15 }, (column) => ({ curl: (0.5 - column) * 0.14 }))
  ];

  const created = roots.map((definition, index) => {
    const sample = sampleScalpQuad(definition.face, definition.column, definition.row);
    if (!sample) return null;
    const variation = Math.sin((index + 1) * 2.39996);
    const tipVariation = Math.sin((index + 1) * 5.137);
    const variedDefinition = {
      ...definition,
      length: definition.length * (1 + variation * 0.035),
      startAngle: variation * 0.12,
      tipCurl: tipVariation * 0.11,
      rootScalpOffset: groupDefaultsFor(sample.region).rootScalpOffset
    };
    const points = createBowlCutPoints(sample, variedDefinition);
    return addLock("front", {
      x: points[0].x,
      y: points[0].y,
      z: points[0].z,
      length: variedDefinition.length,
      curve: points.at(-1).x - points[0].x,
      width: definition.width,
      taper: 0.58,
      twist: 0,
      color: DEFAULT_HAIR_COLOR,
      scalpRegion: sample.region,
      rootScalpOffset: variedDefinition.rootScalpOffset,
      rootSurfacePoint: sample.point,
      rootSurfaceNormal: sample.normal,
      points
    }, { deferUi: true });
  }).filter(Boolean);

  const last = created.at(-1);
  if (last) {
    selectLock(last.id);
    selectCurvePoint(last.id, 0);
    renderLockList();
    updateCount();
  }
}

function scalpRegionAtHit(hit) {
  if (hit?.faceIndex === undefined) return "unassigned";
  if (hit.object === customScalpSurfaceMesh) {
    return customScalpRegions[hit.faceIndex] || "unassigned";
  }
  if (hit.object === editedScalpSurfaceMesh) {
    return editedScalpRegions[hit.faceIndex] || "unassigned";
  }
  const quadId = hit.object.geometry.userData.triangleQuadIds?.[hit.faceIndex];
  return scalpRegionAssignments[quadId] || "unassigned";
}

function selectedCurveLatticeGuide() {
  if (!CURVE_LATTICE_FEATURE_ENABLED && !(GROUP_CURVE_FEATURE_ENABLED && selectedStrandGroup)) return null;
  return guides.find((guide) => guide.id === activeCurveLatticeGuideId && guide.type === "curve-lattice") || null;
}

function braidStrokeActive() {
  return activeTool === "braid";
}

function activeStrokeSurfaceValue() {
  return braidStrokeActive() ? braidSurfaceInput.value : drawStrandSurfaceInput.value;
}

function activeStrokeScalpOffset() {
  return Number(braidStrokeActive() ? braidScalpOffsetInput.value : drawStrandScalpOffsetInput.value);
}

function activeStrokeBrushSize() {
  return braidStrokeActive()
    ? Number(braidCreationDefaults.braidWidth) * Number(braidToolSizeInput.value)
    : Number(strandCreationDefaults.width) * Number(drawToolSizeInput.value);
}

function strokeSurfaceIsContextual(surfaceMode = activeStrokeSurfaceValue()) {
  return surfaceMode === "contextual-plane" || surfaceMode.endsWith("-contextual");
}

function contextualPlaneAtOrigin() {
  const normal = viewPlaneNormal();
  const origin = new THREE.Vector3(0, 0, 0);
  return {
    origin,
    normal,
    plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin)
  };
}

function drawSurfaceHitFromEvent(event, { root = false } = {}) {
  rayFromViewportEvent(event);
  const surfaceMode = activeStrokeSurfaceValue();
  if (surfaceMode === "contextual-plane") {
    const contextualPlane = contextualPlaneAtOrigin();
    const point = raycaster.ray.intersectPlane(contextualPlane.plane, new THREE.Vector3());
    return point ? { point, contextualPlaneNormal: contextualPlane.normal } : null;
  }
  if (root) {
    return raycaster.intersectObject(activeScalpSurfaceMesh(), false)[0]
      || raycaster.intersectObjects(headMeshes(), false)[0]
      || null;
  }
  if (surfaceMode.startsWith("head-")) {
    return raycaster.intersectObjects(headMeshes(), false)[0] || null;
  }
  if (surfaceMode === "lattice") {
    const lattice = selectedCurveLatticeGuide();
    return lattice
      ? raycaster.intersectObjects([lattice.mesh, lattice.rootMesh, lattice.bottomMesh].filter((object) => object && object.visible !== false), false)[0] || null
      : null;
  }
  return raycaster.intersectObjects(headMeshes(), false)[0] || null;
}

function worldNormalAtHit(hit) {
  if (hit.contextualPlaneNormal) return hit.contextualPlaneNormal.clone();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
  if (normal.dot(raycaster.ray.direction) > 0) normal.negate();
  return normal;
}

function drawScalpRegionAtEvent(event, surfaceHit) {
  if (activeStrokeSurfaceValue() === "contextual-plane") return "unassigned";
  if (surfaceHit?.object === activeScalpSurfaceMesh()) return scalpRegionAtHit(surfaceHit);
  const curveLatticeId = surfaceHit?.object?.userData?.curveLatticeGuideId;
  if (curveLatticeId) {
    return guides.find((guide) => guide.id === curveLatticeId)?.scalpRegion || "unassigned";
  }
  rayFromViewportEvent(event);
  const scalpHit = raycaster.intersectObject(activeScalpSurfaceMesh(), false)[0];
  return scalpHit ? scalpRegionAtHit(scalpHit) : "unassigned";
}

function drawSampleFromHit(hit, root = false, scalpRegion = "unassigned", scalpOffset = activeStrokeScalpOffset()) {
  const normal = worldNormalAtHit(hit);
  const drawOffsetDistance = scalpOffset * ROOT_SCALP_OFFSET_DISTANCE;
  const offset = root
    ? rootScalpOffsetDistance(THREE.MathUtils.clamp(activeCreationShapeDefaults().rootScalpOffset + scalpOffset, -1, 1))
    : Math.max(0.018, activeStrokeBrushSize() * 0.12) + drawOffsetDistance;
  return {
    point: hit.point.clone().addScaledVector(normal, offset),
    surfacePoint: hit.point.clone(),
    normal,
    onSurface: true
  };
}

function updateDrawStrandBrushCursor(event) {
  if (!["draw", "braid"].includes(activeTool) || drawStrandStroke?.freePlane) {
    drawStrandBrushCursor.visible = false;
    return;
  }
  const extensionLock = selectedTipContinuationLock(event);
  const cursorScale = activeStrokeBrushSize() * (braidStrokeActive() ? 1 / 3 : 1);
  if (extensionLock) {
    drawStrandBrushCursor.visible = true;
    drawStrandBrushCursor.position.copy(extensionLock.points.at(-1));
    drawStrandBrushCursor.quaternion.copy(camera.quaternion);
    drawStrandBrushCursor.scale.setScalar(Math.max(0.04, cursorScale));
    return;
  }
  const hit = drawSurfaceHitFromEvent(event, { root: true });
  if (!hit) {
    drawStrandBrushCursor.visible = false;
    return;
  }
  const normal = worldNormalAtHit(hit);
  drawStrandBrushCursor.visible = true;
  drawStrandBrushCursor.position.copy(hit.point).addScaledVector(
    normal,
    0.006 + activeStrokeScalpOffset() * ROOT_SCALP_OFFSET_DISTANCE
  );
  drawStrandBrushCursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  drawStrandBrushCursor.scale.setScalar(cursorScale);
}

function strokeLength(samples) {
  let length = 0;
  for (let i = 1; i < samples.length; i += 1) length += samples[i - 1].point.distanceTo(samples[i].point);
  return length;
}

function resampleDrawStroke(samples, count) {
  if (samples.length < 2) return samples.map((sample) => ({ ...sample, point: sample.point.clone() }));
  const distances = [0];
  for (let i = 1; i < samples.length; i += 1) {
    distances.push(distances[i - 1] + samples[i - 1].point.distanceTo(samples[i].point));
  }
  const total = distances.at(-1);
  if (total < 0.0001) return samples.slice(0, 1).map((sample) => ({ ...sample, point: sample.point.clone() }));
  const result = [];
  let segment = 1;
  for (let i = 0; i < count; i += 1) {
    const target = total * (i / Math.max(1, count - 1));
    while (segment < distances.length - 1 && distances[segment] < target) segment += 1;
    const before = samples[segment - 1];
    const after = samples[segment];
    const span = Math.max(0.0001, distances[segment] - distances[segment - 1]);
    const alpha = THREE.MathUtils.clamp((target - distances[segment - 1]) / span, 0, 1);
    const normal = before.normal && after.normal
      ? before.normal.clone().lerp(after.normal, alpha).normalize()
      : before.normal?.clone() || after.normal?.clone() || null;
    result.push({
      point: before.point.clone().lerp(after.point, alpha),
      surfacePoint: before.surfacePoint && after.surfacePoint
        ? before.surfacePoint.clone().lerp(after.surfacePoint, alpha)
        : null,
      normal,
      onSurface: before.onSurface && after.onSurface
    });
  }
  return result;
}

function processedDrawStroke(
  samples,
  smoothing = Number(drawStrandSmoothingInput.value),
  curveStep = Number(drawStrandCurveStepInput.value)
) {
  const length = strokeLength(samples);
  const spacing = THREE.MathUtils.clamp(Number(curveStep), 0.12, 0.6);
  const count = THREE.MathUtils.clamp(Math.round(length / spacing) + 1, 3, 18);
  const result = resampleDrawStroke(samples, count);
  if (result.length < 3 && result.length === 2) {
    result.splice(1, 0, {
      ...result[0],
      point: result[0].point.clone().lerp(result[1].point, 0.5)
    });
  }
  const passes = Math.round(smoothing * 4);
  const strength = THREE.MathUtils.lerp(0.18, 0.62, smoothing);
  for (let pass = 0; pass < passes; pass += 1) {
    const previous = result.map((sample) => sample.point.clone());
    for (let i = 1; i < result.length - 1; i += 1) {
      const target = previous[i - 1].clone().add(previous[i + 1]).multiplyScalar(0.5);
      const delta = target.sub(previous[i]).multiplyScalar(strength);
      if (result[i].onSurface && result[i].normal) delta.projectOnPlane(result[i].normal);
      result[i].point.copy(previous[i]).add(delta);
    }
  }
  return result;
}

function drawClumpFrame(curve, t) {
  const point = curve.getPoint(t);
  const y = curve.getTangent(t).normalize();
  const z = outwardNormalAtPoint(point, y);
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return { point, x, y, z };
}

function drawClumpPointSets(samples, brushSize) {
  const centerPoints = samples.map((sample) => sample.point.clone());
  if (centerPoints.length < 2) return [centerPoints];

  const sourceCurves = DRAW_CLUMP_TEMPLATE.strands.map((template) => (
    new THREE.CatmullRomCurve3(template.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)))
  ));
  const sourceCenter = sourceCurves[0];
  const targetCurve = new THREE.CatmullRomCurve3(centerPoints);
  const lateralScale = brushSize / DRAW_CLUMP_TEMPLATE.baseWidth;
  const lengthScale = targetCurve.getLength() / Math.max(0.001, sourceCenter.getLength());

  return [
    centerPoints,
    ...sourceCurves.slice(1).map((branchCurve) => centerPoints.map((point, index) => {
      const t = index / Math.max(1, centerPoints.length - 1);
      const sourceFrame = drawClumpFrame(sourceCenter, t);
      const targetFrame = drawClumpFrame(targetCurve, t);
      const delta = branchCurve.getPoint(t).sub(sourceFrame.point);
      return point.clone()
        .addScaledVector(targetFrame.x, delta.dot(sourceFrame.x) * lateralScale)
        .addScaledVector(targetFrame.y, delta.dot(sourceFrame.y) * lengthScale)
        .addScaledVector(targetFrame.z, delta.dot(sourceFrame.z) * lateralScale);
    }))
  ];
}

function nextClumpName() {
  const used = new Set(locks.map((lock) => lock.clumpName).filter(Boolean));
  let index = 1;
  while (used.has(`Clump ${index}`)) index += 1;
  return `Clump ${index}`;
}

function initializeClumpShape(guide) {
  if (!guide) return;
  guide.clumpSpread = Number(guide.clumpSpread ?? 1);
  guide.clumpDepthSpread = Number(guide.clumpDepthSpread ?? 1);
  guide.clumpTipFan = Number(guide.clumpTipFan ?? 0);
  guide.clumpRoll = Number(guide.clumpRoll ?? 0);
  guide.clumpStrandWidth = Number(guide.clumpStrandWidth ?? 1);
  guide.clumpStrandDepth = Number(guide.clumpStrandDepth ?? 1);
  guide.clumpVariation = Number(guide.clumpVariation ?? 0);
}

function stableClumpVariation(id = "") {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const first = ((hash >>> 0) % 2001) / 1000 - 1;
  hash = Math.imul(hash ^ 0x9e3779b9, 16777619);
  const second = ((hash >>> 0) % 2001) / 1000 - 1;
  return { first, second };
}

function createClumpFromLocks(clumpLocks, options = {}) {
  const members = clumpLocks.filter(Boolean);
  if (members.length < 2) return null;
  const clumpId = crypto.randomUUID();
  const guide = members[0];
  const name = options.name || nextClumpName();
  members.forEach((lock, index) => {
    lock.clumpId = clumpId;
    lock.clumpName = name;
    lock.clumpGuide = index === 0;
    lock.clumpGuideId = guide.id;
    lock.clumpInfluence = 1;
    lock.clumpRestPoints = lock.points.map((point) => point.clone());
    lock.clumpRestTwists = [...lock.pointTwists];
    lock.clumpRestScales = lock.pointScales.map((scale) => ({ x: scale.x, z: scale.z }));
    if (index === 0) {
      initializeClumpShape(lock);
      lock.clumpGuideRestPoints = lock.points.map((point) => point.clone());
      lock.clumpGuideRestTwists = [...lock.pointTwists];
      lock.clumpGuideRestScales = lock.pointScales.map((scale) => ({ x: scale.x, z: scale.z }));
    }
  });
  return guide;
}

function addLockToClump(lock, guide) {
  if (!lock || !guide?.clumpGuide || !guide.clumpId || lock.id === guide.id) return false;
  if (lock.clumpGuide || lock.clumpId === guide.clumpId) return false;
  if (lock.clumpId) detachLockFromClump(lock);
  lock.clumpId = guide.clumpId;
  lock.clumpName = guide.clumpName;
  lock.clumpGuide = false;
  lock.clumpGuideId = guide.id;
  lock.clumpInfluence = 1;
  lock.clumpRestPoints = lock.points.map((point) => point.clone());
  lock.clumpRestTwists = [...lock.pointTwists];
  lock.clumpRestScales = lock.pointScales.map((scale) => ({ x: scale.x, z: scale.z }));
  updateClumpMembers(guide);
  return true;
}

function clumpDirectMembers(guide) {
  if (!guide?.clumpGuide || !guide.clumpId) return [];
  return locks.filter((lock) => lock.clumpId === guide.clumpId && lock.id !== guide.id);
}

function clumpMembersForGuide(guide) {
  return clumpDirectMembers(guide);
}

function clumpGuideForLock(lock) {
  if (!lock?.clumpId) return null;
  return locks.find((item) => item.clumpId === lock.clumpId && item.clumpGuide) || null;
}

function clumpFrameAt(curve, t) {
  const point = curve.getPoint(t);
  const y = curve.getTangent(t).normalize();
  const z = outwardNormalAtPoint(point, y);
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return { point, x, y, z };
}

function commitClumpMemberRestState(lock) {
  if (!lock?.clumpId || lock.clumpGuide || !lock.points?.length) return;
  const guide = clumpGuideForLock(lock);
  if (!guide?.clumpGuideRestPoints?.length || guide.points.length < 2) return;

  const restGuideCurve = new THREE.CatmullRomCurve3(guide.clumpGuideRestPoints);
  const currentGuideCurve = new THREE.CatmullRomCurve3(guide.points);
  const influence = THREE.MathUtils.clamp(Number(guide.clumpInfluence ?? 1), 0, 1);
  initializeClumpShape(guide);
  const spread = THREE.MathUtils.clamp(guide.clumpSpread, 0, 2.5);
  const depthSpread = THREE.MathUtils.clamp(guide.clumpDepthSpread, 0, 2.5);
  const tipFan = THREE.MathUtils.clamp(guide.clumpTipFan, -1, 1.5);
  const roll = THREE.MathUtils.degToRad(guide.clumpRoll);
  const rollCos = Math.cos(roll);
  const rollSin = Math.sin(roll);
  const strandWidth = THREE.MathUtils.clamp(guide.clumpStrandWidth, 0.1, 2.5);
  const strandDepth = THREE.MathUtils.clamp(guide.clumpStrandDepth, 0.1, 2.5);
  const variation = THREE.MathUtils.clamp(guide.clumpVariation, 0, 1);
  const memberVariation = stableClumpVariation(lock.id);
  const restPoints = [];
  const restTwists = [];
  const restScales = [];

  lock.points.forEach((point, index) => {
    const t = index / Math.max(1, lock.points.length - 1);
    const guideIndex = Math.round(t * Math.max(0, guide.points.length - 1));
    const restFrame = clumpFrameAt(restGuideCurve, t);
    const currentFrame = clumpFrameAt(currentGuideCurve, t);
    const fanScale = Math.max(0.04, 1 + tipFan * t);
    const variationScale = 1 + memberVariation.first * variation * 0.16 * t;
    const widthFactor = spread * fanScale * variationScale;
    const depthFactor = depthSpread * fanScale * variationScale;
    const variationBow = Math.sin(Math.PI * t) * memberVariation.second * variation * 0.08;
    const inverseInfluence = 1 - influence;
    const columnX = restFrame.x.clone().multiplyScalar(inverseInfluence)
      .addScaledVector(currentFrame.x, influence * widthFactor * rollCos)
      .addScaledVector(currentFrame.z, influence * widthFactor * rollSin);
    const columnY = restFrame.y.clone().multiplyScalar(inverseInfluence)
      .addScaledVector(currentFrame.y, influence);
    const columnZ = restFrame.z.clone().multiplyScalar(inverseInfluence)
      .addScaledVector(currentFrame.x, -influence * depthFactor * rollSin)
      .addScaledVector(currentFrame.z, influence * depthFactor * rollCos);
    const basis = new THREE.Matrix3().set(
      columnX.x, columnY.x, columnZ.x,
      columnX.y, columnY.y, columnZ.y,
      columnX.z, columnY.z, columnZ.z
    );
    const constant = restFrame.point.clone().multiplyScalar(inverseInfluence)
      .addScaledVector(currentFrame.point, influence)
      .addScaledVector(currentFrame.x, influence * variationBow);
    const coordinates = point.clone().sub(constant);
    if (Math.abs(basis.determinant()) > 1e-8) coordinates.applyMatrix3(basis.invert());
    restPoints.push(restFrame.point.clone()
      .addScaledVector(restFrame.x, coordinates.x)
      .addScaledVector(restFrame.y, coordinates.y)
      .addScaledVector(restFrame.z, coordinates.z));

    const guideTwistDelta = Number(guide.pointTwists[guideIndex] || 0)
      - Number(guide.clumpGuideRestTwists?.[guideIndex] || 0);
    restTwists.push(Number(lock.pointTwists[index] || 0) - guideTwistDelta * influence);

    const guideRestScale = guide.clumpGuideRestScales?.[guideIndex] || { x: 1, z: 1 };
    const guideScale = guide.pointScales[guideIndex] || guideRestScale;
    const widthVariation = 1 + memberVariation.second * variation * 0.12;
    const depthVariation = 1 - memberVariation.second * variation * 0.08;
    const widthScaleFactor = guideScale.x / Math.max(0.18, guideRestScale.x) * strandWidth * widthVariation;
    const depthScaleFactor = guideScale.z / Math.max(0.18, guideRestScale.z) * strandDepth * depthVariation;
    const currentScale = lock.pointScales[index] || { x: 1, z: 1 };
    restScales.push({
      x: currentScale.x / Math.max(1e-6, inverseInfluence + influence * widthScaleFactor),
      z: currentScale.z / Math.max(1e-6, inverseInfluence + influence * depthScaleFactor)
    });
  });

  lock.clumpRestPoints = restPoints;
  lock.clumpRestTwists = restTwists;
  lock.clumpRestScales = restScales;
}

function updateClumpMembers(guide) {
  const members = clumpMembersForGuide(guide);
  if (!members.length || guide.clumpGuideRestPoints?.length < 2 || guide.points.length < 2) return;
  const restGuideCurve = new THREE.CatmullRomCurve3(guide.clumpGuideRestPoints);
  const currentGuideCurve = new THREE.CatmullRomCurve3(guide.points);
  const influence = THREE.MathUtils.clamp(Number(guide.clumpInfluence ?? 1), 0, 1);
  initializeClumpShape(guide);
  const spread = THREE.MathUtils.clamp(guide.clumpSpread, 0, 2.5);
  const depthSpread = THREE.MathUtils.clamp(guide.clumpDepthSpread, 0, 2.5);
  const tipFan = THREE.MathUtils.clamp(guide.clumpTipFan, -1, 1.5);
  const roll = THREE.MathUtils.degToRad(guide.clumpRoll);
  const strandWidth = THREE.MathUtils.clamp(guide.clumpStrandWidth, 0.1, 2.5);
  const strandDepth = THREE.MathUtils.clamp(guide.clumpStrandDepth, 0.1, 2.5);
  const variation = THREE.MathUtils.clamp(guide.clumpVariation, 0, 1);
  clumpUpdateInProgress = true;
  try {
    members.forEach((member) => {
      const memberVariation = stableClumpVariation(member.id);
      if (!member.clumpRestPoints?.length) member.clumpRestPoints = member.points.map((point) => point.clone());
      member.points.forEach((point, index) => {
        const t = index / Math.max(1, member.points.length - 1);
        const guideIndex = Math.round(t * Math.max(0, guide.points.length - 1));
        const basePoint = member.clumpRestPoints[index] || member.clumpRestPoints.at(-1);
        const restFrame = clumpFrameAt(restGuideCurve, t);
        const currentFrame = clumpFrameAt(currentGuideCurve, t);
        const offset = basePoint.clone().sub(restFrame.point);
        const fanScale = Math.max(0.04, 1 + tipFan * t);
        const variationScale = 1 + memberVariation.first * variation * 0.16 * t;
        const offsetX = offset.dot(restFrame.x) * spread * fanScale * variationScale;
        const offsetZ = offset.dot(restFrame.z) * depthSpread * fanScale * variationScale;
        const rollCos = Math.cos(roll);
        const rollSin = Math.sin(roll);
        const rolledX = offsetX * rollCos - offsetZ * rollSin;
        const rolledZ = offsetX * rollSin + offsetZ * rollCos;
        const variationBow = Math.sin(Math.PI * t) * memberVariation.second * variation * 0.08;
        const target = currentFrame.point.clone()
          .addScaledVector(currentFrame.x, rolledX + variationBow)
          .addScaledVector(currentFrame.y, offset.dot(restFrame.y))
          .addScaledVector(currentFrame.z, rolledZ);
        point.copy(basePoint).lerp(target, influence);
        const restTwist = Number(member.clumpRestTwists?.[index] ?? member.pointTwists[index] ?? 0);
        const guideTwistDelta = Number(guide.pointTwists[guideIndex] || 0)
          - Number(guide.clumpGuideRestTwists?.[guideIndex] || 0);
        member.pointTwists[index] = restTwist + guideTwistDelta * influence;
        const restScale = member.clumpRestScales?.[index] || member.pointScales[index] || { x: 1, z: 1 };
        const guideRestScale = guide.clumpGuideRestScales?.[guideIndex] || { x: 1, z: 1 };
        const guideScale = guide.pointScales[guideIndex] || guideRestScale;
        const widthVariation = 1 + memberVariation.second * variation * 0.12;
        const depthVariation = 1 - memberVariation.second * variation * 0.08;
        setPointScale(
          member,
          index,
          THREE.MathUtils.lerp(restScale.x, restScale.x * guideScale.x / Math.max(0.18, guideRestScale.x) * strandWidth * widthVariation, influence),
          THREE.MathUtils.lerp(restScale.z, restScale.z * guideScale.z / Math.max(0.18, guideRestScale.z) * strandDepth * depthVariation, influence)
        );
      });
      syncLockFromCurve(member);
      updateLockGeometry(member);
    });
  } finally {
    clumpUpdateInProgress = false;
  }
}

function dissolveClump(clumpId) {
  if (!clumpId) return;
  clumpOpen.delete(clumpId);
  locks.filter((lock) => lock.clumpId === clumpId).forEach((lock) => {
    delete lock.clumpId;
    delete lock.clumpName;
    delete lock.clumpGuide;
    delete lock.clumpGuideId;
    delete lock.clumpInfluence;
    delete lock.clumpSpread;
    delete lock.clumpDepthSpread;
    delete lock.clumpTipFan;
    delete lock.clumpRoll;
    delete lock.clumpStrandWidth;
    delete lock.clumpStrandDepth;
    delete lock.clumpVariation;
    delete lock.clumpRestPoints;
    delete lock.clumpGuideRestPoints;
    delete lock.clumpRestTwists;
    delete lock.clumpGuideRestTwists;
    delete lock.clumpRestScales;
    delete lock.clumpGuideRestScales;
  });
}

function detachLockFromClump(lock) {
  if (!lock?.clumpId) return;
  const guide = clumpGuideForLock(lock);
  if (lock.clumpGuide) {
    dissolveClump(lock.clumpId);
    return;
  }
  delete lock.clumpId;
  delete lock.clumpName;
  delete lock.clumpGuide;
  delete lock.clumpGuideId;
  delete lock.clumpInfluence;
  delete lock.clumpRestPoints;
  delete lock.clumpRestTwists;
  delete lock.clumpRestScales;
  const remaining = guide ? clumpMembersForGuide(guide) : [];
  if (guide && remaining.length < 1) dissolveClump(guide.clumpId);
}

function updateDrawVolumePreview(mesh, previewLock, color) {
  const previousGeometry = mesh.geometry;
  mesh.geometry = createHairGeometry(previewLock);
  previousGeometry.dispose();
  mesh.material.color.set(color);
  mesh.visible = true;
}

function hideDrawClumpPreviews() {
  [...drawStrandClumpVolumePreviews, ...drawStrandClumpMirrorPreviews].forEach((mesh) => {
    mesh.visible = false;
  });
}

function resetDrawVolumePreview(mesh) {
  mesh.visible = false;
  mesh.geometry.dispose();
  mesh.geometry = new THREE.BufferGeometry();
}

function updateDrawStrandPreview() {
  if (!drawStrandStroke?.samples.length) {
    drawStrandPreview.visible = false;
    drawStrandMirrorPreview.visible = false;
    drawStrandVolumePreview.visible = false;
    drawStrandMirrorVolumePreview.visible = false;
    hideDrawClumpPreviews();
    return;
  }
  const samples = processedDrawStroke(
    drawStrandStroke.samples,
    drawStrandStroke.smoothing,
    drawStrandStroke.curveStep
  );
  const groupDefaults = groupDefaultsFor(drawStrandStroke.scalpRegion);
  const defaults = drawStrandStroke.outputType === "braid"
    ? braidCreationDefaults
    : strandCreationDefaults;
  const extensionLock = drawStrandStroke.extensionLockId
    ? locks.find((lock) => lock.id === drawStrandStroke.extensionLockId)
    : null;
  const layerId = normalizeHairLayer(defaults.hairLayer);
  const layerOffset = Number(groupDefaults.layerOffsets?.[layerId] ?? 0);
  const layerDirection = drawStrandStroke.rootSurfaceNormal?.clone().normalize() || new THREE.Vector3(0, 0, 1);
  const previewPoints = extensionLock
    ? [...extensionLock.points.map((point) => point.clone()), ...samples.slice(1).map((sample) => sample.point.clone())]
    : pointsWithLayerOffset(
        samples.map((sample) => sample.point),
        layerDirection,
        layerOffset,
        layerId
      );
  drawStrandPreview.geometry.setFromPoints(previewPoints);
  drawStrandPreview.visible = true;
  drawStrandMirrorPreview.geometry.setFromPoints(previewPoints.map(mirroredVector));
  drawStrandMirrorPreview.visible = mirrorXEditing;
  if (samples.length < 2) {
    drawStrandVolumePreview.visible = false;
    drawStrandMirrorVolumePreview.visible = false;
    hideDrawClumpPreviews();
    return;
  }
  const previewLock = {
    id: "draw-strand-preview",
    geometryType: extensionLock?.geometryType || (drawStrandStroke.outputType === "braid" ? "braid" : "strand"),
    materialId: extensionLock?.materialId || DEFAULT_HAIR_MATERIAL_ID,
    scalpRegion: extensionLock?.scalpRegion || drawStrandStroke.scalpRegion,
    hairLayer: extensionLock?.hairLayer || layerId,
    points: previewPoints,
    pointTwists: extensionLock
      ? [...extensionLock.pointTwists, ...samples.slice(1).map(() => extensionLock.pointTwists.at(-1) || 0)]
      : samples.map(() => 0),
    pointScales: extensionLock
      ? [...extensionLock.pointScales.map((scale) => ({ ...scale })), ...samples.slice(1).map(() => ({ ...(extensionLock.pointScales.at(-1) || { x: 1, z: 1 }) }))]
      : samples.map(() => ({ x: 1, z: 1 })),
    pointWidths: extensionLock
      ? [...extensionLock.pointWidths, ...samples.slice(1).map(() => extensionLock.pointWidths.at(-1) ?? 1)]
      : samples.map(() => 1),
    baseWidth: extensionLock?.baseWidth || drawStrandStroke.brushSize,
    width: extensionLock?.width || drawStrandStroke.brushSize,
    braidMeshPreset: extensionLock?.braidMeshPreset || drawStrandStroke.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET,
    braidWidth: extensionLock?.braidWidth || drawStrandStroke.braidWidth,
    braidDepth: extensionLock?.braidDepth || drawStrandStroke.braidDepth,
    braidSegmentLength: extensionLock?.braidSegmentLength || drawStrandStroke.braidSegmentLength,
    braidRotation: extensionLock?.braidRotation ?? drawStrandStroke.braidRotation,
    curlEnabled: drawStrandStroke.outputType === "strand"
      ? Boolean(drawStrandStroke.curlEnabled)
      : Boolean(extensionLock?.curlEnabled),
    curlCount: Number(drawStrandStroke.outputType === "strand"
      ? drawStrandStroke.curlCount ?? 4
      : extensionLock?.curlCount ?? 4),
    curlDisplacement: Number(drawStrandStroke.outputType === "strand"
      ? drawStrandStroke.curlDisplacement ?? 0.18
      : extensionLock?.curlDisplacement ?? 0.18),
    length: strokeLength(samples),
    twist: extensionLock?.twist ?? defaults.twist,
    radialSegments: Math.min(12, Math.round(extensionLock?.radialSegments || groupDefaults.radialSegments || 10)),
    lengthSegments: Math.min(32, Math.max(8, extensionLock?.lengthSegments || samples.length * 3)),
    dynamicDensity: extensionLock ? Boolean(extensionLock.dynamicDensity) : Boolean(groupDefaults.dynamicDensity),
    densityAggression: Number(extensionLock?.densityAggression ?? groupDefaults.densityAggression ?? 0.5),
    taperCurve: extensionLock?.taperCurve || defaults.taperCurve,
    depthCurve: extensionLock?.depthCurve || defaults.depthCurve,
    widthScale: extensionLock?.widthScale ?? defaults.widthScale,
    depthScale: extensionLock?.depthScale ?? defaults.depthScale,
    sweepProfile: extensionLock?.sweepProfile || (drawStrandStroke.curlEnabled ? ROUND_SWEEP_PROFILE : defaults.sweepProfile),
    profileOffset: Number(extensionLock?.profileOffset ?? defaults.profileOffset ?? 0)
  };
  const previewColor = strandDisplayColor(previewLock);
  updateDrawVolumePreview(drawStrandVolumePreview, previewLock, previewColor);
  if (mirrorXEditing) {
    const mirroredPreviewLock = {
      ...previewLock,
      points: previewLock.points.map(mirroredVector),
      pointTwists: previewLock.pointTwists.map((twist) => -twist),
      twist: -previewLock.twist
    };
    updateDrawVolumePreview(drawStrandMirrorVolumePreview, mirroredPreviewLock, previewColor);
  } else {
    drawStrandMirrorVolumePreview.visible = false;
  }

  if (!extensionLock && drawStrandStroke.outputType !== "braid" && drawStrandMode === "clump") {
    const pointSets = drawClumpPointSets(samples, drawStrandStroke.brushSize);
    DRAW_CLUMP_TEMPLATE.strands.slice(1).forEach((template, index) => {
      const points = pointsWithLayerOffset(pointSets[index + 1], layerDirection, layerOffset, layerId);
      const width = drawStrandStroke.brushSize * (template.width / DRAW_CLUMP_TEMPLATE.baseWidth);
      const clumpPreviewLock = {
        ...previewLock,
        id: `draw-clump-preview-${index}`,
        points,
        pointTwists: points.map(() => 0),
        pointScales: points.map(() => ({ x: 1, z: 1 })),
        baseWidth: width,
        width
      };
      updateDrawVolumePreview(drawStrandClumpVolumePreviews[index], clumpPreviewLock, previewColor);
      if (mirrorXEditing) {
        updateDrawVolumePreview(drawStrandClumpMirrorPreviews[index], {
          ...clumpPreviewLock,
          points: points.map(mirroredVector),
          pointTwists: clumpPreviewLock.pointTwists.map((twist) => -twist),
          twist: -clumpPreviewLock.twist
        }, previewColor);
      } else {
        drawStrandClumpMirrorPreviews[index].visible = false;
      }
    });
  } else {
    hideDrawClumpPreviews();
  }
}

function continueFromTipEnabled() {
  return braidStrokeActive() ? braidContinueFromTipInput.checked : drawContinueFromTipInput.checked;
}

function selectedTipContinuationLock(event) {
  if (!continueFromTipEnabled()) return null;
  const lock = getSelectedLock();
  const expectedGeometry = braidStrokeActive() ? "braid" : "strand";
  if (!lock || lock.geometryType !== expectedGeometry || lock.points.length < 2) return null;
  const rect = renderer.domElement.getBoundingClientRect();
  const tip = lock.points.at(-1).clone().project(camera);
  if (tip.z < -1 || tip.z > 1) return null;
  const tipX = rect.left + (tip.x + 1) * rect.width * 0.5;
  const tipY = rect.top + (1 - tip.y) * rect.height * 0.5;
  return Math.hypot(event.clientX - tipX, event.clientY - tipY) <= 20 ? lock : null;
}

function beginDrawStrandStroke(event, hit, extensionLock = null) {
  if (event.button !== 0 || (!hit && !extensionLock) || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;
  const surfaceMode = activeStrokeSurfaceValue();
  const scalpRegion = extensionLock?.scalpRegion || drawScalpRegionAtEvent(event, hit);
  const drawingBraid = braidStrokeActive();
  const scalpOffset = activeStrokeScalpOffset();
  const contextualPlane = surfaceMode === "contextual-plane" ? contextualPlaneAtOrigin() : null;
  const extensionTip = extensionLock?.points.at(-1)?.clone();
  const extensionTangent = extensionLock
    ? extensionTip.clone().sub(extensionLock.points.at(-2)).normalize()
    : null;
  const extensionNormal = extensionLock?.rootSurfaceNormal?.clone()?.normalize()
    || (extensionTangent ? viewPlaneNormal().cross(extensionTangent).cross(extensionTangent).normalize() : null);
  const sample = extensionLock
    ? {
        point: extensionTip,
        surfacePoint: null,
        normal: extensionNormal || new THREE.Vector3(0, 0, 1),
        onSurface: false
      }
    : contextualPlane
    ? {
        point: hit.point.clone(),
        surfacePoint: null,
        normal: contextualPlane.normal.clone(),
        onSurface: false
      }
    : drawSampleFromHit(hit, true, scalpRegion, scalpOffset);
  drawStrandStroke = {
    pointerId: event.pointerId,
    outputType: drawingBraid ? "braid" : "strand",
    surfaceMode,
    scalpRegion,
    brushSize: activeStrokeBrushSize(),
    braidMeshPreset: braidCreationDefaults.braidMeshPreset,
    braidWidth: Number(braidCreationDefaults.braidWidth) * Number(braidToolSizeInput.value),
    braidDepth: Number(braidCreationDefaults.braidDepth) * Number(braidToolSizeInput.value),
    braidSegmentLength: Number(braidCreationDefaults.braidSegmentLength) * Number(braidToolSizeInput.value),
    braidRotation: Number(braidCreationDefaults.braidRotation),
    curlEnabled: !drawingBraid && drawStrandMode === "coil",
    curlCount: Number(strandCreationDefaults.curlCount),
    curlDisplacement: Number(strandCreationDefaults.curlDisplacement),
    smoothing: Number(drawingBraid ? braidSmoothingInput.value : drawStrandSmoothingInput.value),
    curveStep: Number(drawingBraid ? braidCurveStepInput.value : drawStrandCurveStepInput.value),
    scalpOffset,
    rootSurfacePoint: extensionLock?.rootSurfacePoint?.clone() || extensionTip?.clone() || hit.point.clone(),
    rootSurfaceNormal: extensionLock?.rootSurfaceNormal?.clone() || sample.normal.clone(),
    extensionLockId: extensionLock?.id || null,
    samples: [sample],
    lastX: event.clientX,
    lastY: event.clientY,
    freePlane: extensionLock && surfaceMode === "contextual-plane"
      ? {
          origin: extensionTip.clone(),
          normal: viewPlaneNormal(),
          plane: new THREE.Plane().setFromNormalAndCoplanarPoint(viewPlaneNormal(), extensionTip)
        }
      : contextualPlane
  };
  renderer.domElement.setPointerCapture?.(event.pointerId);
  renderer.domElement.style.cursor = "crosshair";
  drawStrandBrushCursor.visible = false;
  updateDrawStrandPreview();
  updateInteractionLocks();
  updatePlacementStatus();
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}

function beginDrawFreePlane(stroke) {
  if (stroke.freePlane) return;
  const origin = stroke.surfaceMode === "contextual-plane"
    ? new THREE.Vector3(0, 0, 0)
    : stroke.samples.at(-1).point.clone();
  const normal = viewPlaneNormal();
  stroke.freePlane = {
    origin,
    normal,
    plane: new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin)
  };
  updateViewPlaneGrid();
}

function updateDrawStrandStroke(event) {
  updateDrawStrandBrushCursor(event);
  const stroke = drawStrandStroke;
  if (!stroke || event.pointerId !== stroke.pointerId) return;
  const screenDistance = Math.hypot(event.clientX - stroke.lastX, event.clientY - stroke.lastY);
  const sampleSpacing = THREE.MathUtils.lerp(2.5, 9, stroke.smoothing);
  if (screenDistance < sampleSpacing) return;

  let nextSample = null;
  if (!stroke.freePlane) {
    const hit = drawSurfaceHitFromEvent(event);
    if (hit) {
      const surfaceSample = drawSampleFromHit(hit, false, stroke.scalpRegion, stroke.scalpOffset);
      if (strokeSurfaceIsContextual(stroke.surfaceMode)) {
        const previous = stroke.samples.at(-1);
        const movingDown = surfaceSample.point.y < previous.point.y - 0.004;
        if (movingDown && surfaceSample.normal.y < -0.08) beginDrawFreePlane(stroke);
        else nextSample = surfaceSample;
      } else {
        nextSample = surfaceSample;
      }
    } else if (strokeSurfaceIsContextual(stroke.surfaceMode)) {
      beginDrawFreePlane(stroke);
    }
  }
  if (stroke.freePlane && !nextSample) {
    const point = rayFromViewportEvent(event).intersectPlane(stroke.freePlane.plane, new THREE.Vector3());
    if (point) nextSample = { point, surfacePoint: null, normal: null, onSurface: false };
  }
  if (!nextSample || nextSample.point.distanceTo(stroke.samples.at(-1).point) < 0.008) return;
  stroke.samples.push(nextSample);
  stroke.lastX = event.clientX;
  stroke.lastY = event.clientY;
  updateDrawStrandPreview();
  event.preventDefault();
  event.stopImmediatePropagation();
}

function createDrawnLock(stroke, points, width, isCenter) {
  const root = points[0];
  const length = new THREE.CatmullRomCurve3(points).getLength();
  const lock = addLock("front", {
    x: root.x,
    y: root.y,
    z: root.z,
    length,
    curve: points.at(-1).x - root.x,
    width,
    twist: strandCreationDefaults.twist,
    taperCurve: cloneShapePresetValue(strandCreationDefaults.taperCurve),
    depthCurve: cloneShapePresetValue(strandCreationDefaults.depthCurve),
    widthScale: strandCreationDefaults.widthScale,
    depthScale: strandCreationDefaults.depthScale,
    sweepProfile: cloneShapePresetValue(stroke.curlEnabled ? ROUND_SWEEP_PROFILE : strandCreationDefaults.sweepProfile),
    profileOffset: strandCreationDefaults.profileOffset,
    curlEnabled: Boolean(stroke.curlEnabled),
    curlCount: Number(stroke.curlCount ?? 4),
    curlDisplacement: Number(stroke.curlDisplacement ?? 0.18),
    color: DEFAULT_HAIR_COLOR,
    scalpRegion: stroke.scalpRegion,
    rootScalpOffset: THREE.MathUtils.clamp(
      strandCreationDefaults.rootScalpOffset + stroke.scalpOffset,
      -1,
      1
    ),
    rootSurfacePoint: isCenter ? stroke.rootSurfacePoint : null,
    rootSurfaceNormal: isCenter ? stroke.rootSurfaceNormal : null,
    points
  }, { deferUi: true });
  applyPlacedStrandScaleProfile(lock);
  updateLockGeometry(lock);
  lock.curveObjects.group.visible = false;
  return lock;
}

function createDrawnBraid(stroke) {
  if (!braidMeshPresets.has(stroke.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET)
    && !braidMeshPresets.has(DEFAULT_BRAID_MESH_PRESET)) return null;
  const processed = processedDrawStroke(stroke.samples, stroke.smoothing, stroke.curveStep);
  if (processed.length < 3 || strokeLength(processed) < 0.12) return null;
  const points = processed.map((sample) => sample.point.clone());
  const root = points[0];
  const length = new THREE.CatmullRomCurve3(points).getLength();
  const defaults = braidCreationDefaults;
  const lock = addLock("front", {
    geometryType: "braid",
    braidMeshPreset: stroke.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET,
    x: root.x,
    y: root.y,
    z: root.z,
    length,
    curve: points.at(-1).x - root.x,
    width: stroke.braidWidth,
    braidWidth: stroke.braidWidth,
    braidDepth: stroke.braidDepth,
    braidSegmentLength: stroke.braidSegmentLength,
    braidRotation: stroke.braidRotation,
    twist: defaults.twist,
    taperCurve: cloneShapePresetValue(defaults.taperCurve),
    depthCurve: cloneShapePresetValue(defaults.depthCurve),
    sweepProfile: cloneShapePresetValue(defaults.sweepProfile),
    profileOffset: defaults.profileOffset,
    widthScale: defaults.widthScale,
    depthScale: defaults.depthScale,
    hairLayer: defaults.hairLayer,
    color: DEFAULT_HAIR_COLOR,
    scalpRegion: stroke.scalpRegion,
    rootScalpOffset: THREE.MathUtils.clamp(
      defaults.rootScalpOffset + stroke.scalpOffset,
      -1,
      1
    ),
    rootSurfacePoint: stroke.rootSurfacePoint,
    rootSurfaceNormal: stroke.rootSurfaceNormal,
    points
  }, { deferUi: true });
  updateLockGeometry(lock);
  lock.curveObjects.group.visible = false;
  syncActiveMirror(lock);
  renderLockList();
  updateCount();
  selectLock(lock.id);
  return lock;
}

function createDrawnStrand(stroke) {
  if (stroke.outputType === "braid") return createDrawnBraid(stroke);
  const processed = processedDrawStroke(stroke.samples, stroke.smoothing, stroke.curveStep);
  if (processed.length < 3 || strokeLength(processed) < 0.12) return null;
  const pointSets = drawStrandMode === "clump"
    ? drawClumpPointSets(processed, stroke.brushSize)
    : [processed.map((sample) => sample.point.clone())];
  const templates = drawStrandMode === "clump"
    ? DRAW_CLUMP_TEMPLATE.strands
    : [{ width: DRAW_CLUMP_TEMPLATE.baseWidth }];
  const created = pointSets.map((points, index) => createDrawnLock(
    stroke,
    points,
    stroke.brushSize * (templates[index].width / DRAW_CLUMP_TEMPLATE.baseWidth),
    index === 0
  ));
  created.forEach((lock) => syncActiveMirror(lock));
  if (drawStrandMode === "clump") {
    const clumpName = nextClumpName();
    createClumpFromLocks(created, { name: clumpName });
    if (mirrorXEditing) {
      const mirroredLocks = created.map((lock) => mirrorPartnerFor(lock)).filter(Boolean);
      createClumpFromLocks(mirroredLocks, { name: `${clumpName} Mirror` });
    }
  }
  renderLockList();
  updateCount();
  selectLock(created[0].id);
  return created[0];
}

function extendDrawnStrand(stroke) {
  const lock = locks.find((item) => item.id === stroke.extensionLockId);
  if (!lock) return null;
  const processed = processedDrawStroke(stroke.samples, stroke.smoothing, stroke.curveStep);
  if (processed.length < 2 || strokeLength(processed) < 0.04) return null;
  const addedPoints = processed.slice(1).map((sample) => sample.point.clone());
  if (!addedPoints.length) return null;
  const lastScale = lock.pointScales.at(-1) || { x: 1, z: 1 };
  const lastWidth = lock.pointWidths.at(-1) ?? 1;
  const lastTwist = lock.pointTwists.at(-1) ?? 0;
  lock.points.push(...addedPoints);
  lock.pointScales.push(...addedPoints.map(() => ({ ...lastScale })));
  lock.pointWidths.push(...addedPoints.map(() => lastWidth));
  lock.pointTwists.push(...addedPoints.map(() => lastTwist));
  if (lock.geometryType !== "braid" && stroke.curlEnabled) {
    lock.curlEnabled = true;
    lock.curlCount = Number(stroke.curlCount ?? lock.curlCount ?? 4);
    lock.curlDisplacement = Number(stroke.curlDisplacement ?? lock.curlDisplacement ?? 0.18);
    lock.sweepProfile = cloneShapePresetValue(ROUND_SWEEP_PROFILE);
  }
  syncLockFromCurve(lock);
  if (lock.curveObjects.handles.length !== lock.points.length) rebuildCurveObjects(lock);
  updateLockGeometry(lock);
  syncActiveMirror(lock, { refreshUi: true });
  selectLock(lock.id, { individualClumpMember: Boolean(lock.clumpId && !lock.clumpGuide) });
  renderLockList();
  updateCount();
  return lock;
}

function finishDrawStrandStroke(event, options = {}) {
  const stroke = drawStrandStroke;
  if (!stroke || (event?.pointerId !== undefined && event.pointerId !== stroke.pointerId)) return;
  drawStrandStroke = null;
  if (renderer.domElement.hasPointerCapture?.(stroke.pointerId)) renderer.domElement.releasePointerCapture(stroke.pointerId);
  renderer.domElement.style.cursor = "";
  drawStrandPreview.visible = false;
  drawStrandPreview.geometry.setFromPoints([]);
  drawStrandMirrorPreview.visible = false;
  drawStrandMirrorPreview.geometry.setFromPoints([]);
  resetDrawVolumePreview(drawStrandVolumePreview);
  resetDrawVolumePreview(drawStrandMirrorVolumePreview);
  [...drawStrandClumpVolumePreviews, ...drawStrandClumpMirrorPreviews].forEach(resetDrawVolumePreview);
  viewPlaneFill.visible = false;
  viewPlaneGrid.visible = false;
  const minimumStrokeLength = stroke.extensionLockId ? 0.04 : 0.12;
  if (!options.cancel && stroke.samples.length >= 2 && strokeLength(stroke.samples) >= minimumStrokeLength) {
    pushUndoState();
    if (stroke.extensionLockId) extendDrawnStrand(stroke);
    else createDrawnStrand(stroke);
  }
  updateInteractionLocks();
  scheduleStrandCollisionResolve();
  updateAttributeEditorMode();
  updatePlacementStatus();
  event?.preventDefault();
}

function createPlacedStrand(hit) {
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
  const surfaceCenter = scalpSurfaceGroup.getWorldPosition(new THREE.Vector3());
  if (normal.dot(hit.point.clone().sub(surfaceCenter).normalize()) < 0) normal.negate();

  const hitCurveLattice = hit.object.userData.curveLatticeGuideId
    ? guides.find((guide) => guide.id === hit.object.userData.curveLatticeGuideId)
    : null;
  const scalpRegion = hitCurveLattice?.scalpRegion || scalpRegionAtHit(hit);
  const localRootOffset = THREE.MathUtils.clamp(
    strandCreationDefaults.rootScalpOffset + Number(placeStrandScalpOffsetInput.value),
    -1,
    1
  );
  const root = hit.point.clone().addScaledVector(normal, rootScalpOffsetDistance(localRootOffset));
  let flow = new THREE.Vector3(0, -1, 0).projectOnPlane(normal).normalize();
  if (flow.lengthSq() < 0.01) {
    flow = root.clone().sub(surfaceCenter).setY(0).normalize();
  }
  if (flow.lengthSq() < 0.01) {
    flow = new THREE.Vector3(0, 0, 1).projectOnPlane(normal).normalize();
  }
  const side = new THREE.Vector3().crossVectors(flow, normal).normalize();
  const length = 1.28;
  const frame = { root, normal, flow, side, sideSign: Math.sign(root.x || 1), gravity: new THREE.Vector3(0, -1, 0), orientationStrength: 0 };
  const points = createPlacedPoints(frame, length);
  const placed = addLock("front", {
    x: root.x,
    y: root.y,
    z: root.z,
    length,
    curve: points.at(-1).x - root.x,
    width: 0.16,
    taper: 0.58,
    twist: strandCreationDefaults.twist,
    taperCurve: cloneShapePresetValue(strandCreationDefaults.taperCurve),
    depthCurve: cloneShapePresetValue(strandCreationDefaults.depthCurve),
    widthScale: strandCreationDefaults.widthScale,
    depthScale: strandCreationDefaults.depthScale,
    sweepProfile: cloneShapePresetValue(strandCreationDefaults.sweepProfile),
    profileOffset: strandCreationDefaults.profileOffset,
    color: DEFAULT_HAIR_COLOR,
    scalpRegion,
    rootScalpOffset: localRootOffset,
    rootSurfacePoint: hit.point,
    rootSurfaceNormal: normal,
    points
  });
  placed.placementFrame = frame;
  placed.placementFrame.root.copy(placed.points[0]);
  applyPlacedStrandScaleProfile(placed);
  updateLockGeometry(placed);
  pendingPlacedLockId = placed.id;
  syncActiveMirror(placed, { refreshUi: true });
  selectCurvePoint(placed.id, 0);
  return placed;
}

function placedPointCount(length) {
  return THREE.MathUtils.clamp(Math.round(length / 0.42) + 2, 3, 9);
}

function createPlacedPoints(frame, length, countOverride) {
  const count = countOverride ?? placedPointCount(length);
  const gravity = frame.gravity || new THREE.Vector3(0, -1, 0);
  const orientationStrength = frame.orientationStrength || 0;
  const surfaceSlide = frame.flow.clone().multiplyScalar(length * THREE.MathUtils.lerp(0.18, 0.38, orientationStrength));
  const sideCurl = frame.side.clone().multiplyScalar(frame.sideSign * Math.min(0.12, length * 0.035));
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0 : i / (count - 1);
    const fall = length * t * 0.92;
    const point = frame.root.clone()
      .add(gravity.clone().multiplyScalar(fall))
      .add(surfaceSlide.clone().multiplyScalar(1 - Math.exp(-t * 3.2)))
      .add(sideCurl.clone().multiplyScalar(t * t));
    points.push(i === 0 ? point : pushPointOutsideHead(point, frame.normal, 0.055 + t * 0.035));
  }
  return points;
}

function pushPointOutsideHead(point, fallbackNormal, margin) {
  const local = scalpSurfaceGroup.worldToLocal(point.clone());
  const direction = local.clone();
  if (direction.lengthSq() < 0.0001) {
    direction.set(
      fallbackNormal.x / Math.max(0.001, scalpSurfaceGroup.scale.x),
      fallbackNormal.y / Math.max(0.001, scalpSurfaceGroup.scale.y),
      fallbackNormal.z / Math.max(0.001, scalpSurfaceGroup.scale.z)
    );
  }
  direction.normalize();
  const activeGeometry = activeScalpSurfaceMesh().geometry;
  const position = activeGeometry.getAttribute("position");
  const sample = new THREE.Vector3();
  let bestAlignment = -Infinity;
  let surfaceRadius = 1;
  const activeIndices = activeScalpSurfaceMesh() === scalpSurfaceMesh
    ? scalpActiveVertexIndices
    : [...Array(position.count).keys()];
  for (const index of activeIndices) {
    sample.fromBufferAttribute(position, index);
    const alignment = sample.clone().normalize().dot(direction);
    if (alignment > bestAlignment) {
      bestAlignment = alignment;
      surfaceRadius = Math.max(0.05, sample.dot(direction));
    }
  }
  if (local.length() >= surfaceRadius) return point;
  const averageScale = (scalpSurfaceGroup.scale.x + scalpSurfaceGroup.scale.y + scalpSurfaceGroup.scale.z) / 3;
  return scalpSurfaceGroup.localToWorld(direction.multiplyScalar(surfaceRadius + margin / Math.max(0.001, averageScale)));
}

function resizePlacedStrand(lock, length, width, options = {}) {
  lock.length = length;
  lock.width = width;
  lock.baseWidth = width;
  lock.points = createPlacedPoints(lock.placementFrame, length, options.pointCount);
  fitPointAttributes(lock, lock.points.length);
  applyPlacedStrandScaleProfile(lock);
  syncLockFromCurve(lock);
  if (lock.curveObjects.handles.length !== lock.points.length) {
    rebuildCurveObjects(lock);
  }
  updateLockGeometry(lock);
  syncActiveMirror(lock);
  syncInputs(lock);
  selectCurvePoint(lock.id, Math.min(selectedPoint?.pointIndex || 0, lock.points.length - 1));
}

function applyPlacedStrandScaleProfile(lock) {
  lock.pointScales = lock.points.map(() => ({ x: 1, z: 1 }));
  lock.pointWidths = lock.pointScales.map(() => 1);
}

function beginPlaceEdit(lock, event, options = {}) {
  if (options.saveUndo !== false && !placeEdit) pushUndoState();
  placeEdit = {
    mode: "two-step",
    step: options.step || "direction",
    lockId: lock.id,
    startX: event.clientX,
    startY: event.clientY,
    baseLength: lock.length,
    baseWidth: lock.baseWidth,
    pointCount: lock.points.length,
    lastLength: lock.length,
    lastWidth: lock.baseWidth
  };
  updateInteractionLocks();
  updatePlacementStatus();
}

function updatePlaceEdit(event) {
  if (!placeEdit || proportionalSizeEdit) return;
  if (placementPointer?.isDown) return;
  const lock = locks.find((item) => item.id === placeEdit.lockId);
  if (!lock?.placementFrame) return;
  if (placeEdit.step === "direction") {
    updatePlacementOrientation(lock.placementFrame, event);
    resizePlacedStrand(lock, placeEdit.lastLength, placeEdit.lastWidth, { pointCount: placeEdit.pointCount });
    return;
  }
  updatePlacementLength(lock, event);
  event.preventDefault();
}

function updatePlacementLength(lock, event) {
  const dragDistance = Math.hypot(event.clientX - placeEdit.startX, event.clientY - placeEdit.startY);
  const length = THREE.MathUtils.clamp(0.38 + dragDistance / 115, 0.38, 3.4);
  const width = THREE.MathUtils.clamp(placeEdit.baseWidth * (0.85 + length / Math.max(0.1, placeEdit.baseLength) * 0.15), 0.045, 0.34);
  placeEdit.pointCount = placedPointCount(length);
  placeEdit.lastLength = length;
  placeEdit.lastWidth = width;
  resizePlacedStrand(lock, length, width, { pointCount: placeEdit.pointCount });
}

function updatePlacementOrientation(frame, event) {
  const dx = event.clientX - placeEdit.startX;
  const dy = event.clientY - placeEdit.startY;
  const dragDistance = Math.hypot(dx, dy);
  if (dragDistance < 8) return;

  const cameraRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const cameraUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const dragWorld = cameraRight.multiplyScalar(dx).add(cameraUp.multiplyScalar(-dy));
  const flow = dragWorld.projectOnPlane(frame.normal).normalize();
  if (flow.lengthSq() < 0.01) return;

  frame.flow.copy(flow);
  frame.side.crossVectors(frame.flow, frame.normal).normalize();
  frame.sideSign = Math.sign(frame.flow.x || frame.root.x || 1);
  frame.orientationStrength = THREE.MathUtils.clamp((dragDistance - 8) / 90, 0, 1);
}

function endPlaceEdit(event) {
  if (!placeEdit) return;
  if (placeEdit.mode === "two-step") return;
  const lock = locks.find((item) => item.id === placeEdit.lockId);
  if (lock?.placementFrame) {
    resizePlacedStrand(lock, placeEdit.lastLength, placeEdit.lastWidth);
  }
  if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
  placeEdit = null;
  updateInteractionLocks();
  updatePlacementStatus();
}

function confirmPendingPlacedStrand(options = {}) {
  if (!pendingPlacedLockId) return;
  const confirmedId = pendingPlacedLockId;
  pendingPlacedLockId = null;
  if (options.deselect && selectedId === confirmedId) {
    deselectStrands();
  }
  updatePlacementStatus();
}

function pendingPlacedLock() {
  return locks.find((lock) => lock.id === pendingPlacedLockId);
}

function beginPlacementPointer(event, headHit) {
  placementPointer = {
    isDown: true,
    startX: event.clientX,
    startY: event.clientY,
    startTime: performance.now(),
    headHit
  };
}

function finishPlacementPointer(event) {
  if (!placementPointer?.isDown) return false;
  const heldMs = performance.now() - placementPointer.startTime;
  const moved = Math.hypot(event.clientX - placementPointer.startX, event.clientY - placementPointer.startY);
  const isClick = heldMs < 280 && moved < 6;
  const headHit = placementPointer.headHit;
  placementPointer = null;
  if (!isClick) {
    updatePlacementStatus();
    return true;
  }
  if (placeEdit) {
    confirmPlacementStep(event);
    return true;
  }
  if (headHit) {
    pushUndoState();
    const placed = createPlacedStrand(headHit);
    beginPlaceEdit(placed, event, { saveUndo: false });
    return true;
  }
  return false;
}

function confirmPlacementStep(event) {
  if (!placeEdit) return false;
  const lock = locks.find((item) => item.id === placeEdit.lockId);
  if (!lock?.placementFrame) {
    finishPlacementFlow();
    return true;
  }
  if (placeEdit.step === "direction") {
    updatePlacementOrientation(lock.placementFrame, event);
    resizePlacedStrand(lock, placeEdit.lastLength, placeEdit.lastWidth, { pointCount: placeEdit.pointCount });
    placeEdit.step = "length";
    placeEdit.startX = event.clientX;
    placeEdit.startY = event.clientY;
    placeEdit.baseLength = lock.length;
    placeEdit.baseWidth = lock.baseWidth;
    updatePlacementStatus();
    return true;
  }
  updatePlacementLength(lock, event);
  finishPlacementFlow({ keepSelected: true });
  return true;
}

function finishPlacementFlow(options = {}) {
  const placedId = pendingPlacedLockId;
  placeEdit = null;
  pendingPlacedLockId = null;
  updateInteractionLocks();
  scheduleStrandCollisionResolve();
  if (options.deselect && selectedId === placedId) {
    deselectStrands();
  } else if (options.keepSelected && placedId) {
    selectLock(placedId);
  }
  updatePlacementStatus();
}

function updatePlacementStatus() {
  if (!placementStatus) return;
  let message = "";
  if (proportionalSizeEdit) {
    message = `Proportional influence: ${Number(proportionalRadiusInput.value).toFixed(1)}. Release B to finish.`;
  } else if (scalpBuilderEditing) {
    message = scalpBuilderCurveLattice
      ? "Scalp curve lattice: select a cyan point and use the gizmo to shape the cage. Hold Alt and drag to orbit."
      : "Loading the authored scalp curve lattice...";
  } else if (scalpLatticeEditing) {
    message = "Placement lattice: drag a cyan cage point, or select it for axis controls.";
  } else if (scalpPaintEditing) {
    message = `Paint ${SCALP_REGIONS[activeScalpRegion].label}: drag over the scalp. Hold Shift, Ctrl, or Alt to orbit.`;
  } else if (scalpShapeEditing) {
    message = "Placement shape: adjust the artist controls in the panel. Advanced lattice is optional.";
  } else if (activeTool === "place") {
    if (placeEdit?.step === "direction") {
      message = "Step 1 of 2: move the mouse to choose hair flow, click to confirm. Hold and drag to orbit.";
    } else if (placeEdit?.step === "length") {
      message = "Step 2 of 2: move the mouse to set length, click to finish. Hold and drag to orbit.";
    } else {
      message = selectedCurveLatticeGuide()
        ? "Place strand: click the selected curve lattice to set the root. Hold and drag to orbit."
        : "Place strand: click the scalp guide to set the root. Hold and drag to orbit.";
    }
  } else if (activeTool === "draw") {
    const drawLabel = drawStrandMode === "clump"
      ? "Draw 3 strand clump"
      : drawStrandMode === "coil" ? "Draw coil" : "Draw strand";
    const surfaceMode = activeStrokeSurfaceValue();
    if (surfaceMode === "contextual-plane") {
      message = `${drawLabel}: draw on the contextual 2D plane at the project origin. The closest view axis chooses its orientation.`;
    } else if (surfaceMode.endsWith("-conform")) {
      message = `${drawLabel}: drag across the selected surface. The stroke remains strictly conformed to it.`;
    } else {
      message = drawStrandStroke
        ? `${drawLabel}: drag across the live surface. Beyond its boundary, the stroke continues on the contextual 2D plane.`
        : `${drawLabel}: drag from the chosen live surface. Hold Shift, Ctrl, or Alt for viewport navigation.`;
    }
  } else if (activeTool === "braid") {
    const surfaceMode = activeStrokeSurfaceValue();
    if (!braidMeshPresets.has(braidMeshPresetInput.value)) {
      message = "Braid: loading the selected mesh preset...";
    } else if (surfaceMode === "contextual-plane") {
      message = "Draw braid: draw on the contextual 2D plane at the project origin. The closest view axis chooses its orientation.";
    } else if (surfaceMode.endsWith("-conform")) {
      message = "Draw braid: drag across the selected surface. The braid remains strictly conformed to it.";
    } else {
      message = drawStrandStroke
        ? "Draw braid: drag across the live surface. Beyond its boundary, the braid continues on the contextual 2D plane."
        : "Draw braid: drag a continuous braid path from the chosen live surface. Hold Shift, Ctrl, or Alt for viewport navigation.";
    }
  } else if (activeTool === "move" && selectedCurveLatticeGuide()) {
    message = selectedStrandGroup
      ? "Group curve: move a cyan control point to reshape every strand in the selected group."
      : "";
  } else if (pullMoveActive()) {
    message = "Pull strand: drag a curve point to pose the chain. The root stays planted and nearby points follow.";
  } else if (proportionalEditing) {
    message = "Proportional editing: tap B to toggle off, or hold B and drag to resize influence.";
  } else if (objectSpaceEditing && ["move", "rotate", "scale"].includes(activeTool)) {
    message = "Object space: gizmo is aligned to the selected curve point. Press O for world space.";
  }
  placementStatus.textContent = message;
  placementStatus.classList.toggle("hidden", !message);
}

function deselectStrands() {
  clearMultiPointSelection();
  selectedId = undefined;
  clumpViewportSelection = false;
  selectedStrandGroup = null;
  selectedGuideId = undefined;
  selectedPoint = null;
  selectedCurveLatticePoint = null;
  curveLatticeToggle.classList.remove("active");
  curveLatticeToggle.setAttribute("aria-pressed", "false");
  filterCurveLatticesToGroup(null);
  transformControls.detach();
  locks.forEach((lock) => {
    lock.mesh.material.emissive?.set(0x000000);
    updateCurveObjects(lock, { visible: false });
  });
  guides.forEach((guide) => {
    guide.mesh.material.color.set(guide.type === "curve-lattice" ? guide.color : 0x60707a);
    if (guide.type === "curve-lattice") guide.wire.material.color.set(guide.color);
    if (guide.rootMesh) guide.rootMesh.material.color.set(guide.color);
    if (guide.rootWire) guide.rootWire.material.color.set(guide.color);
    if (guide.bottomMesh) guide.bottomMesh.material.color.set(guide.color);
    if (guide.bottomWire) guide.bottomWire.material.color.set(guide.color);
    guide.mesh.material.opacity = Math.min(guide.opacity, 0.16);
    if (guide.rootMesh) guide.rootMesh.material.opacity = guide.mesh.material.opacity;
    if (guide.bottomMesh) guide.bottomMesh.material.opacity = guide.mesh.material.opacity;
    guide.wire.material.opacity = 0.25;
    if (guide.rootWire) guide.rootWire.material.opacity = 0.25;
    if (guide.bottomWire) guide.bottomWire.material.opacity = 0.25;
    if (guide.handlesGroup) guide.handlesGroup.visible = false;
  });
  renderLockList();
  updateAttributeEditorMode();
  updateGuideControlsVisibility();
  updateSelectedPointLabel();
  updateTopologyStats();
}

function beginSelectionMarquee(event, surface = null) {
  if (event.button !== 0 || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;
  selectionMarqueeDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY,
    surface,
    active: false
  };
  emptySelectionPointer = null;
  selectionMarquee.classList.add("hidden");
  updateInteractionLocks();
  return true;
}

function beginAltOrbit(event) {
  if (event.button !== 0 || !event.altKey) return;
  altOrbitDrag = { pointerId: event.pointerId };
  if (selectionMarqueeDrag) {
    selectionMarqueeDrag = null;
    selectionMarquee.classList.add("hidden");
  }
  updateInteractionLocks();
}

function prepareSelectPointerCapture(event) {
  if (activeTool !== "select" || event.button !== 0 || event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return;
  selectPointerCapture = { pointerId: event.pointerId };
  updateInteractionLocks();
}

function endSelectPointerCapture(event) {
  if (!selectPointerCapture || event.pointerId !== selectPointerCapture.pointerId) return;
  selectPointerCapture = null;
  updateInteractionLocks();
}

function endAltOrbit(event) {
  if (!altOrbitDrag || event.pointerId !== altOrbitDrag.pointerId) return;
  altOrbitDrag = null;
  updateInteractionLocks();
}

function updateSelectionMarquee(event) {
  if (!selectionMarqueeDrag || event.pointerId !== selectionMarqueeDrag.pointerId) return;
  selectionMarqueeDrag.currentX = event.clientX;
  selectionMarqueeDrag.currentY = event.clientY;
  const width = Math.abs(event.clientX - selectionMarqueeDrag.startX);
  const height = Math.abs(event.clientY - selectionMarqueeDrag.startY);
  if (!selectionMarqueeDrag.active && Math.hypot(width, height) < 6) return;
  selectionMarqueeDrag.active = true;
  const viewportRect = renderer.domElement.getBoundingClientRect();
  selectionMarquee.style.left = `${Math.min(event.clientX, selectionMarqueeDrag.startX) - viewportRect.left}px`;
  selectionMarquee.style.top = `${Math.min(event.clientY, selectionMarqueeDrag.startY) - viewportRect.top}px`;
  selectionMarquee.style.width = `${width}px`;
  selectionMarquee.style.height = `${height}px`;
  selectionMarquee.classList.remove("hidden");
  event.preventDefault();
}

function pointInsideSelectionMarquee(position, bounds, viewportRect) {
  const projected = position.clone().project(camera);
  if (projected.z < -1 || projected.z > 1) return false;
  const x = viewportRect.left + ((projected.x + 1) * 0.5 * viewportRect.width);
  const y = viewportRect.top + ((1 - projected.y) * 0.5 * viewportRect.height);
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

function selectPointsInMarquee(drag) {
  const bounds = {
    left: Math.min(drag.startX, drag.currentX),
    right: Math.max(drag.startX, drag.currentX),
    top: Math.min(drag.startY, drag.currentY),
    bottom: Math.max(drag.startY, drag.currentY)
  };
  const viewportRect = renderer.domElement.getBoundingClientRect();
  const matches = [];
  const lattice = selectedCurveLatticeGuide();
  if (lattice?.handlesGroup.visible) {
    lattice.handlesGroup.children.forEach((handle, pointIndex) => {
      if (handle.visible && pointInsideSelectionMarquee(handle.getWorldPosition(new THREE.Vector3()), bounds, viewportRect)) {
        matches.push({ type: "lattice", guideId: lattice.id, pointIndex });
      }
    });
  } else {
    const lock = getSelectedLock();
    if (lock?.curveObjects?.group.visible) {
      lock.curveObjects.handles.forEach((handle, pointIndex) => {
        if (handle.visible && pointInsideSelectionMarquee(handle.getWorldPosition(new THREE.Vector3()), bounds, viewportRect)) {
          matches.push({ type: "strand", lockId: lock.id, pointIndex });
        }
      });
    }
  }
  selectedControlPoints = matches;
  transformControls.detach();
  if (matches[0]?.type === "lattice") {
    selectedCurveLatticePoint = { guideId: matches[0].guideId, pointIndex: matches[0].pointIndex };
    selectedPoint = null;
  } else if (matches[0]?.type === "strand") {
    selectedPoint = { lockId: matches[0].lockId, pointIndex: matches[0].pointIndex };
    selectedCurveLatticePoint = null;
  } else {
    selectedPoint = null;
    selectedCurveLatticePoint = null;
  }
  guides.filter((guide) => guide.type === "curve-lattice").forEach(updateCurveLatticeHandleColors);
  locks.forEach((lock) => updateCurveObjects(lock, { visible: lock.id === selectedId }));
  updateSelectedPointLabel();
  updateViewPlaneGrid();
}

function finishSelectionMarquee(event, options = {}) {
  if (!selectionMarqueeDrag || event.pointerId !== selectionMarqueeDrag.pointerId) return;
  const drag = selectionMarqueeDrag;
  selectionMarqueeDrag = null;
  selectionMarquee.classList.add("hidden");
  updateInteractionLocks();
  if (options.cancel) return;
  if (drag.active) {
    selectPointsInMarquee(drag);
  } else if (drag.surface?.type === "guide") {
    selectGuide(drag.surface.hit.object.userData.guideId);
  } else if (drag.surface?.type === "strand") {
    selectLock(drag.surface.hit.object.userData.lockId);
  } else {
    deselectStrands();
  }
}

function headMeshes() {
  const meshes = [];
  guideModel?.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });
  return meshes;
}

function createCurveObjects(lock) {
  const group = new THREE.Group();
  group.userData.lockId = lock.id;
  const line = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xe7a95d, transparent: true, opacity: 0.78, depthTest: false })
  );
  line.renderOrder = 3;
  group.add(line);

  const handles = lock.points.map((point, index) => {
    const pointScale = lock.pointScales?.[index] || { x: 1, z: 1 };
    const frame = curveFrameAtPoint(lock, index);
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(index === 0 ? 0.065 : 0.052, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0x58f6ff, depthTest: false, transparent: true, opacity: 0.78 })
    );
    handle.position.copy(point);
    handle.quaternion.copy(frame.quaternion);
    handle.scale.set(pointScale.x || 1, 1, pointScale.z || 1);
    handle.renderOrder = 4;
    handle.userData.lockId = lock.id;
    handle.userData.pointIndex = index;
    group.add(handle);
    return handle;
  });
  const arrows = lock.points.map((point, index) => {
    const arrow = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x58f6ff, transparent: true, opacity: 0.95, depthTest: false })
    );
    arrow.position.copy(point);
    arrow.userData.lockId = lock.id;
    arrow.userData.pointIndex = index;
    arrow.renderOrder = 5;
    group.add(arrow);
    return arrow;
  });
  group.visible = false;
  return { group, line, handles, arrows };
}

function updateCurveObjects(lock, options = {}) {
  if (!lock.curveObjects) return;
  lock.curveObjects.line.material.color.set(lock.clumpGuide ? 0x58f6ff : 0xe7a95d);
  lock.curveObjects.line.geometry.dispose();
  const previewCurve = new THREE.CatmullRomCurve3(lock.points);
  lock.curveObjects.line.geometry = new THREE.BufferGeometry().setFromPoints(previewCurve.getPoints(40));
  lock.curveObjects.handles.forEach((handle, index) => {
    if (!lock.points[index]) {
      handle.visible = false;
      return;
    }
    handle.visible = true;
    const frame = curveFrameAtPoint(lock, index);
    const pointScale = lock.pointScales?.[index] || { x: lock.pointWidths[index] || 1, z: lock.pointWidths[index] || 1 };
    handle.position.copy(lock.points[index]);
    handle.quaternion.copy(frame.quaternion);
    const selectedHandle = (selectedPoint?.lockId === lock.id && selectedPoint.pointIndex === index)
      || controlPointIsSelected("strand", lock.id, index);
    handle.scale.set(pointScale.x || 1, 1, pointScale.z || 1);
    handle.material.color.set(handleColor(lock, index));
    const affectedHandle = isAffectedCurvePoint(lock, index);
    handle.material.opacity = selectedHandle ? 1 : affectedHandle ? 0.72 : 0.28;
  });
  lock.curveObjects.arrows.forEach((arrow, index) => {
    if (!lock.points[index]) {
      arrow.visible = false;
      return;
    }
    const frame = curveFrameAtPoint(lock, index);
    const scale = Math.max(frame.scale.x, frame.scale.z);
    arrow.geometry.dispose();
    arrow.geometry = createOutlineArrowGeometry(0.24 + scale * 0.16);
    arrow.position.copy(lock.points[index]);
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), frame.z);
    arrow.rotateY(Math.PI / 2);
    arrow.visible = lock.id === selectedId && activeTool === "rotate";
  });
  if ("visible" in options) lock.curveObjects.group.visible = options.visible;
}

function createOutlineArrowGeometry(length) {
  const shaft = length * 0.13;
  const head = length * 0.34;
  const headBase = length * 0.58;
  const points = [
    new THREE.Vector3(-shaft, 0, 0),
    new THREE.Vector3(shaft, 0, 0),
    new THREE.Vector3(shaft, headBase, 0),
    new THREE.Vector3(head, headBase, 0),
    new THREE.Vector3(0, length, 0),
    new THREE.Vector3(-head, headBase, 0),
    new THREE.Vector3(-shaft, headBase, 0),
    new THREE.Vector3(-shaft, 0, 0)
  ];
  return new THREE.BufferGeometry().setFromPoints(points);
}

function pointUpDirection(lock, pointIndex) {
  return curveFrameAtPoint(lock, pointIndex).z;
}

function curveFrameAtPoint(lock, pointIndex) {
  const t = lock.points.length <= 1 ? 0 : pointIndex / (lock.points.length - 1);
  const frame = curveFrameAt(lock, t);
  frame.scale = lock.pointScales?.[pointIndex] || { x: lock.pointWidths?.[pointIndex] || 1, z: lock.pointWidths?.[pointIndex] || 1 };
  return frame;
}

function curveFrameAt(lock, t, twistOverride) {
  const curve = new THREE.CatmullRomCurve3(lock.points);
  const clampedT = THREE.MathUtils.clamp(t, 0, 1);
  const point = curve.getPoint(clampedT);
  const tangent = curve.getTangent(clampedT).normalize();
  const normal = outwardNormalAtPoint(point, tangent);
  const twist = twistOverride ?? sampleArray(lock.pointTwists, t);
  const z = normal.applyAxisAngle(tangent, twist).normalize();
  const x = new THREE.Vector3().crossVectors(tangent, z).normalize();
  const y = tangent;
  const matrix = new THREE.Matrix4().makeBasis(x, y, z);
  return {
    x,
    y,
    z,
    quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix),
    scale: { x: sampleScale(lock.pointScales, t, "x"), z: sampleScale(lock.pointScales, t, "z") }
  };
}

function strandTwistAt(lock, t) {
  return sampleArray(lock.pointTwists, t) + Number(lock.twist || 0) * THREE.MathUtils.clamp(t, 0, 1);
}

function strandFrameAt(lock, t) {
  const frame = curveFrameAt(lock, t, strandTwistAt(lock, t));
  frame.scale = { x: sampleScale(lock.pointScales, t, "x"), z: sampleScale(lock.pointScales, t, "z") };
  return frame;
}

function curveFrameAtSnapshot(lock, points, pointTwists, pointIndex, twistOverride) {
  const t = points.length <= 1 ? 0 : pointIndex / (points.length - 1);
  const curve = new THREE.CatmullRomCurve3(points);
  const point = curve.getPoint(t);
  const tangent = curve.getTangent(t).normalize();
  const normal = outwardNormalAtPoint(point, tangent);
  const twist = twistOverride ?? sampleArray(pointTwists, t);
  const z = normal.applyAxisAngle(tangent, twist).normalize();
  const x = new THREE.Vector3().crossVectors(tangent, z).normalize();
  const y = tangent;
  const matrix = new THREE.Matrix4().makeBasis(x, y, z);
  return {
    x,
    y,
    z,
    quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix),
    scale: { x: sampleScale(lock.pointScales, t, "x"), z: sampleScale(lock.pointScales, t, "z") }
  };
}

function outwardNormalAtPoint(point, tangent) {
  const radial = point.clone();
  if (radial.lengthSq() < 0.0001) radial.set(0, 0, 1);
  radial.normalize();
  const normal = radial.projectOnPlane(tangent).normalize();
  if (normal.lengthSq() >= 0.01) return normal;

  const fallback = new THREE.Vector3(0, 0, 1).projectOnPlane(tangent).normalize();
  if (fallback.lengthSq() >= 0.01) return fallback;
  return new THREE.Vector3(1, 0, 0).projectOnPlane(tangent).normalize();
}

function twistFromHandle(lock, pointIndex, handle) {
  const t = lock.points.length <= 1 ? 0 : pointIndex / (lock.points.length - 1);
  const baseFrame = curveFrameAt(lock, t, 0);
  const handleZ = new THREE.Vector3(0, 0, 1).applyQuaternion(handle.quaternion).normalize();
  return signedAngleAroundAxis(baseFrame.z, handleZ, baseFrame.y);
}

function signedAngleAroundAxis(from, to, axis) {
  const a = from.clone().projectOnPlane(axis).normalize();
  const b = to.clone().projectOnPlane(axis).normalize();
  const cross = new THREE.Vector3().crossVectors(a, b);
  return Math.atan2(cross.dot(axis), a.dot(b));
}

function handleColor(lock, index) {
  const selectedLock = lock.id === selectedId;
  if (!selectedLock) return 0x476472;
  const selectedHandle = selectedPoint?.lockId === lock.id && selectedPoint.pointIndex === index;
  const hierarchyAffected = hierarchyEditing && selectedPoint?.lockId === lock.id && index > selectedPoint.pointIndex;
  const proportionalAffected = proportionalEditing && selectedPoint?.lockId === lock.id && proportionalWeight(index, selectedPoint.pointIndex) > 0;
  if (selectedHandle) return 0x58f6ff;
  if (hierarchyAffected) return 0xf0d95d;
  if (proportionalAffected) return 0x8affcf;
  if (activeTool === "relax") return 0x80ffcf;
  return 0x58f6ff;
}

function isAffectedCurvePoint(lock, index) {
  if (selectedPoint?.lockId !== lock.id) return false;
  if (hierarchyEditing && index > selectedPoint.pointIndex) return true;
  return proportionalEditing && proportionalWeight(index, selectedPoint.pointIndex) > 0;
}

function syncLockFromCurve(lock) {
  const first = lock.points[0];
  const last = lock.points.at(-1);
  if (lock.rootSurfacePoint && lock.rootSurfaceNormal) {
    const expectedRoot = lock.rootSurfacePoint.clone().addScaledVector(
      lock.rootSurfaceNormal,
      rootScalpOffsetDistance(lock.rootScalpOffset) + layerOffsetForLock(lock) * layerRootOffsetFactor(lock.hairLayer)
    );
    if (first.distanceToSquared(expectedRoot) > 0.000004) {
      lock.rootAttachment = createRootAttachment(lock, first);
      if (lock.rootAttachment) {
        lock.rootSurfacePoint = lock.rootAttachment.surfacePoint.clone();
        lock.rootSurfaceNormal = lock.rootAttachment.normal.clone();
      }
    }
  }
  syncRootAttachmentMetadata(lock);
  lock.x = first.x;
  lock.y = first.y;
  lock.z = first.z;
  lock.length = Math.max(0.35, first.distanceTo(last));
  lock.curve = (last.x - first.x) / 0.52;
}

function labelForPreset(name) {
  return document.querySelector(`#preset option[value="${name}"]`).textContent;
}

function strandCollisionRadius(lock, t) {
  const pointScales = lock.pointScales?.length ? lock.pointScales : lock.points.map(() => ({ x: 1, z: 1 }));
  const pointPosition = THREE.MathUtils.clamp(t, 0, 1) * Math.max(1, pointScales.length - 1);
  const leftIndex = Math.floor(pointPosition);
  const rightIndex = Math.min(pointScales.length - 1, leftIndex + 1);
  const amount = pointPosition - leftIndex;
  const leftScale = pointScales[leftIndex] || { x: 1, z: 1 };
  const rightScale = pointScales[rightIndex] || leftScale;
  const scaleX = THREE.MathUtils.lerp(Number(leftScale.x ?? 1), Number(rightScale.x ?? 1), amount);
  const scaleZ = THREE.MathUtils.lerp(Number(leftScale.z ?? 1), Number(rightScale.z ?? 1), amount);
  const width = strandRadiusAt(lock, t, "x") * scaleX;
  const depth = strandRadiusAt(lock, t, "z") * scaleZ;
  return Math.max(0.025, Math.max(width, depth) * 0.82);
}

function collisionSegments() {
  const segments = [];
  locks.forEach((lock) => {
    if (lock.geometryType === "braid" || !lock.mesh?.visible || lock.points.length < 2) return;
    for (let index = 0; index < lock.points.length - 1; index += 1) {
      const t = (index + 0.5) / (lock.points.length - 1);
      const radius = strandCollisionRadius(lock, t);
      const start = lock.points[index];
      const end = lock.points[index + 1];
      segments.push({
        lock,
        index,
        start,
        end,
        radius,
        min: new THREE.Vector3(
          Math.min(start.x, end.x) - radius,
          Math.min(start.y, end.y) - radius,
          Math.min(start.z, end.z) - radius
        ),
        max: new THREE.Vector3(
          Math.max(start.x, end.x) + radius,
          Math.max(start.y, end.y) + radius,
          Math.max(start.z, end.z) + radius
        )
      });
    }
  });
  return segments;
}

function addCollisionPointOffset(offsets, lock, pointIndex, direction, weight) {
  if (pointIndex <= 0 || weight <= 0.0001) return 0;
  let entry = offsets.get(lock.id);
  if (!entry) {
    entry = lock.points.map(() => ({ offset: new THREE.Vector3(), weight: 0 }));
    offsets.set(lock.id, entry);
  }
  entry[pointIndex].offset.addScaledVector(direction, weight);
  entry[pointIndex].weight += weight;
  return weight;
}

function resolveStrandCollisions({ iterations = 2 } = {}) {
  if (!strandCollisionEnabled || strandCollisionResolving) return;
  strandCollisionResolving = true;
  const changedLocks = new Set();
  try {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const segments = collisionSegments();
      const pairs = findSpatialCollisionPairs(segments);
      const offsets = new Map();
      pairs.forEach(([indexA, indexB]) => {
        const segmentA = segments[indexA];
        const segmentB = segments[indexB];
        const closest = closestPointsOnSegments(segmentA.start, segmentA.end, segmentB.start, segmentB.end);
        const separation = closest.pointA.clone().sub(closest.pointB);
        const distance = separation.length();
        const requiredDistance = segmentA.radius + segmentB.radius;
        if (distance >= requiredDistance) return;
        if (distance < 0.0001) {
          separation.copy(segmentA.end).sub(segmentA.start).cross(
            segmentB.end.clone().sub(segmentB.start)
          );
          if (separation.lengthSq() < 0.0001) {
            separation.copy(closest.pointA).add(closest.pointB).multiplyScalar(0.5).setY(0);
          }
          if (separation.lengthSq() < 0.0001) separation.set(1, 0, 0);
        }
        separation.normalize();
        const correction = Math.min(0.09, (requiredDistance - distance) * 0.58);
        const directionA = separation.clone().multiplyScalar(correction * 0.5);
        const directionB = separation.clone().multiplyScalar(-correction * 0.5);
        const movableA = addCollisionPointOffset(offsets, segmentA.lock, segmentA.index, directionA, 1 - closest.amountA)
          + addCollisionPointOffset(offsets, segmentA.lock, segmentA.index + 1, directionA, closest.amountA);
        const movableB = addCollisionPointOffset(offsets, segmentB.lock, segmentB.index, directionB, 1 - closest.amountB)
          + addCollisionPointOffset(offsets, segmentB.lock, segmentB.index + 1, directionB, closest.amountB);
        if (!movableA && movableB) {
          addCollisionPointOffset(offsets, segmentB.lock, segmentB.index, directionB, (1 - closest.amountB) * 2);
          addCollisionPointOffset(offsets, segmentB.lock, segmentB.index + 1, directionB, closest.amountB * 2);
        } else if (!movableB && movableA) {
          addCollisionPointOffset(offsets, segmentA.lock, segmentA.index, directionA, (1 - closest.amountA) * 2);
          addCollisionPointOffset(offsets, segmentA.lock, segmentA.index + 1, directionA, closest.amountA * 2);
        }
      });
      if (!offsets.size) break;
      offsets.forEach((entries, lockId) => {
        const lock = locks.find((item) => item.id === lockId);
        if (!lock) return;
        entries.forEach((entry, pointIndex) => {
          if (pointIndex === 0 || entry.weight <= 0) return;
          const offset = entry.offset.multiplyScalar(1 / entry.weight);
          if (offset.length() > 0.075) offset.setLength(0.075);
          lock.points[pointIndex].add(offset);
        });
        syncLockFromCurve(lock);
        changedLocks.add(lock);
      });
    }
    changedLocks.forEach((lock) => rebuildLockGeometry(lock));
    if (changedLocks.size) updateTopologyStats();
  } finally {
    strandCollisionResolving = false;
  }
}

function scheduleStrandCollisionResolve() {
  if (!strandCollisionEnabled || strandCollisionResolving || restoringHistory) return;
  if (strandCollisionFrame !== null) cancelAnimationFrame(strandCollisionFrame);
  strandCollisionFrame = requestAnimationFrame(() => {
    strandCollisionFrame = null;
    if (transformDragging || viewPlaneMoveDrag || relaxEdit || drawStrandStroke || placeEdit) return;
    resolveStrandCollisions({ iterations: 1 });
  });
}

function setStrandCollisionEnabled(enabled, options = {}) {
  strandCollisionEnabled = Boolean(enabled);
  strandCollisionToggle.classList.toggle("active", strandCollisionEnabled);
  strandCollisionToggle.setAttribute("aria-pressed", String(strandCollisionEnabled));
  const label = strandCollisionEnabled
    ? "Disable lightweight strand collision"
    : "Enable lightweight strand collision";
  strandCollisionToggle.title = label;
  strandCollisionToggle.setAttribute("aria-label", label);
  if (strandCollisionEnabled && options.resolve !== false) resolveStrandCollisions({ iterations: 3 });
}

function rebuildLockGeometry(lock) {
  const previousGeometry = lock.mesh.geometry;
  lock.mesh.geometry = createHairGeometry(lock);
  previousGeometry.dispose();
  if (hairTopologyVisible && lock.wireOverlay) {
    lock.wireOverlay.geometry.dispose();
    lock.wireOverlay.geometry = createHairTopologyGeometry(lock.mesh.geometry);
  }
  const showingProportionalRamp = proportionalEditing && selectedPoint?.lockId === lock.id;
  setAnimeHairBaseColor(lock.mesh.material, showingProportionalRamp ? 0xffffff : strandDisplayColor(lock));
  lock.mesh.material.side = lock.geometryType === "braid" ? THREE.DoubleSide : THREE.FrontSide;
  lock.mesh.material.needsUpdate = true;
  updateHairMaterialResponse(lock.mesh.material, materialForLock(lock).roughness);
  updateCurveObjects(lock);
  if (!clumpUpdateInProgress && lock.clumpGuide) updateClumpMembers(lock);
}

function flushPendingLockGeometryUpdates() {
  if (pendingLockGeometryFrame !== null) {
    cancelAnimationFrame(pendingLockGeometryFrame);
    pendingLockGeometryFrame = null;
  }
  const queuedLocks = [...pendingLockGeometryUpdates];
  pendingLockGeometryUpdates.clear();
  queuedLocks.forEach((lock) => {
    if (lock?.mesh && locks.includes(lock)) rebuildLockGeometry(lock);
  });
  if (queuedLocks.length) updateTopologyStats();
}

function updateLockGeometry(lock, options = {}) {
  if (!lock?.mesh) return;
  const deferUpdate = options.defer || transformDragging || viewPlaneMoveDrag || relaxEdit;
  if (deferUpdate && !options.immediate) {
    pendingLockGeometryUpdates.add(lock);
    if (pendingLockGeometryFrame === null) {
      pendingLockGeometryFrame = requestAnimationFrame(() => {
        pendingLockGeometryFrame = null;
        const queuedLocks = [...pendingLockGeometryUpdates];
        pendingLockGeometryUpdates.clear();
        queuedLocks.forEach((queuedLock) => {
          if (queuedLock?.mesh && locks.includes(queuedLock)) rebuildLockGeometry(queuedLock);
        });
        if (queuedLocks.length) updateTopologyStats();
      });
    }
    return;
  }
  rebuildLockGeometry(lock);
}

function setGroupColorView(enabled) {
  showGroupColors = Boolean(enabled);
  groupColorToggle.classList.toggle("active", showGroupColors);
  groupColorToggle.setAttribute("aria-pressed", String(showGroupColors));
  groupColorToggle.title = showGroupColors ? "Show default hair color" : "Show strand group colors";
  groupColorToggle.setAttribute("aria-label", groupColorToggle.title);
  locks.forEach((lock) => {
    const showingProportionalRamp = proportionalEditing && selectedPoint?.lockId === lock.id;
    setAnimeHairBaseColor(lock.mesh.material, showingProportionalRamp ? 0xffffff : strandDisplayColor(lock));
  });
  renderLockList();
}

function selectLock(id, options = {}) {
  const requestedLock = locks.find((lock) => lock.id === id);
  const requestedGuide = clumpGuideForLock(requestedLock);
  const selectWholeClump = Boolean(requestedLock?.clumpId && requestedGuide && !options.individualClumpMember);
  if (selectWholeClump) id = requestedGuide.id;
  clearMultiPointSelection();
  selectedId = id;
  clumpViewportSelection = selectWholeClump;
  selectedStrandGroup = null;
  selectedGuideId = undefined;
  selectedCurveLatticePoint = null;
  curveLatticeToggle.classList.remove("active");
  curveLatticeToggle.setAttribute("aria-pressed", "false");
  filterCurveLatticesToGroup(null);
  updateAttributeEditorMode();
  updateGuideControlsVisibility();
  const lock = getSelectedLock();
  guides.forEach((guide) => {
    guide.mesh.material.color.set(guide.type === "curve-lattice" ? guide.color : 0x60707a);
    if (guide.type === "curve-lattice") guide.wire.material.color.set(guide.color);
    if (guide.rootMesh) guide.rootMesh.material.color.set(guide.color);
    if (guide.rootWire) guide.rootWire.material.color.set(guide.color);
    if (guide.bottomMesh) guide.bottomMesh.material.color.set(guide.color);
    if (guide.bottomWire) guide.bottomWire.material.color.set(guide.color);
    guide.mesh.material.opacity = Math.min(guide.opacity, 0.16);
    if (guide.rootMesh) guide.rootMesh.material.opacity = guide.mesh.material.opacity;
    if (guide.bottomMesh) guide.bottomMesh.material.opacity = guide.mesh.material.opacity;
    guide.wire.material.opacity = 0.25;
    if (guide.rootWire) guide.rootWire.material.opacity = 0.25;
    if (guide.bottomWire) guide.bottomWire.material.opacity = 0.25;
    if (guide.handlesGroup) guide.handlesGroup.visible = false;
  });
  const selectedClumpId = clumpViewportSelection ? lock?.clumpId : null;
  locks.forEach((item) => {
    const inSelectedClump = selectedClumpId && item.clumpId === selectedClumpId;
    const emissive = item.id === id
      ? (inSelectedClump ? 0x164b53 : 0x2b1a08)
      : inSelectedClump ? 0x0d3036 : 0x000000;
    item.mesh.material.emissive?.set(emissive);
    if (item.mesh.material.emissiveIntensity !== undefined) {
      item.mesh.material.emissiveIntensity = inSelectedClump ? 0.72 : 1;
    }
  });
  locks.forEach((item) => updateCurveObjects(item, { visible: item.id === id }));
  if (!lock?.curveObjects?.handles.includes(transformControls.object)) {
    transformControls.detach();
    selectedPoint = null;
  }
  locks.forEach((item) => updateLockGeometry(item));
  if (!lock) return;
  syncInputs(lock);
  renderLockList();
  updateSelectedPointLabel();
}

function syncGroupInputs() {
  if (!selectedStrandGroup) return;
  const defaults = groupDefaultsFor(selectedStrandGroup);
  Object.entries(groupInputs).forEach(([key, input]) => {
    input.value = defaults[key];
  });
  topologyValues.groupRadialSegments.textContent = groupInputs.radialSegments.value;
  topologyValues.groupLengthSegments.textContent = groupInputs.lengthSegments.value;
  topologyValues.groupDensityAggression.textContent = Number(defaults.densityAggression ?? 0.5).toFixed(2);
  groupDynamicDensityInput.checked = Boolean(defaults.dynamicDensity);
  groupInputs.densityAggression.disabled = !defaults.dynamicDensity;
  HAIR_LAYERS.forEach((layer) => {
    const input = groupLayerInputs[layer.id];
    const value = Number(defaults.layerOffsets?.[layer.id] ?? layer.defaultOffset);
    input.value = value;
    document.querySelector(`#${input.id}Value`).textContent = value.toFixed(2);
  });
  document.querySelector("#groupWidthScaleValue").textContent = Number(defaults.widthScale ?? 1).toFixed(2);
  document.querySelector("#groupDepthScaleValue").textContent = Number(defaults.depthScale ?? 1).toFixed(2);
  document.querySelector("#groupRootScalpOffsetValue").textContent = Number(groupInputs.rootScalpOffset.value).toFixed(2);
  document.querySelector("#groupProfileOffsetValue").textContent = Number(defaults.profileOffset || 0).toFixed(2);
  renderProfilePreview(profilePreviewPaths.group, defaults.sweepProfile, defaults.profileOffset);
  renderTaperPreview(taperPreviewPaths.group, defaults.taperCurve);
  renderTaperPreview(taperPreviewPaths.groupDepth, defaults.depthCurve);
  const group = STRAND_GROUPS.find((item) => item.id === selectedStrandGroup);
  groupSettingsTitle.textContent = group?.label || "Group Settings";
  updateTopologyStats();
  syncShapePresetSelects();
}

function topologyStatsForLock(lock) {
  const geometry = lock?.mesh?.geometry;
  return {
    vertices: geometry?.getAttribute("position")?.count || 0,
    triangles: geometry?.getIndex() ? geometry.getIndex().count / 3 : (geometry?.getAttribute("position")?.count || 0) / 3
  };
}

function formatTopologyStats(vertices, triangles) {
  return `${Math.round(vertices).toLocaleString()} verts / ${Math.round(triangles).toLocaleString()} tris`;
}

function updateTopologyStats() {
  const selectedLock = getSelectedLock();
  const strandStats = topologyStatsForLock(selectedLock);
  strandTopologyStats.textContent = formatTopologyStats(strandStats.vertices, strandStats.triangles);
  viewportSelectedStats.textContent = selectedLock
    ? formatTopologyStats(strandStats.vertices, strandStats.triangles)
    : "-- verts / -- tris";

  const totalStats = locks.reduce((totals, lock) => {
    const stats = topologyStatsForLock(lock);
    totals.vertices += stats.vertices;
    totals.triangles += stats.triangles;
    return totals;
  }, { vertices: 0, triangles: 0 });
  viewportTotalStats.textContent = formatTopologyStats(totalStats.vertices, totalStats.triangles);

  const groupStats = locks
    .filter((lock) => (lock.scalpRegion || "unassigned") === selectedStrandGroup)
    .reduce((totals, lock) => {
      const stats = topologyStatsForLock(lock);
      totals.vertices += stats.vertices;
      totals.triangles += stats.triangles;
      return totals;
    }, { vertices: 0, triangles: 0 });
  groupTopologyStats.textContent = formatTopologyStats(groupStats.vertices, groupStats.triangles);
}

function normalizeBraidDimensions(target) {
  if (!target || (target !== braidCreationDefaults && target.geometryType !== "braid")) return target;
  target.braidWidth = Number(target.braidWidth ?? target.width ?? 0.34) * Number(target.widthScale ?? 1);
  target.braidDepth = Number(target.braidDepth ?? 0.44) * Number(target.depthScale ?? 1);
  target.widthScale = 1;
  target.depthScale = 1;
  if (target.geometryType === "braid") {
    target.width = target.braidWidth;
    target.baseWidth = target.braidWidth;
  }
  return target;
}

function normalizeStrandWidth(target) {
  if (!target || target === braidCreationDefaults || target.geometryType === "braid") return target;
  const widthScale = Number(target.widthScale ?? 1);
  if (Math.abs(widthScale - 1) < 1e-6) return target;
  const width = Number(target.width ?? 0.16);
  target.width = width * widthScale;
  target.baseWidth = Number(target.baseWidth ?? width) * widthScale;
  target.widthScale = 1;
  return target;
}

function syncShapeDimensionInputs(target) {
  const braidTarget = target === braidCreationDefaults || target?.geometryType === "braid";
  if (braidTarget) {
    normalizeBraidDimensions(target);
    if (target?.geometryType === "braid") normalizeBraidDimensions(mirrorPartnerFor(target));
    widthScaleLabel.textContent = "Width";
    depthScaleLabel.textContent = "Depth";
    inputs.widthScale.min = braidWidthInput.min;
    inputs.widthScale.max = braidWidthInput.max;
    inputs.depthScale.min = braidDepthInput.min;
    inputs.depthScale.max = braidDepthInput.max;
    inputs.widthScale.value = target.braidWidth;
    inputs.depthScale.value = target.braidDepth;
    document.querySelector("#widthScaleValue").textContent = Number(target.braidWidth).toFixed(2);
    document.querySelector("#depthScaleValue").textContent = Number(target.braidDepth).toFixed(2);
    braidWidthInput.value = target.braidWidth;
    braidDepthInput.value = target.braidDepth;
    braidWidthValue.textContent = Number(target.braidWidth).toFixed(2);
    braidDepthValue.textContent = Number(target.braidDepth).toFixed(2);
    return;
  }
  normalizeStrandWidth(target);
  if (target?.geometryType !== "braid") normalizeStrandWidth(mirrorPartnerFor(target));
  widthScaleLabel.textContent = "Width";
  depthScaleLabel.textContent = "Depth";
  inputs.widthScale.min = "0.1";
  inputs.widthScale.max = "3";
  inputs.depthScale.min = "0.1";
  inputs.depthScale.max = "3";
  inputs.widthScale.value = Number(target?.widthScale ?? 1);
  inputs.depthScale.value = Number(target?.depthScale ?? 1);
  document.querySelector("#widthScaleValue").textContent = Number(target?.widthScale ?? 1).toFixed(2);
  document.querySelector("#depthScaleValue").textContent = Number(target?.depthScale ?? 1).toFixed(2);
}

function syncCreationShapeInputs() {
  const defaults = activeCreationShapeDefaults();
  strandLayerInput.value = normalizeHairLayer(defaults.hairLayer);
  renderTaperPreview(taperPreviewPaths.strand, defaults.taperCurve);
  renderTaperPreview(taperPreviewPaths.strandDepth, defaults.depthCurve);
  renderProfilePreview(profilePreviewPaths.strand, defaults.sweepProfile, defaults.profileOffset);
  syncShapeDimensionInputs(defaults);
  inputs.profileOffset.value = defaults.profileOffset;
  document.querySelector("#profileOffsetValue").textContent = Number(defaults.profileOffset).toFixed(2);
  inputs.rootScalpOffset.value = defaults.rootScalpOffset;
  document.querySelector("#rootScalpOffsetValue").textContent = Number(defaults.rootScalpOffset).toFixed(2);
  inputs.twist.value = THREE.MathUtils.clamp(defaults.twist, Number(inputs.twist.min), Number(inputs.twist.max));
  twistNumberInput.value = Number(defaults.twist).toFixed(2);
  if (defaults === strandCreationDefaults) {
    drawStrandBrushSizeInput.value = defaults.width;
    drawStrandBrushSizeValue.textContent = Number(defaults.width).toFixed(2);
    drawStrandCurlCountInput.value = defaults.curlCount;
    drawStrandCurlDisplacementInput.value = defaults.curlDisplacement;
    drawStrandCurlCountValue.textContent = Number(defaults.curlCount).toFixed(2);
    drawStrandCurlDisplacementValue.textContent = Number(defaults.curlDisplacement).toFixed(2);
  }
  if (defaults === braidCreationDefaults) {
    braidMeshPresetInput.value = defaults.braidMeshPreset;
    braidSegmentLengthInput.value = defaults.braidSegmentLength;
    braidRotationInput.value = defaults.braidRotation;
    braidSegmentLengthValue.textContent = Number(defaults.braidSegmentLength).toFixed(2);
    braidRotationValue.textContent = `${Math.round(Number(defaults.braidRotation))} deg`;
  }
  syncShapePresetSelects();
}

function updateAttributeEditorMode() {
  const editingGroup = Boolean(selectedStrandGroup);
  const editingStrand = Boolean(getSelectedLock());
  const editingSelection = editingGroup || editingStrand;
  const editingCreationShape = creationToolActive() && !editingStrand;
  const selectedBraid = getSelectedLock()?.geometryType === "braid" ? getSelectedLock() : null;
  const selectedCoil = getSelectedLock()?.geometryType !== "braid" && getSelectedLock()?.curlEnabled
    ? getSelectedLock()
    : null;
  const transformToolActive = ["move", "rotate", "scale"].includes(activeTool);
  const hierarchyToolActive = ["move", "rotate", "scale"].includes(activeTool) && !pullMoveActive();
  const proportionalToolActive = hierarchyToolActive || activeTool === "relax";
  groupSettingsPanel.classList.toggle("hidden", !editingGroup);
  guidePanel.classList.toggle("hidden", editingSelection);
  presetPanel.classList.add("hidden");
  selectedStrandPanel.classList.toggle("hidden", !editingStrand);
  if (!editingStrand) clumpGuidePanel.classList.add("hidden");
  hairMaterialPanel.classList.toggle("hidden", !editingStrand);
  strandTopologyPanel.classList.toggle("hidden", !editingStrand);
  transformToolPanel.classList.toggle("hidden", !transformToolActive);
  drawStrandToolPanel.classList.toggle("hidden", activeTool !== "draw");
  braidToolPanel.classList.toggle("hidden", activeTool !== "braid");
  strandShapePanel.classList.toggle(
    "braid-context",
    Boolean(selectedBraid) || (!editingStrand && activeTool === "braid")
  );
  strandShapePanel.classList.remove("draw-context");
  if (selectedCoil) {
    drawStrandCurlCountInput.value = Number(selectedCoil.curlCount ?? 4);
    drawStrandCurlDisplacementInput.value = Number(selectedCoil.curlDisplacement ?? 0.18);
    drawStrandCurlCountValue.textContent = Number(selectedCoil.curlCount ?? 4).toFixed(2);
    drawStrandCurlDisplacementValue.textContent = Number(selectedCoil.curlDisplacement ?? 0.18).toFixed(2);
    drawStrandCurlCountInput.disabled = false;
    drawStrandCurlDisplacementInput.disabled = false;
  }
  if (selectedBraid) {
    const braid = selectedBraid;
    braidMeshPresetInput.value = braid.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET;
    braidWidthInput.value = braid.braidWidth;
    braidDepthInput.value = braid.braidDepth;
    braidSegmentLengthInput.value = braid.braidSegmentLength;
    braidRotationInput.value = braid.braidRotation;
    braidWidthValue.textContent = Number(braid.braidWidth).toFixed(2);
    braidDepthValue.textContent = Number(braid.braidDepth).toFixed(2);
    braidSegmentLengthValue.textContent = Number(braid.braidSegmentLength).toFixed(2);
    braidRotationValue.textContent = `${Math.round(Number(braid.braidRotation))} deg`;
  } else if (editingStrand) {
    const strand = getSelectedLock();
    const width = Number(strand?.width ?? strand?.baseWidth ?? 0.16);
    drawStrandBrushSizeInput.value = width;
    drawStrandBrushSizeValue.textContent = width.toFixed(2);
  }
  transformToolTitle.textContent = `${activeTool[0].toUpperCase()}${activeTool.slice(1)} Tool`;
  pullMoveSetting.classList.toggle("hidden", activeTool !== "move");
  pullRigiditySetting.classList.toggle("hidden", activeTool !== "move" || !pullMoveEnabled);
  pullCollisionSetting.classList.toggle("hidden", activeTool !== "move" || !pullMoveEnabled);
  viewPlaneMoveSetting.classList.toggle("hidden", activeTool !== "move");
  viewPlaneMoveSnappedSetting.classList.toggle("hidden", activeTool !== "move");
  placeStrandToolPanel.classList.toggle("hidden", activeTool !== "place");
  proportionalPanel.classList.toggle(
    "hidden",
    !((editingStrand && proportionalToolActive) || (scalpBuilderEditing && proportionalEditing))
  );
  proportionalLockRootRow.classList.toggle("hidden", scalpBuilderEditing);
  hierarchyPanel.classList.toggle("hidden", !editingStrand || !hierarchyToolActive || !hierarchyEditing);
  strandShapePanel.classList.toggle("hidden", !editingStrand && !editingCreationShape);
  strandShapeTitle.textContent = editingCreationShape
    ? (activeTool === "braid" ? "Braid Shape" : "Strand Shape")
    : (selectedBraid ? "Braid Shape" : "Strand Shape");
  if (editingCreationShape) syncCreationShapeInputs();
  pinActiveToolSettingsPanel();
}

function pinActiveToolSettingsPanel() {
  document.querySelectorAll(".tool-panel > .active-tool-settings").forEach((item) => {
    item.classList.remove("active-tool-settings");
  });
  let panel = null;
  if (scalpPaintEditing) panel = scalpPaintPanel;
  else if (headSetupEditing) panel = headPanel;
  else if (scalpBuilderEditing) panel = scalpBuilderPanel;
  else if (scalpShapeEditing) panel = scalpPanel;
  else if (activeTool === "draw") panel = drawStrandToolPanel;
  else if (activeTool === "braid") panel = braidToolPanel;
  else if (["move", "rotate", "scale"].includes(activeTool)) panel = transformToolPanel;
  if (panel && !panel.classList.contains("hidden")) {
    panel.classList.add("active-tool-settings");
    panel.parentElement?.prepend(panel);
  }
}

function curveLatticeForGroup(region, createIfMissing = false) {
  if (!CURVE_LATTICE_FEATURE_ENABLED && !GROUP_CURVE_FEATURE_ENABLED) return null;
  let guide = guides.find((item) => item.type === "curve-lattice" && item.scalpRegion === region);
  if (!guide && createIfMissing && region !== "unassigned") {
    const columns = 3;
    const rows = region === "bangs" ? 3 : 4;
    guide = addCurveLattice({
      columns,
      rows,
      scalpRegion: region,
      color: SCALP_REGIONS[region]?.color ?? SCALP_REGIONS.bangs.color,
      points: curveLatticePointsForScalpRegion(region, columns, rows)
    }, { deferUi: true });
    updateCount();
  }
  return guide || null;
}

function filterCurveLatticesToGroup(selectedGuideId = null) {
  const filtering = Boolean(selectedGuideId);
  guides.filter((guide) => guide.type === "curve-lattice").forEach((guide) => {
    const latticeVisible = CURVE_LATTICE_FEATURE_ENABLED && (!filtering || guide.id === selectedGuideId);
    const groupCurveVisible = GROUP_CURVE_FEATURE_ENABLED
      && Boolean(selectedStrandGroup)
      && guide.id === selectedGuideId;
    guide.viewportGroupVisible = latticeVisible;
    guide.mesh.visible = latticeVisible;
    guide.wire.visible = latticeVisible;
    if (guide.rootMesh) guide.rootMesh.visible = latticeVisible;
    if (guide.rootWire) guide.rootWire.visible = latticeVisible;
    if (guide.bottomMesh) guide.bottomMesh.visible = latticeVisible && guide.bottomExtrude > 0.001;
    if (guide.bottomWire) guide.bottomWire.visible = latticeVisible && guide.bottomExtrude > 0.001;
    ensureGroupCurveDisplay(guide).visible = groupCurveVisible;
    if (guide.handlesGroup) {
      guide.handlesGroup.visible = groupCurveVisible || (latticeVisible && guide.id === selectedGuideId);
      if (groupCurveVisible) {
        const visibleIndices = new Set(groupCurveControlIndices(guide));
        guide.handlesGroup.children.forEach((handle, index) => {
          handle.visible = visibleIndices.has(index);
        });
      }
    }
  });
}

function showCurveLatticeForGroup(region) {
  const guide = curveLatticeForGroup(region, true);
  selectedGuideId = guide?.id;
  activeCurveLatticeGuideId = guide?.id || activeCurveLatticeGuideId;
  selectedCurveLatticePoint = null;
  curveLatticeToggle.classList.toggle("active", Boolean(guide));
  curveLatticeToggle.setAttribute("aria-pressed", String(Boolean(guide)));
  filterCurveLatticesToGroup(guide?.id || null);
  guides.forEach((item) => {
    const selected = item.id === guide?.id;
    if (item.type === "curve-lattice") {
      const displayColor = new THREE.Color(item.color);
      if (selected) displayColor.lerp(new THREE.Color(0xffffff), 0.18);
      item.mesh.material.color.copy(displayColor);
      item.wire.material.color.copy(displayColor);
      item.rootMesh?.material.color.copy(displayColor);
      item.rootWire?.material.color.copy(displayColor);
      item.bottomMesh?.material.color.copy(displayColor);
      item.bottomWire?.material.color.copy(displayColor);
    }
    item.mesh.material.opacity = selected ? item.opacity : Math.min(item.opacity, 0.16);
    if (item.rootMesh) item.rootMesh.material.opacity = item.mesh.material.opacity;
    if (item.bottomMesh) item.bottomMesh.material.opacity = item.mesh.material.opacity;
    item.wire.material.opacity = selected ? 0.7 : 0.25;
    if (item.rootWire) item.rootWire.material.opacity = item.wire.material.opacity;
    if (item.bottomWire) item.bottomWire.material.opacity = item.wire.material.opacity;
    if (item.handlesGroup) {
      item.handlesGroup.visible = selected
        && (item.viewportGroupVisible !== false || (GROUP_CURVE_FEATURE_ENABLED && Boolean(selectedStrandGroup)));
    }
  });
  if (guide) syncGuideInputs(guide);
  updateGuideControlsVisibility();
  updatePlacementStatus();
}

function selectStrandGroup(region) {
  if (!strandGroupDefaults[region]) return;
  if (selectedStrandGroup === region) {
    selectedStrandGroup = null;
    selectedGuideId = undefined;
    selectedCurveLatticePoint = null;
    transformControls.detach();
    guides.forEach((guide) => {
      if (guide.handlesGroup) guide.handlesGroup.visible = false;
    });
    filterCurveLatticesToGroup(null);
    curveLatticeToggle.classList.remove("active");
    curveLatticeToggle.setAttribute("aria-pressed", "false");
    updateAttributeEditorMode();
    updateGuideControlsVisibility();
    updatePlacementStatus();
    renderLockList();
    return;
  }
  selectedStrandGroup = region;
  clearMultiPointSelection();
  selectedId = undefined;
  clumpViewportSelection = false;
  selectedPoint = null;
  transformControls.detach();
  locks.forEach((lock) => {
    lock.mesh.material.emissive?.set(0x000000);
    updateCurveObjects(lock, { visible: false });
  });
  showCurveLatticeForGroup(region);
  syncGroupInputs();
  updateAttributeEditorMode();
  updateGuideControlsVisibility();
  updateSelectedPointLabel();
  renderLockList();
}

function selectCurvePoint(lockId, pointIndex, preserveMulti = false) {
  selectedPoint = { lockId, pointIndex };
  selectedCurveLatticePoint = null;
  if (!preserveMulti) selectedControlPoints = [{ type: "strand", lockId, pointIndex }];
  updateSelectedPointLabel();
  locks.forEach((lock) => {
    if (proportionalEditing) updateLockGeometry(lock);
    updateCurveObjects(lock, { visible: lock.id === selectedId });
  });
  updateViewPlaneGrid();
}

function navigateCurvePointHierarchy(offset) {
  const lock = selectedPoint
    ? locks.find((item) => item.id === selectedPoint.lockId)
    : getSelectedLock();
  if (!lock) return;
  const pointIndex = selectedPoint
    ? THREE.MathUtils.clamp(selectedPoint.pointIndex + offset, 0, lock.points.length - 1)
    : offset < 0 ? 0 : lock.points.length - 1;
  if (pointIndex === selectedPoint?.pointIndex) return;

  transformControls.detach();
  selectCurvePoint(lock.id, pointIndex);
  if (!["move", "rotate", "scale"].includes(activeTool)) return;

  const handle = lock.curveObjects?.handles[pointIndex];
  if (!handle) return;
  if (activeTool === "move" && viewPlaneMoveActiveForView()) {
    updateViewPlaneGrid();
    return;
  }
  configureTransformControls(activeTool);
  attachTransformForCurvePoint(lock, pointIndex, handle);
}

function updateSelectedPointLabel() {
  if (!selectedPointLabel) return;
  selectedPointLabel.textContent = selectedControlPoints.length > 1
    ? `${selectedControlPoints.length} selected`
    : selectedPoint
      ? String(selectedPoint.pointIndex + 1)
      : selectedCurveLatticePoint
        ? String(selectedCurveLatticePoint.pointIndex + 1)
        : "None";
  hierarchyNavigationHint?.classList.toggle("hidden", !getSelectedLock());
}

function syncInputs(lock) {
  inputs.name.value = lock.name;
  strandLayerInput.value = normalizeHairLayer(lock.hairLayer);
  syncHairMaterialEditor(lock);
  renderTaperPreview(taperPreviewPaths.strand, lock.taperCurve);
  renderTaperPreview(taperPreviewPaths.strandDepth, lock.depthCurve);
  syncShapeDimensionInputs(lock);
  inputs.rootScalpOffset.value = lock.rootScalpOffset ?? 0;
  document.querySelector("#rootScalpOffsetValue").textContent = Number(lock.rootScalpOffset ?? 0).toFixed(2);
  inputs.profileOffset.value = lock.profileOffset ?? 0;
  document.querySelector("#profileOffsetValue").textContent = Number(lock.profileOffset ?? 0).toFixed(2);
  inputs.twist.value = lock.twist;
  twistNumberInput.value = Number(lock.twist || 0).toFixed(2);
  inputs.radialSegments.value = lock.radialSegments;
  inputs.lengthSegments.value = lock.lengthSegments;
  inputs.densityAggression.value = lock.densityAggression ?? 0.5;
  strandDynamicDensityInput.checked = Boolean(lock.dynamicDensity);
  inputs.densityAggression.disabled = !lock.dynamicDensity;
  topologyValues.strandRadialSegments.textContent = inputs.radialSegments.value;
  topologyValues.strandLengthSegments.textContent = inputs.lengthSegments.value;
  topologyValues.strandDensityAggression.textContent = Number(lock.densityAggression ?? 0.5).toFixed(2);
  renderProfilePreview(profilePreviewPaths.strand, lock.sweepProfile, lock.profileOffset);
  updateTopologyStats();
  syncShapePresetSelects();
  syncClumpGuidePanel(lock);
}

function syncClumpGuidePanel(lock = getSelectedLock()) {
  const guide = clumpGuideForLock(lock);
  const inClump = Boolean(lock?.clumpId && guide);
  clumpGuidePanel.classList.toggle("hidden", !inClump);
  if (!inClump) return;
  const memberCount = clumpMembersForGuide(guide).length;
  const influence = THREE.MathUtils.clamp(Number(guide.clumpInfluence ?? 1), 0, 1);
  initializeClumpShape(guide);
  clumpGuideStatus.textContent = lock.clumpGuide
    ? `${lock.clumpName || "Clump"} guide - ${memberCount} bound ${memberCount === 1 ? "strand" : "strands"}`
    : `${lock.clumpName || "Clump"} member - driven by ${guide.name}`;
  clumpInfluenceControl.classList.toggle("hidden", !lock.clumpGuide);
  clumpShapeControls.classList.toggle("hidden", !lock.clumpGuide);
  clumpInfluenceInput.value = influence;
  clumpInfluenceValue.textContent = influence.toFixed(2);
  Object.entries(clumpShapeInputs).forEach(([key, input]) => {
    input.value = guide[`clump${key[0].toUpperCase()}${key.slice(1)}`];
  });
  clumpShapeValues.spread.textContent = guide.clumpSpread.toFixed(2);
  clumpShapeValues.depthSpread.textContent = guide.clumpDepthSpread.toFixed(2);
  clumpShapeValues.tipFan.textContent = guide.clumpTipFan.toFixed(2);
  clumpShapeValues.roll.textContent = `${Math.round(guide.clumpRoll)}°`;
  clumpShapeValues.strandWidth.textContent = guide.clumpStrandWidth.toFixed(2);
  clumpShapeValues.strandDepth.textContent = guide.clumpStrandDepth.toFixed(2);
  clumpShapeValues.variation.textContent = guide.clumpVariation.toFixed(2);
}

function getSelectedLock() {
  return locks.find((lock) => lock.id === selectedId);
}

function hideOutlinerContextMenu() {
  outlinerContextTarget = null;
  clumpContextMenu.classList.add("hidden");
}

function showOutlinerContextMenu(event, target) {
  event.preventDefault();
  event.stopPropagation();
  outlinerContextTarget = target;
  const isClump = target.type === "clump";
  dissolveClumpAction.classList.toggle("hidden", !isClump);
  deleteOutlinerAction.textContent = isClump ? "Delete clump" : "Delete strand";
  clumpContextMenu.setAttribute("aria-label", isClump ? "Clump actions" : "Strand actions");
  clumpContextMenu.classList.remove("hidden");
  const margin = 8;
  const left = Math.min(event.clientX, window.innerWidth - clumpContextMenu.offsetWidth - margin);
  const top = Math.min(event.clientY, window.innerHeight - clumpContextMenu.offsetHeight - margin);
  clumpContextMenu.style.left = `${Math.max(margin, left)}px`;
  clumpContextMenu.style.top = `${Math.max(margin, top)}px`;
  clumpContextMenu.querySelector("button:not(.hidden)")?.focus();
}

function outlinerClumpLocks(guide) {
  return guide?.clumpGuide ? [guide, ...clumpMembersForGuide(guide)] : [];
}

function handleOutlinerClumpDrop(event, targetLock) {
  event.preventDefault();
  event.stopPropagation();
  const sourceId = event.dataTransfer?.getData("text/plain");
  const source = locks.find((lock) => lock.id === sourceId);
  const targetGuide = clumpGuideForLock(targetLock);
  if (!source || !targetLock || source.id === targetLock.id) return;
  if (source.clumpGuide) return;
  if (targetGuide && source.clumpId === targetGuide.clumpId) return;
  pushUndoState();
  let guide = targetGuide;
  if (guide) {
    if (!addLockToClump(source, guide)) return;
  } else {
    if (source.clumpId) detachLockFromClump(source);
    guide = createClumpFromLocks([targetLock, source]);
  }
  if (!guide) return;
  clumpOpen.set(guide.clumpId, false);
  selectLock(guide.id);
  renderLockList();
}

function createOutlinerStrandButton(lock, options = {}) {
  const button = document.createElement("button");
  const selectedLock = getSelectedLock();
  const clumpHighlighted = clumpViewportSelection
    && selectedLock?.clumpId
    && lock.clumpId === selectedLock.clumpId;
  button.className = `lock-item${options.nested ? " clump-child" : ""}${lock.id === selectedId || clumpHighlighted ? " active" : ""}`;
  button.type = "button";
  button.draggable = !lock.clumpGuide;
  button.title = lock.clumpGuide ? "Clump parent strand" : "Drag onto another strand or clump to group";
  const swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.style.background = new THREE.Color(strandDisplayColor(lock)).getStyle();
  const name = document.createElement("span");
  name.textContent = lock.name;
  button.append(swatch, name);
  if (lock.clumpGuide) {
    button.classList.add("clump-guide-item");
    const badge = document.createElement("span");
    badge.className = "clump-guide-badge";
    badge.textContent = "Parent";
    button.appendChild(badge);
  }
  button.addEventListener("click", () => selectLock(lock.id, {
    individualClumpMember: Boolean(lock.clumpId && !lock.clumpGuide)
  }));
  button.addEventListener("contextmenu", (event) => showOutlinerContextMenu(event, {
    type: "strand",
    lockId: lock.id
  }));
  button.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", lock.id);
    event.dataTransfer.effectAllowed = "move";
    button.classList.add("dragging");
  });
  button.addEventListener("dragend", () => button.classList.remove("dragging"));
  button.addEventListener("dragover", (event) => {
    if (!event.dataTransfer.types.includes("text/plain")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    button.classList.add("drop-target");
  });
  button.addEventListener("dragleave", () => button.classList.remove("drop-target"));
  button.addEventListener("drop", (event) => {
    button.classList.remove("drop-target");
    handleOutlinerClumpDrop(event, lock);
  });
  return button;
}

function createOutlinerClump(guide) {
  const clumpLocks = outlinerClumpLocks(guide);
  const isOpen = clumpOpen.get(guide.clumpId) === true;
  const selectedLock = getSelectedLock();
  const containsSelection = Boolean(
    selectedLock && clumpLocks.some((lock) => lock.id === selectedLock.id)
  );
  const container = document.createElement("div");
  container.className = `outliner-clump${isOpen ? " open" : ""}${containsSelection ? " selected" : ""}`;
  const header = document.createElement("div");
  header.className = "outliner-clump-head";
  header.title = "Clump container";
  const disclosure = document.createElement("button");
  disclosure.type = "button";
  disclosure.className = "outliner-clump-disclosure";
  disclosure.textContent = ">";
  disclosure.title = `${isOpen ? "Collapse" : "Expand"} ${guide.clumpName || "clump"}`;
  disclosure.setAttribute("aria-expanded", String(isOpen));
  disclosure.addEventListener("click", () => {
    clumpOpen.set(guide.clumpId, !isOpen);
    renderLockList();
  });
  const select = document.createElement("button");
  select.type = "button";
  select.className = "outliner-clump-select";
  const folderIcon = document.createElement("span");
  folderIcon.className = "outliner-folder-icon";
  folderIcon.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = guide.clumpName || "Clump";
  const count = document.createElement("span");
  count.className = "outliner-clump-count";
  count.textContent = clumpLocks.length;
  select.append(folderIcon, label, count);
  select.addEventListener("click", () => selectLock(guide.id));
  [header, select].forEach((target) => {
    target.addEventListener("dragover", (event) => {
      if (!event.dataTransfer.types.includes("text/plain")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      header.classList.add("drop-target");
    });
    target.addEventListener("dragleave", () => header.classList.remove("drop-target"));
    target.addEventListener("drop", (event) => {
      header.classList.remove("drop-target");
      handleOutlinerClumpDrop(event, guide);
    });
  });
  header.append(disclosure, select);
  header.addEventListener("contextmenu", (event) => showOutlinerContextMenu(event, {
    type: "clump",
    clumpId: guide.clumpId,
    guideId: guide.id
  }));
  const children = document.createElement("div");
  children.className = "outliner-clump-children";
  children.appendChild(createOutlinerStrandButton(guide, { nested: true }));
  clumpDirectMembers(guide).forEach((lock) => children.appendChild(createOutlinerStrandButton(lock, { nested: true })));
  container.append(header, children);
  return container;
}

function renderLockList() {
  const list = document.querySelector("#lockList");
  list.innerHTML = "";
  STRAND_GROUPS.forEach((group) => {
    const groupRoots = locks.filter((lock) => {
      if (lock.clumpId && !lock.clumpGuide) return false;
      return (lock.scalpRegion || "unassigned") === group.id;
    });
    const groupLocks = groupRoots.flatMap((lock) => lock.clumpGuide ? outlinerClumpLocks(lock) : [lock]);
    const groupElement = document.createElement("div");
    const isOpen = strandGroupOpen.get(group.id) || groupLocks.some((lock) => lock.id === selectedId);
    groupElement.className = `outliner-group${isOpen ? " open" : ""}`;
    groupElement.dataset.strandGroup = group.id;

    const header = document.createElement("div");
    header.className = `outliner-group-head${selectedStrandGroup === group.id ? " selected" : ""}`;
    const disclosure = document.createElement("button");
    disclosure.className = "outliner-disclosure";
    disclosure.type = "button";
    disclosure.title = isOpen ? `Collapse ${group.label}` : `Expand ${group.label}`;
    disclosure.setAttribute("aria-label", disclosure.title);
    disclosure.setAttribute("aria-expanded", String(isOpen));
    disclosure.textContent = ">";
    disclosure.addEventListener("click", () => {
      strandGroupOpen.set(group.id, !isOpen);
      renderLockList();
    });
    const selectGroup = document.createElement("button");
    selectGroup.className = "outliner-group-select";
    selectGroup.type = "button";
    selectGroup.setAttribute("aria-pressed", String(selectedStrandGroup === group.id));
    selectGroup.addEventListener("click", () => selectStrandGroup(group.id));
    const groupSwatch = document.createElement("span");
    groupSwatch.className = "outliner-group-swatch";
    groupSwatch.style.background = `#${new THREE.Color(SCALP_REGIONS[group.id].color).getHexString()}`;
    const label = document.createElement("span");
    label.className = "outliner-group-label";
    label.textContent = group.label;
    const count = document.createElement("span");
    count.className = "outliner-group-count";
    count.textContent = groupLocks.length;
    selectGroup.append(groupSwatch, label, count);
    header.append(disclosure, selectGroup);
    groupElement.appendChild(header);

    const items = document.createElement("div");
    items.className = "outliner-group-items";
    if (!groupLocks.length) {
      const empty = document.createElement("span");
      empty.className = "outliner-empty";
      empty.textContent = "No strands";
      items.appendChild(empty);
    }
    HAIR_LAYERS.forEach((layer) => {
      const layerRoots = groupRoots.filter((lock) => normalizeHairLayer(lock.hairLayer) === layer.id);
      if (!layerRoots.length) return;
      const layerLockCount = layerRoots.reduce((total, lock) => total + (lock.clumpGuide ? outlinerClumpLocks(lock).length : 1), 0);
      const layerKey = `${group.id}:${layer.id}`;
      const layerOpen = strandLayerOpen.get(layerKey) !== false || layerRoots.some((lock) => lock.id === selectedId || (lock.clumpId && lock.clumpId === getSelectedLock()?.clumpId));
      const layerElement = document.createElement("div");
      layerElement.className = `outliner-layer${layerOpen ? " open" : ""}`;
      const layerHeader = document.createElement("button");
      layerHeader.className = "outliner-layer-head";
      layerHeader.type = "button";
      layerHeader.setAttribute("aria-expanded", String(layerOpen));
      layerHeader.title = `${layerOpen ? "Collapse" : "Expand"} ${layer.label} layer`;
      const layerDisclosure = document.createElement("span");
      layerDisclosure.className = "outliner-layer-disclosure";
      layerDisclosure.textContent = ">";
      const layerSwatch = document.createElement("span");
      layerSwatch.className = "outliner-layer-swatch";
      layerSwatch.style.background = strandDisplayColor(layerRoots[0]);
      const layerLabel = document.createElement("span");
      layerLabel.textContent = layer.label;
      const layerCount = document.createElement("span");
      layerCount.className = "outliner-layer-count";
      layerCount.textContent = layerLockCount;
      layerHeader.append(layerDisclosure, layerSwatch, layerLabel, layerCount);
      layerHeader.addEventListener("click", () => {
        strandLayerOpen.set(layerKey, !layerOpen);
        renderLockList();
      });
      const layerItems = document.createElement("div");
      layerItems.className = "outliner-layer-items";
      layerRoots.forEach((lock) => {
        layerItems.appendChild(lock.clumpGuide ? createOutlinerClump(lock) : createOutlinerStrandButton(lock));
      });
      layerElement.append(layerHeader, layerItems);
      items.appendChild(layerElement);
    });
    groupElement.appendChild(items);
    list.appendChild(groupElement);
  });
}

function updateCount() {
  const lockText = `${locks.length} ${locks.length === 1 ? "strand" : "strands"}`;
  const accessibleGuideCount = CURVE_LATTICE_FEATURE_ENABLED
    ? guides.length
    : guides.filter((guide) => guide.type !== "curve-lattice").length;
  const guideText = `${accessibleGuideCount} ${accessibleGuideCount === 1 ? "guide" : "guides"}`;
  document.querySelector("#strandCount").textContent = `${guideText}, ${lockText}`;
  updateTopologyStats();
}

function captureInputUndo() {
  if (inputUndoCaptured) return;
  pushUndoState();
  inputUndoCaptured = true;
}

function bindUndoCapture(input) {
  input.addEventListener("pointerdown", captureInputUndo);
  input.addEventListener("keydown", captureInputUndo);
  input.addEventListener("change", () => {
    inputUndoCaptured = false;
  });
  input.addEventListener("blur", () => {
    inputUndoCaptured = false;
  });
}

function bindLockInput(key, parser = Number) {
  bindUndoCapture(inputs[key]);
  inputs[key].addEventListener("input", () => {
    const lock = getSelectedLock();
    const target = lock || (creationToolActive() ? activeCreationShapeDefaults() : null);
    if (!target) return;
    const braidDimension = (key === "widthScale" || key === "depthScale")
      && (target === braidCreationDefaults || target.geometryType === "braid");
    if (braidDimension) {
      const braidKey = key === "widthScale" ? "braidWidth" : "braidDepth";
      target[braidKey] = parser(inputs[key].value);
      target[key] = 1;
      if (key === "widthScale" && lock) {
        lock.width = target.braidWidth;
        lock.baseWidth = target.braidWidth;
      }
      syncShapeDimensionInputs(target);
    } else {
      target[key] = parser(inputs[key].value);
    }
    if (key === "twist") twistNumberInput.value = Number(target.twist).toFixed(2);
    if (key === "roughness") roughnessValue.textContent = Number(target[key]).toFixed(2);
    if (key === "radialSegments") topologyValues.strandRadialSegments.textContent = inputs[key].value;
    if (key === "lengthSegments") topologyValues.strandLengthSegments.textContent = inputs[key].value;
    if (key === "densityAggression") topologyValues.strandDensityAggression.textContent = Number(inputs[key].value).toFixed(2);
    if (key === "profileOffset") {
      document.querySelector("#profileOffsetValue").textContent = Number(target[key]).toFixed(2);
      renderProfilePreview(profilePreviewPaths.strand, target.sweepProfile, target.profileOffset);
      if (sweepProfileEditor.open) renderSweepProfileEditor();
    }
    if (key === "rootScalpOffset") {
      document.querySelector("#rootScalpOffsetValue").textContent = Number(target[key]).toFixed(2);
      if (lock) applyLockRootScalpOffset(lock);
    }
    if (key === "widthScale" && !braidDimension) document.querySelector("#widthScaleValue").textContent = Number(target[key]).toFixed(2);
    if (key === "depthScale" && !braidDimension) document.querySelector("#depthScaleValue").textContent = Number(target[key]).toFixed(2);
    if (lock) {
      updateLockGeometry(lock);
      syncActiveMirror(lock, { refreshUi: true });
      updateTopologyStats();
      renderLockList();
    }
  });
}

["widthScale", "depthScale", "profileOffset", "rootScalpOffset", "twist", "radialSegments", "lengthSegments", "densityAggression"].forEach((key) => bindLockInput(key));

strandLayerInput.addEventListener("change", () => {
  const layerId = normalizeHairLayer(strandLayerInput.value);
  const lock = getSelectedLock();
  if (!lock && creationToolActive()) {
    activeCreationShapeDefaults().hairLayer = layerId;
    if (drawStrandStroke) updateDrawStrandPreview();
    return;
  }
  if (!lock || normalizeHairLayer(lock.hairLayer) === layerId) return;
  pushUndoState();
  setLockHairLayer(lock, layerId);
  syncActiveMirror(lock, { refreshUi: true });
  renderLockList();
  updateTopologyStats();
});

bindUndoCapture(clumpInfluenceInput);
clumpInfluenceInput.addEventListener("input", () => {
  const lock = getSelectedLock();
  const guide = clumpGuideForLock(lock);
  if (!guide) return;
  guide.clumpInfluence = THREE.MathUtils.clamp(Number(clumpInfluenceInput.value), 0, 1);
  clumpInfluenceValue.textContent = guide.clumpInfluence.toFixed(2);
  updateClumpMembers(guide);
  const mirroredGuide = syncActiveMirror(guide);
  if (mirroredGuide?.clumpGuide) updateClumpMembers(mirroredGuide);
});

const clumpShapeProperties = {
  spread: "clumpSpread",
  depthSpread: "clumpDepthSpread",
  tipFan: "clumpTipFan",
  roll: "clumpRoll",
  strandWidth: "clumpStrandWidth",
  strandDepth: "clumpStrandDepth",
  variation: "clumpVariation"
};

Object.entries(clumpShapeInputs).forEach(([key, input]) => {
  bindUndoCapture(input);
  input.addEventListener("input", () => {
    const guide = clumpGuideForLock(getSelectedLock());
    if (!guide?.clumpGuide) return;
    guide[clumpShapeProperties[key]] = Number(input.value);
    clumpShapeValues[key].textContent = key === "roll"
      ? `${Math.round(guide.clumpRoll)}°`
      : Number(input.value).toFixed(2);
    updateClumpMembers(guide);
    const mirroredGuide = syncActiveMirror(guide);
    if (mirroredGuide?.clumpGuide) updateClumpMembers(mirroredGuide);
  });
});

dissolveClumpAction.addEventListener("click", () => {
  const target = outlinerContextTarget;
  const guide = target?.type === "clump" ? locks.find((lock) => lock.id === target.guideId) : null;
  if (!guide?.clumpId) return;
  pushUndoState();
  dissolveClump(guide.clumpId);
  clumpViewportSelection = false;
  hideOutlinerContextMenu();
  selectLock(guide.id);
});

deleteOutlinerAction.addEventListener("click", () => {
  const target = outlinerContextTarget;
  hideOutlinerContextMenu();
  if (target?.type === "clump") {
    const guide = locks.find((lock) => lock.id === target.guideId);
    const targets = outlinerClumpLocks(guide);
    if (!targets.length) return;
    pushUndoState();
    deleteLocks(targets);
    return;
  }
  const lock = target?.type === "strand" ? locks.find((item) => item.id === target.lockId) : null;
  if (!lock) return;
  pushUndoState();
  const mirrorPartner = mirrorXEditing ? mirrorPartnerFor(lock) : null;
  deleteLocks(mirrorPartner ? [lock, mirrorPartner] : [lock]);
});

document.addEventListener("pointerdown", (event) => {
  if (!clumpContextMenu.classList.contains("hidden") && !clumpContextMenu.contains(event.target)) {
    hideOutlinerContextMenu();
  }
});
window.addEventListener("blur", hideOutlinerContextMenu);
window.addEventListener("resize", hideOutlinerContextMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideOutlinerContextMenu();
});

strandDynamicDensityInput.addEventListener("change", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  pushUndoState();
  lock.dynamicDensity = strandDynamicDensityInput.checked;
  inputs.densityAggression.disabled = !lock.dynamicDensity;
  updateLockGeometry(lock);
  syncActiveMirror(lock, { refreshUi: true });
  updateTopologyStats();
});

bindUndoCapture(twistNumberInput);
twistNumberInput.addEventListener("input", () => {
  const lock = getSelectedLock();
  const target = lock || (creationToolActive() ? activeCreationShapeDefaults() : null);
  const value = Number(twistNumberInput.value);
  if (!target || !Number.isFinite(value)) return;
  target.twist = value;
  inputs.twist.value = THREE.MathUtils.clamp(value, Number(inputs.twist.min), Number(inputs.twist.max));
  if (lock) {
    updateLockGeometry(lock);
    syncActiveMirror(lock, { refreshUi: true });
    updateTopologyStats();
    renderLockList();
  }
});

hairMaterialSelect.addEventListener("change", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  pushUndoState();
  lock.materialId = hairMaterialSelect.value;
  applyMaterialDefinitionToLock(lock);
  syncActiveMirror(lock, { refreshUi: true });
  syncHairMaterialEditor(lock);
  renderLockList();
});

newHairMaterialButton.addEventListener("click", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  pushUndoState();
  const source = materialForLock(lock);
  hairMaterialIndex += 1;
  const material = normalizeHairMaterialDefinition({ ...source });
  material.id = `hair-material-${crypto.randomUUID()}`;
  material.name = `Hair Material ${hairMaterialIndex}`;
  hairMaterialDefinitions.push(material);
  lock.materialId = material.id;
  applyMaterialDefinitionToLock(lock);
  syncHairMaterialEditor(lock);
  renderLockList();
});

[hairMaterialNameInput, hairMaterialColorInput, hairMaterialShadowColorInput, hairMaterialHighlightColorInput, hairMaterialRoughnessInput, ...Object.values(hairShaderInputs)].forEach(bindUndoCapture);
hairMaterialNameInput.addEventListener("input", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  const material = materialForLock(lock);
  material.name = hairMaterialNameInput.value || "Untitled Material";
  renderHairMaterialOptions(material.id);
});
hairMaterialColorInput.addEventListener("input", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  const material = materialForLock(lock);
  material.color = hairMaterialColorInput.value;
  refreshMaterialUsers(material.id);
});
hairMaterialShadowColorInput.addEventListener("input", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  const material = materialForLock(lock);
  material.shadowColor = hairMaterialShadowColorInput.value;
  refreshMaterialUsers(material.id);
});
hairMaterialHighlightColorInput.addEventListener("input", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  const material = materialForLock(lock);
  material.highlightColor = hairMaterialHighlightColorInput.value;
  refreshMaterialUsers(material.id);
});
hairMaterialRoughnessInput.addEventListener("input", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  const material = materialForLock(lock);
  material.roughness = Number(hairMaterialRoughnessInput.value);
  syncRoughnessValue();
  refreshMaterialUsers(material.id);
});
Object.entries(hairShaderInputs).forEach(([key, input]) => {
  input.addEventListener("input", () => {
    const lock = getSelectedLock();
    if (!lock) return;
    const material = materialForLock(lock);
    material[key] = Number(input.value);
    syncHairShaderValue(key);
    refreshMaterialUsers(material.id);
  });
});
Object.entries(groupInputs).forEach(([key, input]) => {
  input.addEventListener("pointerdown", requestGroupDefaultsWarning, { capture: true });
  bindUndoCapture(input);
  input.addEventListener("input", () => {
    if (!selectedStrandGroup) return;
    strandGroupDefaults[selectedStrandGroup][key] = Number(input.value);
    if (key === "radialSegments") topologyValues.groupRadialSegments.textContent = input.value;
    if (key === "lengthSegments") topologyValues.groupLengthSegments.textContent = input.value;
    if (key === "densityAggression") topologyValues.groupDensityAggression.textContent = Number(input.value).toFixed(2);
    if (key === "profileOffset") {
      document.querySelector("#groupProfileOffsetValue").textContent = Number(input.value).toFixed(2);
      renderProfilePreview(profilePreviewPaths.group, strandGroupDefaults[selectedStrandGroup].sweepProfile, Number(input.value));
      if (sweepProfileEditor.open) renderSweepProfileEditor();
    }
    if (key === "rootScalpOffset") document.querySelector("#groupRootScalpOffsetValue").textContent = Number(input.value).toFixed(2);
    if (key === "widthScale") document.querySelector("#groupWidthScaleValue").textContent = Number(input.value).toFixed(2);
    if (key === "depthScale") document.querySelector("#groupDepthScaleValue").textContent = Number(input.value).toFixed(2);
    applyGroupDefaultsToExistingStrands(selectedStrandGroup);
  });
});
Object.entries(groupLayerInputs).forEach(([layerId, input]) => {
  bindUndoCapture(input);
  input.addEventListener("input", () => {
    if (!selectedStrandGroup) return;
    const value = Number(input.value);
    document.querySelector(`#${input.id}Value`).textContent = value.toFixed(2);
    setGroupLayerOffset(selectedStrandGroup, layerId, value);
    updateTopologyStats();
  });
});
groupDynamicDensityInput.addEventListener("pointerdown", requestGroupDefaultsWarning, { capture: true });
groupDynamicDensityInput.addEventListener("change", () => {
  if (!selectedStrandGroup) return;
  pushUndoState();
  const defaults = strandGroupDefaults[selectedStrandGroup];
  defaults.dynamicDensity = groupDynamicDensityInput.checked;
  groupInputs.densityAggression.disabled = !defaults.dynamicDensity;
  applyGroupDefaultsToExistingStrands(selectedStrandGroup);
});
confirmGroupDefaultsChange.addEventListener("click", () => {
  groupDefaultsWarningAcknowledged = true;
  if (hideGroupDefaultsWarning.checked) {
    localStorage.setItem("anime-hair-hide-group-defaults-warning", "true");
  }
  groupDefaultsWarning.close();
  const continuation = groupDefaultsWarningContinuation;
  groupDefaultsWarningContinuation = null;
  continuation?.();
});
cancelGroupDefaultsChange.addEventListener("click", () => {
  groupDefaultsWarningContinuation = null;
  groupDefaultsWarning.close();
});
editSweepProfileButtons.forEach((button) => button.addEventListener("click", openSweepProfileEditor));
document.querySelector("#closeSweepProfile").addEventListener("click", closeSweepProfileEditor);
sweepProfileEditor.addEventListener("cancel", () => {
  sweepProfileEdit = null;
});
sweepProfileEditor.addEventListener("close", updateViewportStatsVisibility);
sweepProfileCanvas.addEventListener("pointerdown", (event) => {
  const pointIndex = Number(event.target?.dataset?.profilePoint);
  if (!Number.isInteger(pointIndex) || !sweepProfileEdit) return;
  pushUndoState();
  sweepProfileEdit.selectedIndex = pointIndex;
  sweepProfileEdit.dragPointerId = event.pointerId;
  sweepProfileCanvas.setPointerCapture?.(event.pointerId);
  renderSweepProfileEditor();
  event.preventDefault();
});
sweepProfileCanvas.addEventListener("pointermove", (event) => {
  if (!sweepProfileEdit || sweepProfileEdit.dragPointerId !== event.pointerId) return;
  const profile = activeSweepProfile();
  if (!profile?.[sweepProfileEdit.selectedIndex]) return;
  Object.assign(profile[sweepProfileEdit.selectedIndex], canvasToProfile(event));
  applySweepProfileEdit();
  event.preventDefault();
});
function finishSweepProfileDrag(event) {
  if (!sweepProfileEdit || sweepProfileEdit.dragPointerId !== event.pointerId) return;
  if (sweepProfileCanvas.hasPointerCapture?.(event.pointerId)) sweepProfileCanvas.releasePointerCapture(event.pointerId);
  sweepProfileEdit.dragPointerId = null;
}
sweepProfileCanvas.addEventListener("pointerup", finishSweepProfileDrag);
sweepProfileCanvas.addEventListener("pointercancel", finishSweepProfileDrag);
document.querySelector("#addSweepPoint").addEventListener("click", () => {
  const profile = activeSweepProfile();
  if (!profile?.length || !sweepProfileEdit) return;
  pushUndoState();
  const index = THREE.MathUtils.clamp(sweepProfileEdit.selectedIndex, 0, profile.length - 1);
  const next = profile[(index + 1) % profile.length];
  const current = profile[index];
  profile.splice(index + 1, 0, { x: (current.x + next.x) * 0.5, z: (current.z + next.z) * 0.5 });
  sweepProfileEdit.selectedIndex = index + 1;
  applySweepProfileEdit();
});
document.querySelector("#deleteSweepPoint").addEventListener("click", () => {
  const profile = activeSweepProfile();
  if (!profile || profile.length <= 4 || !sweepProfileEdit) return;
  pushUndoState();
  profile.splice(sweepProfileEdit.selectedIndex, 1);
  sweepProfileEdit.selectedIndex = Math.min(sweepProfileEdit.selectedIndex, profile.length - 1);
  applySweepProfileEdit();
});
document.querySelector("#resetSweepProfile").addEventListener("click", () => {
  const profile = activeSweepProfile();
  if (!profile || !sweepProfileEdit) return;
  pushUndoState();
  profile.splice(0, profile.length, ...DEFAULT_SWEEP_PROFILE.map((point) => ({ ...point })));
  sweepProfileEdit.selectedIndex = 0;
  applySweepProfileEdit();
});
editTaperCurveButtons.forEach((button) => button.addEventListener("click", () => openTaperCurveEditor(button.dataset.curveKey)));
document.querySelector("#closeTaperCurve").addEventListener("click", closeTaperCurveEditor);
taperCurveEditor.addEventListener("cancel", () => {
  taperCurveEdit = null;
});
taperCurveEditor.addEventListener("close", updateViewportStatsVisibility);
taperCurveCanvas.addEventListener("pointerdown", (event) => {
  const pointIndex = Number(event.target?.dataset?.taperPoint);
  if (!Number.isInteger(pointIndex) || !taperCurveEdit) return;
  pushUndoState();
  taperCurveEdit.selectedIndex = pointIndex;
  taperCurveEdit.dragPointerId = event.pointerId;
  taperCurveCanvas.setPointerCapture?.(event.pointerId);
  renderTaperCurveEditor();
  event.preventDefault();
});
taperCurveCanvas.addEventListener("pointermove", (event) => {
  if (!taperCurveEdit || taperCurveEdit.dragPointerId !== event.pointerId) return;
  const curve = activeTaperCurve();
  const selected = curve?.[taperCurveEdit.selectedIndex];
  if (!selected) return;
  Object.assign(selected, canvasToTaperPoint(event, taperCurveEdit.selectedIndex));
  curve.sort((a, b) => a.position - b.position);
  taperCurveEdit.selectedIndex = curve.indexOf(selected);
  applyTaperCurveEdit();
  event.preventDefault();
});
function finishTaperCurveDrag(event) {
  if (!taperCurveEdit || taperCurveEdit.dragPointerId !== event.pointerId) return;
  if (taperCurveCanvas.hasPointerCapture?.(event.pointerId)) taperCurveCanvas.releasePointerCapture(event.pointerId);
  taperCurveEdit.dragPointerId = null;
}
taperCurveCanvas.addEventListener("pointerup", finishTaperCurveDrag);
taperCurveCanvas.addEventListener("pointercancel", finishTaperCurveDrag);

function updateSelectedTaperPoint(key, value) {
  const curve = activeTaperCurve();
  const selected = curve?.[taperCurveEdit?.selectedIndex];
  if (!selected) return;
  selected[key] = value;
  if (key === "position") {
    selected.position = THREE.MathUtils.clamp(Number(value), 0.01, 0.99);
    curve.sort((a, b) => a.position - b.position);
    taperCurveEdit.selectedIndex = curve.indexOf(selected);
  }
  applyTaperCurveEdit();
}
[taperPointValue, taperPointPosition, taperPointInterpolation].forEach(bindUndoCapture);
taperPointValue.addEventListener("input", () => updateSelectedTaperPoint("value", THREE.MathUtils.clamp(Number(taperPointValue.value), 0, TAPER_VALUE_MAX)));
taperPointPosition.addEventListener("input", () => updateSelectedTaperPoint("position", Number(taperPointPosition.value)));
taperPointInterpolation.addEventListener("change", () => updateSelectedTaperPoint("interpolation", taperPointInterpolation.value));
document.querySelector("#addTaperPoint").addEventListener("click", () => {
  const curve = activeTaperCurve();
  if (!curve?.length || !taperCurveEdit) return;
  pushUndoState();
  const index = Math.min(taperCurveEdit.selectedIndex, curve.length - 2);
  const left = curve[index];
  const right = curve[index + 1];
  curve.splice(index + 1, 0, {
    position: (left.position + right.position) * 0.5,
    value: (left.value + right.value) * 0.5,
    interpolation: left.interpolation
  });
  taperCurveEdit.selectedIndex = index + 1;
  applyTaperCurveEdit();
});
document.querySelector("#deleteTaperPoint").addEventListener("click", () => {
  const curve = activeTaperCurve();
  if (!curve || curve.length <= 2 || !taperCurveEdit) return;
  const index = taperCurveEdit.selectedIndex;
  if (index === 0 || index === curve.length - 1) return;
  pushUndoState();
  curve.splice(index, 1);
  taperCurveEdit.selectedIndex = Math.min(index, curve.length - 1);
  applyTaperCurveEdit();
});
document.querySelector("#resetTaperCurve").addEventListener("click", () => {
  const curve = activeTaperCurve();
  if (!curve || !taperCurveEdit) return;
  pushUndoState();
  const braidCreationCurve = taperCurveEdit.type === "creation" && activeTool === "braid";
  const defaultCurve = taperCurveEdit.curveKey === "depthCurve"
    ? (braidCreationCurve ? DEFAULT_BRAID_DEPTH_CURVE : DEFAULT_DEPTH_CURVE)
    : (braidCreationCurve ? DEFAULT_BRAID_WIDTH_CURVE : DEFAULT_TAPER_CURVE);
  curve.splice(0, curve.length, ...defaultCurve.map((point) => ({ ...point })));
  taperCurveEdit.selectedIndex = 0;
  applyTaperCurveEdit();
});
bindUndoCapture(inputs.name);
inputs.name.addEventListener("input", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  lock.name = inputs.name.value || "Untitled lock";
  renderLockList();
});

document.querySelector("#addLock").addEventListener("click", addPresetSelection);
presetLibraryToggle.addEventListener("click", () => setPresetLibraryOpen(presetLibrary.classList.contains("hidden")));
document.querySelector("#closePresetLibrary").addEventListener("click", () => setPresetLibraryOpen(false));
document.querySelector("#openHairProject").addEventListener("click", () => hairProjectFileInput.click());
hairProjectFileInput.addEventListener("change", () => {
  const [file] = hairProjectFileInput.files;
  if (file) openHairProjectFile(file);
});
document.querySelector("#importHeadMesh").addEventListener("click", () => headMeshFileInput.click());
headMeshFileInput.addEventListener("change", () => {
  const [file] = headMeshFileInput.files;
  if (file) importHeadMeshFile(file);
});
scalpGuideSourceInput.addEventListener("change", () => {
  if (scalpGuideSourceInput.value === "default") {
    setScalpGuideSource("default");
    return;
  }
  if (customScalpSurfaceMesh) {
    setScalpGuideSource("custom");
    return;
  }
  scalpGuideSourceInput.value = scalpGuideSource;
  scalpGuideMeshFileInput.click();
});
scalpGuideMeshFileInput.addEventListener("change", () => {
  const [file] = scalpGuideMeshFileInput.files;
  if (file) importScalpGuideMeshFile(file);
});
document.querySelector("#saveCurrentPreset").addEventListener("click", saveHairProjectFile);
presetFilterButtons.forEach((button) => button.addEventListener("click", () => {
  activePresetFilter = button.dataset.presetFilter;
  renderPresetLibrary();
}));
presetLibrary.addEventListener("pointerdown", (event) => event.stopPropagation());
presetLibrary.addEventListener("wheel", (event) => event.stopPropagation());
document.querySelector("#centerGuide").addEventListener("click", () => {
  const guide = getSelectedGuide();
  if (!guide) return;
  pushUndoState();
  if (guide.type === "curve-lattice") {
    guide.points = curveLatticePointsForScalpRegion(guide.scalpRegion, guide.columns, guide.rows);
    guide.rootPoints = defaultCurveLatticeRootPoints(guide);
    guide.bottomPoints = defaultCurveLatticeBottomPoints(guide);
    guide.deformRestPoints = guide.points.map((point) => point.clone());
    guide.deformRestRootPoints = guide.rootPoints.map((point) => point.clone());
    guide.deformRestBottomPoints = guide.bottomPoints.map((point) => point.clone());
    if (guide.handlesGroup.children.includes(transformControls.object)) transformControls.detach();
    guideSurfaceGroup.remove(guide.handlesGroup);
    guide.handlesGroup.children.forEach((handle) => {
      handle.geometry.dispose();
      handle.material.dispose();
    });
    guide.handlesGroup = createCurveLatticeHandles(guide);
    guide.handlesGroup.visible = true;
    guideSurfaceGroup.add(guide.handlesGroup);
    updateCurveLatticeGeometry(guide);
    selectGuide(guide.id);
    return;
  }
  guide.x = 0;
  guide.y = 0.72;
  guide.z = 0.42;
  updateGuideGeometry(guide);
});
document.querySelector("#deleteGuide").addEventListener("click", () => {
  const guide = getSelectedGuide();
  if (!guide) return;
  pushUndoState();
  if (transformControls.object?.userData.curveLatticeGuideId === guide.id) transformControls.detach();
  locks.forEach((lock) => {
    if (lock.curveLatticeBinding?.guideId === guide.id) lock.curveLatticeBinding = null;
  });
  if (activeCurveLatticeGuideId === guide.id) {
    activeCurveLatticeGuideId = null;
    curveLatticeToggle.classList.remove("active");
  }
  removeGuideObjects(guide);
  disposeGuide(guide);
  guides.splice(guides.indexOf(guide), 1);
  selectGuide(guides.at(-1)?.id);
  updateCount();
});
curveLatticeToggle.addEventListener("click", (event) => {
  if (!CURVE_LATTICE_FEATURE_ENABLED) return;
  if (!event.shiftKey && getSelectedGuide()?.type === "curve-lattice") {
    deselectStrands();
    updatePlacementStatus();
    updateViewPlaneGrid();
    return;
  }
  const existing = selectedCurveLatticeGuide() || guides.find((guide) => guide.type === "curve-lattice");
  if (existing && !event.shiftKey) {
    selectGuide(existing.id);
    return;
  }
  pushUndoState();
  if (event.shiftKey) {
    addCurveLattice({ scalpRegion: activeScalpRegion, color: SCALP_REGIONS[activeScalpRegion].color });
    return;
  }
  const created = createCurveLatticeGuideSet();
  const frontBangs = created.find((guide) => guide.scalpRegion === "bangs") || created[0];
  if (frontBangs) selectGuide(frontBangs.id);
  updateCount();
});
bindUndoCapture(curveLatticeOpacityInput);
curveLatticeOpacityInput.addEventListener("input", () => {
  const guide = getSelectedGuide();
  if (guide?.type !== "curve-lattice") return;
  guide.opacity = Number(curveLatticeOpacityInput.value);
  guide.mesh.material.opacity = guide.opacity;
  if (guide.rootMesh) guide.rootMesh.material.opacity = guide.opacity;
  if (guide.bottomMesh) guide.bottomMesh.material.opacity = guide.opacity;
});
bindUndoCapture(curveLatticeBottomExtrudeInput);
curveLatticeBottomExtrudeInput.addEventListener("input", () => {
  const guide = getSelectedGuide();
  if (guide?.type !== "curve-lattice") return;
  setCurveLatticeBottomExtrude(guide, curveLatticeBottomExtrudeInput.value);
  curveLatticeBottomExtrudeValue.value = guide.bottomExtrude.toFixed(2);
  updateCurveLatticeGeometry(guide);
});
bindUndoCapture(curveLatticeBottomRowsInput);
curveLatticeBottomRowsInput.addEventListener("input", () => {
  const guide = getSelectedGuide();
  if (guide?.type !== "curve-lattice") return;
  setCurveLatticeBottomRows(guide, curveLatticeBottomRowsInput.value);
  curveLatticeBottomRowsValue.value = String(guide.bottomRows);
  rebuildCurveLatticeHandles(guide);
  updateCurveLatticeGeometry(guide);
});
document.querySelector("#createLatticeStrands").addEventListener("click", () => {
  createStrandsFromCurveLattice(getSelectedGuide());
});
document.querySelector("#mirrorLock").addEventListener("click", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  pushUndoState();
  const mirrored = createMirrorPartner(lock);
  if (!mirrored) return;
  selectLock(mirrored.id);
});

Object.entries(guideInputs).forEach(([key, input]) => {
  bindUndoCapture(input);
  input.addEventListener("input", () => {
    const guide = getSelectedGuide();
    if (!guide) return;
    guide[key] = Number(input.value);
    updateGuideGeometry(guide);
  });
});

Object.entries(scalpInputs).forEach(([key, input]) => {
  bindUndoCapture(input);
  input.addEventListener("input", () => {
    scalpSurface[key] = Number(input.value);
    updateScalpSurface();
  });
});

["sideFlatten", "topHeight", "bottomHeight", "topWidth", "topDepth", "middleWidth", "middleDepth", "bottomWidth", "bottomDepth"].forEach((key) => {
  const input = scalpArtistInputs[key];
  bindUndoCapture(input);
  input.addEventListener("input", () => {
    scalpArtistShape[key] = Number(input.value);
    applyScalpLatticeDeformation();
    updateScalpLatticeObjects();
  });
});

bindUndoCapture(scalpArtistInputs.hairlineRows);
scalpArtistInputs.hairlineRows.addEventListener("input", () => {
  scalpArtistShape.hairlineRows = Number(scalpArtistInputs.hairlineRows.value);
  updateScalpTopology();
});

bindUndoCapture(scalpArtistInputs.sideBangRows);
scalpArtistInputs.sideBangRows.addEventListener("input", () => {
  scalpArtistShape.sideBangRows = Number(scalpArtistInputs.sideBangRows.value);
  applyDefaultScalpRegionAssignments(scalpArtistShape.sideBangRows);
});

bindUndoCapture(scalpArtistInputs.rootScalpOffset);
scalpArtistInputs.rootScalpOffset.addEventListener("input", () => {
  scalpArtistShape.rootScalpOffset = Number(scalpArtistInputs.rootScalpOffset.value);
  document.querySelector("#scalpRootOffsetValue").textContent = scalpArtistShape.rootScalpOffset.toFixed(2);
});

scalpArtistInputs.mirrorX.addEventListener("change", () => {
  pushUndoState();
  scalpArtistShape.mirrorX = scalpArtistInputs.mirrorX.checked;
});

modeToolButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTool(button.dataset.tool));
});
exitSetupEditor.addEventListener("click", exitSetupEditors);

spaceToggle.addEventListener("click", () => setObjectSpaceEditing(!objectSpaceEditing));
mirrorXToggle.addEventListener("click", () => setMirrorXEditing(!mirrorXEditing));
strandCollisionToggle.addEventListener("click", () => {
  if (!strandCollisionEnabled) pushUndoState();
  setStrandCollisionEnabled(!strandCollisionEnabled);
});
transformSpaceButtons.forEach((button) => {
  button.addEventListener("click", () => setObjectSpaceEditing(button.dataset.transformSpace === "object"));
});
viewPlaneMoveInput.addEventListener("change", () => setViewPlaneMove(viewPlaneMoveInput.checked));
viewPlaneMoveSnappedOnlyInput.addEventListener("change", () => setViewPlaneMoveSnappedOnly(viewPlaneMoveSnappedOnlyInput.checked));
pullMoveInput.addEventListener("change", () => {
  pullMoveEnabled = pullMoveInput.checked;
  activeHandleEdit = null;
  transformControls.detach();
  setActiveTool("move");
});
pullRigidityInput.addEventListener("input", () => {
  pullRigidity = Number(pullRigidityInput.value);
  pullRigidityValue.textContent = pullRigidity.toFixed(2);
});
pullCollisionInput.addEventListener("change", () => {
  pullCollisionEnabled = pullCollisionInput.checked;
});
placeStrandScalpOffsetInput.addEventListener("input", () => {
  placeStrandScalpOffsetValue.textContent = Number(placeStrandScalpOffsetInput.value).toFixed(2);
});
drawStrandBrushSizeInput.addEventListener("input", () => {
  drawStrandBrushSizeValue.textContent = Number(drawStrandBrushSizeInput.value).toFixed(2);
  drawStrandBrushCursor.scale.setScalar(activeStrokeBrushSize());
  if (drawStrandStroke && drawStrandStroke.outputType !== "braid") {
    drawStrandStroke.brushSize = activeStrokeBrushSize();
    updateDrawStrandPreview();
    return;
  }
  const selectedLock = getSelectedLock();
  if (selectedLock && selectedLock.geometryType !== "braid") {
    selectedLock.width = Number(drawStrandBrushSizeInput.value);
    selectedLock.baseWidth = selectedLock.width;
    updateLockGeometry(selectedLock, { immediate: true });
    syncActiveMirror(selectedLock, { refreshUi: true });
    updateTopologyStats();
    renderLockList();
  } else if (!selectedLock) {
    strandCreationDefaults.width = Number(drawStrandBrushSizeInput.value);
  }
});
drawToolSizeInput.addEventListener("input", () => {
  drawToolSizeValue.textContent = Number(drawToolSizeInput.value).toFixed(2);
  drawStrandBrushCursor.scale.setScalar(activeStrokeBrushSize());
  if (drawStrandStroke && drawStrandStroke.outputType !== "braid") {
    drawStrandStroke.brushSize = activeStrokeBrushSize();
    updateDrawStrandPreview();
  }
});
braidToolSizeInput.addEventListener("input", () => {
  const scale = Number(braidToolSizeInput.value);
  braidToolSizeValue.textContent = scale.toFixed(2);
  if (drawStrandStroke?.outputType === "braid") {
    drawStrandStroke.brushSize = Number(braidCreationDefaults.braidWidth) * scale;
    drawStrandStroke.braidWidth = Number(braidCreationDefaults.braidWidth) * scale;
    drawStrandStroke.braidDepth = Number(braidCreationDefaults.braidDepth) * scale;
    drawStrandStroke.braidSegmentLength = Number(braidCreationDefaults.braidSegmentLength) * scale;
    updateDrawStrandPreview();
  }
});
drawStrandSmoothingInput.addEventListener("input", () => {
  drawStrandSmoothingValue.textContent = Number(drawStrandSmoothingInput.value).toFixed(2);
});
drawStrandCurveStepInput.addEventListener("input", () => {
  drawStrandCurveStepValue.textContent = Number(drawStrandCurveStepInput.value).toFixed(2);
});
function syncDrawCurlControls() {
  const selectedLock = getSelectedLock();
  const selectedCoil = selectedLock?.geometryType !== "braid" && selectedLock?.curlEnabled;
  const enabled = drawStrandMode === "coil" || Boolean(selectedCoil);
  const curlCount = Number(drawStrandCurlCountInput.value);
  const curlDisplacement = Number(drawStrandCurlDisplacementInput.value);
  drawStrandCurlCountInput.disabled = !enabled;
  drawStrandCurlDisplacementInput.disabled = !enabled;
  if (!selectedLock) {
    strandCreationDefaults.curlCount = curlCount;
    strandCreationDefaults.curlDisplacement = curlDisplacement;
  }
  if (drawStrandStroke?.outputType === "strand") {
    drawStrandStroke.curlEnabled = enabled;
    drawStrandStroke.curlCount = curlCount;
    drawStrandStroke.curlDisplacement = curlDisplacement;
    updateDrawStrandPreview();
    return;
  }
  if (enabled && selectedCoil) {
    selectedLock.curlCount = curlCount;
    selectedLock.curlDisplacement = curlDisplacement;
    updateLockGeometry(selectedLock, { immediate: true });
    syncActiveMirror(selectedLock);
    updateTopologyStats();
  }
}
drawStrandCurlCountInput.addEventListener("input", () => {
  drawStrandCurlCountValue.textContent = Number(drawStrandCurlCountInput.value).toFixed(2);
  syncDrawCurlControls();
});
drawStrandCurlDisplacementInput.addEventListener("input", () => {
  drawStrandCurlDisplacementValue.textContent = Number(drawStrandCurlDisplacementInput.value).toFixed(2);
  syncDrawCurlControls();
});
syncDrawCurlControls();
drawStrandScalpOffsetInput.addEventListener("input", () => {
  drawStrandScalpOffsetValue.textContent = Number(drawStrandScalpOffsetInput.value).toFixed(2);
});
drawStrandSurfaceInput.addEventListener("change", () => {
  finishDrawStrandStroke(null, { cancel: true });
  drawStrandBrushCursor.visible = false;
  autoShowScalpGuideForActiveTool();
  updateScalpEditingVisibility();
  updatePlacementStatus();
});
[
  [braidWidthInput, braidWidthValue],
  [braidDepthInput, braidDepthValue],
  [braidSegmentLengthInput, braidSegmentLengthValue],
  [braidRotationInput, braidRotationValue],
  [braidSmoothingInput, braidSmoothingValue],
  [braidCurveStepInput, braidCurveStepValue],
  [braidScalpOffsetInput, braidScalpOffsetValue]
].forEach(([input, output]) => {
  bindUndoCapture(input);
  input.addEventListener("input", () => {
    output.textContent = input === braidRotationInput
      ? `${Math.round(Number(input.value))} deg`
      : Number(input.value).toFixed(2);
    if (drawStrandStroke?.outputType === "braid") {
      const toolScale = Number(braidToolSizeInput.value);
      drawStrandStroke.braidWidth = Number(braidWidthInput.value) * toolScale;
      drawStrandStroke.brushSize = drawStrandStroke.braidWidth;
      drawStrandStroke.braidDepth = Number(braidDepthInput.value) * toolScale;
      drawStrandStroke.braidSegmentLength = Number(braidSegmentLengthInput.value) * toolScale;
      drawStrandStroke.braidRotation = Number(braidRotationInput.value);
      drawStrandStroke.smoothing = Number(braidSmoothingInput.value);
      drawStrandStroke.curveStep = Number(braidCurveStepInput.value);
      drawStrandStroke.scalpOffset = Number(braidScalpOffsetInput.value);
      updateDrawStrandPreview();
      return;
    }
    const braid = getSelectedLock();
    const target = braid?.geometryType === "braid" ? braid : braidCreationDefaults;
    if (input === braidWidthInput) {
      target.braidWidth = Number(input.value);
      target.widthScale = 1;
      if (braid?.geometryType === "braid") {
        braid.width = braid.braidWidth;
        braid.baseWidth = braid.braidWidth;
      }
    } else if (input === braidDepthInput) {
      target.braidDepth = Number(input.value);
      target.depthScale = 1;
    } else if (input === braidSegmentLengthInput) {
      target.braidSegmentLength = Number(input.value);
    } else if (input === braidRotationInput) {
      target.braidRotation = Number(input.value);
    } else {
      return;
    }
    if (!braid || braid.geometryType !== "braid") return;
    updateLockGeometry(braid, { defer: true });
    syncActiveMirror(braid, { deferGeometry: true });
  });
});
function creationPresetSnapshot(source, type) {
  const snapshot = {
    width: Number(source.width ?? 0.16),
    widthScale: Number(source.widthScale ?? 1),
    depthScale: Number(source.depthScale ?? 1),
    profileOffset: Number(source.profileOffset ?? 0),
    rootScalpOffset: Number(source.rootScalpOffset ?? 0),
    twist: Number(source.twist ?? 0),
    hairLayer: normalizeHairLayer(source.hairLayer),
    dynamicDensity: Boolean(source.dynamicDensity),
    densityAggression: Number(source.densityAggression ?? 0.5),
    taperCurve: cloneShapePresetValue(source.taperCurve),
    depthCurve: cloneShapePresetValue(source.depthCurve),
    sweepProfile: cloneShapePresetValue(source.sweepProfile)
  };
  if (type === "strand") {
    snapshot.curlCount = Number(source.curlCount ?? 4);
    snapshot.curlDisplacement = Number(source.curlDisplacement ?? 0.18);
  } else {
    snapshot.braidMeshPreset = source.braidMeshPreset || DEFAULT_BRAID_MESH_PRESET;
    snapshot.braidWidth = Number(source.braidWidth ?? 0.34);
    snapshot.braidDepth = Number(source.braidDepth ?? 0.44);
    snapshot.braidSegmentLength = Number(source.braidSegmentLength ?? 0.28);
    snapshot.braidRotation = Number(source.braidRotation ?? 0);
  }
  return snapshot;
}

const defaultStrandToolPreset = creationPresetSnapshot(strandCreationDefaults, "strand");
let customCreationPresets = { strand: [], braid: [] };

function loadCustomCreationPresets() {
  try {
    const saved = JSON.parse(localStorage.getItem(CREATION_PRESET_STORAGE_KEY) || "null");
    if (!saved || typeof saved !== "object") return;
    customCreationPresets.strand = Array.isArray(saved.strand) ? saved.strand : [];
    customCreationPresets.braid = Array.isArray(saved.braid) ? saved.braid : [];
  } catch (error) {
    console.warn("Could not load creation presets", error);
  }
}

function saveCustomCreationPresets() {
  try {
    localStorage.setItem(CREATION_PRESET_STORAGE_KEY, JSON.stringify(customCreationPresets));
  } catch (error) {
    console.warn("Could not save creation presets", error);
  }
}

function populateCreationPresetSelect(select, type, selectedValue = select.value) {
  const builtIns = type === "strand"
    ? [{ value: "default", label: "Default Strand" }]
    : [{ value: "classic", label: "Classic Braid" }, { value: "chain-links", label: "Chain Links" }];
  select.replaceChildren();
  builtIns.forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
  if (customCreationPresets[type].length) {
    const group = document.createElement("optgroup");
    group.label = "Custom Presets";
    customCreationPresets[type].forEach((preset) => {
      const option = document.createElement("option");
      option.value = `custom:${preset.id}`;
      option.textContent = preset.name;
      group.append(option);
    });
    select.append(group);
  }
  if ([...select.options].some((option) => option.value === selectedValue)) select.value = selectedValue;
}

function applyCreationPresetSnapshot(target, snapshot, type) {
  const keys = [
    "width", "widthScale", "depthScale", "profileOffset", "rootScalpOffset", "twist",
    "hairLayer", "dynamicDensity", "densityAggression", "curlCount", "curlDisplacement",
    "braidMeshPreset", "braidWidth", "braidDepth", "braidSegmentLength", "braidRotation"
  ];
  keys.forEach((key) => {
    if (snapshot[key] !== undefined) target[key] = snapshot[key];
  });
  ["taperCurve", "depthCurve", "sweepProfile"].forEach((key) => {
    if (snapshot[key]) target[key] = cloneShapePresetValue(snapshot[key]);
  });
  if (type === "braid") normalizeBraidDimensions(target);
}

function applyCustomCreationPreset(type, value) {
  const id = value.replace(/^custom:/, "");
  const preset = customCreationPresets[type].find((item) => item.id === id);
  if (!preset) return;
  const target = type === "braid" ? braidCreationDefaults : strandCreationDefaults;
  applyCreationPresetSnapshot(target, preset.value, type);
  if (!getSelectedLock() && ((type === "braid" && activeTool === "braid") || (type === "strand" && activeTool === "draw"))) {
    syncCreationShapeInputs();
  }
  updatePlacementStatus();
}

let pendingCreationPresetType = null;

function createCustomCreationPreset(type) {
  pendingCreationPresetType = type;
  const label = type === "braid" ? "Braid" : "Strand";
  creationPresetDialogTitle.textContent = `Create ${label} Preset`;
  creationPresetNameInput.value = `New ${label} Preset`;
  creationPresetDialog.showModal();
  requestAnimationFrame(() => {
    creationPresetNameInput.focus();
    creationPresetNameInput.select();
  });
}

function commitCustomCreationPreset() {
  const type = pendingCreationPresetType;
  const name = creationPresetNameInput.value.trim();
  if (!type || !name) return;
  const source = type === "braid" ? braidCreationDefaults : strandCreationDefaults;
  const preset = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    value: creationPresetSnapshot(source, type)
  };
  customCreationPresets[type].push(preset);
  saveCustomCreationPresets();
  const select = type === "braid" ? braidToolPresetInput : strandToolPresetInput;
  populateCreationPresetSelect(select, type, `custom:${preset.id}`);
  pendingCreationPresetType = null;
  creationPresetDialog.close();
}

function applyBraidToolPreset(presetId) {
  const preset = BRAID_TOOL_PRESETS[presetId];
  if (!preset) return;
  braidCreationDefaults.braidMeshPreset = preset.braidMeshPreset;
  braidCreationDefaults.braidWidth = preset.braidWidth;
  braidCreationDefaults.braidDepth = preset.braidDepth;
  braidCreationDefaults.braidSegmentLength = preset.braidSegmentLength;
  braidCreationDefaults.braidRotation = preset.braidRotation;
  braidCreationDefaults.widthScale = 1;
  braidCreationDefaults.depthScale = 1;
  braidCreationDefaults.profileOffset = 0;
  braidCreationDefaults.taperCurve = preset.taperCurve.map((point) => ({ ...point }));
  braidCreationDefaults.depthCurve = preset.depthCurve.map((point) => ({ ...point }));
  braidCreationDefaults.sweepProfile = preset.sweepProfile.map((point) => ({ ...point }));

  if (drawStrandStroke?.outputType === "braid") {
    const toolScale = Number(braidToolSizeInput.value);
    drawStrandStroke.braidMeshPreset = preset.braidMeshPreset;
    drawStrandStroke.braidWidth = preset.braidWidth * toolScale;
    drawStrandStroke.brushSize = drawStrandStroke.braidWidth;
    drawStrandStroke.braidDepth = preset.braidDepth * toolScale;
    drawStrandStroke.braidSegmentLength = preset.braidSegmentLength * toolScale;
    drawStrandStroke.braidRotation = preset.braidRotation;
    updateDrawStrandPreview();
  }

  if (!getSelectedLock()) syncCreationShapeInputs();
  updatePlacementStatus();
}

loadCustomCreationPresets();
populateCreationPresetSelect(strandToolPresetInput, "strand", "default");
populateCreationPresetSelect(braidToolPresetInput, "braid", "classic");

strandToolPresetInput.addEventListener("change", () => {
  pushUndoState();
  if (strandToolPresetInput.value.startsWith("custom:")) {
    applyCustomCreationPreset("strand", strandToolPresetInput.value);
  } else {
    applyCreationPresetSnapshot(strandCreationDefaults, defaultStrandToolPreset, "strand");
    if (!getSelectedLock()) syncCreationShapeInputs();
    updatePlacementStatus();
  }
  drawStrandBrushCursor.scale.setScalar(activeStrokeBrushSize());
});

braidToolPresetInput.addEventListener("change", () => {
  pushUndoState();
  if (braidToolPresetInput.value.startsWith("custom:")) {
    applyCustomCreationPreset("braid", braidToolPresetInput.value);
  } else {
    applyBraidToolPreset(braidToolPresetInput.value);
  }
});

saveStrandToolPresetButton.addEventListener("click", () => createCustomCreationPreset("strand"));
saveBraidToolPresetButton.addEventListener("click", () => createCustomCreationPreset("braid"));
creationPresetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  commitCustomCreationPreset();
});
[closeCreationPresetDialogButton, cancelCreationPresetButton].forEach((button) => {
  button.addEventListener("click", () => creationPresetDialog.close());
});
creationPresetDialog.addEventListener("close", () => {
  pendingCreationPresetType = null;
});

braidMeshPresetInput.addEventListener("change", () => {
  pushUndoState();
  const presetId = braidMeshPresetInput.value;
  if (drawStrandStroke?.outputType === "braid") {
    drawStrandStroke.braidMeshPreset = presetId;
    updateDrawStrandPreview();
    updatePlacementStatus();
    return;
  }
  const braid = getSelectedLock();
  if (braid?.geometryType === "braid") {
    braid.braidMeshPreset = presetId;
    updateLockGeometry(braid);
    syncActiveMirror(braid);
    updateTopologyStats();
  } else {
    braidCreationDefaults.braidMeshPreset = presetId;
  }
  updatePlacementStatus();
});
braidSurfaceInput.addEventListener("change", () => {
  finishDrawStrandStroke(null, { cancel: true });
  drawStrandBrushCursor.visible = false;
  autoShowScalpGuideForActiveTool();
  updateScalpEditingVisibility();
  updatePlacementStatus();
});
drawBrushPresetInput.addEventListener("change", () => setDrawStrandMode(drawBrushPresetInput.value));
hierarchyToggle.addEventListener("click", () => setHierarchyEditing(!hierarchyEditing));
hierarchyRecursiveTransformInput.addEventListener("change", () => {
  recursiveHierarchyTransforms = hierarchyRecursiveTransformInput.checked;
});
proportionalToggle.addEventListener("click", () => setProportionalEditing(!proportionalEditing));
scalpSetupToggle.addEventListener("click", () => {
  setScalpSetupMenuOpen(scalpSetupMenu.classList.contains("hidden"));
});
scalpPaintToggle.addEventListener("click", () => {
  setScalpPaintEditing(!scalpPaintEditing);
  setScalpSetupMenuOpen(false);
});
scalpBuilderMode.addEventListener("click", () => {
  setScalpBuilderEditing(!scalpBuilderEditing);
  setScalpSetupMenuOpen(false);
});
headSetupMode.addEventListener("click", () => {
  setHeadSetupEditing(!headSetupEditing);
  setScalpSetupMenuOpen(false);
});
document.querySelector("#fineTuneScalpGuide").addEventListener("click", () => {
  setHeadSetupEditing(false);
  setScalpBuilderEditing(true);
});
resetScalpBuilderButton.addEventListener("click", resetScalpBuilder);
confirmScalpBuilderButton.addEventListener("click", confirmScalpBuilderPlane);
generateScalpBuilderButton.addEventListener("click", displayScalpBuilderConstructionCurves);
scalpBuilderShowTemplateInput.addEventListener("change", rebuildScalpBuilderTemplateOverlay);
document.addEventListener("pointerdown", (event) => {
  if (!scalpSetupMenu.classList.contains("hidden") && !scalpSetupShell.contains(event.target)) {
    setScalpSetupMenuOpen(false);
  }
});
scalpGuideVisibilityToggle.addEventListener("click", () => setScalpGuideVisibility(!scalpGuideVisible));
[placeAutoShowScalpInput, drawAutoShowScalpInput, braidAutoShowScalpInput].forEach((input) => {
  input.addEventListener("change", () => {
    if (input.checked) autoShowScalpGuideForActiveTool();
  });
});
groupColorToggle.addEventListener("click", () => setGroupColorView(!showGroupColors));
[lightAzimuthInput, lightElevationInput].forEach((input) => {
  input.addEventListener("input", updateLightAngleFromInputs);
});
Object.entries(headTransformInputs).forEach(([key, input]) => {
  bindUndoCapture(input);
  input.addEventListener("input", () => {
    headTransform[key] = Number(input.value);
    headTransformValues[key].textContent = headTransform[key].toFixed(2);
    applyHeadTransform();
  });
});
headTransformResetButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const key = button.dataset.resetHeadTransform;
    const resetValue = key === "uniformScale" ? 1 : 0;
    if (headTransform[key] === resetValue) return;
    pushUndoState();
    headTransform[key] = resetValue;
    syncHeadTransformInputs();
    applyHeadTransform();
  });
});
scalpRoughScaleInputs.forEach((input) => {
  bindUndoCapture(input);
  input.addEventListener("input", () => {
    scalpRoughScale[input.dataset.scalpRoughScaleAxis] = Number(input.value);
    syncScalpRoughScaleInputs();
    applyScalpRoughScale();
  });
});
scalpRoughScaleResetButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const axis = button.dataset.resetScalpRoughScale;
    if (scalpRoughScale[axis] === 1) return;
    pushUndoState();
    scalpRoughScale[axis] = 1;
    syncScalpRoughScaleInputs();
    applyScalpRoughScale();
  });
});
advancedLatticeButton.addEventListener("click", () => setScalpLatticeEditing(!scalpLatticeEditing));
undoButton.addEventListener("click", undoLastAction);

scalpRegionButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveScalpRegion(button.dataset.scalpRegion));
});
document.querySelector("#clearScalpRegions").addEventListener("click", () => clearScalpRegions());
scalpBrushSizeInput.addEventListener("input", () => updatePlacementStatus());

[proportionalRadiusInput, proportionalFalloffInput].forEach((input) => {
  input.addEventListener("input", () => {
    refreshProportionalPreview();
    updatePlacementStatus();
  });
});
proportionalLockRootInput.addEventListener("change", () => {
  proportionalRootLocked = proportionalLockRootInput.checked;
  refreshProportionalPreview();
  updatePlacementStatus();
});

window.addEventListener("keydown", (event) => {
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (event.key === "Shift" && !event.repeat && beginViewSnapFromActiveOrbit()) {
    event.preventDefault();
    return;
  }
  if (event.key === "Escape" && !presetLibrary.classList.contains("hidden")) {
    event.preventDefault();
    setPresetLibraryOpen(false);
    presetLibraryToggle.focus();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undoLastAction();
    return;
  }
  if (tag === "input" || tag === "select" || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key.toLowerCase() === "b") {
    event.preventDefault();
    if (event.repeat || proportionalHotkeyPress) return;
    proportionalHotkeyPress = {
      wasEnabled: proportionalEditing,
      activatedByHold: false,
      startX: lastPointer.x,
      startY: lastPointer.y,
      holdTimer: null
    };
    if (proportionalEditing) beginProportionalSizeEdit(event);
    else proportionalHotkeyPress.holdTimer = window.setTimeout(activateProportionalHotkeyHold, 180);
    updateInteractionLocks();
    return;
  }
  if (event.key.toLowerCase() === "o") {
    event.preventDefault();
    setObjectSpaceEditing(!objectSpaceEditing);
    return;
  }
  if (event.key.toLowerCase() === "h") {
    event.preventDefault();
    setHierarchyEditing(!hierarchyEditing);
    return;
  }
  if (event.key.toLowerCase() === "z") {
    event.preventDefault();
    navigateCurvePointHierarchy(-1);
    return;
  }
  if (event.key.toLowerCase() === "x") {
    event.preventDefault();
    navigateCurvePointHierarchy(1);
    return;
  }
  const tool = shortcutTools[event.key.toLowerCase()];
  if (!tool) return;
  event.preventDefault();
  setActiveTool(tool);
});

window.addEventListener("keyup", (event) => {
  if (event.key.toLowerCase() === "b" && proportionalHotkeyPress) {
    const press = proportionalHotkeyPress;
    window.clearTimeout(press.holdTimer);
    const resizedInfluence = Boolean(proportionalSizeEdit?.didDrag);
    proportionalHotkeyPress = null;
    endProportionalSizeEdit();
    if (!resizedInfluence && !press.activatedByHold) setProportionalEditing(!press.wasEnabled);
    else updateInteractionLocks();
  }
});
window.addEventListener("blur", () => {
  activeViewportPointer = null;
  window.clearTimeout(proportionalHotkeyPress?.holdTimer);
  proportionalHotkeyPress = null;
  endProportionalSizeEdit();
  endViewSnap();
  endViewPlaneMove();
  finishDrawStrandStroke(null, { cancel: true });
  updateInteractionLocks();
});

function deleteLocks(targetLocks) {
  const targets = [...new Set(targetLocks)].filter((lock) => locks.includes(lock));
  if (!targets.length) return;
  targets.forEach((item) => {
    if (item.clumpGuide) dissolveClump(item.clumpId);
    else if (item.clumpId) detachLockFromClump(item);
  });
  if (targets.some((item) => item.curveObjects?.handles.includes(transformControls.object))) transformControls.detach();
  if (targets.some((item) => selectedPoint?.lockId === item.id)) {
    selectedPoint = null;
    updateSelectedPointLabel();
  }
  targets.forEach((item) => {
    hairGroup.remove(item.mesh);
    curveGroup.remove(item.curveObjects.group);
    item.mesh.geometry.dispose();
    item.mesh.material.dispose();
    item.wireOverlay?.geometry.dispose();
    item.wireOverlay?.material.dispose();
    disposeCurveObjects(item);
    locks.splice(locks.indexOf(item), 1);
  });
  if (targets.some((item) => item.id === selectedId)) {
    const fallback = locks.at(-1);
    if (fallback) selectLock(fallback.id);
    else deselectStrands();
  }
  renderLockList();
  updateCount();
}

document.querySelector("#deleteLock").addEventListener("click", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  pushUndoState();
  const mirrorPartner = mirrorXEditing ? mirrorPartnerFor(lock) : null;
  deleteLocks(mirrorPartner ? [lock, mirrorPartner] : [lock]);
});

function disposeCurveObjects(lock) {
  if (!lock.curveObjects) return;
  lock.curveObjects.line.geometry.dispose();
  lock.curveObjects.line.material.dispose();
  lock.curveObjects.handles.forEach((handle) => {
    handle.geometry.dispose();
    handle.material.dispose();
  });
  lock.curveObjects.arrows.forEach((arrow) => {
    arrow.geometry.dispose();
    arrow.material.dispose();
  });
}

document.querySelector("#resetCamera").addEventListener("click", () => {
  if (guideModel) {
    frameGuideModel();
    return;
  }
  camera.up.set(0, 1, 0);
  camera.position.set(0, 1.15, 5.2);
  controls.target.set(0, 0.75, 0);
  controls.update();
});

document.querySelector("#toggleWire").addEventListener("click", () => {
  hairTopologyVisible = !hairTopologyVisible;
  locks.forEach((lock) => {
    if (!lock.wireOverlay) return;
    if (hairTopologyVisible) {
      lock.wireOverlay.geometry.dispose();
      lock.wireOverlay.geometry = createHairTopologyGeometry(lock.mesh.geometry);
    }
    lock.wireOverlay.visible = hairTopologyVisible;
  });
  const button = document.querySelector("#toggleWire");
  button.classList.toggle("active", hairTopologyVisible);
  button.setAttribute("aria-pressed", String(hairTopologyVisible));
});

document.querySelector("#exportObj").addEventListener("click", exportHairObj);

function exportHairObj() {
  let obj = "# Anime Hair Studio export\n";
  let vertexOffset = 1;
  let uvOffset = 1;
  locks.forEach((lock) => {
    obj += `o ${lock.name.replace(/\s+/g, "_")}\n`;
    const geometry = lock.mesh.geometry;
    const positions = geometry.getAttribute("position");
    const uvs = geometry.getAttribute("uv");
    for (let i = 0; i < positions.count; i += 1) {
      obj += `v ${positions.getX(i).toFixed(5)} ${positions.getY(i).toFixed(5)} ${positions.getZ(i).toFixed(5)}\n`;
    }
    if (uvs) {
      for (let i = 0; i < uvs.count; i += 1) {
        obj += `vt ${uvs.getX(i).toFixed(6)} ${uvs.getY(i).toFixed(6)}\n`;
      }
    }
    obj += exportHairFaces(geometry, vertexOffset, uvOffset);
    vertexOffset += positions.count;
    if (uvs) uvOffset += uvs.count;
  });
  const url = URL.createObjectURL(new Blob([obj], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "anime-hair.obj";
  link.click();
  URL.revokeObjectURL(url);
}

function resize() {
  const { clientWidth, clientHeight } = viewport;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight, false);
}

function handleViewportPointerMove(event) {
  if (proportionalHotkeyPress && !proportionalHotkeyPress.wasEnabled && !proportionalHotkeyPress.activatedByHold) {
    const dx = event.clientX - proportionalHotkeyPress.startX;
    const dy = event.clientY - proportionalHotkeyPress.startY;
    if (Math.hypot(dx, dy) >= 3) activateProportionalHotkeyHold();
  }
  lastPointer.x = event.clientX;
  lastPointer.y = event.clientY;
  updateProportionalSizeEdit(event);
}

function blockProportionalSizingEvent(event) {
  if (!proportionalSizeEdit && !proportionalHotkeyPress) return;
  event.preventDefault();
  event.stopPropagation();
}

function updateLightAngleFromInputs() {
  const azimuth = THREE.MathUtils.degToRad(Number(lightAzimuthInput.value));
  const elevation = THREE.MathUtils.degToRad(Number(lightElevationInput.value));
  const horizontalDistance = keyLightDistance * Math.cos(elevation);
  keyLight.position.set(
    horizontalDistance * Math.sin(azimuth),
    keyLightDistance * Math.sin(elevation),
    horizontalDistance * Math.cos(azimuth)
  );
  lightAzimuthValue.textContent = String(Math.round(Number(lightAzimuthInput.value)));
  lightElevationValue.textContent = String(Math.round(Number(lightElevationInput.value)));
}

function beginViewSnap(event) {
  if (event.button !== 0 || !event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;
  const started = startViewSnap(event.pointerId, event.clientX, event.clientY);
  if (!started) return false;
  event.preventDefault();
  event.stopImmediatePropagation();
  return true;
}

function startViewSnap(pointerId, startX, startY) {
  if (viewSnapDrag) return false;
  const dampingEnabled = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = dampingEnabled;
  const offset = camera.position.clone().sub(controls.target);
  const startAxis = nearestCardinalAxis(offset);
  const baseHorizontalAxis = Math.abs(startAxis.y) > 0.5
    ? lastHorizontalViewAxis.clone()
    : startAxis.clone();
  viewSnapDrag = {
    pointerId,
    startX,
    startY,
    distance: offset.length(),
    startAxis,
    baseHorizontalAxis,
    currentAxisKey: "",
    didDrag: false
  };
  renderer.domElement.setPointerCapture?.(pointerId);
  renderer.domElement.style.cursor = "grabbing";
  emptySelectionPointer = null;
  updateInteractionLocks();
  return true;
}

function beginViewSnapFromActiveOrbit() {
  const pointer = activeViewportPointer;
  if (!pointer || !(pointer.buttons & 1) || viewSnapDrag) return false;
  if (
    transformDragging || relaxEdit || proportionalSizeEdit || proportionalHotkeyPress ||
    scalpLatticeDrag || scalpPaintDrag || viewPlaneMoveDrag || placeEdit || drawStrandStroke
  ) return false;
  return startViewSnap(pointer.pointerId, pointer.x, pointer.y);
}

function trackViewportPointerDown(event) {
  if (event.button !== 0) return;
  activeViewportPointer = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    buttons: event.buttons
  };
}

function trackViewportPointerMove(event) {
  if (!activeViewportPointer || activeViewportPointer.pointerId !== event.pointerId) return;
  activeViewportPointer.x = event.clientX;
  activeViewportPointer.y = event.clientY;
  activeViewportPointer.buttons = event.buttons;
  if (!(event.buttons & 1)) activeViewportPointer = null;
}

function clearViewportPointer(event) {
  if (!activeViewportPointer || activeViewportPointer.pointerId !== event.pointerId) return;
  activeViewportPointer = null;
}

function updateViewSnap(event) {
  if (!viewSnapDrag || event.pointerId !== viewSnapDrag.pointerId) return;
  const dx = event.clientX - viewSnapDrag.startX;
  const dy = event.clientY - viewSnapDrag.startY;
  if (!viewSnapDrag.didDrag && Math.hypot(dx, dy) < 3) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  if (!viewSnapDrag.didDrag) {
    viewSnapDrag.didDrag = true;
    shiftSnappedViewActive = true;
    snapCameraToCardinalAxis(viewSnapDrag.startAxis, viewSnapDrag.distance);
    viewSnapDrag.currentAxisKey = cardinalAxisKey(viewSnapDrag.startAxis);
  }

  const horizontalStep = steppedDragAmount(dx);
  const verticalStep = steppedDragAmount(dy);
  let axis = viewSnapDrag.startAxis;
  if (Math.abs(dy) > Math.abs(dx) && verticalStep !== 0) {
    axis = new THREE.Vector3(0, verticalStep > 0 ? 1 : -1, 0);
  } else if (horizontalStep !== 0) {
    axis = viewSnapDrag.baseHorizontalAxis.clone().applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -horizontalStep * Math.PI * 0.5
    );
  }

  const axisKey = cardinalAxisKey(axis);
  if (axisKey !== viewSnapDrag.currentAxisKey) {
    shiftSnappedViewActive = true;
    snapCameraToCardinalAxis(axis, viewSnapDrag.distance);
    viewSnapDrag.currentAxisKey = axisKey;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
}

function nearestCardinalAxis(direction) {
  direction = direction.clone().normalize();
  const absolute = new THREE.Vector3(Math.abs(direction.x), Math.abs(direction.y), Math.abs(direction.z));
  const axis = new THREE.Vector3();
  if (absolute.y >= absolute.x && absolute.y >= absolute.z) {
    axis.set(0, Math.sign(direction.y) || 1, 0);
  } else if (absolute.x >= absolute.z) {
    axis.set(Math.sign(direction.x) || 1, 0, 0);
  } else {
    axis.set(0, 0, Math.sign(direction.z) || 1);
  }
  return axis;
}

function cardinalAxisKey(axis) {
  return `${Math.round(axis.x)},${Math.round(axis.y)},${Math.round(axis.z)}`;
}

function steppedDragAmount(delta) {
  const distance = Math.abs(delta);
  if (distance < CARDINAL_VIEW_DRAG_GRACE) return 0;
  return Math.sign(delta) * (1 + Math.floor((distance - CARDINAL_VIEW_DRAG_GRACE) / CARDINAL_VIEW_DRAG_STEP));
}

function snapCameraToCardinalAxis(axis, distance) {
  axis = nearestCardinalAxis(axis);
  if (Math.abs(axis.y) > 0.5) {
    camera.up.set(0, 0, axis.y > 0 ? -1 : 1);
  } else {
    camera.up.set(0, 1, 0);
    lastHorizontalViewAxis.copy(axis);
  }
  camera.position.copy(controls.target).addScaledVector(axis, distance);
  camera.lookAt(controls.target);
  controls.update();
}

function endViewSnap(event) {
  if (!viewSnapDrag || (event?.pointerId !== undefined && event.pointerId !== viewSnapDrag.pointerId)) return;
  const { pointerId } = viewSnapDrag;
  viewSnapDrag = null;
  if (renderer.domElement.hasPointerCapture?.(pointerId)) renderer.domElement.releasePointerCapture(pointerId);
  renderer.domElement.style.cursor = "";
  updateInteractionLocks();
  event?.preventDefault();
  event?.stopImmediatePropagation();
}

function prepareCurvePointSelection(event) {
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || proportionalSizeEdit || proportionalHotkeyPress || scalpShapeEditing || scalpPaintEditing || scalpBuilderEditing || ["select", "place", "draw", "braid"].includes(activeTool)) return;
  if (pointerHitsTransformGizmo(event)) return;
  const selectedLock = getSelectedLock();
  const handles = selectedLock?.curveObjects?.group.visible ? selectedLock.curveObjects.handles : [];
  if (!handles.length) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(handles, false)[0];
  if (!hit || hit.object === transformControls.object) return;
  transformControls.detach();
  activeHandleEdit = null;
  transformDragging = false;
  updateInteractionLocks();
}

window.addEventListener("resize", resize);
updateGuideControlsVisibility();
updateUndoButton();
setObjectSpaceEditing(false);
setViewPlaneMove(false);
setHierarchyEditing(false);
setProportionalEditing(false);
setScalpShapeEditing(false);
setScalpPaintEditing(false);
setScalpBuilderEditing(false);
updateLightAngleFromInputs();
updateInteractionLocks();
window.addEventListener("pointermove", trackViewportPointerMove);
window.addEventListener("pointermove", updateViewSnap);
window.addEventListener("pointermove", updateViewPlaneMove);
window.addEventListener("pointermove", updateRelaxEdit);
window.addEventListener("pointermove", updatePlaceEdit);
window.addEventListener("pointermove", updateDrawStrandStroke);
window.addEventListener("pointermove", updateSelectionMarquee);
window.addEventListener("pointermove", handleViewportPointerMove);
window.addEventListener("pointermove", updateScalpLatticeDrag);
window.addEventListener("pointermove", updateScalpPaint);
window.addEventListener("pointermove", updateScalpBuilderStroke);
window.addEventListener("pointerup", endViewSnap);
window.addEventListener("pointerup", endViewPlaneMove);
window.addEventListener("pointerup", endRelaxEdit);
window.addEventListener("pointerup", endPlaceEdit);
window.addEventListener("pointerup", finishDrawStrandStroke);
window.addEventListener("pointerup", endScalpLatticeDrag);
window.addEventListener("pointerup", endScalpPaint);
window.addEventListener("pointerup", finishScalpBuilderStroke);
window.addEventListener("pointerup", finishSelectionMarquee);
window.addEventListener("pointerup", endAltOrbit);
window.addEventListener("pointerup", endSelectPointerCapture);
window.addEventListener("pointercancel", endViewSnap);
window.addEventListener("pointercancel", endViewPlaneMove);
window.addEventListener("pointercancel", endRelaxEdit);
window.addEventListener("pointercancel", endPlaceEdit);
window.addEventListener("pointercancel", (event) => finishDrawStrandStroke(event, { cancel: true }));
window.addEventListener("pointercancel", endScalpLatticeDrag);
window.addEventListener("pointercancel", endScalpPaint);
window.addEventListener("pointercancel", (event) => finishScalpBuilderStroke(event, { cancel: true }));
window.addEventListener("pointercancel", () => {
  emptySelectionPointer = null;
});
window.addEventListener("pointercancel", (event) => finishSelectionMarquee(event, { cancel: true }));
window.addEventListener("pointercancel", endAltOrbit);
window.addEventListener("pointercancel", endSelectPointerCapture);
window.addEventListener("pointerup", (event) => {
  if (activeTool === "place" && finishPlacementPointer(event)) {
    event.preventDefault();
  }
});
window.addEventListener("pointercancel", () => {
  placementPointer = null;
});
window.addEventListener("pointerup", clearViewportPointer);
window.addEventListener("pointercancel", clearViewportPointer);
["pointerdown", "click", "dblclick"].forEach((eventName) => {
  renderer.domElement.addEventListener(eventName, blockProportionalSizingEvent, true);
});
renderer.domElement.addEventListener("pointerdown", trackViewportPointerDown, true);
renderer.domElement.addEventListener("pointerdown", beginViewSnap, true);
renderer.domElement.addEventListener("pointerdown", prepareSelectPointerCapture, true);
renderer.domElement.addEventListener("pointerdown", beginAltOrbit, true);
renderer.domElement.addEventListener("pointerdown", prepareCurvePointSelection, true);
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (proportionalSizeEdit || proportionalHotkeyPress) return;
  lastPointer.x = event.clientX;
  lastPointer.y = event.clientY;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (pointerHitsTransformGizmo(event)) return;
  if (scalpBuilderEditing) {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (beginScalpBuilderInput(event)) event.preventDefault();
    return;
  }
  if (scalpPaintEditing) {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    const scalpHit = raycaster.intersectObject(activeScalpSurfaceMesh(), false)[0];
    if (scalpHit) {
      beginScalpPaint(event, scalpHit);
      event.preventDefault();
    }
    return;
  }
  if (scalpLatticeEditing) {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || transformControls.axis) return;
    const latticeHit = raycaster.intersectObjects(scalpLatticeHandles, false)[0];
    if (latticeHit) {
      selectScalpLatticePoint(latticeHit.object.userData.scalpLatticeIndex);
      beginScalpLatticeDrag(latticeHit.object, event);
      event.preventDefault();
    } else if (transformControls.object?.userData.scalpLatticeIndex !== undefined) {
      transformControls.detach();
      selectedScalpLatticeIndex = null;
      scalpLatticeHandles.forEach((handle) => {
        handle.material.color.set(0x58f6ff);
        handle.material.opacity = 0.64;
      });
    }
    return;
  }
  if (scalpShapeEditing) return;
  if (["draw", "braid"].includes(activeTool)) {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    const extensionLock = selectedTipContinuationLock(event);
    const surfaceHit = extensionLock ? null : drawSurfaceHitFromEvent(event, { root: true });
    beginDrawStrandStroke(event, surfaceHit, extensionLock);
    return;
  }
  if (activeTool === "place") {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (placeEdit) {
      beginPlacementPointer(event);
      return;
    }
    const pendingLock = pendingPlacedLock();
    if (pendingPlacedLockId && !pendingLock) {
      finishPlacementFlow();
    } else if (pendingLock) {
      finishPlacementFlow({ keepSelected: true });
      return;
    }
    const curveLattice = selectedCurveLatticeGuide();
    const surfaceHit = curveLattice
      ? raycaster.intersectObjects([curveLattice.mesh, curveLattice.rootMesh, curveLattice.bottomMesh].filter((object) => object && object.visible !== false), false)[0]
      : raycaster.intersectObject(activeScalpSurfaceMesh(), false)[0];
    beginPlacementPointer(event, surfaceHit);
    return;
  }
  if (activeTool === "select") {
    if (event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) return;
    const selectedLattice = selectedCurveLatticeGuide();
    const latticePointHit = selectedLattice?.handlesGroup.visible
      ? raycaster.intersectObjects(selectedLattice.handlesGroup.children, false)[0]
      : null;
    if (latticePointHit) {
      selectionMarqueeDrag = null;
      selectCurveLatticePoint(selectedLattice, latticePointHit.object.userData.curveLatticePointIndex, false);
      return;
    }
    const lockHit = raycaster.intersectObjects(locks.map((lock) => lock.mesh), false)[0] || null;
    const guideHit = raycaster.intersectObjects(
      guides.flatMap((guide) => [guide.mesh, guide.rootMesh, guide.bottomMesh].filter((object) => object && object.visible !== false)),
      false
    )[0] || null;
    const selectedSurface = guideHit && (!lockHit || guideHit.distance <= lockHit.distance)
      ? { type: "guide", hit: guideHit }
      : lockHit
        ? { type: "strand", hit: lockHit }
        : null;
    if (beginSelectionMarquee(event, selectedSurface)) event.preventDefault();
    return;
  }

  const modelingClick = event.button === 0 && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
  const selectedLattice = selectedCurveLatticeGuide();
  if (modelingClick && ["move", "rotate", "scale"].includes(activeTool) && selectedLattice?.handlesGroup.visible) {
    const latticePointHit = raycaster.intersectObjects(selectedLattice.handlesGroup.children, false)[0];
    if (latticePointHit) {
      const directMove = activeTool === "move" && viewPlaneMoveActiveForView();
      const pointIndex = latticePointHit.object.userData.curveLatticePointIndex;
      const preserveMulti = selectedControlPoints.length > 1
        && controlPointIsSelected("lattice", selectedLattice.id, pointIndex);
      selectCurveLatticePoint(
        selectedLattice,
        pointIndex,
        !directMove,
        preserveMulti
      );
      if (directMove) beginViewPlaneMove(null, latticePointHit.object, event);
      event.preventDefault();
      return;
    }
  }
  const selectedLock = getSelectedLock();
  const handles = selectedLock?.curveObjects?.group.visible ? selectedLock.curveObjects.handles : [];
  const hit = modelingClick ? raycaster.intersectObjects(handles, false)[0] : null;

  if (!hit && modelingClick && ["move", "rotate", "scale"].includes(activeTool)) {
    const lockHit = raycaster.intersectObjects(locks.map((lock) => lock.mesh), false)[0] || null;
    const guideHit = raycaster.intersectObjects(
      guides.flatMap((guide) => [guide.mesh, guide.rootMesh, guide.bottomMesh]
        .filter((object) => object && object.visible !== false)),
      false
    )[0] || null;
    const selectedSurface = guideHit && (!lockHit || guideHit.distance <= lockHit.distance)
      ? { type: "guide", hit: guideHit }
      : lockHit
        ? { type: "strand", hit: lockHit }
        : null;

    if (selectedSurface?.type === "guide") {
      const guideId = selectedSurface.hit.object.userData.guideId;
      if (guideId && guideId !== selectedGuideId) {
        selectGuide(guideId);
        event.preventDefault();
        return;
      }
    } else if (selectedSurface?.type === "strand") {
      const lockId = selectedSurface.hit.object.userData.lockId;
      if (lockId && lockId !== selectedId) {
        selectLock(lockId);
        event.preventDefault();
        return;
      }
    }
  }

  if (!hit) {
    if (modelingClick && activeTool === "relax" && selectedLock && selectedPoint?.lockId === selectedLock.id) {
      if (beginRelaxEdit(selectedLock, selectedPoint.pointIndex, event)) {
        event.preventDefault();
      }
    }
    return;
  }
  const handle = hit.object;
  const preserveMulti = selectedControlPoints.length > 1
    && controlPointIsSelected("strand", handle.userData.lockId, handle.userData.pointIndex);
  transformControls.detach();
  activeHandleEdit = null;
  transformDragging = false;
  updateInteractionLocks();
  if (!preserveMulti) {
    const keepIndividualMember = handle.userData.lockId === selectedId && !clumpViewportSelection;
    selectLock(handle.userData.lockId, { individualClumpMember: keepIndividualMember });
  } else {
    selectedId = handle.userData.lockId;
  }
  selectCurvePoint(handle.userData.lockId, handle.userData.pointIndex, preserveMulti);
  if (activeTool === "relax") {
    const lock = getSelectedLock();
    if (lock && beginRelaxEdit(lock, handle.userData.pointIndex, event)) {
      event.preventDefault();
    }
    return;
  }
  if (activeTool === "move" && viewPlaneMoveActiveForView()) {
    beginViewPlaneMove(getSelectedLock(), handle, event);
    return;
  }
  configureTransformControls(activeTool);
  attachTransformForCurvePoint(getSelectedLock(), handle.userData.pointIndex, handle);
  beginHandleEdit();
});

let fpsFrameCount = 0;
let fpsSampleStart = performance.now();

function animate(timestamp = performance.now()) {
  fpsFrameCount += 1;
  const fpsElapsed = timestamp - fpsSampleStart;
  if (fpsElapsed >= 500) {
    viewportFps.textContent = `${Math.round((fpsFrameCount * 1000) / fpsElapsed)} FPS`;
    fpsFrameCount = 0;
    fpsSampleStart = timestamp;
  }
  controls.update();
  updateViewPlaneGrid();
  updatePullGuideVisual();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

renderLockList();
updateAttributeEditorMode();
resize();
animate();
