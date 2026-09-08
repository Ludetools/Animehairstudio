const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finiteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const DEFAULT_CROWN_GROW_SETTINGS = Object.freeze({
  strandCount: 16,
  length: 1.8,
  crownRadius: 0.18,
  surfaceFollow: 0.52,
  lift: 0.16,
  gravity: 0.72,
  swirl: 0,
  smoothing: 0.65,
  randomness: 0.08,
  seed: 173
});

export function normalizeCrownGrowSettings(settings = {}) {
  return {
    strandCount: Math.round(clamp(finiteNumber(settings.strandCount, DEFAULT_CROWN_GROW_SETTINGS.strandCount), 4, 48)),
    length: clamp(finiteNumber(settings.length, DEFAULT_CROWN_GROW_SETTINGS.length), 0.35, 4),
    crownRadius: clamp(finiteNumber(settings.crownRadius, DEFAULT_CROWN_GROW_SETTINGS.crownRadius), 0, 0.8),
    surfaceFollow: clamp(finiteNumber(settings.surfaceFollow, DEFAULT_CROWN_GROW_SETTINGS.surfaceFollow), 0, 1),
    lift: clamp(finiteNumber(settings.lift, DEFAULT_CROWN_GROW_SETTINGS.lift), 0, 0.8),
    gravity: clamp(finiteNumber(settings.gravity, DEFAULT_CROWN_GROW_SETTINGS.gravity), 0, 1),
    swirl: clamp(finiteNumber(settings.swirl, DEFAULT_CROWN_GROW_SETTINGS.swirl), -1, 1),
    smoothing: clamp(finiteNumber(settings.smoothing, DEFAULT_CROWN_GROW_SETTINGS.smoothing), 0, 1),
    randomness: clamp(finiteNumber(settings.randomness, DEFAULT_CROWN_GROW_SETTINGS.randomness), 0, 0.35),
    seed: Math.trunc(finiteNumber(settings.seed, DEFAULT_CROWN_GROW_SETTINGS.seed)) || DEFAULT_CROWN_GROW_SETTINGS.seed
  };
}

function seededUnit(seed) {
  let value = Math.trunc(seed) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

export function crownGrowStrandPlan(settings = {}) {
  const normalized = normalizeCrownGrowSettings(settings);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: normalized.strandCount }, (_, index) => {
    const centeredNoise = seededUnit(normalized.seed + index * 1013) * 2 - 1;
    const lengthNoise = seededUnit(normalized.seed + index * 1877 + 41) * 2 - 1;
    return {
      index,
      angle: index * goldenAngle
        + centeredNoise * normalized.randomness * (Math.PI * 2 / normalized.strandCount),
      rootT: Math.sqrt((index + 0.5) / normalized.strandCount),
      length: normalized.length * (1 + lengthNoise * normalized.randomness),
      widthScale: 1 + centeredNoise * normalized.randomness * 0.65
    };
  });
}

export function crownGrowCoverageRadius(settings = {}) {
  const normalized = normalizeCrownGrowSettings(settings);
  return clamp(normalized.length * (0.58 + normalized.surfaceFollow * 0.22), 0.65, 2.1);
}

export function crownGrowSmoothingMetrics(settings = {}) {
  const { smoothing } = normalizeCrownGrowSettings(settings);
  return {
    surfaceTurnDegrees: 30 + (7 - 30) * smoothing,
    freeTurnDegrees: 24 + (6 - 24) * smoothing
  };
}

export function crownGrowGravityStrength(gravity) {
  const normalized = clamp(finiteNumber(gravity, DEFAULT_CROWN_GROW_SETTINGS.gravity), 0, 1);
  return 1 - (1 - normalized) ** 2;
}
