export const TOOL_PRESET_TYPES = Object.freeze(["strand", "braid"]);

export function emptyToolPresetLibrary() {
  return Object.fromEntries(TOOL_PRESET_TYPES.map((type) => [type, []]));
}

export function normalizeToolPresetLibrary(value, normalizeValue = (presetValue) => presetValue) {
  const library = emptyToolPresetLibrary();
  if (!value || typeof value !== "object" || Array.isArray(value)) return library;

  TOOL_PRESET_TYPES.forEach((type) => {
    const entries = Array.isArray(value[type]) ? value[type] : [];
    library[type] = entries.slice(0, 100).flatMap((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const id = typeof entry.id === "string" ? entry.id.trim().slice(0, 120) : "";
      const name = typeof entry.name === "string" ? entry.name.trim().slice(0, 60) : "";
      if (!id || !name || !entry.value || typeof entry.value !== "object" || Array.isArray(entry.value)) return [];
      try {
        return [{
          id,
          name,
          value: normalizeValue(entry.value, type),
          toolSettings: entry.toolSettings && typeof entry.toolSettings === "object" && !Array.isArray(entry.toolSettings)
            ? { ...entry.toolSettings }
            : null
        }];
      } catch {
        return [];
      }
    });
  });

  return library;
}

export function removeToolPreset(library, type, id) {
  if (!TOOL_PRESET_TYPES.includes(type) || !library || typeof id !== "string") return library;
  return {
    ...library,
    [type]: Array.isArray(library[type])
      ? library[type].filter((preset) => preset?.id !== id)
      : []
  };
}
