import { DEFAULT_HAIR_MATERIAL_SETTINGS } from "./app-config.js";
import {
  normalizeAnimeAnisotropicSettings,
  normalizeHairShader
} from "./anime-hair-shaders.js";

const LEGACY_CUSTOM_HAIR_MATERIAL_FIELDS = Object.freeze([
  "shadowColor",
  "highlightColor",
  "shadowThreshold",
  "shadowSoftness",
  "backGradientStrength",
  "backGradientPower",
  "highlightWidth",
  "highlightSoftness",
  "highlightStrength",
  "highlightShift",
  "highlightJaggedness",
  "highlightJaggedFrequency"
]);

export const MAX_HAIR_GRADIENT_STOPS = 8;

function normalizedGradientColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""))
    ? String(value).toLowerCase()
    : fallback;
}

export function normalizeHairGradientStops(stops, fallbackColor = DEFAULT_HAIR_MATERIAL_SETTINGS.color) {
  const fallback = normalizedGradientColor(fallbackColor, DEFAULT_HAIR_MATERIAL_SETTINGS.color);
  const normalized = (Array.isArray(stops) ? stops : [])
    .slice(0, MAX_HAIR_GRADIENT_STOPS)
    .map((stop) => ({
      position: Math.min(1, Math.max(0, Number(stop?.position) || 0)),
      color: normalizedGradientColor(stop?.color, fallback)
    }))
    .sort((first, second) => first.position - second.position);
  if (!normalized.length) return [{ position: 0, color: fallback }, { position: 1, color: fallback }];
  if (normalized.length === 1) {
    return [
      { position: 0, color: normalized[0].color },
      { position: 1, color: normalized[0].color }
    ];
  }
  return normalized;
}

export function normalizeHairMaterialDefinition(material = {}) {
  LEGACY_CUSTOM_HAIR_MATERIAL_FIELDS.forEach((key) => delete material[key]);
  material.color ||= DEFAULT_HAIR_MATERIAL_SETTINGS.color;
  material.shader = normalizeHairShader(material.shader);
  Object.assign(material, normalizeAnimeAnisotropicSettings(material));
  const roughness = Number(material.roughness);
  material.roughness = Number.isFinite(roughness)
    ? Math.min(1, Math.max(0, roughness))
    : DEFAULT_HAIR_MATERIAL_SETTINGS.roughness;
  material.baseColorGradientEnabled = Boolean(material.baseColorGradientEnabled);
  material.baseColorGradientStops = normalizeHairGradientStops(
    material.baseColorGradientStops,
    material.shader === "anime-anisotropic" ? material.animeBaseColor : material.color
  );
  return material;
}

export function resolveHairMaterialDefinition(definitions, materialId) {
  const materials = Array.isArray(definitions) ? definitions : [];
  const definition = materials.find((material) => material.id === materialId) || materials[0] || null;
  return definition ? normalizeHairMaterialDefinition(definition) : null;
}

export function hairMaterialUsageCounts(locks, definitions, defaultMaterialId) {
  const counts = new Map();
  (Array.isArray(locks) ? locks : []).forEach((lock) => {
    const definition = resolveHairMaterialDefinition(definitions, lock?.materialId || defaultMaterialId);
    if (!definition) return;
    counts.set(definition.id, (counts.get(definition.id) || 0) + 1);
  });
  return counts;
}

export function hairMaterialPresetValue(material = {}) {
  const normalized = normalizeHairMaterialDefinition({
    ...material,
    baseColorGradientStops: Array.isArray(material.baseColorGradientStops)
      ? material.baseColorGradientStops.map((stop) => ({ ...stop }))
      : material.baseColorGradientStops
  });
  const animeSettings = normalizeAnimeAnisotropicSettings(normalized);
  return {
    color: normalized.color,
    roughness: normalized.roughness,
    shader: normalized.shader,
    baseColorGradientEnabled: normalized.baseColorGradientEnabled,
    baseColorGradientStops: normalized.baseColorGradientStops.map((stop) => ({ ...stop })),
    ...animeSettings
  };
}

export function normalizeHairMaterialPresetLibrary(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const id = typeof entry.id === "string" ? entry.id.trim().slice(0, 120) : "";
    const name = typeof entry.name === "string" ? entry.name.trim().slice(0, 60) : "";
    if (!id || !name || !entry.value || typeof entry.value !== "object" || Array.isArray(entry.value)) return [];
    return [{ id, name, value: hairMaterialPresetValue(entry.value) }];
  });
}

export function removeHairMaterialPreset(library, id) {
  if (!Array.isArray(library) || typeof id !== "string") return Array.isArray(library) ? library : [];
  return library.filter((preset) => preset?.id !== id);
}
