import { booleanWorkerSource } from './boolean-worker-source.js?v=20260922-1';
import { startRemeshWorker } from './remesh-worker.js';
import { booleanMeshWorkerSource } from './boolean-mesh-worker.js';

// Same cancellation/resource lifecycle; the shipped worker owns Boolean settings.
export function startCurveUnionJob(data, onProgress, WorkerClass = Worker, urls = URL) {
  return startRemeshWorker(data.meshes ? booleanMeshWorkerSource : booleanWorkerSource, data, onProgress, WorkerClass, urls);
}
