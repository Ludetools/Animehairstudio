import {buildUsdHairRig,usdHairWeights} from './usda-rig.js';

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  const number = finiteNumber(value);
  if (Math.abs(number) < 0.0000005) return "0";
  return Number(number.toFixed(6)).toString();
}

function quoteString(value) {
  return `"${String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\n", "\\n")}"`;
}

export function usdIdentifier(value, fallback = "Item") {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safe = normalized || fallback;
  return /^[A-Za-z_]/.test(safe) ? safe : `_${safe}`;
}

function uniqueIdentifier(value, used, fallback) {
  const base = usdIdentifier(value, fallback);
  let identifier = base;
  let suffix = 2;
  while (used.has(identifier)) {
    identifier = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(identifier);
  return identifier;
}

function tuple(values) {
  return `(${values.map(formatNumber).join(", ")})`;
}

function tupleArray(values) {
  return `[${values.map(tuple).join(", ")}]`;
}

function numberArray(values) {
  return `[${values.map((value) => Math.trunc(finiteNumber(value))).join(", ")}]`;
}

function metadataLines(item, indent) {
  const lines = [`${indent}custom string animeHairStudio:sourceName = ${quoteString(item.name)}`];
  if (item.group) lines.push(`${indent}custom string animeHairStudio:group = ${quoteString(item.group)}`);
  if (item.layer) lines.push(`${indent}custom string animeHairStudio:layer = ${quoteString(item.layer)}`);
  return lines;
}

function primvarLines(type, name, values, interpolation, indices = null) {
  const lines = [
    `            ${type}[] primvars:${name} = ${tupleArray(values)} (`,
    `                interpolation = "${interpolation}"`,
    "            )"
  ];
  if (Array.isArray(indices) && indices.length) {
    lines.push(`            int[] primvars:${name}:indices = ${numberArray(indices)}`);
  }
  return lines;
}

function meshBlock(mesh, identifier, skeleton, rootIdentifier, includeWeights) {
  const points = Array.isArray(mesh.points) ? mesh.points : [];
  const faces = (Array.isArray(mesh.faces) ? mesh.faces : [])
    .filter((face) => Array.isArray(face) && face.length >= 3);
  const faceVertexCounts = faces.map((face) => face.length);
  const faceVertexIndices = faces.flat();
  const skin=includeWeights&&skeleton?usdHairWeights(points,mesh.id,skeleton):null;
  const lines = [
    `        def Mesh "${identifier}"${skin?' (prepend apiSchemas = ["SkelBindingAPI"])':''}`,
    "        {",
    `            point3f[] points = ${tupleArray(points)}`,
    `            int[] faceVertexCounts = ${numberArray(faceVertexCounts)}`,
    `            int[] faceVertexIndices = ${numberArray(faceVertexIndices)}`,
    '            uniform token subdivisionScheme = "none"'
  ];
  if(skin)lines.push(
    `            rel skel:skeleton = </${rootIdentifier}/Skeleton>`,
    '            uniform token primvars:skel:skinningMethod = "classicLinear"',
    '            matrix4d primvars:skel:geomBindTransform = ((1,0,0,0),(0,1,0,0),(0,0,1,0),(0,0,0,1))',
    `            int[] primvars:skel:jointIndices = ${numberArray(skin.indices)} (\n                interpolation = "vertex"\n                elementSize = 3\n            )`,
    `            float[] primvars:skel:jointWeights = [${skin.weights.map(formatNumber).join(', ')}] (\n                interpolation = "vertex"\n                elementSize = 3\n            )`
  );

  if (Array.isArray(mesh.normals) && mesh.normals.length === points.length) {
    lines.push(
      `            normal3f[] normals = ${tupleArray(mesh.normals)}`,
      '            uniform token normals:interpolation = "vertex"'
    );
  }
  if (Array.isArray(mesh.uvs) && mesh.uvs.length === points.length) {
    lines.push(...primvarLines("texCoord2f", "st", mesh.uvs, "faceVarying", faceVertexIndices));
  }
  if (Array.isArray(mesh.colors) && mesh.colors.length === points.length) {
    lines.push(...primvarLines("color3f", "displayColor", mesh.colors, "vertex"));
  }
  if (Array.isArray(mesh.tangents) && mesh.tangents.length === points.length) {
    lines.push(...primvarLines("float4", "animeHairStudio:tangent", mesh.tangents, "vertex"));
  }
  lines.push(...metadataLines(mesh, "            "), "        }");
  return lines.join("\n");
}

function curveBlock(curve, identifier) {
  const points = Array.isArray(curve.points) ? curve.points : [];
  const width = Math.max(0.0001, finiteNumber(curve.width || 0.01));
  return [
    `        def BasisCurves "${identifier}"`,
    "        {",
    '            uniform token type = "cubic"',
    '            uniform token basis = "catmullRom"',
    '            uniform token wrap = "pinned"',
    `            int[] curveVertexCounts = [${points.length}]`,
    `            point3f[] points = ${tupleArray(points)}`,
    `            float[] widths = [${formatNumber(width)}]`,
    '            uniform token widths:interpolation = "constant"',
    ...metadataLines(curve, "            "),
    "        }"
  ].join("\n");
}

export function exportAnimeHairUsda({
  meshes = [],
  curves = [],
  rigs = [],
  rigRoot = null,
  includeBones = false,
  includeWeights = false,
  rootName = "AnimeHairStudio"
} = {}) {
  const usedMeshNames = new Set();
  const usedCurveNames = new Set();
  const rootIdentifier = usdIdentifier(rootName, "AnimeHairStudio");
  const skeleton=includeBones||includeWeights?buildUsdHairRig(rigs,rigRoot,usdIdentifier):null;
  const meshBlocks = meshes
    .filter((mesh) => Array.isArray(mesh?.points) && mesh.points.length && Array.isArray(mesh?.faces) && mesh.faces.length)
    .map((mesh) => meshBlock(mesh, uniqueIdentifier(mesh.name, usedMeshNames, "HairMesh"),skeleton,rootIdentifier,includeWeights));
  const curveBlocks = curves
    .filter((curve) => Array.isArray(curve?.points) && curve.points.length >= 4)
    .map((curve) => curveBlock(curve, uniqueIdentifier(`${curve.name || "Hair"}_Curve`, usedCurveNames, "HairCurve")));
  const matrices=values=>`[${values.map(m=>`(${[0,4,8,12].map(i=>tuple(m.slice(i,i+4))).join(', ')})`).join(', ')}]`;

  return [
    "#usda 1.0",
    "(",
    `    defaultPrim = "${rootIdentifier}"`,
    "    metersPerUnit = 1",
    '    upAxis = "Y"',
    ")",
    "",
    `def ${skeleton?'SkelRoot':'Xform'} "${rootIdentifier}"`,
    "{",
    ...(skeleton?['    def Skeleton "Skeleton"','    {',
      `        uniform token[] joints = [${skeleton.joints.map(quoteString).join(', ')}]`,
      `        uniform matrix4d[] bindTransforms = ${matrices(skeleton.bindTransforms)}`,
      `        uniform matrix4d[] restTransforms = ${matrices(skeleton.restTransforms)}`,'    }']:[]),
    '    def Scope "Meshes"',
    "    {",
    meshBlocks.join("\n\n"),
    "    }",
    "",
    '    def Scope "CenterCurves"',
    "    {",
    curveBlocks.join("\n\n"),
    "    }",
    "}",
    ""
  ].join("\n");
}
