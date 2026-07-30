export const SHAPE_PRESET_TYPES = Object.freeze(["sweepProfile", "taperCurve", "depthCurve"]);

export function emptyShapePresetLibrary() {
  return Object.fromEntries(SHAPE_PRESET_TYPES.map((type) => [type, []]));
}

function normalizedPoints(value, type) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const keys = type === "sweepProfile" ? ["x", "z"] : ["position", "value"];
  const points = value.slice(0, 128).map((point) => {
    if (!point || typeof point !== "object") return null;
    const normalized = { ...point };
    for (const key of keys) {
      const number = Number(point[key]);
      if (!Number.isFinite(number)) return null;
      normalized[key] = number;
    }
    return normalized;
  });
  return points.every(Boolean) ? points : null;
}

export function normalizeShapePresetLibrary(value) {
  const library = emptyShapePresetLibrary();
  if (!value || typeof value !== "object" || Array.isArray(value)) return library;

  SHAPE_PRESET_TYPES.forEach((type) => {
    const entries = Array.isArray(value[type]) ? value[type] : [];
    library[type] = entries.slice(0, 100).flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const id = typeof entry.id === "string" ? entry.id.trim().slice(0, 120) : "";
      const name = typeof entry.name === "string" ? entry.name.trim().slice(0, 60) : "";
      const points = normalizedPoints(entry.value, type);
      if (!id || !name || !points) return [];
      const normalized = { id, name, value: points };
      if (type !== "sweepProfile") {
        normalized.secondaryValue = normalizedPoints(entry.secondaryValue, type) || points.map((point) => ({ ...point }));
        normalized.asymmetric = Boolean(entry.asymmetric);
      }
      return [normalized];
    });
  });

  return library;
}

export function removeShapePreset(library, type, id) {
  if (!SHAPE_PRESET_TYPES.includes(type) || !library || typeof id !== "string") return library;
  return {
    ...library,
    [type]: Array.isArray(library[type])
      ? library[type].filter((preset) => preset?.id !== id)
      : []
  };
}
