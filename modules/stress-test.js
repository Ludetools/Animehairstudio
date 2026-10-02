// Developer diagnostics only. Nothing here becomes project/preset state.
// Contract: Debug modal owns all test objects, rigs, pose clones and settings.
// Default: one independent six-bone physics chain per generated strand; rendering
// alone remains available. Authored objects, groups, mirrors, undo, projects,
// presets and exports are unaffected. Stop/failure/re-entry release owned data.
import {createHairRig} from './hair-rig.js';
import {createChainSimulation} from './hair-physics.js';
import {createHairPosePreview, disposeHairPosePreview} from './hair-pose-preview.js';

export const STRESS_TEST_GEM_ID = '__stress_gem_full__';
export const STRESS_TEST_GEM_LOOK = Object.freeze({
  color: '#189b90', roughness: 0.16, gemFracturing: 1, gemDepthContrast: 1,
  gemInclusions: 1, gemInclusionScale: 1, gemFracturingScale: 1,
  gemFractureDepth: 1, gemPearlescence: 1, gemRainbowReflections: 1
});

export function normalizeStressTestSettings(source = {}) {
  const bounded = (value, fallback, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
  };
  const settings = {
    count: bounded(source.count ?? 500, 500, 50, 5000),
    segments: bounded(source.segments ?? 16, 16, 4, 64),
    seconds: bounded(source.seconds ?? 10, 10, 5, 30),
    pixelRatio: [1, 2].includes(Number(source.pixelRatio)) ? Number(source.pixelRatio) : 1,
    materialId: String(source.materialId || ''),
    mode: source.mode === 'render' ? 'render' : 'rig-physics',
    bones: bounded(source.bones ?? 6, 6, 2, 24)
  };
  // Conservative split-vertex estimate: prevent accidental multi-million-
  // vertex allocations while allowing thousands of low-density objects.
  if (settings.count * (settings.segments + 1) * 18 > 750000) {
    throw new Error('Safety limit: reduce strand count or length segments (750,000 estimated vertices maximum).');
  }
  if (settings.mode === 'rig-physics' && settings.count * settings.bones > 30000) {
    throw new Error('Safety limit: reduce strand count or bones per strand (30,000 bones maximum).');
  }
  return settings;
}

// Append one binding at a time so the controller can yield between strands.
// Use the production rig builder, binding adapter and preview ownership path.
export function appendStressTestRig(THREE, session, data, lock, createEntries) {
  session.rigs ??= [];
  session.pose ??= {rigs:new Map(), meshes:[], ownedGeometries:new Set(), group:new THREE.Group(),
    physics:{playing:true, initial:[], chains:new Map(), head:{delta:new THREE.Matrix4().toArray(), rotation:new THREE.Quaternion()}}};
  const rig = createHairRig([data], {id:`stress-rig-${data.id}`, boneCount:session.settings.bones});
  rig.boundStrandIds = [lock.id];
  rig.bindingBlend = 1;
  rig.physicsEnabled = Array(session.settings.bones).fill(true);
  // A temporary per-strand group keeps partial binding failure cleanup local.
  const part = createHairPosePreview({rigs:[rig], locks:[lock], group:new THREE.Group(), createEntries});
  const pose = part.rigs.get(rig.id);
  session.rigs.push(rig);
  session.pose.rigs.set(rig.id, pose);
  session.pose.meshes.push(...part.meshes);
  for (const geometry of part.ownedGeometries) session.pose.ownedGeometries.add(geometry);
  for (const entry of part.meshes) session.pose.group.add(entry.clone);
  session.pose.physics.initial.push({id:rig.id, joints:pose.joints.map(point=>[...point]),
    matrices:pose.matrices.map(matrix=>[...matrix])});
  session.pose.physics.chains.set(rig.id, createChainSimulation(pose.joints));
  session.group.add(session.pose.group);
  // Render only the posed clone, not two copies of the same strand.
  lock.mesh.visible = false;
}

export function meanStressTestTime(samples) {
  return samples.length ? samples.reduce((sum,value)=>sum+value,0) / samples.length : 0;
}

