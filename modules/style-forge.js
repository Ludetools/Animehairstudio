const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export const DEFAULT_STYLE_FORGE_SETTINGS = Object.freeze({
  strandCount: 24,
  length: 1.8,
  surfaceFollow: 0.58,
  lift: 0.16,
  gravity: 0.82,
  smoothing: 0.72,
  randomness: 0.08,
  seed: 173
});

export function normalizeStyleForgeSettings(settings = {}) {
  return {
    strandCount: Math.round(clamp(finiteNumber(settings.strandCount, DEFAULT_STYLE_FORGE_SETTINGS.strandCount), 4, 64)),
    length: clamp(finiteNumber(settings.length, DEFAULT_STYLE_FORGE_SETTINGS.length), 0.35, 4),
    surfaceFollow: clamp(finiteNumber(settings.surfaceFollow, DEFAULT_STYLE_FORGE_SETTINGS.surfaceFollow), 0, 1),
    lift: clamp(finiteNumber(settings.lift, DEFAULT_STYLE_FORGE_SETTINGS.lift), 0, 0.8),
    gravity: clamp(finiteNumber(settings.gravity, DEFAULT_STYLE_FORGE_SETTINGS.gravity), 0, 1),
    smoothing: clamp(finiteNumber(settings.smoothing, DEFAULT_STYLE_FORGE_SETTINGS.smoothing), 0, 1),
    randomness: clamp(finiteNumber(settings.randomness, DEFAULT_STYLE_FORGE_SETTINGS.randomness), 0, 0.35),
    seed: Math.trunc(finiteNumber(settings.seed, DEFAULT_STYLE_FORGE_SETTINGS.seed)) || DEFAULT_STYLE_FORGE_SETTINGS.seed
  };
}

function pointDistanceSquared(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Selects a deterministic, spatially even subset of directed region-seam roots.
 * Each target region receives a seed before the remaining slots use farthest-point
 * sampling, so both sides of a shared border remain represented.
 */
export function selectStyleForgeRootCandidates(candidates = [], requestedCount = 0) {
  const source = candidates
    .filter((candidate) => Array.isArray(candidate?.point) && candidate.point.length >= 3)
    .map((candidate, index) => ({ ...candidate, sourceIndex: index }))
    .sort((a, b) => String(a.key || a.sourceIndex).localeCompare(String(b.key || b.sourceIndex)));
  const count = Math.min(source.length, Math.max(0, Math.round(requestedCount)));
  if (!count) return [];

  const selected = [];
  const remaining = new Set(source.map((_, index) => index));
  const regionSeeds = new Map();
  source.forEach((candidate, index) => {
    const region = String(candidate.targetRegion || "unassigned");
    if (!regionSeeds.has(region)) regionSeeds.set(region, index);
  });
  [...regionSeeds.keys()].sort().some((region) => {
    if (selected.length >= count) return true;
    const index = regionSeeds.get(region);
    selected.push(source[index]);
    remaining.delete(index);
    return false;
  });

  while (selected.length < count && remaining.size) {
    let bestIndex = -1;
    let bestDistance = -1;
    remaining.forEach((index) => {
      const candidate = source[index];
      const distance = selected.reduce(
        (minimum, item) => Math.min(minimum, pointDistanceSquared(candidate.point, item.point)),
        Infinity
      );
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    selected.push(source[bestIndex]);
    remaining.delete(bestIndex);
  }
  return selected;
}

export function styleForgeVariation(index, settings = {}) {
  const normalized = normalizeStyleForgeSettings(settings);
  const phase = (normalized.seed + index * 1013) * 0.017453292519943295;
  const secondary = (normalized.seed + index * 1877 + 41) * 0.011;
  return {
    lengthScale: 1 + Math.sin(secondary) * normalized.randomness,
    widthScale: 1 + Math.sin(phase) * normalized.randomness * 0.65,
    flowJitter: Math.cos(phase * 1.37) * normalized.randomness
  };
}
