export const MESH_PRIMITIVE_TYPES = Object.freeze(["cube", "plane", "cylinder", "sphere"]);

export const MESH_PRIMITIVE_DEFAULT_SETTINGS = Object.freeze({
  cube: Object.freeze({ segmentsX: 1, segmentsY: 1, segmentsZ: 1 }),
  plane: Object.freeze({ columns: 1, rows: 1 }),
  cylinder: Object.freeze({ radialSegments: 16, heightSegments: 4 }),
  sphere: Object.freeze({ resolution: 4 })
});

const PRIMITIVE_LABELS = Object.freeze({
  cube: "Cube",
  plane: "Plane",
  cylinder: "Cylinder",
  sphere: "Sphere"
});

export function normalizeMeshPrimitiveType(value) {
  return MESH_PRIMITIVE_TYPES.includes(value) ? value : "cube";
}

function clampedInteger(value, fallback, min = 1, max = 32) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || fallback)));
}

export function normalizeMeshPrimitiveSettings(type, value = {}) {
  const primitiveType = normalizeMeshPrimitiveType(type);
  const defaults = MESH_PRIMITIVE_DEFAULT_SETTINGS[primitiveType];
  if (primitiveType === "cube") {
    return {
      segmentsX: clampedInteger(value.segmentsX, defaults.segmentsX),
      segmentsY: clampedInteger(value.segmentsY, defaults.segmentsY),
      segmentsZ: clampedInteger(value.segmentsZ, defaults.segmentsZ)
    };
  }
  if (primitiveType === "plane") {
    return {
      columns: clampedInteger(value.columns, defaults.columns, 1, 64),
      rows: clampedInteger(value.rows, defaults.rows, 1, 64)
    };
  }
  if (primitiveType === "cylinder") {
    const radialSegments = clampedInteger(value.radialSegments, defaults.radialSegments, 4, 64);
    return {
      radialSegments: Math.max(4, Math.round(radialSegments / 4) * 4),
      heightSegments: clampedInteger(value.heightSegments, defaults.heightSegments, 1, 32)
    };
  }
  return { resolution: clampedInteger(value.resolution, defaults.resolution, 1, 16) };
}

function cubeSurface(divisions, transformPoint) {
  const source = typeof divisions === "number"
    ? { x: divisions, y: divisions, z: divisions }
    : divisions;
  const segments = {
    x: clampedInteger(source.x, 1),
    y: clampedInteger(source.y, 1),
    z: clampedInteger(source.z, 1)
  };
  const points = [];
  const faces = [];
  const faceGroups = [];
  const pointIndices = new Map();
  const coordinate = (index, count) => -1 + (index / count) * 2;
  const pointIndex = (x, y, z) => {
    const key = `${x.toFixed(8)}:${y.toFixed(8)}:${z.toFixed(8)}`;
    if (!pointIndices.has(key)) {
      pointIndices.set(key, points.length);
      points.push(transformPoint({ x, y, z }));
    }
    return pointIndices.get(key);
  };
  const addFaceGrid = (columns, rows, sample, reverse = false, group = 0) => {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = pointIndex(...sample(column, row));
        const b = pointIndex(...sample(column + 1, row));
        const c = pointIndex(...sample(column + 1, row + 1));
        const d = pointIndex(...sample(column, row + 1));
        faces.push(reverse ? [a, d, c, b] : [a, b, c, d]);
        faceGroups.push(group);
      }
    }
  };

  addFaceGrid(segments.x, segments.y, (column, row) => [coordinate(column, segments.x), coordinate(row, segments.y), 1], false, 0);
  addFaceGrid(segments.x, segments.y, (column, row) => [coordinate(column, segments.x), coordinate(row, segments.y), -1], true, 1);
  addFaceGrid(segments.z, segments.y, (column, row) => [1, coordinate(row, segments.y), coordinate(column, segments.z)], true, 2);
  addFaceGrid(segments.z, segments.y, (column, row) => [-1, coordinate(row, segments.y), coordinate(column, segments.z)], false, 3);
  addFaceGrid(segments.x, segments.z, (column, row) => [coordinate(column, segments.x), 1, coordinate(row, segments.z)], true, 4);
  addFaceGrid(segments.x, segments.z, (column, row) => [coordinate(column, segments.x), -1, coordinate(row, segments.z)], false, 5);
  return { points, faces, faceGroups };
}

function cubeData(settings) {
  return cubeSurface({ x: settings.segmentsX, y: settings.segmentsY, z: settings.segmentsZ }, ({ x, y, z }) => ({ x: x * 0.5, y: y * 0.5, z: z * 0.5 }));
}

