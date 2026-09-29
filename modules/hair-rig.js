import {normalizeBoneLimit} from './hair-bone-limits.js';
import {MAX_HAIR_BINDING_BLEND} from './hair-skinning.js';
import {normalizeRigHierarchy} from './hair-rig-hierarchy.js';
import {endToEndSections,distributeEndToEndBones} from './rig-end-to-end.js';
// Authored rest joints are world-space. Parent of joint i is i - 1.
const validPoint = p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

export function normalizeHairRigRoot(value, rigs = [], fallback = null) {
  if (!rigs.length) return null;
  const position = validPoint(value?.position) ? value.position : validPoint(fallback) ? fallback
    : [0,1,2].map(axis => rigs.reduce((sum, rig) => sum + rig.joints[0][axis], 0) / rigs.length);
  return {id: 'hair-root', name: String(value?.name || 'Hair_Root').trim().replace(/[^\p{L}\p{N}_]+/gu, '_').slice(0,80) || 'Hair_Root', position: [...position]};
}

// Display-only octahedral bone, centered on Y with its broad shoulder near the root.
export function hairBoneDisplayShape(length, radius) {
  const vertices = [[0,-length/2,0], [0,length/2,0],
    [radius,-length*0.32,0], [0,-length*0.32,radius],
    [-radius,-length*0.32,0], [0,-length*0.32,-radius]];
  const positions = [], shades = [];
  const faces = [[0,2,3],[0,3,4],[0,4,5],[0,5,2], [1,3,2],[1,4,3],[1,5,4],[1,2,5]];
  const lighting = [0.48,0.38,0.52,0.64, 0.88,0.60,0.72,1];
  faces.forEach((face, i) => face.forEach(index => {
    positions.push(...vertices[index]); shades.push(lighting[i], lighting[i], lighting[i]);
  }));
  return {positions, shades};
}

export function sampleRigPolyline(points, count, values = points) {
  if (!Array.isArray(points) || points.length < 2 || !points.every(validPoint)) throw new Error('A strand needs a valid curve.');
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + distance(points[i], points[i - 1]));
  const total = lengths.at(-1);
  if (total < 1e-7) throw new Error('The selected curve has no length.');
  let segment = 1;
  return Array.from({length: count}, (_, i) => {
    const target = total * i / (count - 1);
    while (segment < points.length - 1 && lengths[segment] < target) segment++;
    const t = (target - lengths[segment - 1]) / (lengths[segment] - lengths[segment - 1] || 1);
    return values[segment - 1].map((v, axis) => v + (values[segment][axis] - v) * t);
  });
}

export function createHairRig(sources, {id, name = '', boneCount = 6, mode = 'average', centerX = 0, headWidth = 1, existingNames = []} = {}) {
  let unique = [...new Map(sources.map(source => [source.id, source])).values()];
  if (!unique.length) throw new Error('Choose at least one strand.');
  const count = Math.max(1, Math.min(64, Math.round(Number(boneCount) || 6)));
  const samples = unique.map(source => sampleRigPolyline(source.points, 129));
  const average = samples[0].map((_, i) => [0, 1, 2].map(axis => samples.reduce((sum, curve) => sum + curve[i][axis], 0) / samples.length));
  const normalSamples = unique.map(source => sampleRigPolyline(source.points, 129,
    source.normals?.length === source.points.length && source.normals.every(validPoint)
      ? source.normals : source.points.map((_, i) => rigJointFrame(source.points, [], i).z)));
  const averagedNormals = average.map((_, i) => {
    const reference = unit(normalSamples[0][i]);
    return unit(normalSamples.reduce((sum, normals) => {
      const sign = dot(reference, normals[i]) < 0 ? -1 : 1;
      return sum.map((v, axis) => v + normals[i][axis] * sign);
    }, [0, 0, 0]));
  });
  let joints = mode==='end-to-end'?[]:sampleRigPolyline(average, count + 1);
  let sampledNormals = mode==='end-to-end'?[]:sampleRigPolyline(average, count + 1, averagedNormals);
  if(mode==='end-to-end'){
    const plan=endToEndSections(unique);unique=plan.order;
    const counts=distributeEndToEndBones(plan.sections,count);joints=[];sampledNormals=[];
    plan.sections.forEach((section,i)=>{
      const values=section.normals?.length===section.points.length&&section.normals.every(validPoint)
        ?section.normals:section.points.map((_,j)=>rigJointFrame(section.points,[],j).z);
      joints.push(...sampleRigPolyline(section.points,counts[i]+1).slice(i?1:0));
      sampledNormals.push(...sampleRigPolyline(section.points,counts[i]+1,values).slice(i?1:0));
    });
  }
  const normals = joints.map((_, i) => rigJointFrame(joints, sampledNormals, i).z);
  const sharedGroup = unique[0].groupName && unique.every(source => source.groupName === unique[0].groupName) ? unique[0].groupName : '';
  const baseName = String(name).trim().slice(0,80) || (unique.length === 1 ? unique[0].name : sharedGroup) || unique[0].name || 'Hair Chain';
  const rig = {id, name: baseName, sourceIds: unique.map(source => source.id), joints, normals};
  rig.boneSide = 'auto';
  rig.boneNames = automaticHairBoneNames(baseName, joints, {centerX, headWidth, existingNames});
  return rig;
}

