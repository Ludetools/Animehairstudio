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
