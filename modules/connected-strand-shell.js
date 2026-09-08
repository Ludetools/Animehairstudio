import { normalizeTaperCurve, sampleTaperCurve } from "./curve-math.js";

const SOURCE_CENTER_Y = 157.435455;
const SOURCE_SCALE = 0.1;
const INTERNAL_Y_OFFSET = 0.2;

const SOURCE_POINTS = [[0,168.489151,2.206626],[0,165.035736,8.159403],[6.437036,163.21698,6.98148],[6.468478,166.434433,1.330136],[-6.468477,166.434433,1.330137],[-6.437036,163.21698,6.98148],[9.641742,158.607788,3.324044],[9.451706,161.251541,-2.406485],[-9.451706,161.251541,-2.406485],[-9.641742,158.607788,3.324044],[9.025446,153.063065,-0.355668],[8.536661,155.13797,-4.983168],[-8.536661,155.13797,-4.983168],[-9.025446,153.063065,-0.355668],[6.092938,148.112701,-2.32611],[5.298716,150.050552,-5.481825],[-5.298716,150.050552,-5.481825],[-6.092938,148.112701,-2.32611],[4.703307,166.799973,-4.171926],[0,167.938583,-4.487468],[-4.703307,166.799973,-4.171926],[5.886886,162.697983,-7.803161],[0,163.638153,-9.633431],[-5.886886,162.697983,-7.803161],[5.628267,156.597397,-9.551069],[0,156.969269,-11.242622],[-5.628267,156.597397,-9.551069],[3.413111,151.026489,-7.967057],[0,151.234497,-9.055603],[-3.413111,151.026489,-7.967057],[-5.726401,166.904022,-1.652549],[5.537,164.994888,-6.279835],[3.13579,163.289322,-9.204801],[0,166.203842,-7.412107],[-3.13579,163.289322,-9.204801],[-5.537,164.994888,-6.279834],[5.956992,159.912338,-8.957321],[2.96228,156.910263,-10.833022],[0,160.455627,-10.927217],[-2.96228,156.910263,-10.833022],[-5.956992,159.912338,-8.957321],[4.624121,153.549545,-8.957447],[1.785645,151.199921,-8.767621],[0,153.758774,-10.559845],[-1.785645,151.199921,-8.767621],[-4.624121,153.549545,-8.957447],[8.122569,162.088654,-5.363166],[-8.12257,162.088654,-5.363166],[7.496916,155.96225,-7.425397],[-7.496916,155.96225,-7.425397],[4.503232,150.637238,-6.891141],[-4.503232,150.637238,-6.891141],[0,167.13205,5.325108],[3.404259,164.505127,7.874433],[6.675994,165.105164,4.262304],[3.252605,167.973328,1.946845],[-3.252605,167.973328,1.946844],[-6.675993,165.105164,4.262304],[-3.404259,164.505127,7.874433],[8.530016,161.144104,5.330841],[9.712135,160.025681,0.457973],[8.437501,164.090912,-0.375246],[-8.4375,164.090912,-0.375246],[-9.712135,160.025681,0.457973],[-8.530016,161.144104,5.330841],[9.707738,155.806824,1.294131],[8.915771,154.142624,-2.689584],[9.541797,158.200302,-3.990201],[-9.541797,158.200302,-3.990201],[-8.915771,154.142624,-2.689584],[-9.707738,155.806824,1.294131],[7.824112,150.479889,-1.483075],[5.817371,149.137909,-3.90795],[7.02427,152.431885,-5.381092],[-7.02427,152.431885,-5.381092],[-5.817371,149.137909,-3.90795],[-7.824112,150.479889,-1.483075],[5.726403,166.904022,-1.65255],[2.385177,167.700409,-4.460788],[0,168.656662,-1.277951],[-2.385176,167.700409,-4.460789],[3.443539,166.575287,5.036833],[-3.443539,166.575287,5.036833],[8.69305,162.800415,2.527256],[-8.69305,162.800415,2.527256],[9.800159,157.053802,-1.374199],[-9.800159,157.053802,-1.374199],[7.578899,151.514313,-3.443601],[-7.578899,151.514313,-3.443601],[2.766695,168.29071,-1.424367],[-2.766695,168.29071,-1.424367],[2.698534,165.91774,-7.179812],[-2.698534,165.91774,-7.179813],[3.119596,160.329147,-10.406304],[-3.119596,160.329147,-10.406304],[2.429127,153.739914,-10.132492],[-2.429127,153.739914,-10.132492],[7.425238,164.780472,-3.320498],[-7.425238,164.780472,-3.320498],[8.194287,159.176514,-6.644545],[-8.194287,159.176514,-6.644545],[6.096726,153.061172,-7.315307],[-6.096726,153.061172,-7.315307]];