export function inferHairRigSide(joints, centerX = 0, headWidth = 1) {
  const band = Math.max(1e-5, Math.abs(headWidth) * 0.02);
  let samples;
  try { samples = sampleRigPolyline(joints, 65); } catch { return 'C'; }
  const left = samples.filter(p => p[0] - centerX < -band).length;
  const right = samples.filter(p => p[0] - centerX > band).length;
  // Require both a majority of the whole chain and a clear side dominance.
  if (left > samples.length * 0.55 && left > right * 1.5) return 'L';
  if (right > samples.length * 0.55 && right > left * 1.5) return 'R';
  return 'C';
}

// Split explicitly linked mirror pairs before averaging, never by visual proximity.
// Mixed/unlinked selections keep their existing shared-chain behavior.
export function mirroredRigSourceGroups(selectedIds, sources) {
  const byId=new Map(sources.map(source=>[source.id,source]));
  const selected=[...new Set(selectedIds)].map(id=>byId.get(id)).filter(Boolean);
  const paired=source=>source.mirrorId!==source.id&&byId.get(source.mirrorId)?.mirrorId===source.id;
  if(!selected.length||!selected.every(paired))return [selected.map(source=>source.id)];
  const selectedSet=new Set(selected.map(source=>source.id)),primary=[];
  const preferred=selected.find(source=>['L','R'].includes(source.side))?.side;
  for(const source of selected) {
    if(primary.includes(source.id)||primary.includes(source.mirrorId))continue;
    const partner=byId.get(source.mirrorId);
    primary.push(selectedSet.has(partner.id)&&preferred&&partner.side===preferred?partner.id:source.id);
  }
  return [primary,primary.map(id=>byId.get(id).mirrorId)];
}

export function automaticHairBoneNames(name, joints, {centerX = 0, headWidth = 1, existingNames = [], side = 'auto'} = {}) {
  const stem = String(name || 'Hair').trim().replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, '').slice(0,60) || 'Hair';
  // AHS head coordinates label negative X left and positive X right.
  side = ['L','R','C'].includes(side) ? side : inferHairRigSide(joints, centerX, headWidth);
  const used = new Set(existingNames);
  let serial = 1, names;
  do {
    const prefix = `${stem}${serial === 1 ? '' : '_' + serial}_${side}`;
    names = joints.slice(0,-1).map((_, i) => `${prefix}_${i === 0 ? 'root' : String(i).padStart(2,'0')}`);
    serial++;
  } while (names.some(value => used.has(value)));
  return names;
}

