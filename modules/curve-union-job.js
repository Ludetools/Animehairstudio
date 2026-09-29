import { startRemeshWorker } from './remesh-worker.js';
import { createCurveUnionRuntime as lowRuntime } from './curve-union-v1.js?v=20260922-1';
import { createCurveUnionRuntime } from './curve-union-v2.js?v=20260922-1';
import { createCurveUnionRuntime as highRuntime } from './curve-union-v3.js?v=20260922-1';

// Self-contained: no file:// imports inside the worker's opaque origin.
function installWorker(scope, run) {
  scope.onmessage = async ({ data }) => {
    try {
      const mesh = await run(data.sweeps, data.axialLoops, data.flowSmoothing,
        (progress, message) => scope.postMessage({ type: 'progress', progress, message }), data.options);
      scope.postMessage({ type: 'result', mesh });
    } catch (error) {
      scope.postMessage({ type: 'error', message: error?.message || 'Curve union failed.' });
    }
  };
}

export function curveUnionWorkerSource(method = 'curve-union-v2') {
  const runtime = method === 'legacy' ? lowRuntime : method === 'curve-union-v3' ? highRuntime : createCurveUnionRuntime;
  return `(${installWorker.toString()})(self, (${runtime.toString()})());`;
}

export function startCurveUnionJob(data, onProgress, WorkerClass = Worker, urls = URL) {
  return startRemeshWorker(curveUnionWorkerSource(data.method), data, onProgress, WorkerClass, urls);
}
