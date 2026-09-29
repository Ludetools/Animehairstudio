// Shared worker ownership, independent of any geometry engine.
export function startRemeshWorker(source, data, onProgress, WorkerClass = Worker, urls = URL, clock = globalThis) {
  const workerUrl = urls.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  let worker;
  try { worker = new WorkerClass(workerUrl); }
  catch (error) { urls.revokeObjectURL(workerUrl); throw error; }
  let finish;
  const promise = new Promise((resolve, reject) => {
    let done = false;
    const timer = clock.setTimeout(() => finish(new Error('Curve union timed out. Try fewer strands or Low Effort.')), 300000);
    finish = (error, mesh) => {
      if (done) return;
      done = true;
      clock.clearTimeout(timer);
      worker.terminate();
      urls.revokeObjectURL(workerUrl);
      if (error) reject(error); else resolve(mesh);
    };
    worker.onmessage = ({ data: result }) => {
      if (done) return;
      if (result.type === 'progress') onProgress?.(result.progress, result.message ?? result.label);
      else if (result.type === 'result') finish(null, result.mesh);
      else if (result.type === 'error') finish(new Error(result.message));
    };
    worker.onerror = event => { event.preventDefault?.(); finish(new Error(event.message || 'Curve union worker failed.')); };
    worker.onmessageerror = () => finish(new Error('Curve union returned unreadable geometry.'));
    try { worker.postMessage(data); } catch (error) { finish(error); }
  });
  return { promise, cancel() { finish(new Error('Remeshing cancelled.')); } };
}