export function normalizeHairRigs(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const rigs = value.filter(rig => {
    if (!rig || typeof rig.id !== 'string' || seen.has(rig.id) || !Array.isArray(rig.joints)
      || rig.joints.length < 2 || rig.joints.length > 65 || !rig.joints.every(validPoint)) return false;
    seen.add(rig.id); return true;
  }).map(rig => ({id: rig.id, name: String(rig.name || 'Hair Chain').slice(0, 80),
    ...(rig.parentId === 'hair-root' ? {parentId: 'hair-root'} : {}),
    ...(rig.parentBone ? {parentBone:{rigId:rig.parentBone.rigId,joint:rig.parentBone.joint}} : {}),
    sourceIds: Array.isArray(rig.sourceIds) ? rig.sourceIds.filter(id => typeof id === 'string') : [],
    joints: rig.joints.map(point => [...point]),
    ...(['auto','L','C','R'].includes(rig.boneSide) ? {boneSide: rig.boneSide} : {}),
    ...(Array.isArray(rig.boneNameOverrides) && rig.boneNameOverrides.length === rig.joints.length - 1
      ? {boneNameOverrides: rig.boneNameOverrides.map(value => value === true)} : {}),
    ...(Array.isArray(rig.boneNames) && rig.boneNames.length === rig.joints.length - 1
      && rig.boneNames.every(name => typeof name === 'string' && name.trim())
      ? {boneNames: rig.boneNames.map(name => name.trim().slice(0,80))} : {}),
    ...(Number.isFinite(rig.bindingBlend) ? {bindingBlend: Math.max(0, Math.min(MAX_HAIR_BINDING_BLEND, rig.bindingBlend))} : {}),
    ...(Array.isArray(rig.physicsEnabled) ? {physicsEnabled: rig.joints.slice(0,-1).map((_,i)=>rig.physicsEnabled[i] !== false)} : {}),
    ...(Array.isArray(rig.rotationLimits) ? {rotationLimits:rig.joints.slice(0,-1).map((_,i)=>normalizeBoneLimit(rig.rotationLimits[i]))} : {}),
    ...(rig.rootWeights && typeof rig.rootWeights === 'object' ? {rootWeights: Object.fromEntries(Object.entries(rig.rootWeights)
      .filter(([id, value]) => rig.boundStrandIds?.includes(id) && Number.isFinite(value))
      .map(([id, value]) => [id, Math.max(0, Math.min(1, value))]))} : {}),
    ...(rig.normals?.length === rig.joints.length && rig.normals.every(validPoint)
      ? {normals: rig.normals.map(normal => [...normal])} : {}),
    ...(Array.isArray(rig.boundStrandIds) ? {boundStrandIds: [...new Set(rig.boundStrandIds.filter(id => typeof id === 'string'))]} : {})}));
  return normalizeRigHierarchy(rigs);
}

const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = v => { const length = Math.hypot(...v); return length > 1e-10 ? v.map(n => n / length) : [0,0,0]; };

// Y aims at the child; Z follows the strand depth/normal, X its width.
// The terminal joint inherits the last non-zero segment direction.
export function rigJointFrame(joints, normals, index) {
  let y = [0,0,0];
  for (let i = Math.min(index, joints.length - 2); i >= 0; i--) {
    y = unit(joints[i + 1].map((v, axis) => v - joints[i][axis]));
    if (dot(y,y) > 0) break;
  }
  if (!dot(y,y)) y = [0,1,0];
  let z = normals?.[index] || [0,0,1];
  z = unit(z.map((v, axis) => v - dot(z,y) * y[axis]));
  if (!dot(z,z)) {
    const fallback = Math.abs(y[2]) < 0.9 ? [0,0,1] : [1,0,0];
    z = unit(fallback.map((v, axis) => v - dot(fallback,y) * y[axis]));
  }
  return {x: unit(cross(y,z)), y, z};
}

export function transformRigNormals(normals, matrix, firstJoint = 0) {
  return normals.map((normal, i) => i < firstJoint ? [...normal] : unit([0,1,2].map(axis =>
    matrix[axis]*normal[0] + matrix[axis+4]*normal[1] + matrix[axis+8]*normal[2])));
}

export function transformRigJoints(joints, matrix, firstJoint = 0) {
  return joints.map((point, i) => i < firstJoint ? [...point] : [0, 1, 2].map(axis =>
    matrix[axis] * point[0] + matrix[axis + 4] * point[1] + matrix[axis + 8] * point[2] + matrix[axis + 12]));
}
