export class FakeClassList {
  constructor(initial = []) { this.values = new Set(initial); }
  add(...items) { items.forEach(item => this.values.add(item)); }
  remove(...items) { items.forEach(item => this.values.delete(item)); }
  contains(item) { return this.values.has(item); }
  toggle(item, force) {
    if (force === true) { this.values.add(item); return true; }
    if (force === false) { this.values.delete(item); return false; }
    if (this.values.has(item)) { this.values.delete(item); return false; }
    this.values.add(item); return true;
  }
  toString() { return [...this.values].join(" "); }
}

export class FakeStyle {
  constructor() { this.values = new Map(); this.backgroundImage = ""; }
  setProperty(name, value) { this.values.set(name, String(value)); }
  getPropertyValue(name) { return this.values.get(name) || ""; }
  removeProperty(name) { this.values.delete(name); }
}

export class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName).toUpperCase();
    this.className = "";
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = new FakeStyle();
    this.attributes = new Map();
    this.children = [];
    this.innerHTML = "";
    this.removed = false;
  }
  setAttribute(name, value) { this.attributes.set(String(name), String(value)); }
  getAttribute(name) { return this.attributes.get(String(name)) ?? null; }
  replaceChildren(...children) { this.children = [...children]; this.innerHTML = ""; }
  prepend(child) { this.children.unshift(child); }
  remove() { this.removed = true; }
  querySelector(selector) {
    if (selector === ":scope > .intro-banner-art") return this.children.find(child => child.className === "intro-banner-art" && !child.removed) || null;
    return null;
  }
}

export function installFakeDocument() {
  const previous = Object.prototype.hasOwnProperty.call(globalThis, "document") ? globalThis.document : undefined;
  globalThis.document = { createElement: tag => new FakeElement(tag) };
  return () => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  };
}