function planeData(settings) {
  const points = [];
  const faces = [];
  for (let row = 0; row <= settings.rows; row += 1) {
    for (let column = 0; column <= settings.columns; column += 1) {
      points.push({
        x: -0.5 + column / settings.columns,
        y: -0.5 + row / settings.rows,
        z: 0
      });
    }
  }
  const index = (column, row) => row * (settings.columns + 1) + column;
  for (let row = 0; row < settings.rows; row += 1) {
    for (let column = 0; column < settings.columns; column += 1) {
      faces.push([
        index(column, row),
        index(column + 1, row),
        index(column + 1, row + 1),
        index(column, row + 1)
      ]);
    }
  }
  return { points, faces, faceGroups: faces.map(() => 0) };
}

function squareToDisk(x, z) {
  return {
    x: x * Math.sqrt(Math.max(0, 1 - (z * z) * 0.5)),
    z: z * Math.sqrt(Math.max(0, 1 - (x * x) * 0.5))
  };
}

function cylinderData(settings) {
  const sideResolution = settings.radialSegments / 4;
  const geometry = cubeSurface({ x: sideResolution, y: settings.heightSegments, z: sideResolution }, ({ x, y, z }) => {
    const disk = squareToDisk(x, z);
    return { x: disk.x * 0.5, y: y * 0.5, z: disk.z * 0.5 };
  });
  const sideGroups = new Set([0, 1, 2, 3]);
  return {
    ...geometry,
    faceGroups: geometry.faceGroups.map((group) => (
      sideGroups.has(group) ? 0 : group === 4 ? 1 : 2
    ))
  };
}

function sphereData(settings) {
  const geometry = cubeSurface(settings.resolution, ({ x, y, z }) => {
    const length = Math.hypot(x, y, z) || 1;
    return { x: x * 0.5 / length, y: y * 0.5 / length, z: z * 0.5 / length };
  });
  return { ...geometry, faceGroups: geometry.faces.map(() => 0) };
}

export function splitMeshVerticesByFaceGroups(faces, faceGroups) {
  const sourceIndices = [];
  const keyedIndices = new Map();
  const splitFaces = faces.map((face, faceIndex) => {
    const group = Number.isInteger(faceGroups?.[faceIndex]) ? faceGroups[faceIndex] : 0;
    return face.map((sourceIndex) => {
      const key = `${sourceIndex}:${group}`;
      if (!keyedIndices.has(key)) {
        keyedIndices.set(key, sourceIndices.length);
        sourceIndices.push(sourceIndex);
      }
      return keyedIndices.get(key);
    });
  });
  return { sourceIndices, faces: splitFaces };
}

export function inferMeshPrimitiveFaceSmoothingGroups(type, points, faces) {
  const primitiveType = normalizeMeshPrimitiveType(type);
  if (!["cube", "cylinder"].includes(primitiveType)) return (faces || []).map(() => 0);
  const faceNormal = (face) => {
    const [a, b, c] = (face || []).map((index) => points?.[index]);
    if (!a || !b || !c) return { x: 0, y: 1, z: 0 };
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const normal = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x
    };
    const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
    return { x: normal.x / length, y: normal.y / length, z: normal.z / length };
  };
  return (faces || []).map((face) => {
    const normal = faceNormal(face);
    if (primitiveType === "cylinder") {
      if (Math.abs(normal.y) > 0.7) return normal.y > 0 ? 1 : 2;
      return 0;
    }
    const absolute = { x: Math.abs(normal.x), y: Math.abs(normal.y), z: Math.abs(normal.z) };
    if (absolute.z >= absolute.x && absolute.z >= absolute.y) return normal.z >= 0 ? 0 : 1;
    if (absolute.x >= absolute.y) return normal.x >= 0 ? 2 : 3;
    return normal.y >= 0 ? 4 : 5;
  });
}

export function createMeshPrimitiveData(type = "cube", settingsValue = {}) {
  const normalizedType = normalizeMeshPrimitiveType(type);
  const settings = normalizeMeshPrimitiveSettings(normalizedType, settingsValue);
  const geometry = normalizedType === "plane"
    ? planeData(settings)
    : normalizedType === "cylinder"
      ? cylinderData(settings)
      : normalizedType === "sphere"
        ? sphereData(settings)
        : cubeData(settings);
  return {
    type: normalizedType,
    label: PRIMITIVE_LABELS[normalizedType],
    settings,
    points: geometry.points,
    faces: geometry.faces,
    faceSmoothingGroups: geometry.faceGroups
  };
}
