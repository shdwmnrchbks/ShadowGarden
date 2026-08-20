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

export function createTocController({ panel, navigate, closeDrawers }) {
  let items = [];
  let flat = [];
  let activeButton = null;

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
  }

  function matchForLocation(location) {
    const href = location?.start?.href || location?.end?.href || "";
    let best = null;
    for (const entry of flat) {
      if (!hrefMatches(href, entry.item?.href)) continue;
      if (!best || entry.depth > best.depth || cleanHref(entry.item.href).length > cleanHref(best.item.href).length) best = entry;
    }
    return best?.item || null;
  }

  function chapterForLocation(location) {
    const match = matchForLocation(location);
    return match?.label?.trim() || (location?.start?.displayed?.page ? `Page ${location.start.displayed.page}` : "");
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

  return { render, chapterForLocation, setActiveForLocation };
}
