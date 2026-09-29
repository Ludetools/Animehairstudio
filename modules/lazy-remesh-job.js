// Preserve the cancellable job interface while deferring the large runtime.
export function startCurveUnionJob(data, onProgress, load = () => data.method === 'boolean'
  ? import('./boolean-remesh-job.js?v=20260925-1') : import('./curve-union-job.js?v=20260922-1')) {
  let job, cancelled = false, rejectPending;
  const cancellation = new Promise((_, reject) => { rejectPending = reject; });
  const work = Promise.resolve().then(load).then(module => {
    if (cancelled) throw new Error('Remeshing cancelled.');
    job = module.startCurveUnionJob(data, onProgress);
    return job.promise;
  });
  onProgress?.(0, 'Loading remesher');
  return {promise: Promise.race([work, cancellation]), cancel() {
    if (cancelled) return;
    cancelled = true;
    job?.cancel();
    rejectPending(new Error('Remeshing cancelled.'));
  }};
}

// Adaptive results keep their existing authored settings; only the Low kernel updates.
export function unionSweeps(sweeps, axialLoops, flowSmoothing, onProgress, options) {
  return startCurveUnionJob({method: 'legacy', sweeps, axialLoops, flowSmoothing, options}, onProgress).promise;
}
