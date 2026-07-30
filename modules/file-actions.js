export const FILE_ACTION_FORMATS = Object.freeze({
  project: Object.freeze({
    extension: ".ahs",
    label: "Project",
    exportContents: Object.freeze([])
  }),
  obj: Object.freeze({
    extension: ".obj",
    label: "OBJ",
    exportContents: Object.freeze(["mesh", "curves"])
  }),
  usda: Object.freeze({
    extension: ".usda",
    label: "USDA",
    exportContents: Object.freeze(["mesh", "curves", "bones", "weights"])
  })
});

export function fileActionFormat(format) {
  return FILE_ACTION_FORMATS[format] || FILE_ACTION_FORMATS.project;
}

export function cleanFileBaseName(value, fallback = "anime-hair") {
  const withoutKnownExtension = String(value ?? "")
    .trim()
    .replace(/\.(?:ahs|animehair\.json|usda|obj)$/i, "");
  const cleaned = withoutKnownExtension
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/g, "")
    .trim();
  return cleaned || fallback;
}

export function fileNameForAction(value, format, fallback = "anime-hair") {
  const definition = fileActionFormat(format);
  return `${cleanFileBaseName(value, fallback)}${definition.extension}`;
}

export function normalizeExportContents(format, requested = {}, available = {}) {
  const supported = new Set(fileActionFormat(format).exportContents);
  return Object.fromEntries(["mesh", "curves", "bones", "weights"].map((key) => [
    key,
    supported.has(key) && available[key] !== false && requested[key] !== false
  ]));
}
