// Derived display only: never writes an input value or dispatches an edit event.
export function sliderFillPercent(range) {
  const min = range.min === '' ? 0 : Number(range.min);
  const max = range.max === '' ? 100 : Number(range.max);
  const value = Number(range.value);
  if (![min, max, value].every(Number.isFinite) || max <= min) return 0;
  return Math.min(100, Math.max(0, (value - min) / (max - min) * 100));
}

const fills = new WeakMap();
export function syncSliderFill(range) {
  const fill = `${sliderFillPercent(range)}%`;
  if (fills.get(range) === fill) return;
  fills.set(range, fill);
  range.style.setProperty('--slider-fill', fill);
}