const SOURCE_FACES = [[0,52,81,55],[52,1,53,81],[81,53,2,54],[55,81,54,3],[3,54,83,61],[54,2,59,83],[83,59,6,60],[61,83,60,7],[7,60,85,67],[60,6,65,85],[85,65,10,66],[67,85,66,11],[11,66,87,73],[66,10,71,87],[87,71,14,72],[73,87,72,15],[0,56,82,52],[56,4,57,82],[82,57,5,58],[52,82,58,1],[5,57,84,64],[57,4,62,84],[84,62,8,63],[64,84,63,9],[9,63,86,70],[63,8,68,86],[86,68,12,69],[70,86,69,13],[13,69,88,76],[69,12,74,88],[88,74,16,75],[76,88,75,17],[0,55,89,79],[55,3,77,89],[89,77,18,78],[79,89,78,19],[18,77,97,31],[77,3,61,97],[97,61,7,46],[31,97,46,21],[11,48,99,67],[48,24,36,99],[99,36,21,46],[67,99,46,7],[11,73,101,48],[73,15,50,101],[101,50,27,41],[48,101,41,24],[4,56,90,30],[56,0,79,90],[90,79,19,80],[30,90,80,20],[4,30,98,62],[30,20,35,98],[98,35,23,47],[62,98,47,8],[26,49,100,40],[49,12,68,100],[100,68,8,47],[40,100,47,23],[16,74,102,51],[74,12,49,102],[102,49,26,45],[51,102,45,29],[19,78,91,33],[78,18,31,91],[91,31,21,32],[33,91,32,22],[22,32,93,38],[32,21,36,93],[93,36,24,37],[38,93,37,25],[25,37,95,43],[37,24,41,95],[95,41,27,42],[43,95,42,28],[20,80,92,35],[80,19,33,92],[92,33,22,34],[35,92,34,23],[23,34,94,40],[34,22,38,94],[94,38,25,39],[40,94,39,26],[26,39,96,45],[39,25,43,96],[96,43,28,44],[45,96,44,29]];

const FACE_SECTIONS = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5,5];
const SECTION_NAMES = ["Section 1","Section 2","Section 3","Section 4","Section 5","Section 6"];
const SECTION_MATERIALS = ["lambert2SG","lambert6SG","lambert3SG","lambert5SG","lambert4SG","lambert7SG"];

export const DEFAULT_CONNECTED_STRAND_SECTION_PROFILE = Object.freeze([
  Object.freeze({ x: -1, z: 0, interpolation: "linear" }),
  Object.freeze({ x: -0.34, z: 0, interpolation: "linear" }),
  Object.freeze({ x: 0.34, z: 0, interpolation: "linear" }),
  Object.freeze({ x: 1, z: 0, interpolation: "linear" })
]);
export const DEFAULT_CONNECTED_STRAND_SECTION_CURVE = Object.freeze([
  Object.freeze({ position: 0, value: 1, interpolation: "linear" }),
  Object.freeze({ position: 1, value: 1, interpolation: "linear" })
]);

