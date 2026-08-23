function childrenOf(item) {
  if (Array.isArray(item?.subitems)) return item.subitems;
  if (Array.isArray(item?.children)) return item.children;
  return [];
}

function cleanHref(value) {
  let href = String(value || "").split("#")[0].split("?")[0];
  try { href = decodeURIComponent(href); } catch {}
  return href.replace(/^\.\//, "").replace(/^\//, "");
}

function hrefMatches(a, b) {
  const left = cleanHref(a), right = cleanHref(b);
  if (!left || !right) return false;
  return left === right || left.endsWith(`/${right}`) || right.endsWith(`/${left}`);
}

function flatten(items, depth = 0, output = []) {
  for (const item of Array.isArray(items) ? items : []) {
    output.push({ item, depth });
    flatten(childrenOf(item), depth + 1, output);
  }
  return output;
}

function genericVisualLabel(item) {
  const label = String(item?.label || "").trim();
  if (!label) return true;
  return /^(?:page|pg\.?)\s*\d+(?:\s*[-–—]\s*\d+)?$/i.test(label) ||
    /^(?:cover|cover page|illustration|illustration page|image|image page|plate|frontispiece)(?:\s+\d+)?$/i.test(label);
}

function readerSpineItems() {
  const items = window.__sgReaderBook?.spine?.spineItems;
  return Array.isArray(items) ? items : [];
}

function spineIndexForHref(href) {
  if (!href) return null;
  const items = readerSpineItems();
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!hrefMatches(href, item?.href || item?.url || "")) continue;
    const explicit = Number(item?.index);
    return Number.isFinite(explicit) ? explicit : index;
  }
  return null;
}

function locationSpineIndex(location) {
  for (const value of [location?.start?.index, location?.end?.index]) {
    const index = Number(value);
    if (Number.isFinite(index) && index >= 0) return index;
  }
  return spineIndexForHref(location?.start?.href || location?.end?.href || "");
}

