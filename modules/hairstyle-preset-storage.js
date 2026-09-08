const DATABASE_NAME = "anime-hair-studio-hairstyle-presets";
const DATABASE_VERSION = 2;
const STORE_NAME = "presets";
const CATALOG_STORE = "catalog";

function catalogRecord(record) {
  return {id: record.id, title: record.title, category: record.category,
    regions: record.regions || [], previewImage: record.previewImage || "",
    hasPreviewModel: Boolean(record.previewModel?.meshes?.length), createdAt: record.createdAt || 0};
}

function previewFloatArray(value) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) return null;
  const result = Float32Array.from(value);
  return result.length ? result : null;
}

function previewIndexArray(value) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) return null;
  const result = Uint32Array.from(value);
  return result.length ? result : null;
}

export function normalizeHairstylePresetPreviewModel(value) {
  const meshes = [];
  for (const source of Array.isArray(value?.meshes) ? value.meshes : []) {
    const positions = previewFloatArray(source?.positions);
    if (!positions || positions.length < 9 || positions.length % 3 !== 0) continue;
    const normals = previewFloatArray(source.normals);
    const indices = previewIndexArray(source.indices);
    const matrix = previewFloatArray(source.matrix);
    meshes.push({
      positions,
      normals: normals?.length === positions.length ? normals : null,
      indices,
      matrix: matrix?.length === 16 ? matrix : Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
      color: Number.isFinite(Number(source.color))
        ? Math.max(0, Math.min(0xffffff, Math.round(Number(source.color))))
        : 0x2c223a,
      opacity: Number.isFinite(Number(source.opacity))
        ? Math.max(0, Math.min(1, Number(source.opacity)))
        : 1
    });
  }
  return meshes.length ? { version: 1, meshes } : null;
}

function indexedDbApi() {
  return globalThis.indexedDB || null;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("IndexedDB request failed")), { once: true });
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve, { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("IndexedDB transaction aborted")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error || new Error("IndexedDB transaction failed")), { once: true });
  });
}

function openHairstylePresetDatabase() {
  const api = indexedDbApi();
  if (!api) return Promise.reject(new Error("Custom hairstyle presets are not available in this browser"));
  return new Promise((resolve, reject) => {
    const request = api.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!database.objectStoreNames.contains(CATALOG_STORE)) {
        const catalog = database.createObjectStore(CATALOG_STORE, {keyPath: "id"});
        const cursor = request.transaction.objectStore(STORE_NAME).openCursor();
        cursor.addEventListener("success", () => {
          const entry = cursor.result;
          if (!entry) return;
          const record = entry.value;
          if (record?.id && record.title && record.project?.state) catalog.put(catalogRecord(record));
          entry.continue();
        });
      }
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("Could not open custom hairstyle presets")), { once: true });
  });
}

export function normalizeHairstylePresetRecord(record) {
  const id = String(record?.id || "").trim();
  const title = String(record?.title || "").trim();
  const project = record?.project;
  if (!id || !title || project?.format !== "anime-hair-studio-project" || !project.state) return null;
  const category = record.category === "full" ? "full" : "elements";
  const regions = [...new Set((Array.isArray(record.regions) ? record.regions : [])
    .map((region) => String(region || "").trim())
    .filter(Boolean))];
  const previewImage = typeof record.previewImage === "string" && record.previewImage.startsWith("data:image/")
    ? record.previewImage
    : "";
  const previewModel = normalizeHairstylePresetPreviewModel(record.previewModel);
  return {
    id,
    title,
    category,
    regions,
    previewImage,
    previewModel,
    project,
    createdAt: Number.isFinite(Number(record.createdAt)) ? Number(record.createdAt) : 0
  };
}

export function normalizeHairstylePresetRecords(records) {
  const byId = new Map();
  for (const candidate of Array.isArray(records) ? records : []) {
    const record = normalizeHairstylePresetRecord(candidate);
    if (!record) continue;
    const current = byId.get(record.id);
    if (!current || record.createdAt >= current.createdAt) byId.set(record.id, record);
  }
  return [...byId.values()].sort((left, right) => right.createdAt - left.createdAt);
}

export async function listHairstylePresetRecords() {
  const database = await openHairstylePresetDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const completed = transactionComplete(transaction);
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll());
    await completed;
    return normalizeHairstylePresetRecords(records);
  } finally {
    database.close();
  }
}

export async function listHairstylePresetCatalog() {
  const database = await openHairstylePresetDatabase();
  try {
    const transaction = database.transaction(CATALOG_STORE, "readonly");
    const completed = transactionComplete(transaction);
    const records = await requestResult(transaction.objectStore(CATALOG_STORE).getAll());
    await completed;
    return records.sort((a,b) => b.createdAt-a.createdAt);
  } finally { database.close(); }
}

export async function readHairstylePresetRecord(id) {
  const database = await openHairstylePresetDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const completed = transactionComplete(transaction);
    const record = await requestResult(transaction.objectStore(STORE_NAME).get(id));
    await completed;
    const normalized = normalizeHairstylePresetRecord(record);
    if (!normalized) throw new Error("This custom preset is no longer available.");
    return normalized;
  } finally { database.close(); }
}

export async function rememberHairstylePresetRecord(record) {
  const normalized = normalizeHairstylePresetRecord(record);
  if (!normalized) throw new Error("A custom hairstyle preset needs a valid project, id, and title");
  const database = await openHairstylePresetDatabase();
  try {
    const transaction = database.transaction([STORE_NAME, CATALOG_STORE], "readwrite");
    const completed = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).put(normalized);
    transaction.objectStore(CATALOG_STORE).put(catalogRecord(normalized));
    await completed;
    return normalized;
  } finally {
    database.close();
  }
}

export async function forgetHairstylePresetRecord(id) {
  const key = String(id || "").trim();
  if (!key) throw new Error("A custom hairstyle preset needs a valid id to be deleted");
  const database = await openHairstylePresetDatabase();
  try {
    const transaction = database.transaction([STORE_NAME, CATALOG_STORE], "readwrite");
    const completed = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).delete(key);
    transaction.objectStore(CATALOG_STORE).delete(key);
    await completed;
    return key;
  } finally {
    database.close();
  }
}
