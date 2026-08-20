import { createReaderStorage } from "./reader/storage.js";
import { createThemeController } from "./reader/theme.js";
import { createTocController } from "./reader/toc.js";

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const bookUrl = params.get("book");
const seriesId = params.get("series");
const isAdultReader = String(seriesId || "").startsWith("adult-");

const elements = {
  readerApp: $("#readerApp"),
  loading: $("#readerLoading"),
  bookTitle: $("#bookTitle"),
  chapterTitle: $("#chapterTitle"),
  tocToggle: $("#tocToggle"),
  tocDrawer: $("#tocDrawer"),
  tocPanel: $("#tocPanel"),
  bookmarksPanel: $("#bookmarksPanel"),
  settingsToggle: $("#settingsToggle"),
  settingsDrawer: $("#settingsDrawer"),
  backdrop: $("#drawerBackdrop"),
  bookmarkButton: $("#bookmarkButton"),
  backLink: $("#backLink"),
  returnButton: $("#returnButton"),
  fullscreenButton: $("#fullscreenButton"),
  progressRange: $("#progressRange"),
  progressText: $("#progressText"),
  prevPage: $("#prevPage"),
  nextPage: $("#nextPage"),
  prevBottom: $("#prevBottom"),
  nextBottom: $("#nextBottom"),
  themeSelect: $("#themeSelect"),
  fontSelect: $("#fontSelect"),
  fontSizeRange: $("#fontSizeRange"),
  fontSizeValue: $("#fontSizeValue"),
  lineHeightRange: $("#lineHeightRange"),
  lineHeightValue: $("#lineHeightValue"),
  widthRange: $("#widthRange"),
  widthValue: $("#widthValue"),
  flowSelect: $("#flowSelect"),
  resetReader: $("#resetReader"),
  toast: $("#toast")
};

const defaults = {
  theme: "garden",
  font: "book",
  fontSize: 100,
  lineHeight: 1.6,
  width: 760,
  flow: "paginated"
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
const clamp01 = value => Math.min(1, Math.max(0, Number(value) || 0));

function sanitizeSettings(value) {
  const input = value || {};
  return {
    theme: ["garden", "night", "black", "paper"].includes(input.theme) ? input.theme : defaults.theme,
    font: ["book", "system", "classic"].includes(input.font) ? input.font : defaults.font,
    fontSize: clamp(input.fontSize ?? defaults.fontSize, 75, 160),
    lineHeight: clamp(input.lineHeight ?? defaults.lineHeight, 1.25, 2.1),
    width: clamp(input.width ?? defaults.width, 560, 1050),
    flow: ["paginated", "scrolled-doc"].includes(input.flow) ? input.flow : defaults.flow
  };
}

const storage = createReaderStorage(bookUrl || "__missing__");
const state = {
  book: null,
  rendition: null,
  navigation: null,
  currentCfi: "",
  currentChapter: "",
  locationsReady: false,
  locationsFailed: false,
  pendingSeek: null,
  seekTimer: 0,
  toastTimer: 0,
  resizeTimer: 0,
  relayoutTimer: 0,
  renditionSerial: 0,
  switchingFlow: false,
  queuedFlow: null,
  renderedFlow: null,
  settings: sanitizeSettings(storage.loadSettings(defaults))
};

const themeController = createThemeController({
  getSettings: () => state.settings,
  isAdult: isAdultReader
});

function toast(message) {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => elements.toast.classList.add("hidden"), 1800);
}

function openDrawer(drawer) {
  document.querySelectorAll(".reader-drawer").forEach(item => item.classList.toggle("open", item === drawer));
  elements.backdrop?.classList.remove("hidden");
}

function closeDrawers() {
  document.querySelectorAll(".reader-drawer").forEach(item => item.classList.remove("open"));
  elements.backdrop?.classList.add("hidden");
}

async function navigate(target) {
  if (!state.rendition || !target) return;
  await state.rendition.display(target);
}

const tocController = createTocController({
  panel: elements.tocPanel,
  navigate,
  closeDrawers
});

