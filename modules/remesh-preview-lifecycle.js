// Transient scheduling only. Scene/UI effects remain in the application adapter.
export function isCurrentRemeshPreview(operation, current, generation) {
  return current === operation && !operation.closed && generation === operation.requestedGeneration;
}

export function scheduleRemeshPreview(operation, generate, {immediate = false, clock = globalThis} = {}) {
  if (!operation || operation.closed) return false;
  operation.requestedGeneration += 1;
  operation.latestOutput = null;
  operation.progress = null;
  operation.remeshJob?.cancel();
  operation.pending = true;
  if (operation.debounceTimer != null) clock.clearTimeout(operation.debounceTimer);
  operation.debounceTimer = clock.setTimeout(() => {
    operation.debounceTimer = null;
    generate();
  }, immediate ? 0 : 160);
  return true;
}

export function closeRemeshPreview(operation, clock = globalThis) {
  if (!operation) return false;
  operation.closed = true;
  operation.requestedGeneration += 1;
  operation.remeshJob?.cancel();
  if (operation.debounceTimer != null) clock.clearTimeout(operation.debounceTimer);
  operation.debounceTimer = null;
  return true;
}

export function finishRemeshPreview(operation, current, generation) {
  operation.running = false;
  operation.remeshJob = null;
  if (current !== operation || operation.closed) return 'closed';
  return generation !== operation.requestedGeneration ? 'restart' : 'sync';
}
