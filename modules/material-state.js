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

export function normalizeHairMaterialDefinition(material = {}) {
  LEGACY_CUSTOM_HAIR_MATERIAL_FIELDS.forEach((key) => delete material[key]);
  material.color ||= DEFAULT_HAIR_MATERIAL_SETTINGS.color;
  material.shader = normalizeHairShader(material.shader);
  Object.assign(material, normalizeAnimeAnisotropicSettings(material));
  const roughness = Number(material.roughness);
  material.roughness = Number.isFinite(roughness)
    ? Math.min(1, Math.max(0, roughness))
    : DEFAULT_HAIR_MATERIAL_SETTINGS.roughness;
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