function syncBodyClasses() {
  document.body.classList.remove("reader-theme-garden", "reader-theme-night", "reader-theme-black", "reader-theme-paper");
  document.body.classList.add(`reader-theme-${state.settings.theme}`);
  document.body.classList.toggle("adult-reader", isAdultReader);
  const scrolled = state.settings.flow === "scrolled-doc";
  document.body.classList.toggle("reader-flow-scrolled", scrolled);
  document.body.classList.toggle("reader-flow-paginated", !scrolled);
}

function syncSettingsControls() {
  elements.themeSelect.value = state.settings.theme;
  elements.fontSelect.value = state.settings.font;
  elements.fontSizeRange.value = state.settings.fontSize;
  elements.fontSizeValue.textContent = `${state.settings.fontSize}%`;
  elements.lineHeightRange.value = state.settings.lineHeight;
  elements.lineHeightValue.textContent = String(state.settings.lineHeight);
  elements.widthRange.value = state.settings.width;
  elements.widthValue.textContent = `${state.settings.width}px`;
  elements.flowSelect.value = state.settings.flow;
}

function persistSettings() {
  state.settings = sanitizeSettings(state.settings);
  storage.saveSettings(state.settings);
  syncBodyClasses();
  syncSettingsControls();
}

function paginatedNeedsSinglePage() {
  if (state.settings.flow !== "paginated") return false;
  const visualWidth = Number(window.visualViewport?.width);
  const innerWidth = Number(window.innerWidth);
  const clientWidth = Number(document.documentElement?.clientWidth);
  const widths = [visualWidth, innerWidth, clientWidth].filter(value => Number.isFinite(value) && value > 0);
  const viewportWidth = widths.length ? Math.min(...widths) : 0;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches === true;
  const mobileUa = navigator.userAgentData?.mobile === true || /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent || "");
  return mobileUa || (viewportWidth > 0 && viewportWidth < 900) || (coarsePointer && viewportWidth > 0 && viewportWidth <= 1024);
}

function configureSpread(rendition = state.rendition) {
  if (!rendition) return;
  try {
    if (state.settings.flow === "paginated") {
      if (paginatedNeedsSinglePage()) rendition.spread("none");
      else rendition.spread("auto", 900);
    } else rendition.spread("none");
  } catch (error) {
    console.warn("Reader spread configuration skipped", error);
  }
}

function applySettingsToRendition({ relayout = false } = {}) {
  persistSettings();
  if (!state.rendition) return;
  try {
    state.rendition.themes.default(themeController.css(state.settings));
  } catch (error) {
    console.warn("Reader theme update skipped", error);
  }
  configureSpread();
  themeController.refresh(state.rendition);
  if (relayout) scheduleRelayout();
}

function scheduleRelayout() {
  clearTimeout(state.relayoutTimer);
  state.relayoutTimer = setTimeout(async () => {
    const rendition = state.rendition;
    if (!rendition || state.switchingFlow) return;
    try { rendition.resize?.("100%", "100%"); } catch {}
    configureSpread(rendition);
    if (state.currentCfi) {
      try { await rendition.display(state.currentCfi); } catch (error) { console.warn("Reader relayout skipped", error); }
    }
  }, 120);
}

function bookmarks() {
  return storage.loadBookmarks();
}

function bookmarkIndex() {
  if (!state.currentCfi) return -1;
  return bookmarks().findIndex(item => item?.cfi === state.currentCfi);
}

function updateBookmarkState() {
  const saved = bookmarkIndex() >= 0;
  elements.bookmarkButton.textContent = saved ? "◆" : "◇";
  elements.bookmarkButton.classList.toggle("bookmarked", saved);
  elements.bookmarkButton.setAttribute("aria-pressed", saved ? "true" : "false");
  elements.bookmarkButton.title = saved ? "Remove bookmark" : "Bookmark this location";
  elements.bookmarkButton.setAttribute("aria-label", saved ? "Remove bookmark at this location" : "Bookmark this location");
}

