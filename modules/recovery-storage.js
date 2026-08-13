export const RECOVERY_DATABASE_NAME = "anime-hair-studio-recovery";
export const RECOVERY_STORE_NAME = "recovery";
export const RECOVERY_RECORD_ID = "latest";
export const DEFAULT_AUTOSAVE_INTERVAL_SECONDS = 30;
export const AUTOSAVE_INTERVAL_OPTIONS = Object.freeze([15, 30, 60, 120, 300]);

export function normalizeAutosaveInterval(value) {
  const seconds = Number(value);
  return AUTOSAVE_INTERVAL_OPTIONS.includes(seconds)
    ? seconds
    : DEFAULT_AUTOSAVE_INTERVAL_SECONDS;
}

export function normalizeRecoveryRecord(value) {
  if (!value || typeof value !== "object") return null;
  const content = typeof value.content === "string" ? value.content : "";
  const updatedAt = Number(value.updatedAt);
  if (!content.trim() || !Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  return {
    id: RECOVERY_RECORD_ID,
    name: typeof value.name === "string" && value.name.trim()
      ? value.name.trim()
      : "Untitled Hair Project",
    content,
    updatedAt,
    appVersion: typeof value.appVersion === "string" ? value.appVersion : ""
  };
}

export function createRecoveryRecord({
  name,
  content,
  updatedAt = Date.now(),
  appVersion = ""
} = {}) {
  const record = normalizeRecoveryRecord({ name, content, updatedAt, appVersion });
  if (!record) throw new TypeError("Recovery content must be a non-empty project file.");
  return record;
}

function openRecoveryDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(RECOVERY_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECOVERY_STORE_NAME)) {
        database.createObjectStore(RECOVERY_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open recovery storage."));
  });
}

async function runRecoveryTransaction(mode, operation) {
  const database = await openRecoveryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(RECOVERY_STORE_NAME, mode);
      const store = transaction.objectStore(RECOVERY_STORE_NAME);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Recovery storage operation failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Recovery storage transaction was aborted."));
    });
  } finally {
    database.close();
  }
}

export async function readRecoverySnapshot() {
  const value = await runRecoveryTransaction("readonly", (store) => store.get(RECOVERY_RECORD_ID));
  return normalizeRecoveryRecord(value);
}

export async function writeRecoverySnapshot(value) {
  const record = createRecoveryRecord(value);
  await runRecoveryTransaction("readwrite", (store) => store.put(record));
  return record;
}

export async function clearRecoverySnapshot() {
  await runRecoveryTransaction("readwrite", (store) => store.delete(RECOVERY_RECORD_ID));
}
