export function markStartup(stage, clock = globalThis.performance) {
  if (!clock?.mark || !clock?.measure) return;
  const name = `ahs:${stage}`;
  if (clock.getEntriesByName(name, 'mark').length) return;
  clock.mark(name);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ahs-startup-stage', {detail: stage}));
  if (clock.getEntriesByName('ahs:start', 'mark').length) {
    clock.measure(`AHS startup: ${stage}`, 'ahs:start', name);
  }
}

export function reportStartupFailure(message) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ahs-startup-failed', {detail: message}));
}
