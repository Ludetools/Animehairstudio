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
