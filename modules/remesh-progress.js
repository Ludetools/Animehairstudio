// Transient preview UI only; never serialized or used to estimate time remaining.
export function renderRemeshProgress(operation, { container, bar, label }) {
  const busy = Boolean(operation && !operation.closed && (operation.pending || operation.running));
  container.hidden = !busy;
  if (!busy) {
    bar.removeAttribute('value');
    label.textContent = '';
    return;
  }
  const value = operation.progress;
  if (Number.isFinite(value)) {
    const percent = Math.min(99, Math.max(0, Math.round(value * 100)));
    bar.value = percent;
    label.textContent = `Remeshing… ${percent}%`;
  } else {
    bar.removeAttribute('value');
    label.textContent = 'Preparing remesh…';
  }
}
