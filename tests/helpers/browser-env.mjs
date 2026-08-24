export class MemoryStorage {
  constructor(entries = []) { this.values = new Map(entries.map(([key, value]) => [String(key), String(value)])); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(String(key)) ? this.values.get(String(key)) : null; }
  setItem(key, value) { this.values.set(String(key), String(value)); }
  removeItem(key) { this.values.delete(String(key)); }
  clear() { this.values.clear(); }
}

export function installBrowserEnv({ href = "https://shadowgarden-bon.pages.dev/" } = {}) {
  const previous = new Map();
  for (const key of ["window", "location", "localStorage", "dispatchEvent", "CustomEvent", "requestAnimationFrame"]) {
    previous.set(key, Object.prototype.hasOwnProperty.call(globalThis, key) ? globalThis[key] : undefined);
  }
  const storage = new MemoryStorage();
  const events = [];
  const assigned = [];
  const url = new URL(href);
  const location = {
    href: url.href,
    origin: url.origin,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    assign(value) {
      const next = new URL(String(value), this.href);
      assigned.push(next.href);
      this.href = next.href;
      this.origin = next.origin;
      this.pathname = next.pathname;
      this.search = next.search;
      this.hash = next.hash;
    }
  };

  globalThis.window = globalThis;
  globalThis.location = location;
  globalThis.localStorage = storage;
  globalThis.dispatchEvent = event => { events.push(event); return true; };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };
  globalThis.requestAnimationFrame = callback => { callback?.(0); return 1; };
  globalThis.confirm = () => true;
  globalThis.alert = () => {};

  const restore = () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  };
  return { storage, events, assigned, location, restore };
}

export async function fixtureJson(relativeUrl) {
  const url = new URL(relativeUrl, import.meta.url);
  return JSON.parse(await (await import("node:fs/promises")).readFile(url, "utf8"));
}
