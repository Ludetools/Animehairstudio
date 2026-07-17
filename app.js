import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const viewport = document.querySelector("#viewport");
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
transformControls.addEventListener("dragging-changed", (event) => {
  transformDragging = event.value;
  updateInteractionLocks();
  if (proportionalSizeEdit) return;
  if (event.value) {
    pushUndoState();
    if (transformControls.object?.userData.scalpLatticeIndex === undefined) beginHandleEdit();
  }
  if (!event.value) activeHandleEdit = null;
});
transformControls.addEventListener("objectChange", () => {
  if (proportionalSizeEdit) return;
  const handle = transformControls.object;
  if (!handle) return;
  if (handle.userData.scalpLatticeIndex !== undefined) {
    updateScalpLatticeFromHandle(handle);
    return;
  }
  const lock = locks.find((item) => item.id === handle.userData.lockId);
  if (!lock) return;
  const pointIndex = handle.userData.pointIndex;
  if (!activeHandleEdit || activeHandleEdit.lockId !== lock.id || activeHandleEdit.pointIndex !== pointIndex) {
    beginHandleEdit();
  }
  if (activeTool === "move") {
    if (hierarchyEditing) applyHierarchicalMove(lock, pointIndex, handle);
    else if (proportionalEditing) applyProportionalMove(lock, pointIndex, handle);
    else applySingleMove(lock, pointIndex, handle);
    syncLockFromCurve(lock);
  } else if (activeTool === "rotate") {
    if (hierarchyEditing) applyHierarchicalRotate(lock, pointIndex, handle);
    else if (proportionalEditing) applyProportionalRotate(lock, pointIndex, handle);
    else applySingleRotate(lock, pointIndex, handle);
  } else if (activeTool === "scale") {
    if (hierarchyEditing) applyHierarchicalScale(lock, pointIndex, handle);
    else if (proportionalEditing) applyProportionalScale(lock, pointIndex, handle);
    else applySingleScale(lock, pointIndex, handle);
    lock.width = Math.max(0.04, lock.baseWidth * average(lock.pointWidths));
  }
  updateLockGeometry(lock);
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
const SCALP_REGIONS = {
  bangs: { label: "Bangs Root", color: 0xef476f },
  "side-bangs-left": { label: "Side Bangs Left", color: 0xb967ff },
  "side-bangs-right": { label: "Side Bangs Right", color: 0xffd166 },
  "side-left": { label: "Side Left", color: 0x47c978 },
  "side-right": { label: "Side Right", color: 0x36c9c6 },
  back: { label: "Back", color: 0x4778e8 },
  unassigned: { label: "Unassigned", color: 0x77747d }
};
const DEFAULT_HAIR_COLOR = "#2c223a";
const DEFAULT_HAIR_MATERIAL_ID = "default-purple";
const ROOT_SCALP_OFFSET_DISTANCE = 0.08;
const DEFAULT_HAIR_MATERIAL_SETTINGS = {
  color: DEFAULT_HAIR_COLOR,
  shadowColor: "#555a78",
  highlightColor: "#e7ebff",
  roughness: 0.72,
  shadowThreshold: 0.12,
  shadowSoftness: 0.025,
  backGradientStrength: 0.36,
  backGradientPower: 1.35,
  highlightWidth: 0.055,
  highlightSoftness: 0.018,
  highlightStrength: 0.68,
  highlightShift: 0.12,
  highlightJaggedness: 0.22,
  highlightJaggedFrequency: 7
};
const hairMaterialDefinitions = [{
  id: DEFAULT_HAIR_MATERIAL_ID,
  name: "Default Purple",
  ...DEFAULT_HAIR_MATERIAL_SETTINGS
}];
let hairMaterialIndex = 1;
const STRAND_GROUPS = [
  { id: "bangs", label: "Front Bangs" },
  { id: "side-bangs-left", label: "Side Bangs Left" },
  { id: "side-bangs-right", label: "Side Bangs Right" },
  { id: "side-left", label: "Side Left" },
  { id: "side-right", label: "Side Right" },
  { id: "back", label: "Back" },
  { id: "unassigned", label: "Unassigned" }
];

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

const DEFAULT_SWEEP_PROFILE = [
  { x: 1, z: -0.31 },
  { x: 0.94, z: -0.18 },
  { x: 0.55, z: 0.14 },
  { x: 0, z: 0.36 },
  { x: -0.55, z: 0.14 },
  { x: -0.94, z: -0.18 },
  { x: -1, z: -0.31 },
  { x: -0.7, z: -0.36 },
  { x: 0.7, z: -0.36 }
];
const DEFAULT_TAPER_CURVE = [
  { position: 0, value: 0.3, interpolation: "smooth" },
  { position: 0.11, value: 0.6, interpolation: "smooth" },
  { position: 0.43, value: 0.95, interpolation: "smooth" },
  { position: 0.68, value: 0.8, interpolation: "smooth" },
  { position: 0.89, value: 0.4, interpolation: "smooth" },
  { position: 1, value: 0, interpolation: "smooth" }
];
const DEFAULT_DEPTH_CURVE = [
  { position: 0, value: 0.18, interpolation: "smooth" },
  { position: 0.25, value: 0.66, interpolation: "smooth" },
  { position: 1, value: 0, interpolation: "smooth" }
];
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
      { x: 1, z: 0 }, { x: 0.7, z: 0.7 }, { x: 0, z: 1 }, { x: -0.7, z: 0.7 },
      { x: -1, z: 0 }, { x: -0.7, z: -0.7 }, { x: 0, z: -1 }, { x: 0.7, z: -0.7 }
    ] }
  ],
  taperCurve: [
    { id: "anime-taper", name: "Anime Taper", value: DEFAULT_TAPER_CURVE },
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
const TAPER_VALUE_MAX = 1.5;
const strandGroupDefaults = Object.fromEntries(STRAND_GROUPS.map((group) => [group.id, {
  taperCurve: DEFAULT_TAPER_CURVE.map((point) => ({ ...point })),
  depthCurve: DEFAULT_DEPTH_CURVE.map((point) => ({ ...point })),
  widthScale: 1,
  depthScale: 1,
  profileOffset: 0,
  rootScalpOffset: 0,
  radialSegments: 10,
  lengthSegments: 26,
  sweepProfile: DEFAULT_SWEEP_PROFILE.map((point) => ({ ...point }))
}]));
const strandCreationDefaults = {
  taperCurve: DEFAULT_TAPER_CURVE.map((point) => ({ ...point })),
  depthCurve: DEFAULT_DEPTH_CURVE.map((point) => ({ ...point })),
  widthScale: 1,
  depthScale: 1,
  profileOffset: 0,
  rootScalpOffset: 0,
  twist: 0,
  splitEnabled: false,
  splitPosition: 0.62,
  splitSpread: 0.28,
  sweepProfile: DEFAULT_SWEEP_PROFILE.map((point) => ({ ...point }))
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

const scalpSurfaceGroup = new THREE.Group();
const {
  geometry: scalpSurfaceGeometry,
  quadEdges: initialScalpQuadEdges,
  quads: scalpQuads
} = createQuadSphereGeometry(SCALP_SEGMENTS);
let scalpQuadEdges = initialScalpQuadEdges;
let scalpActiveVertexIndices = [...Array(scalpSurfaceGeometry.getAttribute("position").count).keys()];

function buildDefaultScalpRegionAssignments(sideBangRows = 5) {
  const rows = THREE.MathUtils.clamp(Math.round(sideBangRows), 0, SCALP_SEGMENTS);
  return scalpQuads.map((quad) => {
    let region = "unassigned";
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
scalpSurfaceGroup.add(scalpSurfaceMesh, scalpSurfaceWire);
scalpSurfaceGroup.visible = false;
scene.add(scalpSurfaceGroup);
const scalpBrushCursor = new THREE.Mesh(
  new THREE.RingGeometry(0.91, 1, 48),
  new THREE.MeshBasicMaterial({ color: SCALP_REGIONS.bangs.color, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide })
);
scalpBrushCursor.visible = false;
scalpBrushCursor.renderOrder = 9;
scene.add(scalpBrushCursor);
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
let hairTopologyVisible = false;
let showGroupColors = false;
let scalpGuideVisible = true;
let selectedId;
let selectedGuideId;
let lockIndex = 1;
let activeTool = "select";
let activeHandleEdit = null;
let transformDragging = false;
let objectSpaceEditing = false;
let hierarchyEditing = false;
let mirrorXEditing = false;
let recursiveHierarchyTransforms = false;
let proportionalEditing = false;
let scalpShapeEditing = false;
let scalpLatticeEditing = false;
let scalpPaintEditing = false;
let scalpPaintDrag = null;
let activeScalpRegion = "bangs";
let selectedScalpLatticeIndex = null;
let scalpLatticeDrag = null;
let selectedPoint = null;
let selectedStrandGroup = null;
let relaxEdit = null;
let placeEdit = null;
let drawStrandStroke = null;
let drawStrandMode = "single";
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
let lastHorizontalViewAxis = new THREE.Vector3(0, 0, 1);
const CARDINAL_VIEW_DRAG_STEP = 72;
const CARDINAL_VIEW_DRAG_GRACE = 48;
let sweepProfileEdit = null;
let taperCurveEdit = null;
const lastPointer = { x: 0, y: 0 };
let pendingPlacedLockId = null;
const locks = [];
const guides = [];
const undoStack = [];
const strandGroupOpen = new Map(STRAND_GROUPS.map((group) => [group.id, true]));
let restoringHistory = false;
let inputUndoCaptured = false;
const inputs = {
  name: document.querySelector("#lockName"),
  widthScale: document.querySelector("#widthScale"),
  depthScale: document.querySelector("#depthScale"),
  profileOffset: document.querySelector("#profileOffset"),
  rootScalpOffset: document.querySelector("#rootScalpOffset"),
  twist: document.querySelector("#twist"),
  splitPosition: document.querySelector("#splitPosition"),
  splitSpread: document.querySelector("#splitSpread"),
  radialSegments: document.querySelector("#strandRadialSegments"),
  lengthSegments: document.querySelector("#strandLengthSegments")
};
const splitEnabledInput = document.querySelector("#splitEnabled");
const mirrorXToggle = document.querySelector("#mirrorXToggle");
const splitControls = document.querySelector("#splitControls");
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
const latticeToggle = document.querySelector("#latticeToggle");
const scalpPaintToggle = document.querySelector("#scalpPaintToggle");
const scalpGuideVisibilityToggle = document.querySelector("#scalpGuideVisibilityToggle");
const groupColorToggle = document.querySelector("#groupColorToggle");
const lightAzimuthInput = document.querySelector("#lightAzimuth");
const lightElevationInput = document.querySelector("#lightElevation");
const lightAzimuthValue = document.querySelector("#lightAzimuthValue");
const lightElevationValue = document.querySelector("#lightElevationValue");
const presetLibraryToggle = document.querySelector("#presetLibraryToggle");
const presetLibrary = document.querySelector("#presetLibrary");
const presetLibraryGrid = document.querySelector("#presetLibraryGrid");
const presetLibraryStatus = document.querySelector("#presetLibraryStatus");
const presetFilterButtons = [...document.querySelectorAll("[data-preset-filter]")];
const hairProjectFileInput = document.querySelector("#hairProjectFile");
const undoButton = document.querySelector("#undoAction");
const placementStatus = document.querySelector("#placementStatus");
const hierarchyNavigationHint = document.querySelector("#hierarchyNavigationHint");
const selectedPointLabel = document.querySelector("#selectedPointLabel");
const proportionalRadiusInput = document.querySelector("#proportionalRadius");
const proportionalFalloffInput = document.querySelector("#proportionalFalloff");
const scalpPanel = document.querySelector("#scalpPanel");
const scalpPaintPanel = document.querySelector("#scalpPaintPanel");
const scalpBrushSizeInput = document.querySelector("#scalpBrushSize");
const scalpRegionButtons = [...document.querySelectorAll("[data-scalp-region]")];
const guidePanel = document.querySelector("#guidePanel");
const groupSettingsPanel = document.querySelector("#groupSettingsPanel");
const groupSettingsTitle = document.querySelector("#groupSettingsTitle");
const presetPanel = document.querySelector("#presetPanel");
const selectedStrandPanel = document.querySelector("#selectedStrandPanel");
const hairMaterialPanel = document.querySelector("#hairMaterialPanel");
const proportionalPanel = document.querySelector("#proportionalPanel");
const hierarchyPanel = document.querySelector("#hierarchyPanel");
const hierarchyRecursiveTransformInput = document.querySelector("#hierarchyRecursiveTransform");
const transformToolPanel = document.querySelector("#transformToolPanel");
const transformToolTitle = document.querySelector("#transformToolTitle");
const viewPlaneMoveSetting = document.querySelector("#viewPlaneMoveSetting");
const viewPlaneMoveInput = document.querySelector("#viewPlaneMove");
const viewPlaneMoveSnappedSetting = document.querySelector("#viewPlaneMoveSnappedSetting");
const viewPlaneMoveSnappedOnlyInput = document.querySelector("#viewPlaneMoveSnappedOnly");
const drawStrandToolPanel = document.querySelector("#drawStrandToolPanel");
const drawStrandBrushSizeInput = document.querySelector("#drawStrandBrushSize");
const drawStrandBrushSizeValue = document.querySelector("#drawStrandBrushSizeValue");
const drawStrandSmoothingInput = document.querySelector("#drawStrandSmoothing");
const drawStrandSmoothingValue = document.querySelector("#drawStrandSmoothingValue");
const drawStrandCurveStepInput = document.querySelector("#drawStrandCurveStep");
const drawStrandCurveStepValue = document.querySelector("#drawStrandCurveStepValue");
const drawStrandScalpOffsetInput = document.querySelector("#drawStrandScalpOffset");
const drawStrandScalpOffsetValue = document.querySelector("#drawStrandScalpOffsetValue");
const drawStrandSurfaceInput = document.querySelector("#drawStrandSurface");
const drawStrandOutputButtons = [...document.querySelectorAll("[data-draw-output]")];
const transformSpaceButtons = [...document.querySelectorAll("[data-transform-space]")];
const strandShapePanel = document.querySelector("#strandShapePanel");
const strandShapeTitle = document.querySelector("#strandShapeTitle");
const randomizeShapeButton = document.querySelector("#randomize");
const groupInputs = {
  widthScale: document.querySelector("#groupWidthScale"),
  depthScale: document.querySelector("#groupDepthScale"),
  profileOffset: document.querySelector("#groupProfileOffset"),
  rootScalpOffset: document.querySelector("#groupRootScalpOffset"),
  radialSegments: document.querySelector("#groupRadialSegments"),
  lengthSegments: document.querySelector("#groupLengthSegments")
};
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
  strandRadialSegments: document.querySelector("#strandRadialSegmentsValue"),
  strandLengthSegments: document.querySelector("#strandLengthSegmentsValue")
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
  draw: "translate"
};
const shortcutTools = {
  q: "select",
  w: "move",
  e: "rotate",
  r: "scale",
  t: "relax",
  a: "place",
  d: "draw"
};

const presets = {
  front: { x: 0, y: 1.56, z: 0.9, length: 1.25, curve: -0.42, width: 0.24, taper: 0.48, twist: 0, color: "#2c223a", scalpRegion: "bangs" },
  side: { x: 0.48, y: 1.42, z: 0.72, length: 1.65, curve: 0.55, width: 0.2, taper: 0.42, twist: 0.45, color: "#2c223a", scalpRegion: "side-right" },
  back: { x: 0.2, y: 1.42, z: -0.62, length: 2.2, curve: 0.18, width: 0.28, taper: 0.5, twist: -0.2, color: "#2c223a", scalpRegion: "back" },
  twin: { x: 1.12, y: 0.88, z: -0.22, length: 2.6, curve: 0.68, width: 0.32, taper: 0.38, twist: 0.85, color: "#2c223a", scalpRegion: "back" },
  ahoge: { x: 0.06, y: 1.95, z: 0.1, length: 0.92, curve: 1.05, width: 0.08, taper: 0.35, twist: 1.2, color: "#2c223a", scalpRegion: "unassigned" }
};

const generatedPresetGroups = new Set(["generated-bangs", "bowl-cut"]);
const presetCatalog = [
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

new OBJLoader().load("./assets/animefacesymmetrical.obj", (obj) => {
  guideModel = obj;
  const box = new THREE.Box3().setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = 2.8 / Math.max(size.x, size.y, size.z);

  obj.scale.setScalar(scale);
  obj.position.set(-center.x * scale, -center.y * scale + 0.05, -center.z * scale);
  obj.traverse((child) => {
    if (!child.isMesh) return;
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
  scene.add(obj);
  fitScalpSurfaceToHead();
  setHeadReferenceTransparency(scalpShapeEditing);
  frameGuideModel();
}, undefined, (error) => {
  console.error("Could not load base head OBJ", error);
});

function frameGuideModel() {
  const box = new THREE.Box3().setFromObject(guideModel);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.62;
  camera.up.set(0, 1, 0);
  controls.target.copy(center);
  controls.target.y += 0.18;
  camera.position.set(center.x, center.y + 0.28, center.z + Math.max(4.2, radius * 2.8));
  camera.near = 0.05;
  camera.far = 100;
  camera.updateProjectionMatrix();
}

function fitScalpSurfaceToHead() {
  if (!guideModel) return;
  const box = new THREE.Box3().setFromObject(guideModel);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.z) * 0.46;
  scalpSurface.x = center.x;
  scalpSurface.y = box.max.y - radius * 0.9;
  scalpSurface.z = center.z;
  scalpSurface.radius = radius;
  scalpSurface.scaleX = 0.98;
  scalpSurface.scaleY = 1;
  scalpSurface.scaleZ = 0.96;
  Object.assign(scalpArtistShape, {
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
  });
  applyDefaultScalpRegionAssignments(scalpArtistShape.sideBangRows);
  updateScalpTopology();
  resetScalpLattice();
  syncScalpInputs();
  syncScalpArtistInputs();
  updateScalpSurface();
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
  lock.points[0].copy(lock.rootSurfacePoint).addScaledVector(
    lock.rootSurfaceNormal,
    rootScalpOffsetDistance(lock.rootScalpOffset)
  );
  lock.placementFrame?.root.copy(lock.points[0]);
  syncLockFromCurve(lock);
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
  scalpRegionAssignments.fill("unassigned");
  scalpManualRegionQuads = new Set(scalpRegionAssignments.keys());
  writeScalpRegionColors();
}

function scalpHitFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(scalpSurfaceMesh, false)[0];
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

function updateScalpEditingVisibility() {
  const visible = activeTool === "place" || (activeTool === "draw" && drawStrandSurfaceInput.value === "scalp") || scalpShapeEditing || scalpPaintEditing;
  scalpSurfaceGroup.visible = visible;
  scalpPanel.classList.toggle("hidden", !scalpShapeEditing || scalpPaintEditing);
  scalpPaintPanel.classList.toggle("hidden", !scalpPaintEditing);
  scalpLatticeGroup.visible = scalpShapeEditing && scalpLatticeEditing;
  const surfaceOpacity = scalpPaintEditing ? 0.46 : ["place", "draw"].includes(activeTool) ? 0.28 : 0.12;
  scalpSurfaceMesh.material.opacity = scalpGuideVisible ? surfaceOpacity : 0;
  scalpSurfaceWire.material.opacity = scalpGuideVisible ? (scalpPaintEditing ? 0.12 : 0.14) : 0;
  scalpSurfaceMesh.material.depthTest = !scalpPaintEditing;
  scalpSurfaceWire.material.depthTest = !scalpPaintEditing;
  scalpSurfaceMesh.material.needsUpdate = true;
  scalpSurfaceWire.material.needsUpdate = true;
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
  if (enabled && scalpPaintEditing) setScalpPaintEditing(false);
  if (enabled && selectedStrandGroup) {
    selectedStrandGroup = null;
    updateAttributeEditorMode();
    renderLockList();
  }
  scalpShapeEditing = enabled;
  latticeToggle.classList.toggle("active", enabled);
  latticeToggle.title = enabled ? "Close placement shape" : "Edit placement shape";
  if (!enabled) setScalpLatticeEditing(false);
  setHeadReferenceTransparency(enabled);
  updateScalpEditingVisibility();
  updatePlacementStatus();
}

function setScalpPaintEditing(enabled) {
  if (enabled && scalpShapeEditing) setScalpShapeEditing(false);
  if (enabled && selectedStrandGroup) {
    selectedStrandGroup = null;
    updateAttributeEditorMode();
    renderLockList();
  }
  scalpPaintEditing = enabled;
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
  selectedId = undefined;
  selectedStrandGroup = null;
  selectedGuideId = id;
  selectedPoint = null;
  updateSelectedPointLabel();
  const guide = getSelectedGuide();
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
    item.mesh.material.color.set(selected ? 0x75c9ff : 0x60707a);
    item.mesh.material.opacity = selected ? item.opacity : Math.min(item.opacity, 0.16);
    item.wire.material.opacity = selected ? 0.7 : 0.25;
  });
  if (!guide) return;
  syncGuideInputs(guide);
}

function updateGuideControlsVisibility() {
  const hasSelectedGuide = Boolean(getSelectedGuide());
  guideControls.forEach((element) => {
    element.classList.toggle("hidden", !hasSelectedGuide);
  });
}

function getSelectedGuide() {
  return guides.find((guide) => guide.id === selectedGuideId);
}

function syncGuideInputs(guide) {
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
  if (tool !== "place") finishPlacementFlow();
  if (tool !== "draw") finishDrawStrandStroke(null, { cancel: true });
  if (tool !== "draw") drawStrandBrushCursor.visible = false;
  if (["place", "draw"].includes(tool) && scalpShapeEditing) setScalpShapeEditing(false);
  if (tool !== "move") endViewPlaneMove();
  activeTool = tool;
  updateScalpEditingVisibility();
  modeToolButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  transformControls.detach();
  if (!["relax", "place", "draw"].includes(tool)) configureTransformControls(tool);
  locks.forEach((lock) => updateCurveObjects(lock, { visible: lock.id === selectedId }));
  updateAttributeEditorMode();
  updateViewPlaneGrid();
  updatePlacementStatus();
}

function setDrawStrandMode(mode) {
  if (!["single", "clump"].includes(mode)) return;
  finishDrawStrandStroke(null, { cancel: true });
  drawStrandMode = mode;
  drawStrandOutputButtons.forEach((button) => {
    const active = button.dataset.drawOutput === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
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
  if (!proportionalEditing) endProportionalSizeEdit();
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
}

function updateInteractionLocks() {
  controls.enabled = !transformDragging && !relaxEdit && !proportionalSizeEdit && !proportionalHotkeyPress && !scalpLatticeDrag && !scalpPaintDrag && !viewSnapDrag && !viewPlaneMoveDrag && !drawStrandStroke;
  transformControls.enabled = !proportionalSizeEdit && !proportionalHotkeyPress && !viewSnapDrag && !viewPlaneMoveDrag && !drawStrandStroke;
}

function configureTransformControls(tool) {
  transformControls.setMode(toolModes[tool]);
  transformControls.setSpace(objectSpaceEditing ? "local" : "world");
  transformControls.showX = true;
  transformControls.showY = tool !== "scale";
  transformControls.showZ = true;
}

function beginHandleEdit(handle = transformControls.object) {
  if (!handle?.userData?.lockId) return;
  const lock = locks.find((item) => item.id === handle.userData.lockId);
  if (!lock) return;
  const hadMirrorPartner = Boolean(mirrorPartnerFor(lock));
  syncActiveMirror(lock, { refreshUi: !hadMirrorPartner });
  activeHandleEdit = {
    lockId: lock.id,
    pointIndex: handle.userData.pointIndex,
    tool: activeTool,
    points: lock.points.map((point) => point.clone()),
    pointTwists: [...lock.pointTwists],
    pointScales: lock.pointScales.map((scale) => ({ x: scale.x, z: scale.z })),
    handlePosition: handle.position.clone(),
    handleQuaternion: handle.quaternion.clone(),
    handleScale: handle.scale.clone()
  };
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
  const directMoveActive = viewPlaneMoveActiveForView() && activeTool === "move";
  const freeDrawActive = activeTool === "draw" && Boolean(drawStrandStroke?.freePlane);
  const visible = freeDrawActive || (directMoveActive && Boolean(point) && lock.id === selectedId);
  viewPlaneFill.visible = visible;
  viewPlaneGrid.visible = visible;
  if (!visible) {
    if (
      activeTool === "move" &&
      point &&
      lock.id === selectedId &&
      !viewPlaneMoveDrag &&
      transformControls.object !== lock.curveObjects?.handles[selectedPoint.pointIndex]
    ) {
      const handle = lock.curveObjects?.handles[selectedPoint.pointIndex];
      if (handle) {
        configureTransformControls("move");
        transformControls.attach(handle);
      }
    }
    return;
  }
  if (!viewPlaneMoveDrag && transformControls.object) transformControls.detach();
  const normal = drawStrandStroke?.freePlane?.normal || viewPlaneMoveDrag?.normal || viewPlaneNormal();
  const origin = drawStrandStroke?.freePlane?.origin || viewPlaneMoveDrag?.planeOrigin || point;
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
  const normal = viewPlaneNormal();
  const planeOrigin = handle.position.clone();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, planeOrigin);
  const startIntersection = rayFromViewportEvent(event).intersectPlane(plane, new THREE.Vector3());
  if (!startIntersection) return false;

  pushUndoState();
  transformControls.detach();
  beginHandleEdit(handle);
  viewPlaneMoveDrag = {
    pointerId: event.pointerId,
    lockId: lock.id,
    pointIndex: handle.userData.pointIndex,
    handle,
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
  const lock = locks.find((item) => item.id === viewPlaneMoveDrag.lockId);
  if (!lock || !activeHandleEdit) {
    endViewPlaneMove(event);
    return;
  }
  const intersection = rayFromViewportEvent(event).intersectPlane(viewPlaneMoveDrag.plane, new THREE.Vector3());
  if (!intersection) return;
  viewPlaneMoveDrag.handle.position
    .copy(activeHandleEdit.handlePosition)
    .add(intersection.sub(viewPlaneMoveDrag.startIntersection));

  if (hierarchyEditing) applyHierarchicalMove(lock, viewPlaneMoveDrag.pointIndex, viewPlaneMoveDrag.handle);
  else if (proportionalEditing) applyProportionalMove(lock, viewPlaneMoveDrag.pointIndex, viewPlaneMoveDrag.handle);
  else applySingleMove(lock, viewPlaneMoveDrag.pointIndex, viewPlaneMoveDrag.handle);
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
  viewPlaneMoveDrag = null;
  activeHandleEdit = null;
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
  relaxEdit = null;
  updateInteractionLocks();
}

function disposeGuide(guide) {
  guide.mesh.geometry.dispose();
  guide.mesh.material.dispose();
  guide.wire.geometry.dispose();
  guide.wire.material.dispose();
}

function legacyTaperCurve(shape = {}) {
  const rootTaper = THREE.MathUtils.clamp(Number(shape.rootTaper ?? 0), 0, 1);
  const rootEnd = THREE.MathUtils.clamp(Number(shape.rootTaperEnd ?? 0.2), 0.02, 0.6);
  const tipTaper = THREE.MathUtils.clamp(Number(shape.taper ?? 1), 0, 1);
  const tipStart = THREE.MathUtils.clamp(Number(shape.taperStart ?? 0.42), rootEnd, 0.95);
  return [
    { position: 0, value: 1 - rootTaper, interpolation: "smooth" },
    { position: rootEnd, value: 1, interpolation: "smooth" },
    { position: tipStart, value: 1, interpolation: "smooth" },
    { position: 1, value: 1 - tipTaper, interpolation: "smooth" }
  ];
}

function normalizeTaperCurve(curve, fallback = {}) {
  const source = curve?.length >= 2 ? curve : legacyTaperCurve(fallback);
  const points = source.map((point) => ({
    position: THREE.MathUtils.clamp(Number(point.position), 0, 1),
    value: THREE.MathUtils.clamp(Number(point.value), 0, TAPER_VALUE_MAX),
    interpolation: ["linear", "smooth", "constant"].includes(point.interpolation) ? point.interpolation : "smooth"
  })).sort((a, b) => a.position - b.position);
  points[0].position = 0;
  points.at(-1).position = 1;
  return points;
}

const taperTangentCache = new WeakMap();

function smoothTaperTangents(curve) {
  const signature = curve.map((point) => `${point.position}:${point.value}`).join("|");
  const cached = taperTangentCache.get(curve);
  if (cached?.signature === signature) return cached.tangents;
  const intervals = curve.slice(0, -1).map((point, index) => Math.max(0.0001, curve[index + 1].position - point.position));
  const slopes = intervals.map((interval, index) => (curve[index + 1].value - curve[index].value) / interval);
  const tangents = curve.map((point, index) => {
    if (index === 0) return slopes[0] || 0;
    if (index === curve.length - 1) return slopes.at(-1) || 0;
    const before = slopes[index - 1];
    const after = slopes[index];
    if (!before || !after || Math.sign(before) !== Math.sign(after)) return 0;
    const beforeWeight = 2 * intervals[index] + intervals[index - 1];
    const afterWeight = intervals[index] + 2 * intervals[index - 1];
    return (beforeWeight + afterWeight) / (beforeWeight / before + afterWeight / after);
  });
  taperTangentCache.set(curve, { signature, tangents });
  return tangents;
}

function sampleTaperCurve(curve, t) {
  if (!curve?.length) return 1;
  const clampedT = THREE.MathUtils.clamp(t, 0, 1);
  const rightIndex = curve.findIndex((point) => point.position >= clampedT);
  if (rightIndex <= 0) return curve[0].value;
  if (rightIndex < 0) return curve.at(-1).value;
  const left = curve[rightIndex - 1];
  const right = curve[rightIndex];
  const span = Math.max(0.0001, right.position - left.position);
  let amount = THREE.MathUtils.clamp((clampedT - left.position) / span, 0, 1);
  if (left.interpolation === "constant") amount = 0;
  if (left.interpolation === "smooth") {
    const tangents = smoothTaperTangents(curve);
    const amount2 = amount * amount;
    const amount3 = amount2 * amount;
    const value = (2 * amount3 - 3 * amount2 + 1) * left.value
      + (amount3 - 2 * amount2 + amount) * span * tangents[rightIndex - 1]
      + (-2 * amount3 + 3 * amount2) * right.value
      + (amount3 - amount2) * span * tangents[rightIndex];
    return THREE.MathUtils.clamp(value, Math.min(left.value, right.value), Math.max(left.value, right.value));
  }
  return THREE.MathUtils.lerp(left.value, right.value, amount);
}

function strandRadiusAt(lock, t, axis, radiusScale = 1) {
  const shapeCurve = axis === "z" ? lock.depthCurve : lock.taperCurve;
  const axisScale = axis === "z" ? Number(lock.depthScale ?? 1) : Number(lock.widthScale ?? 1);
  return Math.max(0, lock.baseWidth * sampleTaperCurve(shapeCurve, t) * axisScale * radiusScale);
}

function createSplitHairGeometry(lock) {
  const curve = new THREE.CatmullRomCurve3(lock.points);
  const profilePoints = (lock.sweepProfile?.length >= 4 ? lock.sweepProfile : DEFAULT_SWEEP_PROFILE)
    .map((point) => new THREE.Vector3(point.x, 0, point.z + Number(lock.profileOffset || 0)));
  const profileCurve = new THREE.CatmullRomCurve3(profilePoints, true, "centripetal", 0.5);
  const radialSegments = THREE.MathUtils.clamp(Math.round(lock.radialSegments || 10), 4, 24);
  const lengthSegments = THREE.MathUtils.clamp(Math.round(lock.lengthSegments || 26), 6, 64);
  const splitT = THREE.MathUtils.clamp(Number(lock.splitPosition ?? 0.62), 0.25, 0.85);
  const stemSegments = THREE.MathUtils.clamp(Math.round(lengthSegments * splitT), 2, lengthSegments - 2);
  const branchSegments = Math.max(2, lengthSegments - stemSegments);
  const spreadControl = THREE.MathUtils.clamp(Number(lock.splitSpread ?? 0.28), 0.05, 0.8);
  const spread = spreadControl * Math.max(lock.baseWidth * 2.2, lock.length * 0.14);
  const splitFrame = strandFrameAt(lock, splitT);
  const splitTwist = strandTwistAt(lock, splitT);
  const vertices = [];
  const normals = [];
  const tangents = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  function appendRing(point, frame, t, radiusScale = 1) {
    const ringStart = vertices.length / 3;
    const radiusX = strandRadiusAt(lock, t, "x", radiusScale);
    const radiusZ = strandRadiusAt(lock, t, "z", radiusScale);
    const scaleX = sampleScale(lock.pointScales, t, "x");
    const scaleZ = sampleScale(lock.pointScales, t, "z");
    const color = strandInfluenceColor(lock, t);
    for (let j = 0; j < radialSegments; j += 1) {
      const profile = profileCurve.getPoint(j / radialSegments);
      const offset = frame.x.clone().multiplyScalar(profile.x * radiusX * scaleX);
      offset.add(frame.z.clone().multiplyScalar(profile.z * radiusZ * scaleZ));
      vertices.push(point.x + offset.x, point.y + offset.y, point.z + offset.z);
      normals.push(offset.x, offset.y, offset.z);
      tangents.push(frame.y.x, frame.y.y, frame.y.z, 1);
      uvs.push(j / radialSegments, t);
      colors.push(color.r, color.g, color.b);
    }
    return ringStart;
  }

  function connectRings(previous, next) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = previous + j;
      const b = previous + ((j + 1) % radialSegments);
      const c = next + j;
      const d = next + ((j + 1) % radialSegments);
      indices.push(a, c, b, b, c, d);
    }
  }

  const stemRings = [];
  for (let i = 0; i <= stemSegments; i += 1) {
    const t = splitT * (i / stemSegments);
    stemRings.push(appendRing(curve.getPoint(t), strandFrameAt(lock, t), t));
    if (i > 0) connectRings(stemRings[i - 1], stemRings[i]);
  }
  const junctionRing = stemRings.at(-1);

  function branchCenter(offsetMultiplier, s) {
    const t = THREE.MathUtils.lerp(splitT, 1, s);
    const divergence = s * s * (3 - 2 * s);
    return curve.getPoint(t).addScaledVector(splitFrame.x, offsetMultiplier * spread * divergence);
  }

  function branchFrame(offsetMultiplier, s) {
    const step = 0.5 / branchSegments;
    const previous = branchCenter(offsetMultiplier, Math.max(0, s - step));
    const next = branchCenter(offsetMultiplier, Math.min(1, s + step));
    const point = branchCenter(offsetMultiplier, s);
    const tangent = next.sub(previous).normalize();
    let z = splitFrame.z.clone().projectOnPlane(tangent).normalize();
    if (z.lengthSq() < 0.01) z = outwardNormalAtPoint(point, tangent);
    const t = THREE.MathUtils.lerp(splitT, 1, s);
    z.applyAxisAngle(tangent, strandTwistAt(lock, t) - splitTwist).normalize();
    const x = new THREE.Vector3().crossVectors(tangent, z).normalize();
    return { x, y: tangent, z };
  }

  const branchEnds = [];
  [
    { offsetMultiplier: 0, tipScale: 1, followsMainCurve: true },
    { offsetMultiplier: 1, tipScale: 0.58, followsMainCurve: false }
  ].forEach(({ offsetMultiplier, tipScale, followsMainCurve }) => {
    let previousRing = junctionRing;
    for (let i = 1; i <= branchSegments; i += 1) {
      const s = i / branchSegments;
      const t = THREE.MathUtils.lerp(splitT, 1, s);
      const childScale = followsMainCurve ? 1 : THREE.MathUtils.lerp(1, tipScale, THREE.MathUtils.smoothstep(s, 0, 0.35));
      const frame = followsMainCurve ? strandFrameAt(lock, t) : branchFrame(offsetMultiplier, s);
      const nextRing = appendRing(branchCenter(offsetMultiplier, s), frame, t, childScale);
      connectRings(previousRing, nextRing);
      previousRing = nextRing;
    }
    branchEnds.push({
      ring: previousRing,
      point: branchCenter(offsetMultiplier, 1),
      frame: followsMainCurve ? strandFrameAt(lock, 1) : branchFrame(offsetMultiplier, 1)
    });
  });

  const startPoint = curve.getPoint(0);
  const startFrame = strandFrameAt(lock, 0);
  const startCenter = vertices.length / 3;
  vertices.push(startPoint.x, startPoint.y, startPoint.z);
  normals.push(-startFrame.y.x, -startFrame.y.y, -startFrame.y.z);
  tangents.push(startFrame.x.x, startFrame.x.y, startFrame.x.z, 1);
  uvs.push(0.5, 0);
  const startColor = strandInfluenceColor(lock, 0);
  colors.push(startColor.r, startColor.g, startColor.b);
  for (let j = 0; j < radialSegments; j += 1) {
    indices.push(startCenter, (j + 1) % radialSegments, j);
  }

  branchEnds.forEach(({ ring, point, frame }) => {
    const center = vertices.length / 3;
    vertices.push(point.x, point.y, point.z);
    normals.push(frame.y.x, frame.y.y, frame.y.z);
    tangents.push(frame.x.x, frame.x.y, frame.x.z, 1);
    uvs.push(0.5, 1);
    const color = strandInfluenceColor(lock, 1);
    colors.push(color.r, color.g, color.b);
    for (let j = 0; j < radialSegments; j += 1) {
      indices.push(center, ring + j, ring + ((j + 1) % radialSegments));
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("tangent", new THREE.Float32BufferAttribute(tangents, 4));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.userData.sideTriangleCount = (stemSegments + branchSegments * 2) * radialSegments * 2;
  geometry.userData.splitJunctionRing = junctionRing;
  geometry.computeVertexNormals();
  return geometry;
}

function createHairGeometry(lock) {
  if (lock.splitEnabled) return createSplitHairGeometry(lock);
  const curve = new THREE.CatmullRomCurve3(lock.points);
  const profilePoints = (lock.sweepProfile?.length >= 4 ? lock.sweepProfile : DEFAULT_SWEEP_PROFILE)
    .map((point) => new THREE.Vector3(point.x, 0, point.z + Number(lock.profileOffset || 0)));
  const profileCurve = new THREE.CatmullRomCurve3(profilePoints, true, "centripetal", 0.5);
  const radialSegments = THREE.MathUtils.clamp(Math.round(lock.radialSegments || 10), 4, 24);
  const lengthSegments = THREE.MathUtils.clamp(Math.round(lock.lengthSegments || 26), 4, 64);
  const vertices = [];
  const normals = [];
  const tangents = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  for (let i = 0; i <= lengthSegments; i += 1) {
    const t = i / lengthSegments;
    const point = curve.getPoint(t);
    const frame = strandFrameAt(lock, t);
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
  }

  const startPoint = curve.getPoint(0);
  const endPoint = curve.getPoint(1);
  const startCenter = vertices.length / 3;
  vertices.push(startPoint.x, startPoint.y, startPoint.z);
  normals.push(0, 1, 0);
  const startFrame = strandFrameAt(lock, 0);
  tangents.push(startFrame.x.x, startFrame.x.y, startFrame.x.z, 1);
  uvs.push(0.5, 0);
  const startColor = strandInfluenceColor(lock, 0);
  colors.push(startColor.r, startColor.g, startColor.b);
  const endCenter = vertices.length / 3;
  vertices.push(endPoint.x, endPoint.y, endPoint.z);
  normals.push(0, -1, 0);
  const endFrame = strandFrameAt(lock, 1);
  tangents.push(endFrame.x.x, endFrame.x.y, endFrame.x.z, 1);
  uvs.push(0.5, 1);
  const endColor = strandInfluenceColor(lock, 1);
  colors.push(endColor.r, endColor.g, endColor.b);

  for (let i = 0; i < lengthSegments; i += 1) {
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
    const c = lengthSegments * radialSegments + j;
    const d = lengthSegments * radialSegments + ((j + 1) % radialSegments);
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
  geometry.userData.sideTriangleCount = lengthSegments * radialSegments * 2;
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
  if (!showGroupColors) return materialForLock(lock).color;
  const region = SCALP_REGIONS[lock.scalpRegion || "unassigned"] || SCALP_REGIONS.unassigned;
  return region.color;
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
  return strandGroupDefaults[region] || strandGroupDefaults.unassigned;
}

function creationToolActive() {
  return activeTool === "place" || activeTool === "draw";
}

function activeStrandShapeTarget() {
  return creationToolActive() ? strandCreationDefaults : getSelectedLock();
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
  if (sweepProfileEdit.type === "creation") return strandCreationDefaults.sweepProfile;
  return locks.find((lock) => lock.id === sweepProfileEdit.id)?.sweepProfile || null;
}

function activeProfileOffset() {
  if (!sweepProfileEdit) return 0;
  if (sweepProfileEdit.type === "group") return Number(strandGroupDefaults[sweepProfileEdit.id]?.profileOffset || 0);
  if (sweepProfileEdit.type === "creation") return Number(strandCreationDefaults.profileOffset || 0);
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
  if (taperCurveEdit.type === "creation") return strandCreationDefaults[taperCurveEdit.curveKey];
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
  } else if (creationToolActive()) {
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
  if (creationToolActive()) nextEdit = { type: "creation", id: "new-strand", curveKey, selectedIndex: 0, dragPointerId: null };
  else if (selectedStrandGroup) nextEdit = { type: "group", id: selectedStrandGroup, curveKey, selectedIndex: 0, dragPointerId: null };
  else {
    const lock = getSelectedLock();
    if (lock) nextEdit = { type: "strand", id: lock.id, curveKey, selectedIndex: 0, dragPointerId: null };
  }
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
    // The preview below is the only live geometry needed for creation defaults.
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
  if (creationToolActive()) {
    nextEdit = { type: "creation", id: "new-strand", selectedIndex: 0, dragPointerId: null };
  } else if (selectedStrandGroup) {
    nextEdit = { type: "group", id: selectedStrandGroup, selectedIndex: 0, dragPointerId: null };
  } else {
    const lock = getSelectedLock();
    if (lock) nextEdit = { type: "strand", id: lock.id, selectedIndex: 0, dragPointerId: null };
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
  lock.taperCurve = normalizeTaperCurve(base.taperCurve || topologyDefaults.taperCurve, base);
  lock.depthCurve = normalizeTaperCurve(base.depthCurve || topologyDefaults.depthCurve, base);
  lock.widthScale = Number(base.widthScale ?? topologyDefaults.widthScale ?? 1);
  lock.depthScale = Number(base.depthScale ?? topologyDefaults.depthScale ?? 1);
  lock.profileOffset = Number(base.profileOffset ?? topologyDefaults.profileOffset ?? 0);
  lock.splitEnabled = Boolean(base.splitEnabled);
  lock.splitPosition = Number(base.splitPosition ?? 0.62);
  lock.splitSpread = Number(base.splitSpread ?? 0.28);
  lock.rootScalpOffset = Number(base.rootScalpOffset ?? topologyDefaults.rootScalpOffset ?? 0);
  lock.rootSurfacePoint = base.rootSurfacePoint?.clone() || null;
  lock.rootSurfaceNormal = base.rootSurfaceNormal?.clone()?.normalize() || null;
  lock.sweepProfile = (base.sweepProfile || topologyDefaults.sweepProfile).map((point) => ({ ...point }));
  lock.points = base.points ? base.points.map((point) => point.clone()) : createCurvePoints(lock);
  lock.pointScales = lock.points.map(() => ({ x: 1, z: 1 }));
  lock.pointWidths = lock.points.map(() => 1);
  lock.baseWidth = lock.width;
  fitPointAttributes(lock, lock.points.length);
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
    x: -lock.x,
    y: lock.y,
    z: lock.z,
    length: lock.length,
    curve: -lock.curve,
    width: lock.width,
    widthScale: lock.widthScale,
    depthScale: lock.depthScale,
    taperCurve: lock.taperCurve.map((point) => ({ ...point })),
    depthCurve: lock.depthCurve.map((point) => ({ ...point })),
    splitEnabled: lock.splitEnabled,
    splitPosition: lock.splitPosition,
    splitSpread: lock.splitSpread,
    rootScalpOffset: lock.rootScalpOffset,
    rootSurfacePoint: mirroredVector(lock.rootSurfacePoint),
    rootSurfaceNormal: mirroredVector(lock.rootSurfaceNormal),
    twist: -lock.twist,
    radialSegments: lock.radialSegments,
    lengthSegments: lock.lengthSegments,
    profileOffset: lock.profileOffset,
    sweepProfile: lock.sweepProfile.map((point) => ({ ...point })),
    points: lock.points.map(mirroredVector)
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

function syncMirrorPartnerFromLock(lock, partner = mirrorPartnerFor(lock)) {
  if (!lock || !partner || partner === lock) return null;
  partner.materialId = lock.materialId || DEFAULT_HAIR_MATERIAL_ID;
  partner.scalpRegion = mirroredScalpRegion(lock.scalpRegion);
  partner.width = lock.width;
  partner.baseWidth = lock.baseWidth;
  partner.widthScale = Number(lock.widthScale ?? 1);
  partner.depthScale = Number(lock.depthScale ?? 1);
  partner.twist = -Number(lock.twist || 0);
  partner.taperCurve = lock.taperCurve.map((point) => ({ ...point }));
  partner.depthCurve = lock.depthCurve.map((point) => ({ ...point }));
  partner.sweepProfile = lock.sweepProfile.map((point) => ({ ...point }));
  partner.profileOffset = Number(lock.profileOffset || 0);
  partner.splitEnabled = Boolean(lock.splitEnabled);
  partner.splitPosition = Number(lock.splitPosition ?? 0.62);
  partner.splitSpread = Number(lock.splitSpread ?? 0.28);
  partner.rootScalpOffset = Number(lock.rootScalpOffset || 0);
  partner.rootSurfacePoint = mirroredVector(lock.rootSurfacePoint);
  partner.rootSurfaceNormal = mirroredVector(lock.rootSurfaceNormal)?.normalize() || null;
  partner.radialSegments = lock.radialSegments;
  partner.lengthSegments = lock.lengthSegments;
  partner.points = lock.points.map(mirroredVector);
  partner.pointScales = lock.pointScales.map((scale) => ({ x: scale.x, z: scale.z }));
  partner.pointWidths = [...lock.pointWidths];
  partner.pointTwists = lock.pointTwists.map((twist) => -twist);
  partner.placementFrame = mirroredPlacementFrame(lock.placementFrame);
  fitPointAttributes(partner, partner.points.length);
  if (partner.curveObjects.handles.length !== partner.points.length) rebuildCurveObjects(partner);
  syncLockFromCurve(partner);
  applyMaterialDefinitionToLock(partner);
  updateLockGeometry(partner);
  return partner;
}

function syncActiveMirror(lock, options = {}) {
  if (!mirrorXEditing || !lock) return null;
  const partner = mirrorPartnerFor(lock) || createMirrorPartner(lock, { deferUi: true });
  const result = syncMirrorPartnerFromLock(lock, partner);
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
}

function snapshotState() {
  return {
    lockIndex,
    hairMaterialIndex,
    hairMaterials: hairMaterialDefinitions.map((material) => ({ ...material })),
    selectedId,
    selectedGuideId,
    selectedStrandGroup,
    selectedPoint: selectedPoint ? { ...selectedPoint } : null,
    pendingPlacedLockId,
    mirrorXEditing,
    scalpSurface: { ...scalpSurface },
    scalpArtistShape: { ...scalpArtistShape },
    scalpLatticePoints: scalpLatticePoints.map(vectorToData),
    scalpRegionAssignments: [...scalpRegionAssignments],
    scalpManualRegionQuads: [...scalpManualRegionQuads],
    strandGroupDefaults: Object.fromEntries(Object.entries(strandGroupDefaults).map(([region, defaults]) => [region, {
      ...defaults,
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
      widthScale: Number(lock.widthScale ?? 1),
      depthScale: Number(lock.depthScale ?? 1),
      taperCurve: lock.taperCurve.map((point) => ({ ...point })),
      depthCurve: lock.depthCurve.map((point) => ({ ...point })),
      profileOffset: Number(lock.profileOffset ?? 0),
      splitEnabled: Boolean(lock.splitEnabled),
      splitPosition: Number(lock.splitPosition ?? 0.62),
      splitSpread: Number(lock.splitSpread ?? 0.28),
      rootScalpOffset: lock.rootScalpOffset,
      rootSurfacePoint: lock.rootSurfacePoint ? vectorToData(lock.rootSurfacePoint) : null,
      rootSurfaceNormal: lock.rootSurfaceNormal ? vectorToData(lock.rootSurfaceNormal) : null,
      twist: lock.twist,
      radialSegments: lock.radialSegments,
      lengthSegments: lock.lengthSegments,
      sweepProfile: lock.sweepProfile.map((point) => ({ ...point })),
      scalpRegion: lock.scalpRegion || "unassigned",
      points: lock.points.map(vectorToData),
      pointWidths: [...lock.pointWidths],
      pointScales: lock.pointScales.map((scale) => ({ x: scale.x, z: scale.z })),
      pointTwists: [...lock.pointTwists],
      placementFrame: lock.placementFrame ? frameToData(lock.placementFrame) : null
    })),
    guides: guides.map((guide) => ({
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

function projectFileName(name) {
  const safeName = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${safeName || "anime-hair-project"}.animehair.json`;
}

function buildHairProjectFile(name) {
  const state = snapshotState();
  state.pendingPlacedLockId = null;
  const groupCounts = Object.fromEntries(STRAND_GROUPS.map((group) => [
    group.id,
    state.locks.filter((lock) => (lock.scalpRegion || "unassigned") === group.id).length
  ]));
  return {
    format: "anime-hair-studio-project",
    version: 1,
    application: "Anime Hair Studio",
    metadata: {
      name,
      authoredBy: "human",
      savedAt: new Date().toISOString(),
      strandCount: state.locks.length,
      guideCount: state.guides.length,
      groupCounts
    },
    state
  };
}

async function saveHairProjectThroughLocalDialog(content, suggestedName) {
  const payload = JSON.stringify({ suggestedName, content });
  if (location.protocol === "file:") {
    try {
      await fetch("http://127.0.0.1:5173/api/save-project", {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: payload
      });
      return { submitted: true };
    } catch (error) {
      console.warn("Primary Save As helper unavailable.", error);
    }
  }
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
    const project = JSON.parse(await file.text());
    if (project?.format !== "anime-hair-studio-project" || Number(project.version) !== 1) {
      throw new Error("Unsupported Anime Hair Studio project format");
    }
    if (!project.state || !Array.isArray(project.state.locks) || !Array.isArray(project.state.guides)) {
      throw new Error("Project scene data is incomplete");
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
  undoStack.push(snapshotState());
  if (undoStack.length > 60) undoStack.shift();
  updateUndoButton();
}

function undoLastAction() {
  const state = undoStack.pop();
  if (!state) return;
  restoreState(state);
  updateUndoButton();
}

function updateUndoButton() {
  if (!undoButton) return;
  undoButton.disabled = undoStack.length === 0;
}

function restoreState(state) {
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
  selectedGuideId = state.selectedGuideId;
  selectedStrandGroup = state.selectedStrandGroup || null;
  selectedPoint = state.selectedPoint ? { ...state.selectedPoint } : null;
  pendingPlacedLockId = state.pendingPlacedLockId;
  setMirrorXEditing(Boolean(state.mirrorXEditing));
  if (state.scalpSurface) Object.assign(scalpSurface, state.scalpSurface);
  if (state.scalpArtistShape) Object.assign(scalpArtistShape, state.scalpArtistShape);
  if (state.strandGroupDefaults) {
    Object.entries(state.strandGroupDefaults).forEach(([region, defaults]) => {
      if (!strandGroupDefaults[region]) return;
      Object.assign(strandGroupDefaults[region], defaults, {
        taperCurve: normalizeTaperCurve(defaults.taperCurve, defaults),
        depthCurve: normalizeTaperCurve(defaults.depthCurve, defaults),
        sweepProfile: (defaults.sweepProfile || DEFAULT_SWEEP_PROFILE).map((point) => ({ ...point }))
      });
    });
  }
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
  updateScalpSurface();
  applyScalpLatticeDeformation();
  updateScalpLatticeObjects();

  state.locks.forEach((snapshot) => restoreLock(snapshot));
  state.guides.forEach((snapshot) => restoreGuide(snapshot));

  if (!locks.some((lock) => lock.id === selectedId)) selectedId = undefined;
  if (!guides.some((guide) => guide.id === selectedGuideId)) selectedGuideId = undefined;
  if (!locks.some((lock) => lock.id === selectedPoint?.lockId)) selectedPoint = null;
  if (!locks.some((lock) => lock.id === pendingPlacedLockId)) pendingPlacedLockId = null;

  const pointToRestore = selectedPoint ? { ...selectedPoint } : null;
  if (selectedId) selectLock(selectedId);
  else if (selectedGuideId) selectGuide(selectedGuideId);
  else if (selectedStrandGroup) selectStrandGroup(selectedStrandGroup);
  else {
    updateGuideControlsVisibility();
    renderLockList();
    updateAttributeEditorMode();
    updateSelectedPointLabel();
  }
  if (pointToRestore) selectCurvePoint(pointToRestore.lockId, pointToRestore.pointIndex);
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
    guideSurfaceGroup.remove(guide.mesh, guide.wire);
    disposeGuide(guide);
  });
}

function restoreLock(snapshot) {
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
    splitEnabled: Boolean(snapshot.splitEnabled),
    splitPosition: Number(snapshot.splitPosition ?? 0.62),
    splitSpread: Number(snapshot.splitSpread ?? 0.28),
    rootScalpOffset: Number(snapshot.rootScalpOffset ?? 0),
    rootSurfacePoint: snapshot.rootSurfacePoint ? dataToVector(snapshot.rootSurfacePoint) : null,
    rootSurfaceNormal: snapshot.rootSurfaceNormal ? dataToVector(snapshot.rootSurfaceNormal).normalize() : null,
    placementFrame: snapshot.placementFrame ? frameFromData(snapshot.placementFrame) : null
  };
  lock.radialSegments = lock.radialSegments || 10;
  lock.lengthSegments = lock.lengthSegments || 26;
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

function applyPresetSelection(presetName) {
  pushUndoState();
  if (generatedPresetGroups.has(presetName)) {
    if (presetName === "bowl-cut") addBowlCutPreset();
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

  if (type === "bowl") {
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
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "preset-card-label";
    const title = document.createElement("span");
    title.textContent = preset.title;
    const category = document.createElement("small");
    category.textContent = preset.category === "full" ? "Full Hair" : preset.category === "custom" ? "Custom" : "Element";
    label.append(title, category);
    button.append(canvas, label);
    button.addEventListener("click", () => {
      applyPresetSelection(preset.id);
      presetLibraryStatus.textContent = `${preset.title} added`;
    });
    presetLibraryGrid.append(button);
    drawPresetThumbnail(canvas, preset.thumbnail);
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

function sampleArray(values, t) {
  if (!values?.length) return 0;
  if (values.length === 1) return values[0];
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * (values.length - 1);
  const index = Math.floor(scaled);
  const next = Math.min(values.length - 1, index + 1);
  return THREE.MathUtils.lerp(values[index], values[next], scaled - index);
}

function sampleScale(scales, t, axis) {
  if (!scales?.length) return 1;
  if (scales.length === 1) return scales[0][axis] || 1;
  const scaled = THREE.MathUtils.clamp(t, 0, 1) * (scales.length - 1);
  const index = Math.floor(scaled);
  const next = Math.min(scales.length - 1, index + 1);
  return THREE.MathUtils.lerp(scales[index][axis] || 1, scales[next][axis] || 1, scaled - index);
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
  const quadId = hit.object.geometry.userData.triangleQuadIds?.[hit.faceIndex];
  return scalpRegionAssignments[quadId] || "unassigned";
}

function drawSurfaceHitFromEvent(event) {
  rayFromViewportEvent(event);
  if (drawStrandSurfaceInput.value === "head") {
    return raycaster.intersectObjects(headMeshes(), false)[0] || null;
  }
  return raycaster.intersectObject(scalpSurfaceMesh, false)[0] || null;
}

function worldNormalAtHit(hit) {
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
  if (normal.dot(raycaster.ray.direction) > 0) normal.negate();
  return normal;
}

function drawScalpRegionAtEvent(event, surfaceHit) {
  if (surfaceHit?.object === scalpSurfaceMesh) return scalpRegionAtHit(surfaceHit);
  rayFromViewportEvent(event);
  const scalpHit = raycaster.intersectObject(scalpSurfaceMesh, false)[0];
  return scalpHit ? scalpRegionAtHit(scalpHit) : "unassigned";
}

function drawSampleFromHit(hit, root = false, scalpRegion = "unassigned", scalpOffset = Number(drawStrandScalpOffsetInput.value)) {
  const normal = worldNormalAtHit(hit);
  const drawOffsetDistance = scalpOffset * ROOT_SCALP_OFFSET_DISTANCE;
  const offset = root
    ? rootScalpOffsetDistance(THREE.MathUtils.clamp(strandCreationDefaults.rootScalpOffset + scalpOffset, -1, 1))
    : Math.max(0.018, Number(drawStrandBrushSizeInput.value) * 0.12) + drawOffsetDistance;
  return {
    point: hit.point.clone().addScaledVector(normal, offset),
    surfacePoint: hit.point.clone(),
    normal,
    onSurface: true
  };
}

function updateDrawStrandBrushCursor(event) {
  if (activeTool !== "draw" || drawStrandStroke?.freePlane) {
    drawStrandBrushCursor.visible = false;
    return;
  }
  const hit = drawSurfaceHitFromEvent(event);
  if (!hit) {
    drawStrandBrushCursor.visible = false;
    return;
  }
  const normal = worldNormalAtHit(hit);
  drawStrandBrushCursor.visible = true;
  drawStrandBrushCursor.position.copy(hit.point).addScaledVector(
    normal,
    0.006 + Number(drawStrandScalpOffsetInput.value) * ROOT_SCALP_OFFSET_DISTANCE
  );
  drawStrandBrushCursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  drawStrandBrushCursor.scale.setScalar(Number(drawStrandBrushSizeInput.value));
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
  drawStrandPreview.geometry.setFromPoints(samples.map((sample) => sample.point));
  drawStrandPreview.visible = true;
  drawStrandMirrorPreview.geometry.setFromPoints(samples.map((sample) => mirroredVector(sample.point)));
  drawStrandMirrorPreview.visible = mirrorXEditing;
  if (samples.length < 2) {
    drawStrandVolumePreview.visible = false;
    drawStrandMirrorVolumePreview.visible = false;
    hideDrawClumpPreviews();
    return;
  }
  const groupDefaults = groupDefaultsFor(drawStrandStroke.scalpRegion);
  const defaults = strandCreationDefaults;
  const previewLock = {
    id: "draw-strand-preview",
    points: samples.map((sample) => sample.point),
    pointTwists: samples.map(() => 0),
    pointScales: samples.map(() => ({ x: 1, z: 1 })),
    baseWidth: drawStrandStroke.brushSize,
    width: drawStrandStroke.brushSize,
    length: strokeLength(samples),
    twist: defaults.twist,
    splitEnabled: defaults.splitEnabled,
    splitPosition: defaults.splitPosition,
    splitSpread: defaults.splitSpread,
    radialSegments: Math.min(12, Math.round(groupDefaults.radialSegments || 10)),
    lengthSegments: Math.min(32, Math.max(8, samples.length * 3)),
    taperCurve: defaults.taperCurve,
    depthCurve: defaults.depthCurve,
    widthScale: defaults.widthScale,
    depthScale: defaults.depthScale,
    sweepProfile: defaults.sweepProfile,
    profileOffset: Number(defaults.profileOffset || 0)
  };
  const previewColor = showGroupColors
    ? (SCALP_REGIONS[drawStrandStroke.scalpRegion] || SCALP_REGIONS.unassigned).color
    : DEFAULT_HAIR_COLOR;
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

  if (drawStrandMode === "clump") {
    const pointSets = drawClumpPointSets(samples, drawStrandStroke.brushSize);
    DRAW_CLUMP_TEMPLATE.strands.slice(1).forEach((template, index) => {
      const points = pointSets[index + 1];
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

function beginDrawStrandStroke(event, hit) {
  if (event.button !== 0 || !hit || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return false;
  const scalpRegion = drawScalpRegionAtEvent(event, hit);
  const scalpOffset = Number(drawStrandScalpOffsetInput.value);
  const sample = drawSampleFromHit(hit, true, scalpRegion, scalpOffset);
  drawStrandStroke = {
    pointerId: event.pointerId,
    scalpRegion,
    brushSize: Number(drawStrandBrushSizeInput.value),
    smoothing: Number(drawStrandSmoothingInput.value),
    curveStep: Number(drawStrandCurveStepInput.value),
    scalpOffset,
    rootSurfacePoint: hit.point.clone(),
    rootSurfaceNormal: sample.normal.clone(),
    samples: [sample],
    lastX: event.clientX,
    lastY: event.clientY,
    freePlane: null
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
  const origin = stroke.samples.at(-1).point.clone();
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
      const previous = stroke.samples.at(-1);
      const movingDown = surfaceSample.point.y < previous.point.y - 0.004;
      if (movingDown && surfaceSample.normal.y < -0.08) beginDrawFreePlane(stroke);
      else nextSample = surfaceSample;
    } else {
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
    splitEnabled: strandCreationDefaults.splitEnabled,
    splitPosition: strandCreationDefaults.splitPosition,
    splitSpread: strandCreationDefaults.splitSpread,
    taperCurve: cloneShapePresetValue(strandCreationDefaults.taperCurve),
    depthCurve: cloneShapePresetValue(strandCreationDefaults.depthCurve),
    widthScale: strandCreationDefaults.widthScale,
    depthScale: strandCreationDefaults.depthScale,
    sweepProfile: cloneShapePresetValue(strandCreationDefaults.sweepProfile),
    profileOffset: strandCreationDefaults.profileOffset,
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

function createDrawnStrand(stroke) {
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
  renderLockList();
  updateCount();
  selectLock(created[0].id);
  return created[0];
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
  if (!options.cancel && stroke.samples.length >= 2 && strokeLength(stroke.samples) >= 0.12) {
    pushUndoState();
    createDrawnStrand(stroke);
  }
  updateInteractionLocks();
  updateAttributeEditorMode();
  updatePlacementStatus();
  event?.preventDefault();
}

function createPlacedStrand(hit) {
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
  const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
  const surfaceCenter = scalpSurfaceGroup.getWorldPosition(new THREE.Vector3());
  if (normal.dot(hit.point.clone().sub(surfaceCenter).normalize()) < 0) normal.negate();

  const scalpRegion = scalpRegionAtHit(hit);
  const localRootOffset = strandCreationDefaults.rootScalpOffset;
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
    splitEnabled: strandCreationDefaults.splitEnabled,
    splitPosition: strandCreationDefaults.splitPosition,
    splitSpread: strandCreationDefaults.splitSpread,
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
  const position = scalpSurfaceGeometry.getAttribute("position");
  const sample = new THREE.Vector3();
  let bestAlignment = -Infinity;
  let surfaceRadius = 1;
  for (const index of scalpActiveVertexIndices) {
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
      message = "Place strand: click the placement sphere to set the root. Hold and drag to orbit.";
    }
  } else if (activeTool === "draw") {
    const drawLabel = drawStrandMode === "clump" ? "Draw clump" : "Draw strand";
    message = drawStrandStroke
      ? `${drawLabel}: drag across the live surface. Beyond its boundary, the stroke continues on the view plane.`
      : `${drawLabel}: drag from the chosen live surface. Hold Shift, Ctrl, or Alt for viewport navigation.`;
  } else if (proportionalEditing) {
    message = "Proportional editing: tap B to toggle off, or hold B and drag to resize influence.";
  } else if (objectSpaceEditing && ["move", "rotate", "scale"].includes(activeTool)) {
    message = "Object space: gizmo is aligned to the selected curve point. Press O for world space.";
  }
  placementStatus.textContent = message;
  placementStatus.classList.toggle("hidden", !message);
}

function deselectStrands() {
  selectedId = undefined;
  selectedStrandGroup = null;
  selectedGuideId = undefined;
  selectedPoint = null;
  transformControls.detach();
  locks.forEach((lock) => {
    lock.mesh.material.emissive?.set(0x000000);
    updateCurveObjects(lock, { visible: false });
  });
  guides.forEach((guide) => {
    guide.mesh.material.color.set(0x60707a);
    guide.mesh.material.opacity = Math.min(guide.opacity, 0.16);
    guide.wire.material.opacity = 0.25;
  });
  renderLockList();
  updateAttributeEditorMode();
  updateGuideControlsVisibility();
  updateSelectedPointLabel();
  updateTopologyStats();
}

function finishEmptySelectionPointer(event) {
  if (!emptySelectionPointer || emptySelectionPointer.pointerId !== event.pointerId) return;
  const moved = Math.hypot(
    event.clientX - emptySelectionPointer.startX,
    event.clientY - emptySelectionPointer.startY
  );
  emptySelectionPointer = null;
  if (activeTool === "select" && moved < 6) deselectStrands();
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
    const selectedHandle = selectedPoint?.lockId === lock.id && selectedPoint.pointIndex === index;
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
  lock.x = first.x;
  lock.y = first.y;
  lock.z = first.z;
  lock.length = Math.max(0.35, first.distanceTo(last));
  lock.curve = (last.x - first.x) / 0.52;
}

function labelForPreset(name) {
  return document.querySelector(`#preset option[value="${name}"]`).textContent;
}

function updateLockGeometry(lock) {
  const previousGeometry = lock.mesh.geometry;
  lock.mesh.geometry = createHairGeometry(lock);
  previousGeometry.dispose();
  if (lock.wireOverlay) {
    lock.wireOverlay.geometry.dispose();
    lock.wireOverlay.geometry = createHairTopologyGeometry(lock.mesh.geometry);
  }
  const showingProportionalRamp = proportionalEditing && selectedPoint?.lockId === lock.id;
  setAnimeHairBaseColor(lock.mesh.material, showingProportionalRamp ? 0xffffff : strandDisplayColor(lock));
  lock.mesh.material.needsUpdate = true;
  updateHairMaterialResponse(lock.mesh.material, materialForLock(lock).roughness);
  updateCurveObjects(lock);
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

function selectLock(id) {
  selectedId = id;
  selectedStrandGroup = null;
  selectedGuideId = undefined;
  updateAttributeEditorMode();
  updateGuideControlsVisibility();
  const lock = getSelectedLock();
  guides.forEach((guide) => {
    guide.mesh.material.color.set(0x60707a);
    guide.mesh.material.opacity = Math.min(guide.opacity, 0.16);
    guide.wire.material.opacity = 0.25;
  });
  locks.forEach((item) => item.mesh.material.emissive?.set(item.id === id ? 0x2b1a08 : 0x000000));
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

function syncCreationShapeInputs() {
  const defaults = strandCreationDefaults;
  renderTaperPreview(taperPreviewPaths.strand, defaults.taperCurve);
  renderTaperPreview(taperPreviewPaths.strandDepth, defaults.depthCurve);
  renderProfilePreview(profilePreviewPaths.strand, defaults.sweepProfile, defaults.profileOffset);
  inputs.widthScale.value = defaults.widthScale;
  inputs.depthScale.value = defaults.depthScale;
  document.querySelector("#widthScaleValue").textContent = Number(defaults.widthScale).toFixed(2);
  document.querySelector("#depthScaleValue").textContent = Number(defaults.depthScale).toFixed(2);
  inputs.profileOffset.value = defaults.profileOffset;
  document.querySelector("#profileOffsetValue").textContent = Number(defaults.profileOffset).toFixed(2);
  inputs.rootScalpOffset.value = defaults.rootScalpOffset;
  document.querySelector("#rootScalpOffsetValue").textContent = Number(defaults.rootScalpOffset).toFixed(2);
  inputs.twist.value = THREE.MathUtils.clamp(defaults.twist, Number(inputs.twist.min), Number(inputs.twist.max));
  twistNumberInput.value = Number(defaults.twist).toFixed(2);
  splitEnabledInput.checked = defaults.splitEnabled;
  inputs.splitPosition.value = defaults.splitPosition;
  inputs.splitSpread.value = defaults.splitSpread;
  splitControls.classList.toggle("hidden", !defaults.splitEnabled);
  syncShapePresetSelects();
}

function updateAttributeEditorMode() {
  const editingGroup = Boolean(selectedStrandGroup);
  const editingStrand = Boolean(getSelectedLock());
  const editingSelection = editingGroup || editingStrand;
  const editingCreationShape = creationToolActive();
  const transformToolActive = ["move", "rotate", "scale"].includes(activeTool);
  const proportionalToolActive = transformToolActive || activeTool === "relax";
  groupSettingsPanel.classList.toggle("hidden", !editingGroup);
  guidePanel.classList.toggle("hidden", editingSelection);
  presetPanel.classList.add("hidden");
  selectedStrandPanel.classList.toggle("hidden", !editingStrand);
  hairMaterialPanel.classList.toggle("hidden", !editingStrand);
  strandTopologyPanel.classList.toggle("hidden", !editingStrand);
  const moveToolSettingsAvailable = activeTool === "move";
  transformToolPanel.classList.toggle("hidden", !transformToolActive || (!editingStrand && !moveToolSettingsAvailable));
  drawStrandToolPanel.classList.toggle("hidden", activeTool !== "draw");
  transformToolTitle.textContent = `${activeTool[0].toUpperCase()}${activeTool.slice(1)} Tool`;
  viewPlaneMoveSetting.classList.toggle("hidden", activeTool !== "move");
  viewPlaneMoveSnappedSetting.classList.toggle("hidden", activeTool !== "move");
  proportionalPanel.classList.toggle("hidden", !editingStrand || !proportionalToolActive);
  hierarchyPanel.classList.toggle("hidden", !editingStrand || !transformToolActive || !hierarchyEditing);
  strandShapePanel.classList.toggle("hidden", !editingStrand && !editingCreationShape);
  strandShapeTitle.textContent = editingCreationShape ? "New Strand Shape" : "Shape";
  randomizeShapeButton.classList.toggle("hidden", editingCreationShape);
  if (editingCreationShape) syncCreationShapeInputs();
}

function selectStrandGroup(region) {
  if (!strandGroupDefaults[region]) return;
  if (selectedStrandGroup === region) {
    selectedStrandGroup = null;
    updateAttributeEditorMode();
    renderLockList();
    return;
  }
  selectedStrandGroup = region;
  selectedId = undefined;
  selectedGuideId = undefined;
  selectedPoint = null;
  transformControls.detach();
  locks.forEach((lock) => {
    lock.mesh.material.emissive?.set(0x000000);
    updateCurveObjects(lock, { visible: false });
  });
  syncGroupInputs();
  updateAttributeEditorMode();
  updateGuideControlsVisibility();
  updateSelectedPointLabel();
  renderLockList();
}

function selectCurvePoint(lockId, pointIndex) {
  selectedPoint = { lockId, pointIndex };
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
  transformControls.attach(handle);
}

function updateSelectedPointLabel() {
  if (!selectedPointLabel) return;
  selectedPointLabel.textContent = selectedPoint ? String(selectedPoint.pointIndex + 1) : "None";
  hierarchyNavigationHint?.classList.toggle("hidden", !getSelectedLock());
}

function syncInputs(lock) {
  inputs.name.value = lock.name;
  syncHairMaterialEditor(lock);
  renderTaperPreview(taperPreviewPaths.strand, lock.taperCurve);
  renderTaperPreview(taperPreviewPaths.strandDepth, lock.depthCurve);
  inputs.widthScale.value = lock.widthScale ?? 1;
  inputs.depthScale.value = lock.depthScale ?? 1;
  document.querySelector("#widthScaleValue").textContent = Number(lock.widthScale ?? 1).toFixed(2);
  document.querySelector("#depthScaleValue").textContent = Number(lock.depthScale ?? 1).toFixed(2);
  splitEnabledInput.checked = Boolean(lock.splitEnabled);
  inputs.splitPosition.value = lock.splitPosition ?? 0.62;
  inputs.splitSpread.value = lock.splitSpread ?? 0.28;
  splitControls.classList.toggle("hidden", !lock.splitEnabled);
  inputs.rootScalpOffset.value = lock.rootScalpOffset ?? 0;
  document.querySelector("#rootScalpOffsetValue").textContent = Number(lock.rootScalpOffset ?? 0).toFixed(2);
  inputs.profileOffset.value = lock.profileOffset ?? 0;
  document.querySelector("#profileOffsetValue").textContent = Number(lock.profileOffset ?? 0).toFixed(2);
  inputs.twist.value = lock.twist;
  twistNumberInput.value = Number(lock.twist || 0).toFixed(2);
  inputs.radialSegments.value = lock.radialSegments;
  inputs.lengthSegments.value = lock.lengthSegments;
  topologyValues.strandRadialSegments.textContent = inputs.radialSegments.value;
  topologyValues.strandLengthSegments.textContent = inputs.lengthSegments.value;
  renderProfilePreview(profilePreviewPaths.strand, lock.sweepProfile, lock.profileOffset);
  updateTopologyStats();
  syncShapePresetSelects();
}

function getSelectedLock() {
  return locks.find((lock) => lock.id === selectedId);
}

function renderLockList() {
  const list = document.querySelector("#lockList");
  list.innerHTML = "";
  STRAND_GROUPS.forEach((group) => {
    const groupLocks = locks.filter((lock) => (lock.scalpRegion || "unassigned") === group.id);
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
    groupLocks.forEach((lock) => {
      const button = document.createElement("button");
      button.className = `lock-item${lock.id === selectedId ? " active" : ""}`;
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = new THREE.Color(strandDisplayColor(lock)).getStyle();
      const name = document.createElement("span");
      name.textContent = lock.name;
      button.append(swatch, name);
      button.addEventListener("click", () => selectLock(lock.id));
      items.appendChild(button);
    });
    groupElement.appendChild(items);
    list.appendChild(groupElement);
  });
}

function updateCount() {
  const lockText = `${locks.length} ${locks.length === 1 ? "strand" : "strands"}`;
  const guideText = `${guides.length} ${guides.length === 1 ? "guide" : "guides"}`;
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
    const lock = creationToolActive() ? null : getSelectedLock();
    const target = lock || (creationToolActive() ? strandCreationDefaults : null);
    if (!target) return;
    target[key] = parser(inputs[key].value);
    if (key === "twist") twistNumberInput.value = Number(target.twist).toFixed(2);
    if (key === "roughness") roughnessValue.textContent = Number(target[key]).toFixed(2);
    if (key === "radialSegments") topologyValues.strandRadialSegments.textContent = inputs[key].value;
    if (key === "lengthSegments") topologyValues.strandLengthSegments.textContent = inputs[key].value;
    if (key === "profileOffset") {
      document.querySelector("#profileOffsetValue").textContent = Number(target[key]).toFixed(2);
      renderProfilePreview(profilePreviewPaths.strand, target.sweepProfile, target.profileOffset);
      if (sweepProfileEditor.open) renderSweepProfileEditor();
    }
    if (key === "rootScalpOffset") {
      document.querySelector("#rootScalpOffsetValue").textContent = Number(target[key]).toFixed(2);
      if (lock) applyLockRootScalpOffset(lock);
    }
    if (key === "widthScale") document.querySelector("#widthScaleValue").textContent = Number(target[key]).toFixed(2);
    if (key === "depthScale") document.querySelector("#depthScaleValue").textContent = Number(target[key]).toFixed(2);
    if (lock) {
      updateLockGeometry(lock);
      syncActiveMirror(lock, { refreshUi: true });
      updateTopologyStats();
      renderLockList();
    }
  });
}

["widthScale", "depthScale", "profileOffset", "rootScalpOffset", "twist", "splitPosition", "splitSpread", "radialSegments", "lengthSegments"].forEach((key) => bindLockInput(key));

bindUndoCapture(twistNumberInput);
twistNumberInput.addEventListener("input", () => {
  const lock = creationToolActive() ? null : getSelectedLock();
  const target = lock || (creationToolActive() ? strandCreationDefaults : null);
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

splitEnabledInput.addEventListener("change", () => {
  const lock = creationToolActive() ? null : getSelectedLock();
  const target = lock || (creationToolActive() ? strandCreationDefaults : null);
  if (!target) return;
  pushUndoState();
  target.splitEnabled = splitEnabledInput.checked;
  splitControls.classList.toggle("hidden", !target.splitEnabled);
  if (lock) {
    updateLockGeometry(lock);
    syncActiveMirror(lock, { refreshUi: true });
    updateTopologyStats();
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
  const defaultCurve = taperCurveEdit.curveKey === "depthCurve" ? DEFAULT_DEPTH_CURVE : DEFAULT_TAPER_CURVE;
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
  guide.x = 0;
  guide.y = 0.72;
  guide.z = 0.42;
  updateGuideGeometry(guide);
});
document.querySelector("#deleteGuide").addEventListener("click", () => {
  const guide = getSelectedGuide();
  if (!guide) return;
  pushUndoState();
  guideSurfaceGroup.remove(guide.mesh, guide.wire);
  disposeGuide(guide);
  guides.splice(guides.indexOf(guide), 1);
  selectGuide(guides.at(-1)?.id);
  updateCount();
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

document.querySelector("#fitScalp").addEventListener("click", () => {
  pushUndoState();
  fitScalpSurfaceToHead();
});

modeToolButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTool(button.dataset.tool));
});

spaceToggle.addEventListener("click", () => setObjectSpaceEditing(!objectSpaceEditing));
mirrorXToggle.addEventListener("click", () => setMirrorXEditing(!mirrorXEditing));
transformSpaceButtons.forEach((button) => {
  button.addEventListener("click", () => setObjectSpaceEditing(button.dataset.transformSpace === "object"));
});
viewPlaneMoveInput.addEventListener("change", () => setViewPlaneMove(viewPlaneMoveInput.checked));
viewPlaneMoveSnappedOnlyInput.addEventListener("change", () => setViewPlaneMoveSnappedOnly(viewPlaneMoveSnappedOnlyInput.checked));
drawStrandBrushSizeInput.addEventListener("input", () => {
  drawStrandBrushSizeValue.textContent = Number(drawStrandBrushSizeInput.value).toFixed(2);
  drawStrandBrushCursor.scale.setScalar(Number(drawStrandBrushSizeInput.value));
});
drawStrandSmoothingInput.addEventListener("input", () => {
  drawStrandSmoothingValue.textContent = Number(drawStrandSmoothingInput.value).toFixed(2);
});
drawStrandCurveStepInput.addEventListener("input", () => {
  drawStrandCurveStepValue.textContent = Number(drawStrandCurveStepInput.value).toFixed(2);
});
drawStrandScalpOffsetInput.addEventListener("input", () => {
  drawStrandScalpOffsetValue.textContent = Number(drawStrandScalpOffsetInput.value).toFixed(2);
});
drawStrandSurfaceInput.addEventListener("change", () => {
  finishDrawStrandStroke(null, { cancel: true });
  drawStrandBrushCursor.visible = false;
  updateScalpEditingVisibility();
  updatePlacementStatus();
});
drawStrandOutputButtons.forEach((button) => {
  button.addEventListener("click", () => setDrawStrandMode(button.dataset.drawOutput));
});
hierarchyToggle.addEventListener("click", () => setHierarchyEditing(!hierarchyEditing));
hierarchyRecursiveTransformInput.addEventListener("change", () => {
  recursiveHierarchyTransforms = hierarchyRecursiveTransformInput.checked;
});
proportionalToggle.addEventListener("click", () => setProportionalEditing(!proportionalEditing));
latticeToggle.addEventListener("click", () => setScalpShapeEditing(!scalpShapeEditing));
scalpPaintToggle.addEventListener("click", () => setScalpPaintEditing(!scalpPaintEditing));
scalpGuideVisibilityToggle.addEventListener("click", () => setScalpGuideVisibility(!scalpGuideVisible));
groupColorToggle.addEventListener("click", () => setGroupColorView(!showGroupColors));
[lightAzimuthInput, lightElevationInput].forEach((input) => {
  input.addEventListener("input", updateLightAngleFromInputs);
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

document.querySelector("#deleteLock").addEventListener("click", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  pushUndoState();
  const mirrorPartner = mirrorXEditing ? mirrorPartnerFor(lock) : null;
  const targets = mirrorPartner ? [lock, mirrorPartner] : [lock];
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
  selectLock(locks.at(-1)?.id);
  renderLockList();
  updateCount();
});

document.querySelector("#clearLocks").addEventListener("click", () => {
  if (!locks.length) return;
  pushUndoState();
  [...locks].forEach((lock) => {
    hairGroup.remove(lock.mesh);
    curveGroup.remove(lock.curveObjects.group);
    lock.mesh.geometry.dispose();
    lock.mesh.material.dispose();
    lock.wireOverlay?.geometry.dispose();
    lock.wireOverlay?.material.dispose();
    disposeCurveObjects(lock);
  });
  transformControls.detach();
  locks.length = 0;
  selectedId = undefined;
  selectedPoint = null;
  updateSelectedPointLabel();
  renderLockList();
  updateCount();
});

document.querySelector("#randomize").addEventListener("click", () => {
  const lock = getSelectedLock();
  if (!lock) return;
  pushUndoState();
  lock.curve += (Math.random() - 0.5) * 0.28;
  lock.twist += (Math.random() - 0.5) * 0.28;
  lock.length *= 0.94 + Math.random() * 0.12;
  lock.points = createCurvePoints(lock);
  updateLockGeometry(lock);
  syncActiveMirror(lock, { refreshUi: true });
  selectLock(lock.id);
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
    if (lock.wireOverlay) lock.wireOverlay.visible = hairTopologyVisible;
  });
  const button = document.querySelector("#toggleWire");
  button.classList.toggle("active", hairTopologyVisible);
  button.setAttribute("aria-pressed", String(hairTopologyVisible));
});

document.querySelector("#exportObj").addEventListener("click", exportHairObj);

function exportHairObj() {
  let obj = "# Anime Hair Studio export\n";
  let offset = 1;
  locks.forEach((lock) => {
    obj += `o ${lock.name.replace(/\s+/g, "_")}\n`;
    const positions = lock.mesh.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i += 1) {
      obj += `v ${positions.getX(i).toFixed(5)} ${positions.getY(i).toFixed(5)} ${positions.getZ(i).toFixed(5)}\n`;
    }
    const index = lock.mesh.geometry.index.array;
    for (let i = 0; i < index.length; i += 3) {
      obj += `f ${index[i] + offset} ${index[i + 1] + offset} ${index[i + 2] + offset}\n`;
    }
    offset += positions.count;
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
  if (event.shiftKey || proportionalSizeEdit || proportionalHotkeyPress || scalpShapeEditing || scalpPaintEditing || ["select", "place", "draw"].includes(activeTool)) return;
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
updateLightAngleFromInputs();
window.addEventListener("pointermove", trackViewportPointerMove);
window.addEventListener("pointermove", updateViewSnap);
window.addEventListener("pointermove", updateViewPlaneMove);
window.addEventListener("pointermove", updateRelaxEdit);
window.addEventListener("pointermove", updatePlaceEdit);
window.addEventListener("pointermove", updateDrawStrandStroke);
window.addEventListener("pointermove", handleViewportPointerMove);
window.addEventListener("pointermove", updateScalpLatticeDrag);
window.addEventListener("pointermove", updateScalpPaint);
window.addEventListener("pointerup", endViewSnap);
window.addEventListener("pointerup", endViewPlaneMove);
window.addEventListener("pointerup", endRelaxEdit);
window.addEventListener("pointerup", endPlaceEdit);
window.addEventListener("pointerup", finishDrawStrandStroke);
window.addEventListener("pointerup", endScalpLatticeDrag);
window.addEventListener("pointerup", endScalpPaint);
window.addEventListener("pointerup", finishEmptySelectionPointer);
window.addEventListener("pointercancel", endViewSnap);
window.addEventListener("pointercancel", endViewPlaneMove);
window.addEventListener("pointercancel", endRelaxEdit);
window.addEventListener("pointercancel", endPlaceEdit);
window.addEventListener("pointercancel", (event) => finishDrawStrandStroke(event, { cancel: true }));
window.addEventListener("pointercancel", endScalpLatticeDrag);
window.addEventListener("pointercancel", endScalpPaint);
window.addEventListener("pointercancel", () => {
  emptySelectionPointer = null;
});
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
renderer.domElement.addEventListener("pointerdown", prepareCurvePointSelection, true);
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (proportionalSizeEdit || proportionalHotkeyPress) return;
  lastPointer.x = event.clientX;
  lastPointer.y = event.clientY;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  if (scalpPaintEditing) {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    const scalpHit = raycaster.intersectObject(scalpSurfaceMesh, false)[0];
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
  if (activeTool === "draw") {
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    const surfaceHit = drawSurfaceHitFromEvent(event);
    beginDrawStrandStroke(event, surfaceHit);
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
    const surfaceHit = raycaster.intersectObject(scalpSurfaceMesh, false)[0];
    beginPlacementPointer(event, surfaceHit);
    return;
  }
  if (activeTool === "select") {
    const lockHit = raycaster.intersectObjects(locks.map((lock) => lock.mesh), false)[0];
    if (lockHit) {
      emptySelectionPointer = null;
      selectLock(lockHit.object.userData.lockId);
      return;
    }
    const guideHit = raycaster.intersectObjects(guides.flatMap((guide) => [guide.mesh, guide.wire]), false)[0];
    if (!guideHit) {
      if (event.button === 0 && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        emptySelectionPointer = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY
        };
      }
      return;
    }
    emptySelectionPointer = null;
    selectGuide(guideHit.object.userData.guideId);
    return;
  }

  const modelingClick = event.button === 0 && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
  const selectedLock = getSelectedLock();
  const handles = selectedLock?.curveObjects?.group.visible ? selectedLock.curveObjects.handles : [];
  const hit = modelingClick ? raycaster.intersectObjects(handles, false)[0] : null;

  if (!hit && modelingClick) {
    const lockHit = raycaster.intersectObjects(locks.map((lock) => lock.mesh), false)[0];
    const lockId = lockHit?.object.userData.lockId;
    if (lockId && lockId !== selectedId) {
      selectLock(lockId);
      event.preventDefault();
      return;
    }
  }

  if (!hit) {
    if (activeTool === "relax" && selectedLock && selectedPoint?.lockId === selectedLock.id) {
      if (beginRelaxEdit(selectedLock, selectedPoint.pointIndex, event)) {
        event.preventDefault();
      }
    }
    return;
  }
  const handle = hit.object;
  transformControls.detach();
  activeHandleEdit = null;
  transformDragging = false;
  updateInteractionLocks();
  selectLock(handle.userData.lockId);
  selectCurvePoint(handle.userData.lockId, handle.userData.pointIndex);
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
  transformControls.attach(handle);
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
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

renderLockList();
updateAttributeEditorMode();
resize();
animate();
