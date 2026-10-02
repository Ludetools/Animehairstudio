import { ANIME_ANISOTROPIC_SHADER, STANDARD_ANISOTROPIC_SHADER } from './anime-hair-shaders.js';
import { GEM_SHADER } from './gem-hair-shader.js';

// Read-only editor model. DOM controls, resource edits and undo stay in app.js.
// Consume an already-normalized live definition; never normalize it a second time.
export function hairMaterialEditorView(definition, numericDigits) {
  return {
    showStandard: definition.shader !== ANIME_ANISOTROPIC_SHADER,
    showRoughness: definition.shader === STANDARD_ANISOTROPIC_SHADER || definition.shader === GEM_SHADER,
    showGem: definition.shader === GEM_SHADER,
    showAnime: definition.shader === ANIME_ANISOTROPIC_SHADER,
    outlineEnabled: definition.animeOutlineEnabled,
    shadowJaggednessEnabled: definition.animeShadowJaggednessEnabled,
    overlapEnabled: definition.animeOutlineOverlapEnabled,
    numeric: Object.fromEntries(Object.entries(numericDigits).map(([key, digits]) => [key, {
      value: String(definition[key]),
      text: Number(definition[key]).toFixed(digits)
    }]))
  };
}