function renderBookmarks() {
  const list = bookmarks();
  elements.bookmarksPanel.replaceChildren();
  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "bookmark-empty";
    empty.textContent = "No bookmarks yet.";
    elements.bookmarksPanel.appendChild(empty);
    return;
  }

  list.forEach((bookmark, index) => {
    const row = document.createElement("div");
    row.className = "bookmark-row";
    const copy = document.createElement("div");
    const label = document.createElement("div");
    label.className = "bookmark-label";
    label.textContent = bookmark.label || "Saved location";
    const meta = document.createElement("div");
    meta.className = "bookmark-meta";
    meta.textContent = bookmark.at ? new Date(bookmark.at).toLocaleString() : "Saved bookmark";
    copy.append(label, meta);

    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "↗";
    open.setAttribute("aria-label", `Open bookmark ${index + 1}`);
    open.addEventListener("click", async () => {
      try {
        await navigate(bookmark.cfi);
        closeDrawers();
      } catch (error) {
        console.error("Bookmark navigation failed", error);
        toast("Could not open bookmark");
      }
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Delete bookmark ${index + 1}`);
    remove.addEventListener("click", () => {
      const next = bookmarks();
      next.splice(index, 1);
      storage.saveBookmarks(next);
      renderBookmarks();
      updateBookmarkState();
      toast("Bookmark removed");
    });
    row.append(copy, open, remove);
    elements.bookmarksPanel.appendChild(row);
  });
}

function toggleBookmark() {
  if (!state.currentCfi) return;
  const list = bookmarks();
  const index = list.findIndex(item => item?.cfi === state.currentCfi);
  if (index >= 0) {
    list.splice(index, 1);
    storage.saveBookmarks(list);
    renderBookmarks();
    updateBookmarkState();
    toast("Bookmark removed");
    return;
  }
  list.push({
    cfi: state.currentCfi,
    label: state.currentChapter || elements.bookTitle.textContent || "Saved location",
    at: Date.now()
  });
  storage.saveBookmarks(list);
  renderBookmarks();
  updateBookmarkState();
  toast("Bookmark saved");
}

function setProgressUI(percentage) {
  const value = clamp01(percentage);
  elements.progressRange.value = Math.round(value * 1000);
  elements.progressText.textContent = `${Math.round(value * 100)}%`;
}

function approximateProgress(location) {
  const displayed = location?.start?.displayed;
  const href = String(location?.start?.href || "").split("#")[0];
  const raw = state.book?.spine?.spineItems || [];
  const items = raw.filter(item => item?.href && item.linear !== "no");
  const spine = items.length ? items : raw.filter(item => item?.href);
  if (!spine.length) return Number(location?.start?.percentage) || 0;
  const index = spine.findIndex(item => {
    const itemHref = String(item.href || "").split("#")[0];
    return itemHref === href || itemHref.endsWith(href) || href.endsWith(itemHref);
  });
  if (index < 0) return Number(location?.start?.percentage) || 0;
  const page = Number(displayed?.page) || 1;
  const total = Math.max(1, Number(displayed?.total) || 1);
  const sectionFraction = clamp01((page - 1) / total);
  return clamp01((index + sectionFraction) / spine.length);
}

function progressFromLocation(location) {
  const cfi = location?.start?.cfi || state.currentCfi;
  if (state.locationsReady && cfi) {
    try {
      const exact = state.book.locations.percentageFromCfi(cfi);
      if (Number.isFinite(exact)) return clamp01(exact);
    } catch {}
  }
  const reported = Number(location?.start?.percentage);
  if (Number.isFinite(reported) && reported >= 0) return clamp01(reported);
  return approximateProgress(location);
}

function saveProgress(location) {
  const cfi = location?.start?.cfi;
  if (!cfi) return;
  state.currentCfi = cfi;
  const percentage = progressFromLocation(location);
  storage.saveProgress({
    file: bookUrl,
    cfi,
    percentage,
    chapter: state.currentChapter,
    title: elements.bookTitle.textContent,
    updatedAt: Date.now()
  });
  setProgressUI(percentage);
}

function spineTarget(percentage) {
  const raw = state.book?.spine?.spineItems || [];
  const linear = raw.filter(item => item?.href && item.linear !== "no");
  const items = linear.length ? linear : raw.filter(item => item?.href);
  if (!items.length) return "";
  const value = clamp01(percentage);
  const index = value >= 1 ? items.length - 1 : Math.min(items.length - 1, Math.floor(value * items.length));
  return items[index]?.href || "";
}

async function navigateToPercentage(percentage) {
  const rendition = state.rendition;
  const book = state.book;
  if (!rendition || !book) return;
  const value = clamp01(percentage);
  if (state.locationsReady && book.locations) {
    try {
      const cfi = book.locations.cfiFromPercentage(value);
      if (cfi) {
        await rendition.display(cfi);
        return;
      }
    } catch (error) {
      console.warn("Exact progress seek failed; using spine fallback", error);
    }
  }
  const href = spineTarget(value);
  if (!href) {
    if (state.locationsFailed) toast("Progress seeking is unavailable for this EPUB");
    return;
  }
  try {
    await rendition.display(href);
  } catch (error) {
    console.error("Progress seek failed", error);
    toast("Could not seek to that location");
  }
}

function seekTo(percentage, immediate = false) {
  const value = clamp01(percentage);
  setProgressUI(value);
  if (!state.locationsReady && !state.locationsFailed) {
    state.pendingSeek = { percentage: value, requestedAt: Date.now() };
  } else {
    state.pendingSeek = null;
  }
  clearTimeout(state.seekTimer);
  if (immediate) navigateToPercentage(value);
  else state.seekTimer = setTimeout(() => navigateToPercentage(value), 120);
}

function onRelocated(rendition, location) {
  if (rendition !== state.rendition) return;
  state.currentChapter = tocController.chapterForLocation(location);
  elements.chapterTitle.textContent = state.currentChapter;
  saveProgress(location);
  tocController.setActiveForLocation(location);
  updateBookmarkState();
  themeController.refresh(rendition);
}

function wireRendition(rendition) {
  rendition.hooks.content.register(contents => themeController.prepare(contents));
  rendition.on("relocated", location => onRelocated(rendition, location));
  rendition.on("rendered", () => {
    if (rendition !== state.rendition) return;
    themeController.refresh(rendition);
    updateBookmarkState();
  });
  rendition.on("keyup", event => {
    if (rendition !== state.rendition || state.settings.flow !== "paginated") return;
    if (event.key === "ArrowRight") rendition.next();
    if (event.key === "ArrowLeft") rendition.prev();
  });
}

async function createRendition(target) {
  if (!state.book) throw new Error("EPUB is not open");
  const serial = ++state.renditionSerial;
  const scrolled = state.settings.flow === "scrolled-doc";
  const singlePage = !scrolled && paginatedNeedsSinglePage();
  const rendition = state.book.renderTo("viewer", {
    width: "100%",
    height: "100%",
    manager: scrolled ? "continuous" : "default",
    flow: scrolled ? "scrolled-doc" : "paginated",
    spread: scrolled || singlePage ? "none" : "auto",
    minSpreadWidth: 900
  });
  state.rendition = rendition;
  wireRendition(rendition);
  try { rendition.themes.default(themeController.css(state.settings)); } catch {}
  configureSpread(rendition);
  syncBodyClasses();
  await rendition.display(target || undefined);
  if (serial !== state.renditionSerial || rendition !== state.rendition) return rendition;
  state.renderedFlow = state.settings.flow;
  themeController.refresh(rendition);
  updateBookmarkState();
  return rendition;
}

async function switchFlow(nextFlow) {
  const desired = nextFlow === "scrolled-doc" ? "scrolled-doc" : "paginated";
  if (state.switchingFlow) {
    state.queuedFlow = desired;
    return;
  }
  if (desired === state.renderedFlow && state.rendition) {
    state.settings.flow = desired;
    persistSettings();
    return;
  }

  const previousFlow = state.renderedFlow || state.settings.flow;
  const target = state.currentCfi || storage.loadProgress()?.cfi || undefined;
  state.settings.flow = desired;
  persistSettings();
  state.switchingFlow = true;
  const old = state.rendition;
  state.rendition = null;
  try { old?.destroy?.(); } catch (error) { console.warn("Old rendition cleanup skipped", error); }
  const viewer = $("#viewer");
  if (viewer) viewer.innerHTML = "";

  try {
    await createRendition(target);
  } catch (error) {
    console.error("Reader flow switch failed", error);
    toast("Could not switch reading flow");
    try { state.rendition?.destroy?.(); } catch {}
    if (viewer) viewer.innerHTML = "";
    state.settings.flow = previousFlow;
    persistSettings();
    try {
      await createRendition(target);
    } catch (recoveryError) {
      console.error("Reader flow recovery failed", recoveryError);
      elements.loading.classList.remove("hidden");
      elements.loading.innerHTML = "<p>Shadow Garden could not restore the reader.</p>";
    }
  } finally {
    state.switchingFlow = false;
    const queued = state.queuedFlow;
    state.queuedFlow = null;
    if (queued && queued !== state.renderedFlow) setTimeout(() => switchFlow(queued), 0);
  }
}

function startLocationGeneration() {
  state.book.ready.then(() => state.book.locations.generate(1200)).then(() => {
    state.locationsReady = true;
    state.locationsFailed = false;
    const pending = state.pendingSeek;
    state.pendingSeek = null;
    if (pending && Date.now() - pending.requestedAt < 10000) {
      navigateToPercentage(pending.percentage);
      return;
    }
    if (state.currentCfi) {
      try {
        const exact = state.book.locations.percentageFromCfi(state.currentCfi);
        if (Number.isFinite(exact)) setProgressUI(exact);
      } catch {}
    }
  }).catch(error => {
    state.locationsFailed = true;
    state.pendingSeek = null;
    console.warn("EPUB location generation failed", error);
  });
}

function turn(direction) {
  if (!state.rendition || state.settings.flow !== "paginated") return;
  if (direction < 0) state.rendition.prev();
  else state.rendition.next();
}

function bindDrawers() {
  elements.tocToggle.addEventListener("click", () => openDrawer(elements.tocDrawer));
  elements.settingsToggle.addEventListener("click", () => openDrawer(elements.settingsDrawer));
  elements.backdrop.addEventListener("click", closeDrawers);
  document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeDrawers));
  document.querySelector(".drawer-tabs")?.addEventListener("click", event => {
    const button = event.target.closest("button[data-panel]");
    if (!button) return;
    document.querySelectorAll(".drawer-tabs button").forEach(item => item.classList.toggle("active", item === button));
    elements.tocPanel.classList.toggle("hidden", button.dataset.panel !== "toc");
    elements.bookmarksPanel.classList.toggle("hidden", button.dataset.panel !== "bookmarks");
    if (button.dataset.panel === "bookmarks") renderBookmarks();
  });
}

function bindSettings() {
  elements.themeSelect.addEventListener("change", event => {
    state.settings.theme = event.target.value;
    applySettingsToRendition();
  });
  elements.fontSelect.addEventListener("change", event => {
    state.settings.font = event.target.value;
    applySettingsToRendition({ relayout: true });
  });
  elements.fontSizeRange.addEventListener("input", event => {
    state.settings.fontSize = Number(event.target.value);
    applySettingsToRendition({ relayout: true });
  });
  elements.lineHeightRange.addEventListener("input", event => {
    state.settings.lineHeight = Number(event.target.value);
    applySettingsToRendition({ relayout: true });
  });
  elements.widthRange.addEventListener("input", event => {
    state.settings.width = Number(event.target.value);
    applySettingsToRendition({ relayout: state.settings.flow === "scrolled-doc" });
  });
  elements.flowSelect.addEventListener("change", event => switchFlow(event.target.value));
  elements.resetReader.addEventListener("click", async () => {
    const previousFlow = state.settings.flow;
    state.settings = { ...defaults };
    persistSettings();
    if (previousFlow !== state.settings.flow) await switchFlow(state.settings.flow);
    else applySettingsToRendition({ relayout: true });
    toast("Reader settings reset");
  });
}

function bindNavigation() {
  elements.prevPage.addEventListener("click", () => turn(-1));
  elements.prevBottom.addEventListener("click", () => turn(-1));
  elements.nextPage.addEventListener("click", () => turn(1));
  elements.nextBottom.addEventListener("click", () => turn(1));

  elements.progressRange.addEventListener("input", event => seekTo(Number(event.target.value) / 1000));
  elements.progressRange.addEventListener("change", event => seekTo(Number(event.target.value) / 1000, true));
  elements.progressRange.addEventListener("pointerup", event => seekTo(Number(event.currentTarget.value) / 1000, true));
  elements.progressRange.addEventListener("touchend", event => seekTo(Number(event.currentTarget.value) / 1000, true), { passive: true });

  elements.bookmarkButton.addEventListener("click", toggleBookmark);
  elements.fullscreenButton.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  });

  document.addEventListener("keydown", event => {
    if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (event.key === "Escape") {
      closeDrawers();
      return;
    }
    if (event.key.toLowerCase() === "t") {
      openDrawer(elements.tocDrawer);
      return;
    }
    if (state.settings.flow !== "paginated") return;
    if (event.key === "ArrowRight") turn(1);
    if (event.key === "ArrowLeft") turn(-1);
  });

  window.addEventListener("resize", () => {
    clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(async () => {
      const rendition = state.rendition;
      if (!rendition || state.switchingFlow) return;
      try { rendition.resize?.("100%", "100%"); } catch {}
      configureSpread(rendition);
      if (state.settings.flow === "paginated" && state.currentCfi) {
        try { await rendition.display(state.currentCfi); } catch {}
      }
    }, 140);
  });
}

function bindUi() {
  bindDrawers();
  bindSettings();
  bindNavigation();
  persistSettings();
  renderBookmarks();
  updateBookmarkState();
}

async function init() {
  bindUi();
  if (!bookUrl) {
    elements.loading.innerHTML = "<p>No EPUB file was selected.</p>";
    return;
  }

  let returnHref = "/";
  if (seriesId) {
    if (isAdultReader && localStorage.getItem("sg-adult-ack") !== "1") {
      const ret = `/reader.html?book=${encodeURIComponent(bookUrl)}&series=${encodeURIComponent(seriesId)}`;
      location.replace(`/nsfw.html?return=${encodeURIComponent(ret)}`);
      return;
    }
    returnHref = `/series.html?id=${encodeURIComponent(seriesId)}`;
  }
  elements.backLink.href = returnHref;
  elements.returnButton.href = returnHref;

  try {
    state.book = window.ePub(bookUrl);
    const metadataPromise = state.book.loaded.metadata.catch(() => ({}));
    const navigationPromise = state.book.loaded.navigation.catch(error => {
      console.warn("EPUB navigation unavailable", error);
      return { toc: [] };
    });
    const [metadata, navigation] = await Promise.all([metadataPromise, navigationPromise]);
    state.navigation = navigation;
    const title = metadata?.title || "Untitled EPUB";
    elements.bookTitle.textContent = title;
    document.title = `${title} — Shadow Garden`;
    tocController.render(navigation?.toc || []);

    const saved = storage.loadProgress();
    if (Number.isFinite(Number(saved?.percentage))) setProgressUI(Number(saved.percentage));

    startLocationGeneration();
    await createRendition(saved?.cfi || undefined);
    elements.loading.classList.add("hidden");
  } catch (error) {
    console.error("Reader initialization failed", error);
    elements.loading.classList.remove("hidden");
    elements.loading.innerHTML = "<p>Shadow Garden could not open this EPUB.</p>";
  }
}

init();