export function relativeEditValue(currentValue, primaryValue, nextPrimaryValue, options = {}) {
  const current = Number(currentValue);
  const primary = Number(primaryValue);
  const nextPrimary = Number(nextPrimaryValue);
  if (![current, primary, nextPrimary].every(Number.isFinite)) return current;
  const minimum = Number.isFinite(Number(options.min)) ? Number(options.min) : -Infinity;
  const maximum = Number.isFinite(Number(options.max)) ? Number(options.max) : Infinity;
  return Math.min(maximum, Math.max(minimum, current + nextPrimary - primary));
}
