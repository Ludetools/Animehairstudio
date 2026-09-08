export class BoundedHistory {
  #entries = [];
  #limit;

  constructor(limit = 60) {
    this.#limit = Math.max(1, Math.round(limit));
  }

  get length() {
    return this.#entries.length;
  }

  push(snapshot) {
    this.#entries.push(snapshot);
    if (this.#entries.length > this.#limit) this.#entries.shift();
  }

  pop() {
    return this.#entries.pop();
  }

  clear() {
    this.#entries.length = 0;
  }

  checkpoint() {
    return [...this.#entries];
  }

  restoreCheckpoint(entries) {
    this.#entries = entries.slice(-this.#limit);
  }
}

export class RestoreRefreshRegistry {
  #refreshers = new Map();

  register(name, refresh) {
    if (!name || typeof refresh !== "function") {
      throw new TypeError("Restore refreshers require a name and callback.");
    }
    if (this.#refreshers.has(name)) {
      throw new Error(`Restore refresher already registered: ${name}`);
    }
    this.#refreshers.set(name, refresh);
    return this;
  }

  run(context) {
    this.#refreshers.forEach((refresh) => refresh(context));
  }
}

export function expandHistoryDependencyIds(snapshots, changedIds) {
  const records = Array.isArray(snapshots)
    ? snapshots.filter((snapshot) => snapshot?.id !== undefined && snapshot?.id !== null)
    : [];
  const knownIds = new Set(records.map((snapshot) => snapshot.id));
  const linksById = new Map([...knownIds].map((id) => [id, new Set()]));
  const clumpMembers = new Map();

  const connect = (firstId, secondId) => {
    if (
      firstId === undefined || firstId === null
      || secondId === undefined || secondId === null
      || firstId === secondId
      || !knownIds.has(firstId)
      || !knownIds.has(secondId)
    ) return;
    linksById.get(firstId).add(secondId);
    linksById.get(secondId).add(firstId);
  };

  records.forEach((snapshot) => {
    connect(snapshot.id, snapshot.mirrorPartnerId);
    connect(snapshot.id, snapshot.branchParentId);
    if (snapshot.modelingMeshType === "auto-remesh") {
      (snapshot.adaptiveRemeshSourceIds || []).forEach((sourceId) => {
        connect(snapshot.id, sourceId);
      });
    }
    if (snapshot.clumpId === undefined || snapshot.clumpId === null) return;
    if (!clumpMembers.has(snapshot.clumpId)) clumpMembers.set(snapshot.clumpId, new Set());
    clumpMembers.get(snapshot.clumpId).add(snapshot.id);
  });

  clumpMembers.forEach((memberIds) => {
    const [firstId, ...otherIds] = memberIds;
    otherIds.forEach((id) => connect(firstId, id));
  });

  const expandedIds = new Set(
    [...(changedIds || [])].filter((id) => knownIds.has(id))
  );
  const pendingIds = [...expandedIds];
  for (let index = 0; index < pendingIds.length; index += 1) {
    linksById.get(pendingIds[index])?.forEach((linkedId) => {
      if (expandedIds.has(linkedId)) return;
      expandedIds.add(linkedId);
      pendingIds.push(linkedId);
    });
  }
  return expandedIds;
}
