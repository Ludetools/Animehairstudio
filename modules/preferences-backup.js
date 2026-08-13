export const PREFERENCES_BACKUP_FORMAT = "anime-hair-studio-preferences-and-presets";
export const PREFERENCES_BACKUP_VERSION = 1;

export function createPreferencesBackup({
  appVersion,
  exportedAt = new Date().toISOString(),
  preferences,
  presets,
  shapePresets,
  materialPresets
}) {
  return {
    format: PREFERENCES_BACKUP_FORMAT,
    version: PREFERENCES_BACKUP_VERSION,
    appVersion: String(appVersion || ""),
    exportedAt: String(exportedAt),
    preferences: { ...preferences },
    presets: {
      strand: Array.isArray(presets?.strand) ? presets.strand.map((preset) => ({ ...preset })) : [],
      braid: Array.isArray(presets?.braid) ? presets.braid.map((preset) => ({ ...preset })) : []
    },
    shapePresets: {
      sweepProfile: Array.isArray(shapePresets?.sweepProfile) ? shapePresets.sweepProfile.map((preset) => ({ ...preset })) : [],
      taperCurve: Array.isArray(shapePresets?.taperCurve) ? shapePresets.taperCurve.map((preset) => ({ ...preset })) : [],
      depthCurve: Array.isArray(shapePresets?.depthCurve) ? shapePresets.depthCurve.map((preset) => ({ ...preset })) : []
    },
    materialPresets: Array.isArray(materialPresets)
      ? materialPresets.map((preset) => ({ ...preset, value: { ...preset?.value } }))
      : []
  };
}

export function normalizePreferencesBackup(value) {
  if (!value || typeof value !== "object" || value.format !== PREFERENCES_BACKUP_FORMAT) {
    throw new TypeError("This is not an Anime Hair Studio preferences and presets backup.");
  }
  if (value.version !== PREFERENCES_BACKUP_VERSION) {
    throw new TypeError(`Unsupported preferences backup version: ${String(value.version)}`);
  }
  return {
    format: PREFERENCES_BACKUP_FORMAT,
    version: PREFERENCES_BACKUP_VERSION,
    appVersion: String(value.appVersion || ""),
    exportedAt: String(value.exportedAt || ""),
    preferences: value.preferences && typeof value.preferences === "object"
      ? { ...value.preferences }
      : {},
    presets: {
      strand: Array.isArray(value.presets?.strand)
        ? value.presets.strand.map((preset) => ({ ...preset }))
        : [],
      braid: Array.isArray(value.presets?.braid)
        ? value.presets.braid.map((preset) => ({ ...preset }))
        : []
    },
    shapePresets: {
      sweepProfile: Array.isArray(value.shapePresets?.sweepProfile)
        ? value.shapePresets.sweepProfile.map((preset) => ({ ...preset }))
        : [],
      taperCurve: Array.isArray(value.shapePresets?.taperCurve)
        ? value.shapePresets.taperCurve.map((preset) => ({ ...preset }))
        : [],
      depthCurve: Array.isArray(value.shapePresets?.depthCurve)
        ? value.shapePresets.depthCurve.map((preset) => ({ ...preset }))
        : []
    },
    materialPresets: Array.isArray(value.materialPresets)
      ? value.materialPresets.map((preset) => ({ ...preset, value: { ...preset?.value } }))
      : []
  };
}

export function preferencesBackupFileName(exportedAt = new Date()) {
  const date = exportedAt instanceof Date ? exportedAt : new Date(exportedAt);
  const datePart = Number.isNaN(date.getTime())
    ? "backup"
    : date.toISOString().slice(0, 10);
  return `anime-hair-studio-preferences-presets-${datePart}.json`;
}
