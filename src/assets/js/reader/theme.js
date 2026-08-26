const DARK_TEXT = "#17151b";
const LIGHT_TEXT = "#f1edf6";
const SKIP_TEXT_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IMG", "VIDEO", "AUDIO", "CANVAS",
  "SVG", "MATH", "IFRAME", "OBJECT", "EMBED"
]);

function parseColor(value) {
  const text = String(value || "").trim();
  if (!text || text === "transparent") return null;
  const match = text.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const channel = value => String(value).endsWith("%")
    ? Math.max(0, Math.min(255, parseFloat(value) * 2.55))
    : Math.max(0, Math.min(255, parseFloat(value)));
  const r = channel(parts[0]), g = channel(parts[1]), b = channel(parts[2]);
  if (![r, g, b].every(Number.isFinite)) return null;
  let a = 1;
  if (parts[3] != null) {
    a = String(parts[3]).endsWith("%") ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
    if (!Number.isFinite(a)) a = 1;
  }
  return { r, g, b, a: Math.max(0, Math.min(1, a)) };
}

function solid(hex) {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255, a: 1 };
}

function composite(top, bottom) {
  const a = top.a + bottom.a * (1 - top.a);
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a,
    g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a,
    b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a,
    a
  };
}

function relativeLuminance(color) {
  const convert = value => {
    const x = Math.max(0, Math.min(255, value)) / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * convert(color.r) + 0.7152 * convert(color.g) + 0.0722 * convert(color.b);
}

function contrast(a, b) {
  const l1 = relativeLuminance(a), l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function hasDirectText(element) {
  for (const node of element.childNodes) {
    if (node.nodeType === 3 && node.textContent?.trim()) return true;
  }
  return false;
}

function computedStyle(element, win) {
  if (!element || element.nodeType !== 1 || element.isConnected === false || typeof win?.getComputedStyle !== "function") return null;
  try { return win.getComputedStyle(element) || null; } catch { return null; }
}

function restoreContrast(document) {
  document.querySelectorAll('[data-sg-contrast="1"]').forEach(element => {
    const original = element.getAttribute("data-sg-original-color");
    const priority = element.getAttribute("data-sg-original-priority") || "";
    if (original && original !== "__none__") element.style.setProperty("color", original, priority);
    else element.style.removeProperty("color");
    element.removeAttribute("data-sg-contrast");
    element.removeAttribute("data-sg-original-color");
    element.removeAttribute("data-sg-original-priority");
  });
}

function forceColor(element, color) {
  if (element.getAttribute("data-sg-contrast") === "1") return;
  element.setAttribute("data-sg-contrast", "1");
  element.setAttribute("data-sg-original-color", element.style.getPropertyValue("color") || "__none__");
  element.setAttribute("data-sg-original-priority", element.style.getPropertyPriority("color") || "");
  element.style.setProperty("color", color, "important");
}

export function createThemeController({ getSettings, isAdult }) {
  function themeBase(theme) {
    if (theme === "paper") return solid("#ffffff");
    if (theme === "night") return solid("#0c1020");
    if (theme === "black") return solid("#000000");
    return solid(isAdult ? "#140d10" : "#120e19");
  }

  function effectiveBackground(element, win, theme) {
    const chain = [];
    for (let node = element; node?.nodeType === 1; node = node.parentElement) chain.push(node);
    chain.reverse();
    let result = themeBase(theme);
    for (const node of chain) {
      const style = computedStyle(node, win);
      if (!style) continue;
      const background = parseColor(style.backgroundColor);
      if (background?.a > 0) result = composite(background, result);
    }
    return result;
  }

  function shouldInspect(element, win) {
    if (!element || SKIP_TEXT_TAGS.has(element.tagName) || !hasDirectText(element)) return false;
    const style = computedStyle(element, win);
    if (!style) return false;
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.05;
  }

  function repairText(element, win, theme) {
    const style = computedStyle(element, win);
    if (!style) return;
    const foreground = parseColor(style.color);
    if (!foreground || foreground.a < 0.2) return;
    const background = effectiveBackground(element, win, theme);
    const currentRatio = contrast(foreground, background);
    if (currentRatio >= 4.15) return;

    const dark = solid(DARK_TEXT), light = solid(LIGHT_TEXT);
    const darkRatio = contrast(dark, background), lightRatio = contrast(light, background);
    const replacement = darkRatio >= lightRatio ? DARK_TEXT : LIGHT_TEXT;
    if (Math.max(darkRatio, lightRatio) > currentRatio + 0.35) forceColor(element, replacement);
  }

  function repair(contents) {
    const document = contents?.document;
    if (!document) return;
    restoreContrast(document);
    const settings = getSettings();
    if (settings.theme === "paper") return;
    const win = contents.window || document.defaultView;
    const body = document.body;
    if (!win || !body || body.isConnected === false) return;
    if (shouldInspect(body, win)) repairText(body, win, settings.theme);
    body.querySelectorAll("*").forEach(element => {
      if (shouldInspect(element, win)) repairText(element, win, settings.theme);
    });
  }

  function injectScrollChrome(contents) {
    const document = contents?.document;
    if (!document?.head) return;
    let style = document.getElementById("sg-scrollbar-hide");
    if (!style) {
      style = document.createElement("style");
      style.id = "sg-scrollbar-hide";
      style.textContent = "html,body{scrollbar-width:none!important;-ms-overflow-style:none!important}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none!important;width:0!important;height:0!important}";
      document.head.appendChild(style);
    }
  }

  function prepare(contents) {
    const settings = getSettings();
    if (settings.flow === "scrolled-doc") injectScrollChrome(contents);
    requestAnimationFrame(() => repair(contents));
  }

  function refresh(rendition) {
    if (!rendition?.getContents) return;
    requestAnimationFrame(() => {
      try {
        rendition.getContents().forEach(contents => {
          if (getSettings().flow === "scrolled-doc") injectScrollChrome(contents);
          repair(contents);
        });
      } catch (error) {
        console.warn("Reader theme refresh skipped", error);
      }
    });
  }

  function css(settings) {
    const themes = {
      garden: isAdult
        ? { bg: "#140d10", text: "#eadde1", link: "#d29aa9" }
        : { bg: "#120e19", text: "#e8e1f1", link: "#b9a8e3" },
      night: { bg: "#0c1020", text: "#e1e7f5", link: "#9db0ea" },
      black: { bg: "#000000", text: "#d7d7d7", link: isAdult ? "#d29aa9" : "#b9a8e3" },
      paper: { bg: "#ffffff", text: "#292a25", link: "#536e55" }
    };
    const fonts = {
      book: 'Georgia, "Times New Roman", serif',
      system: 'Inter, system-ui, sans-serif',
      classic: '"Palatino Linotype", Palatino, serif'
    };
    const theme = themes[settings.theme] || themes.garden;
    const paginated = settings.flow === "paginated";
    const body = {
      background: `${theme.bg} !important`,
      color: `${theme.text} !important`,
      "font-family": `${fonts[settings.font] || fonts.book} !important`,
      "font-size": `${settings.fontSize}% !important`,
      "line-height": `${settings.lineHeight} !important`,
      margin: paginated ? "0 !important" : "0 auto !important",
      padding: paginated ? "max(2.5em, 60px) 4vw max(2.5em, 54px) !important" : "2.5em 4vw !important",
      "touch-action": paginated ? "pan-y pinch-zoom !important" : "auto !important",
      "box-sizing": "border-box !important"
    };
    if (paginated) {
      /* EPUB.js writes the exact page/column width inline. Never override that width in
         paginated mode or the content columns drift beyond the mobile viewport. */
      body["max-width"] = "none !important";
    } else {
      body["max-width"] = `${settings.width}px !important`;
      body.width = "auto !important";
    }
    return {
      html: { background: `${theme.bg} !important` },
      body,
      p: { "line-height": `${settings.lineHeight} !important` },
      a: { color: `${theme.link} !important` },
      /* In Continuous mode, max-width:100% alone is insufficient when a publication puts
         an image inside an oversized fixed/vw wrapper: 100% then means the oversized
         wrapper, and the Reader's horizontal overflow guard clips the right edge. Bound
         the image by both its containing block and the EPUB viewport minus body gutters. */
      img: {
        "max-width": paginated ? "100% !important" : "min(100%, 92vw) !important",
        height: "auto !important",
        "box-sizing": "border-box !important"
      }
    };
  }

  return { css, prepare, refresh, repair };
}
