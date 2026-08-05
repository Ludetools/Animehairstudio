export const MAX_RECENT_PROJECTS = 10;

const DATABASE_NAME = "anime-hair-studio-recent-projects";
const DATABASE_VERSION = 1;
const STORE_NAME = "projects";

export function recentProjectId(name) {
  return String(name || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\\/g, "/");
}

export function normalizeRecentProjects(entries, limit = MAX_RECENT_PROJECTS) {
  const byId = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const name = String(entry?.name || "").trim();
    const content = typeof entry?.content === "string" ? entry.content : "";
    if (!name || !content) continue;
    const id = recentProjectId(entry.id || name);
    const normalized = {
      id,
      name,
      content,
      updatedAt: Number.isFinite(Number(entry.updatedAt)) ? Number(entry.updatedAt) : 0
    };
    const current = byId.get(id);
    if (!current || normalized.updatedAt >= current.updatedAt) byId.set(id, normalized);
  }
  return [...byId.values()]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, Math.max(0, Math.floor(Number(limit) || 0)));
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

function openRecentProjectsDatabase() {
  const api = indexedDbApi();
  if (!api) return Promise.reject(new Error("Recent projects are not available in this browser"));
  return new Promise((resolve, reject) => {
    const request = api.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "id" });
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("Could not open recent projects")), { once: true });
  });
}

export async function listRecentProjects() {
  const database = await openRecentProjectsDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const completed = transactionComplete(transaction);
    const entries = await requestResult(transaction.objectStore(STORE_NAME).getAll());
    await completed;
    return normalizeRecentProjects(entries);
  } finally {
    database.close();
  }
}

export async function rememberRecentProject({ name, content, updatedAt = Date.now() }) {
  const entry = normalizeRecentProjects([{ name, content, updatedAt }], 1)[0];
  if (!entry) throw new Error("A recent project needs a name and project content");
  const database = await openRecentProjectsDatabase();
  try {
    let transaction = database.transaction(STORE_NAME, "readwrite");
    let completed = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).put(entry);
    await completed;

    transaction = database.transaction(STORE_NAME, "readonly");
    completed = transactionComplete(transaction);
    const entries = await requestResult(transaction.objectStore(STORE_NAME).getAll());
    await completed;
    const keep = new Set(normalizeRecentProjects(entries).map((project) => project.id));
    const retired = entries.filter((project) => !keep.has(project.id));
    if (retired.length) {
      transaction = database.transaction(STORE_NAME, "readwrite");
      completed = transactionComplete(transaction);
      const store = transaction.objectStore(STORE_NAME);
      retired.forEach((project) => store.delete(project.id));
      await completed;
    }
    return entry;
  } finally {
    database.close();
  }
}