export function stressTestStrandData(index, settings, regions, layers) {
  const angle = index * 2.399963229728653;
  const radius = 0.35 + 0.65 * Math.sqrt((index + 0.5) / settings.count);
  const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
  const length = 1.2 + (index % 7) * 0.12;
  return {
    id: `stress-strand-${index}`, name: `Test Strand ${index + 1}`,
    scalpRegion: regions[index % regions.length].id,
    hairLayer: layers[Math.floor(index / regions.length) % layers.length].id,
    materialId: settings.materialId, width: 0.045, depth: 0.025,
    lengthSegments: settings.segments, radialSegments: 8,
    dynamicDensity: false, twistDensity: 0, rootAttachmentEnabled: false,
    layerOffsetApplied: 0,
    points: Array.from({length:5}, (_, point) => {
      const t = point / 4, outward = 1 + t * 0.65;
      return [x * outward + Math.sin(t * Math.PI) * 0.12,
        0.9 - t * length, z * outward];
    }),
    normals: Array.from({length:5}, () => [Math.cos(angle),0,Math.sin(angle)])
  };
}

export function stressTestOutlinerObjects(objects) {
  // Borrow render meshes/materials but annotate detached records, not even the
  // transient render objects. Mix loose strands, clumps and remesh folders.
  const records = objects.map((object, index) => ({...object,
    clumpId: index % 5 ? `stress-clump-${Math.floor(index / 20)}` : undefined,
    clumpGuide: index % 20 === 1,clumpName:`Test Clump ${Math.floor(index / 20) + 1}`}));
  for (let index = 0; index < objects.length; index += 100) {
    records.push({...objects[index],id:`stress-remesh-${index}`,name:`Test Remesh ${index / 100 + 1}`,
      clumpId:undefined,clumpGuide:false,modelingMeshType:'auto-remesh',
      adaptiveRemeshSourceIds:objects.slice(index,index + 5).map(object => object.id)});
  }
  return records;
}

export function summarizeStressTestFrames(intervals, submissionTimes) {
  if (!intervals.length) return null;
  const sorted = [...intervals].sort((a,b) => a-b);
  const mean = values => values.reduce((sum,value) => sum + value,0) / values.length;
  const percentile = fraction => sorted[Math.max(0,Math.ceil(sorted.length * fraction) - 1)];
  return {frames:intervals.length, fps:1000 / mean(intervals),
    medianFrameMs:percentile(0.5), p95FrameMs:percentile(0.95), p99FrameMs:percentile(0.99),
    worstFrameMs:sorted.at(-1), framesOver33Ms:intervals.filter(value => value > 33.333).length,
    meanRenderSubmissionMs:submissionTimes.length ? mean(submissionTimes) : null};
}

export function nextStressTestFrame(signal, scheduler) {
  return new Promise((resolve,reject) => {
    if (signal.aborted) {reject(new Error('Stress test cancelled'));return;}
    const abort = () => {
      scheduler.cancelAnimationFrame(frame);
      signal.removeEventListener('abort',abort);
      reject(new Error('Stress test cancelled'));
    };
    const frame = scheduler.requestAnimationFrame(() => {
      signal.removeEventListener('abort',abort);resolve();
    });
    signal.addEventListener('abort',abort,{once:true});
  });
}

export function disposeStressTestResources(session) {
  if (!session || session.disposed) return;
  session.disposed = true;
  session.controller.abort();
  session.scheduler.cancelAnimationFrame(session.frame);
  session.observer?.disconnect();
  disposeHairPosePreview(session.pose);
  session.pose?.physics.chains.clear();
  if (session.pose) session.pose.physics.initial.length = 0;
  if (session.rigs) session.rigs.length = 0;
  const geometries = new Set(), materials = new Set();
  session.objects.forEach(object => {
    geometries.add(object.mesh.geometry);
    const value = object.mesh.material;
    (Array.isArray(value) ? value : [value]).forEach(material => materials.add(material));
  });
  geometries.forEach(geometry => geometry.dispose());
  // Maps/textures on these materials may belong to the user's shared resource.
  // Dispose only owned material instances, never their borrowed textures.
  materials.forEach(material => material.dispose());
  session.group?.clear();
  session.renderer?.dispose();
  session.renderer?.forceContextLoss();
  session.objects.length = 0;
}