export const DEFAULT_CONNECTED_STRAND_SHELL_SETTINGS = Object.freeze({
  inflation: 0.08,
  mergeDistance: 0.04,
  sectionWidths: Object.freeze(SECTION_NAMES.map(() => 1))
});

function clonePoint(point) {
  return { x: Number(point.x), y: Number(point.y), z: Number(point.z) };
}

function cloneShapePoints(points) {
  return points.map((point) => ({ ...point }));
}

function normalizeSectionProfile(profile) {
  const source = Array.isArray(profile) && profile.length >= 4
    ? profile
    : DEFAULT_CONNECTED_STRAND_SECTION_PROFILE;
  return source.map((point) => ({
    x: Math.max(-2, Math.min(2, Number(point.x) || 0)),
    z: Math.max(-2, Math.min(2, Number(point.z) || 0)),
    interpolation: ["linear", "smooth"].includes(point.interpolation)
      ? point.interpolation
      : "smooth"
  }));
}

export function normalizeConnectedStrandShellSectionCurve(curve = {}, fallback = {}) {
  const source = { ...fallback, ...curve };
  return {
    ...source,
    sweepProfile: normalizeSectionProfile(source.sweepProfile),
    taperCurve: normalizeTaperCurve(source.taperCurve || DEFAULT_CONNECTED_STRAND_SECTION_CURVE),
    depthCurve: normalizeTaperCurve(source.depthCurve || DEFAULT_CONNECTED_STRAND_SECTION_CURVE)
  };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(point, amount) {
  return { x: point.x * amount, y: point.y * amount, z: point.z * amount };
}

function squaredDistance(a, b) {
  const x = a.x - b.x;
  const y = a.y - b.y;
  const z = a.z - b.z;
  return x * x + y * y + z * z;
}

function sourcePoint([x, y, z]) {
  return {
    x: x * SOURCE_SCALE,
    y: (y - SOURCE_CENTER_Y) * SOURCE_SCALE + 0.55 + INTERNAL_Y_OFFSET,
    z: z * SOURCE_SCALE
  };
}

export function normalizeConnectedStrandShellSettings(settings = {}) {
  return {
    inflation: Math.max(0, Math.min(0.4, Number(settings.inflation ?? 0.08))),
    mergeDistance: Math.max(0, Math.min(0.2, Number(settings.mergeDistance ?? 0.04))),
    sectionWidths: SECTION_NAMES.map((_, sectionIndex) => Math.max(
      0.1,
      Math.min(3, Number(settings.sectionWidths?.[sectionIndex] ?? 1))
    ))
  };
}

export function inflateConnectedStrandShell(points, faces, amount) {
  const inflation = Math.max(0, Number(amount) || 0);
  if (inflation <= 1e-8) return points.map(clonePoint);
  const normals = points.map(() => ({ x: 0, y: 0, z: 0 }));
  faces.forEach((face) => {
    const origin = points[face[0]];
    for (let index = 1; index < face.length - 1; index += 1) {
      const a = subtract(points[face[index]], origin);
      const b = subtract(points[face[index + 1]], origin);
      const normal = {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
      };
      face.forEach((vertexIndex) => {
        normals[vertexIndex] = add(normals[vertexIndex], normal);
      });
    }
  });
  return points.map((point, index) => {
    const normal = normals[index];
    const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
    return add(point, scale(normal, inflation / length));
  });
}

function sectionFaces(sectionIndex) {
  return SOURCE_FACES.filter((_, faceIndex) => FACE_SECTIONS[faceIndex] === sectionIndex);
}

function sharedVertices(faceGroup) {
  if (!faceGroup.length) return [];
  return faceGroup.slice(1).reduce(
    (shared, face) => shared.filter((vertexIndex) => face.includes(vertexIndex)),
    [...faceGroup[0]]
  );
}

function blockMiddleVertices(block) {
  const counts = new Map();
  block.forEach((face) => face.forEach((index) => counts.set(index, (counts.get(index) || 0) + 1)));
  return [...counts.entries()].filter(([, count]) => count === 2).map(([index]) => index);
}

function rowMiddleFromIntersection(left, right) {
  const shared = [...new Set(left.flat())].filter((index) => new Set(right.flat()).has(index));
  const counts = new Map(shared.map((index) => [index, 0]));
  [...left, ...right].forEach((face) => face.forEach((index) => {
    if (counts.has(index)) counts.set(index, counts.get(index) + 1);
  }));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
}

function oppositeBlockMiddle(block, middleVertex) {
  return blockMiddleVertices(block).find((candidate) => (
    candidate !== middleVertex
    && !block.some((face) => face.includes(candidate) && face.includes(middleVertex))
  ));
}

function controllerVertexIndicesForSection(sectionIndex) {
  const faces = sectionFaces(sectionIndex);
  const blocks = [];
  for (let index = 0; index < faces.length; index += 4) blocks.push(faces.slice(index, index + 4));
  if (!blocks.length) return [];
  const neighbors = blocks.map(() => []);
  blocks.forEach((block, blockIndex) => blocks.forEach((other, otherIndex) => {
    if (otherIndex <= blockIndex) return;
    const shared = [...new Set(block.flat())].filter((index) => new Set(other.flat()).has(index));
    if (shared.length !== 3) return;
    neighbors[blockIndex].push(otherIndex);
    neighbors[otherIndex].push(blockIndex);
  }));
  const ordered = [];
  let previous = -1;
  let current = neighbors.findIndex((items) => items.length <= 1);
  if (current < 0) current = 0;
  while (current >= 0 && !ordered.includes(current)) {
    ordered.push(current);
    const next = neighbors[current].find((index) => index !== previous && !ordered.includes(index));
    previous = current;
    current = Number.isInteger(next) ? next : -1;
  }
  const firstConnection = ordered.length > 1
    ? rowMiddleFromIntersection(blocks[ordered[0]], blocks[ordered[1]])
    : blockMiddleVertices(blocks[ordered[0]])[0];
  const indices = [oppositeBlockMiddle(blocks[ordered[0]], firstConnection)];
  ordered.forEach((blockIndex, position) => {
    const block = blocks[blockIndex];
    indices.push(sharedVertices(block)[0]);
    if (position < ordered.length - 1) {
      indices.push(rowMiddleFromIntersection(block, blocks[ordered[position + 1]]));
    }
  });
  const lastBlock = blocks[ordered[ordered.length - 1]];
  const lastConnection = ordered.length > 1
    ? rowMiddleFromIntersection(blocks[ordered[ordered.length - 2]], lastBlock)
    : firstConnection;
  indices.push(oppositeBlockMiddle(lastBlock, lastConnection));
  return indices.filter((index) => Number.isInteger(index));
}

function closestCurveBinding(point, curve) {
  if (curve.length < 2) return { segment: 0, t: 0 };
  let best = { segment: 0, t: 0, distance: Infinity };
  for (let index = 0; index < curve.length - 1; index += 1) {
    const start = curve[index];
    const end = curve[index + 1];
    const delta = subtract(end, start);
    const lengthSquared = squaredDistance(end, start);
    const relative = subtract(point, start);
    const t = lengthSquared > 1e-12
      ? Math.max(0, Math.min(1, (relative.x * delta.x + relative.y * delta.y + relative.z * delta.z) / lengthSquared))
      : 0;
    const projected = add(start, scale(delta, t));
    const distance = squaredDistance(point, projected);
    if (distance < best.distance) best = { segment: index, t, distance };
  }
  return { segment: best.segment, t: best.t };
}

function curvePointAtBinding(curve, binding) {
  if (!curve.length) return { x: 0, y: 0, z: 0 };
  const startIndex = Math.max(0, Math.min(curve.length - 1, Number(binding.segment) || 0));
  const endIndex = Math.min(curve.length - 1, startIndex + 1);
  const t = Math.max(0, Math.min(1, Number(binding.t) || 0));
  return add(curve[startIndex], scale(subtract(curve[endIndex], curve[startIndex]), t));
}

function curveParameterAtBinding(curve, binding) {
  return curve.length > 1
    ? Math.max(0, Math.min(1, ((Number(binding.segment) || 0) + (Number(binding.t) || 0)) / (curve.length - 1)))
    : 0;
}

function curveTangentAtBinding(curve, binding) {
  if (curve.length < 2) return { x: 0, y: -1, z: 0 };
  const startIndex = Math.max(0, Math.min(curve.length - 2, Number(binding.segment) || 0));
  const tangent = subtract(curve[startIndex + 1], curve[startIndex]);
  const length = Math.hypot(tangent.x, tangent.y, tangent.z) || 1;
  return scale(tangent, 1 / length);
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function normalizeVector(vector, fallback = { x: 0, y: 0, z: 1 }) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  return length > 1e-8 ? scale(vector, 1 / length) : clonePoint(fallback);
}

function vertexNormals(points, faces) {
  const normals = points.map(() => ({ x: 0, y: 0, z: 0 }));
  faces.forEach((face) => {
    if (face.length < 3) return;
    const origin = points[face[0]];
    for (let index = 1; index < face.length - 1; index += 1) {
      const normal = cross(
        subtract(points[face[index]], origin),
        subtract(points[face[index + 1]], origin)
      );
      face.forEach((vertexIndex) => {
        normals[vertexIndex] = add(normals[vertexIndex], normal);
      });
    }
  });
  return normals.map((normal) => normalizeVector(normal));
}

function sectionProfileDepth(profile, signedCoordinate) {
  const points = normalizeSectionProfile(profile)
    .map((point) => ({ ...point, x: Math.max(-1, Math.min(1, point.x)) }))
    .sort((a, b) => a.x - b.x || b.z - a.z);
  const upper = [];
  points.forEach((point) => {
    const existing = upper.find((candidate) => Math.abs(candidate.x - point.x) < 1e-6);
    if (!existing) upper.push({ ...point });
    else if (point.z > existing.z) Object.assign(existing, point);
  });
  if (upper.length === 1) return upper[0].z;
  const x = Math.max(-1, Math.min(1, Number(signedCoordinate) || 0));
  let rightIndex = upper.findIndex((point) => point.x >= x);
  if (rightIndex <= 0) return upper[Math.max(0, rightIndex)].z;
  if (rightIndex < 0) return upper.at(-1).z;
  const left = upper[rightIndex - 1];
  const right = upper[rightIndex];
  let amount = (x - left.x) / Math.max(1e-8, right.x - left.x);
  if (left.interpolation === "smooth") amount = amount * amount * (3 - 2 * amount);
  return left.z + (right.z - left.z) * amount;
}

function disjointSet(size) {
  const parents = Array.from({ length: size }, (_, index) => index);
  function find(index) {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    while (parents[index] !== index) {
      const parent = parents[index];
      parents[index] = root;
      index = parent;
    }
    return root;
  }
  return {
    find,
    union(a, b) {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parents[rootB] = rootA;
    }
  };
}

export function buildConnectedStrandShellMesh(
  restPoints,
  faces,
  faceSections,
  restCurves,
  curves,
  settings = {}
) {
  const normalizedSettings = normalizeConnectedStrandShellSettings(settings);
  const restNormals = vertexNormals(restPoints, faces);
  const sectionHalfWidths = SECTION_NAMES.map((_, sectionIndex) => {
    const restCurve = restCurves[sectionIndex]?.points || [];
    let maximum = 0;
    faces.forEach((face, faceIndex) => {
      if (faceSections[faceIndex] !== sectionIndex) return;
      face.forEach((vertexIndex) => {
        const binding = closestCurveBinding(restPoints[vertexIndex], restCurve);
        maximum = Math.max(
          maximum,
          Math.hypot(...Object.values(subtract(restPoints[vertexIndex], curvePointAtBinding(restCurve, binding))))
        );
      });
    });
    return Math.max(0.0001, maximum);
  });
  const splitPoints = [];
  const splitPointSections = [];
  const splitPointOriginalIndices = [];
  const sectionVertexMaps = SECTION_NAMES.map(() => new Map());
  const splitFaces = faces.map((face, faceIndex) => {
    const sectionIndex = Math.max(0, Math.min(SECTION_NAMES.length - 1, Number(faceSections[faceIndex]) || 0));
    const restCurve = restCurves[sectionIndex]?.points || [];
    const sectionCurve = normalizeConnectedStrandShellSectionCurve(curves[sectionIndex], restCurves[sectionIndex]);
    const currentCurve = sectionCurve.points || restCurve;
    const width = normalizedSettings.sectionWidths[sectionIndex];
    return face.map((originalVertexIndex) => {
      const existing = sectionVertexMaps[sectionIndex].get(originalVertexIndex);
      if (existing != null) return existing;
      const restPoint = restPoints[originalVertexIndex];
      const binding = closestCurveBinding(restPoint, restCurve);
      const restCenter = curvePointAtBinding(restCurve, binding);
      const currentCenter = curvePointAtBinding(currentCurve, binding);
      const parameter = curveParameterAtBinding(restCurve, binding);
      const restOffset = subtract(restPoint, restCenter);
      const widthAmount = width * sampleTaperCurve(sectionCurve.taperCurve, parameter);
      const depthAmount = sampleTaperCurve(sectionCurve.depthCurve, parameter);
      const restTangent = curveTangentAtBinding(restCurve, binding);
      const currentTangent = curveTangentAtBinding(currentCurve, binding);
      const restNormal = restNormals[originalVertexIndex];
      const widthAxis = normalizeVector(cross(restNormal, restTangent), restOffset);
      const signedWidth = dot(restOffset, widthAxis);
      const signedCoordinate = signedWidth / sectionHalfWidths[sectionIndex];
      const currentNormal = normalizeVector(
        subtract(restNormal, scale(currentTangent, dot(restNormal, currentTangent))),
        restNormal
      );
      const profileDepth = sectionProfileDepth(sectionCurve.sweepProfile, signedCoordinate)
        * sectionHalfWidths[sectionIndex]
        * depthAmount;
      const point = add(
        add(currentCenter, scale(restOffset, widthAmount)),
        scale(currentNormal, profileDepth)
      );
      const splitIndex = splitPoints.length;
      splitPoints.push(point);
      splitPointSections.push(sectionIndex);
      splitPointOriginalIndices.push(originalVertexIndex);
      sectionVertexMaps[sectionIndex].set(originalVertexIndex, splitIndex);
      return splitIndex;
    });
  });

  const sets = disjointSet(splitPoints.length);
  const threshold = Math.max(1e-8, normalizedSettings.mergeDistance);
  const thresholdSquared = threshold * threshold;
  for (let a = 0; a < splitPoints.length; a += 1) {
    for (let b = a + 1; b < splitPoints.length; b += 1) {
      if (splitPointSections[a] === splitPointSections[b]) continue;
      if (splitPointOriginalIndices[a] !== splitPointOriginalIndices[b]) continue;
      if (squaredDistance(splitPoints[a], splitPoints[b]) <= thresholdSquared) sets.union(a, b);
    }
  }

  const grouped = new Map();
  splitPoints.forEach((point, index) => {
    const root = sets.find(index);
    const group = grouped.get(root) || { sum: { x: 0, y: 0, z: 0 }, count: 0, outputIndex: -1 };
    group.sum = add(group.sum, point);
    group.count += 1;
    grouped.set(root, group);
  });
  const points = [];
  grouped.forEach((group) => {
    group.outputIndex = points.length;
    points.push(scale(group.sum, 1 / group.count));
  });
  const remap = splitPoints.map((_, index) => grouped.get(sets.find(index)).outputIndex);
  const weldedFaces = splitFaces.map((face) => face.map((index) => remap[index]));
  return {
    settings: normalizedSettings,
    points,
    faces: weldedFaces,
    faceSections: [...faceSections],
    splitVertexCount: splitPoints.length,
    weldedVertexCount: points.length
  };
}

export function createConnectedStrandShellData(settings = {}) {
  const normalizedSettings = normalizeConnectedStrandShellSettings(settings);
  const faces = SOURCE_FACES.map((face) => [...face]);
  const points = inflateConnectedStrandShell(
    SOURCE_POINTS.map(sourcePoint),
    faces,
    normalizedSettings.inflation
  );
  const controllerVertexIndices = SECTION_NAMES.map((_, sectionIndex) => controllerVertexIndicesForSection(sectionIndex));
  const restCurves = controllerVertexIndices.map((indices, sectionIndex) => ({
    name: SECTION_NAMES[sectionIndex],
    sourceMaterial: SECTION_MATERIALS[sectionIndex],
    points: indices.map((index) => clonePoint(points[index])),
    sweepProfile: cloneShapePoints(DEFAULT_CONNECTED_STRAND_SECTION_PROFILE),
    taperCurve: cloneShapePoints(DEFAULT_CONNECTED_STRAND_SECTION_CURVE),
    depthCurve: cloneShapePoints(DEFAULT_CONNECTED_STRAND_SECTION_CURVE)
  }));
  const vertexSections = points.map(() => new Set());
  faces.forEach((face, faceIndex) => face.forEach((vertexIndex) => vertexSections[vertexIndex].add(FACE_SECTIONS[faceIndex])));
  const vertexBindings = points.map((point, vertexIndex) => [...vertexSections[vertexIndex]].map((sectionIndex) => ({
    sectionIndex,
    ...closestCurveBinding(point, restCurves[sectionIndex].points)
  })));
  return {
    settings: normalizedSettings,
    points,
    faces,
    faceSections: [...FACE_SECTIONS],
    controllerVertexIndices,
    restCurves,
    curves: restCurves.map((curve) => ({
      ...normalizeConnectedStrandShellSectionCurve(curve),
      points: curve.points.map(clonePoint)
    })),
    vertexBindings
  };
}

export function deformConnectedStrandShell(restPoints, restCurves, curves, vertexBindings) {
  return restPoints.map((point, vertexIndex) => {
    const bindings = vertexBindings[vertexIndex] || [];
    if (!bindings.length) return clonePoint(point);
    const displacement = bindings.reduce((sum, binding) => {
      const restCurve = restCurves[binding.sectionIndex]?.points || [];
      const curve = curves[binding.sectionIndex]?.points || restCurve;
      const restPoint = curvePointAtBinding(restCurve, binding);
      const currentPoint = curvePointAtBinding(curve, binding);
      return add(sum, subtract(currentPoint, restPoint));
    }, { x: 0, y: 0, z: 0 });
    return add(point, scale(displacement, 1 / bindings.length));
  });
}

export function connectedStrandShellTopologySummary() {
  const data = createConnectedStrandShellData();
  const edges = new Map();
  data.faces.forEach((face) => face.forEach((a, index) => {
    const b = face[(index + 1) % face.length];
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edges.set(key, (edges.get(key) || 0) + 1);
  }));
  return {
    vertexCount: data.points.length,
    faceCount: data.faces.length,
    quadCount: data.faces.filter((face) => face.length === 4).length,
    sectionCount: data.curves.length,
    boundaryEdgeCount: [...edges.values()].filter((count) => count === 1).length,
    nonManifoldEdgeCount: [...edges.values()].filter((count) => count > 2).length
  };
}