export function createTocController({ panel, navigate, closeDrawers }) {
  let items = [];
  let flat = [];
  let activeButton = null;
  let pageResolver = null;

  function pageNumberFor(href) {
    if (!pageResolver || !href) return null;
    try {
      const value = Number(pageResolver(href));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  function syncPageNumbers() {
    panel.querySelectorAll(".toc-entry-link[data-href]").forEach(button => {
      const row = button.closest(".toc-row");
      if (!row) return;
      let page = row.querySelector(".toc-page-number");
      const number = pageNumberFor(button.dataset.href);
      if (!number) {
        page?.remove();
        return;
      }
      if (!page) {
        page = document.createElement("span");
        page.className = "toc-page-number";
        page.setAttribute("aria-label", `Starts on page ${number}`);
        row.appendChild(page);
      }
      page.textContent = String(number);
      page.setAttribute("aria-label", `Starts on page ${number}`);
    });
  }

  function createNode(item, depth, path) {
    const node = document.createElement("div");
    const children = childrenOf(item);
    node.className = `toc-node ${children.length ? "toc-branch" : "toc-leaf"}`;
    node.style.setProperty("--toc-depth", String(depth));

    const row = document.createElement("div");
    row.className = "toc-row";
    node.appendChild(row);

    if (children.length) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "toc-expander";
      toggle.textContent = "▾";
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", `Collapse ${String(item?.label || "section").trim()}`);
      row.appendChild(toggle);

      const childBox = document.createElement("div");
      childBox.className = "toc-children";
      childBox.id = `toc-${path}`;
      toggle.setAttribute("aria-controls", childBox.id);
      toggle.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const expanded = toggle.getAttribute("aria-expanded") !== "false";
        toggle.setAttribute("aria-expanded", expanded ? "false" : "true");
        toggle.textContent = expanded ? "▸" : "▾";
        toggle.setAttribute("aria-label", `${expanded ? "Expand" : "Collapse"} ${String(item?.label || "section").trim()}`);
        childBox.classList.toggle("collapsed", expanded);
      });

      children.forEach((child, index) => childBox.appendChild(createNode(child, depth + 1, `${path}-${index}`)));
      node.appendChild(childBox);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "toc-expander-spacer";
      spacer.setAttribute("aria-hidden", "true");
      row.appendChild(spacer);
    }

    const label = String(item?.label || "Untitled section").trim() || "Untitled section";
    const href = String(item?.href || "");
    if (href) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toc-link toc-entry-link";
      button.textContent = label;
      button.dataset.href = href;
      button.addEventListener("click", async () => {
        try {
          await navigate(href);
          closeDrawers();
        } catch (error) {
          console.error("TOC navigation failed", error);
        }
      });
      row.appendChild(button);
      const pageNumber = pageNumberFor(href);
      if (pageNumber) {
        const page = document.createElement("span");
        page.className = "toc-page-number";
        page.textContent = String(pageNumber);
        page.setAttribute("aria-label", `Starts on page ${pageNumber}`);
        row.appendChild(page);
      }
    } else {
      const text = document.createElement("span");
      text.className = "toc-link toc-entry-label";
      text.textContent = label;
      row.appendChild(text);
    }

    return node;
  }

  function render(navigationItems) {
    items = Array.isArray(navigationItems) ? navigationItems : [];
    flat = flatten(items);
    activeButton = null;
    panel.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "bookmark-empty";
      empty.textContent = "This EPUB does not provide a table of contents.";
      panel.appendChild(empty);
      return;
    }
    const tree = document.createElement("div");
    tree.className = "toc-tree";
    tree.setAttribute("role", "tree");
    items.forEach((item, index) => tree.appendChild(createNode(item, 0, String(index))));
    panel.appendChild(tree);
    syncPageNumbers();
  }

  function setPageResolver(resolver) {
    pageResolver = typeof resolver === "function" ? resolver : null;
    syncPageNumbers();
  }

  function bestEntry(entries) {
    let best = null;
    for (const entry of entries) {
      if (!best || entry.depth > best.depth || cleanHref(entry.item?.href).length > cleanHref(best.item?.href).length) best = entry;
    }
    return best;
  }

  function matchForLocation(location) {
    const href = location?.start?.href || location?.end?.href || "";
    const exactEntries = flat.filter(entry => hrefMatches(href, entry.item?.href));
    const exactMeaningful = bestEntry(exactEntries.filter(entry => !genericVisualLabel(entry.item)));
    if (exactMeaningful) return exactMeaningful.item;

    /* Chapter titles are derived from navigation order plus spine position, not from
       visual-only document names. This keeps a chapter active across split XHTML parts
       and standalone illustration pages whose nav labels are only "Page 1", etc. */
    const currentIndex = locationSpineIndex(location);
    if (Number.isFinite(currentIndex)) {
      let preceding = null;
      for (let order = 0; order < flat.length; order++) {
        const entry = flat[order];
        if (genericVisualLabel(entry.item)) continue;
        const navIndex = spineIndexForHref(entry.item?.href);
        if (!Number.isFinite(navIndex) || navIndex > currentIndex) continue;
        if (!preceding || navIndex > preceding.navIndex || (navIndex === preceding.navIndex && entry.depth >= preceding.entry.depth)) {
          preceding = { entry, navIndex, order };
        }
      }
      if (preceding) return preceding.entry.item;
    }

    /* If a publication contains nothing more descriptive, retain its own generic nav
       label rather than displaying an empty chapter title. */
    const exactFallback = bestEntry(exactEntries);
    if (exactFallback) return exactFallback.item;
    return null;
  }

  function chapterForLocation(location) {
    const match = matchForLocation(location);
    return String(match?.label || "").trim();
  }

  function setActiveForLocation(location) {
    const match = matchForLocation(location);
    const href = String(match?.href || "");
    if (activeButton) {
      activeButton.classList.remove("active");
      activeButton.removeAttribute("aria-current");
      activeButton = null;
    }
    if (!href) return;
    activeButton = [...panel.querySelectorAll(".toc-entry-link")].find(button => button.dataset.href === href) || null;
    if (activeButton) {
      activeButton.classList.add("active");
      activeButton.setAttribute("aria-current", "location");
    }
  }

  return { render, setPageResolver, chapterForLocation, setActiveForLocation };
}
