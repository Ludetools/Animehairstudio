import { booleanWorkerSource } from './boolean-worker-source.js?v=20260922-1';
import { createSurfaceCutStitchRuntime } from './surface-cut-stitch.js';

// Keep the imported engine untouched. Only mesh messages use this adapter;
// strand-only sweep messages retain the upstream cut-and-stitch path.
export const booleanMeshWorkerSource = booleanWorkerSource + `
const surfaceRuntime = (${createSurfaceCutStitchRuntime.toString()})();
const sweepMessageHandler = onmessage;
onmessage = async ({data}) => {
  if (!data.meshes) return sweepMessageHandler({data});
  try {
    const progress = (progress,label) => postMessage({type:'progress',progress,label});
    const sources = surfaceRuntime.prepare(data.meshes);
    let mesh;
    if (sources.every(s => s.closed)) {
      progress(.05,'Loading solid Boolean engine');
      const wasm = await createCutStitchManifold(); wasm.setup();
      progress(.2,'Cutting closed mesh intersections');
      const result = cutStitchManifoldUnion(wasm,sources);
      mesh = result.mesh;
      const topology = validateTopology(mesh);
      const audit = strictQualityAudit(mesh,topology.components);
      if (!audit.hardValid || audit.foldedQuads || !mesh.objFaces.length) throw Error('Boolean mesh union failed geometry safety checks. Check for open seams or self-intersections.');
      mesh.cutStitchAudit = audit;
      mesh.cutStitchExportSafe = true;
      mesh.expectedComponents = topology.components;
      progress(.9,'Transferring surface attributes');
      mesh.meshBake = surfaceRuntime.bakeSolid(mesh,sources,result.provenance);
    } else {
      mesh = surfaceRuntime.stitch(sources,progress);
    }
    postMessage({type:'result',mesh});
  } catch(error) { postMessage({type:'error',message:error.message || String(error)}); }
};
`;
