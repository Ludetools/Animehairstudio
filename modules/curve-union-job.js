import { createCurveUnionRuntime as lowRuntime } from './curve-union-v1.js?v=20260908-1';
import { createCurveUnionRuntime } from './curve-union-v2.js?v=20260908-1';
import { createCurveUnionRuntime as highRuntime } from './curve-union-v3.js?v=20260908-1';

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
  const workerUrl = urls.createObjectURL(new Blob([curveUnionWorkerSource(data.method)], { type: 'text/javascript' }));
  let worker;
  try { worker = new WorkerClass(workerUrl); }
  catch (error) { urls.revokeObjectURL(workerUrl); throw error; }
  let finish;
  const promise = new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => finish(new Error('Curve union timed out. Try fewer strands or Low Effort.')), 300000);
    finish = (error, mesh) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      worker.terminate();
      urls.revokeObjectURL(workerUrl);
      if (error) reject(error); else resolve(mesh);
    };
    worker.onmessage = ({ data: result }) => {
      if (done) return;
      if (result.type === 'progress') onProgress?.(result.progress, result.message);
      else if (result.type === 'result') finish(null, result.mesh);
      else if (result.type === 'error') finish(new Error(result.message));
    };
    worker.onerror = event => { event.preventDefault?.(); finish(new Error(event.message || 'Curve union worker failed.')); };
    worker.onmessageerror = () => finish(new Error('Curve union returned unreadable geometry.'));
    try { worker.postMessage(data); } catch (error) { finish(error); }
  });
  return { promise, cancel() { finish(new Error('Remeshing cancelled.')); } };
}
