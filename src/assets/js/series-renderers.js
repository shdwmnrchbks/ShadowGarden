/* Shadow Garden R3 — Series hero and volume-card render ownership. */
import { volumeActionFor } from "./public/volume-actions.js";

const arr = value => Array.isArray(value) ? value : [];

function attrs(action, esc) {
  return `data-volume-action="open" data-volume-state="${esc(action.state)}" data-series-id="${esc(action.seriesId)}" data-book-id="${esc(action.bookId)}" data-volume-title="${esc(action.title)}"`;
}

function volumeArtwork(series, volume) {
  return String(volume?.cover || volume?.coverThumb || series?.cover || series?.coverThumb || "");
}

function bannerVolume(series, identity) {
  const volumes = arr(series?.volumes);
  const selected = String(series?.bannerBookId || "");
  if (identity.isBookId(selected)) {
    const match = volumes.find(volume => String(volume?.bookId || volume?.file || "") === selected);
    if (match) return match;
  }
  return volumes[0] || null;
}

function tagLinks(series, urls, format) {
  const esc = format.escapeHtml;
  const adult = Boolean(series?.nsfw) || String(series?.id || "").startsWith("adult-");
  const base = urls.libraryUrl(adult);
  return arr(series?.tags).map(tag => {
    const value = String(tag || "");
    const href = `${base}?tag=${encodeURIComponent(value)}`;
    return `<a class="tag" href="${href}" title="Show ${esc(value)} in ${adult ? "Adult Library" : "Library"}">${esc(value)}</a>`;
  }).join("");
}

function volumeCard(series, entry, dependencies) {
  const { readingState, urls, format } = dependencies;
  const esc = format.escapeHtml;
  const { volume, index, state, progress } = entry;
  const action = volumeActionFor(series, volume, index);
  const cover = volume?.coverThumb || volume?.cover || series?.coverThumb || series?.cover || "";
  const percent = progress ? Math.round((Number(progress?.percentage) || 0) * 100) : 0;
  const finished = state === readingState.STATES.FINISHED;
  const stateMeta = finished ? "Finished" : state === readingState.STATES.IN_PROGRESS ? `${percent}% read` : "Unread";
  const title = volume?.title || `Volume ${index + 1}`;
  return `<article class="volume-card ${finished ? "is-finished" : ""}" data-volume-index="${index}" data-reading-state="${esc(state)}">
    <a class="volume-cover-link" ${attrs(action, esc)} href="${action.href}" aria-label="${esc(action.label)} ${esc(title)}" title="${esc(action.label)} ${esc(title)}">
      <div class="volume-cover">${cover ? `<img src="${esc(cover)}" alt="${esc(title)} cover" loading="lazy" decoding="async" fetchpriority="low">` : ""}${finished ? '<span class="finished-volume-badge" title="Finished" aria-label="Finished">✓</span>' : ""}</div>
    </a>
    <h3 class="volume-title">${esc(title)}</h3>
    <p class="volume-meta">${[volume?.date || "", format.formatBytes(volume?.size), stateMeta].filter(Boolean).join(" · ")}</p>
    <div class="volume-actions">
      <a class="read" ${attrs(action, esc)} href="${action.href}">${esc(action.label)}</a>
      <a class="download" href="#book-${esc(volume?.file)}" data-book-id="${esc(volume?.file)}" download>Download EPUB</a>
    </div>
  </article>`;
}

export function seriesMarkup(series, dependencies) {
  const { readingState, preferences, urls, format, identity } = dependencies;
  const esc = format.escapeHtml;
  const volumes = arr(series?.volumes);
  const first = volumes[0];
  const pinned = preferences.isPinned(series?.id);
  const finishedCount = readingState.finishedCount(series) || 0;
  const entries = readingState.volumeEntries(series);
  const startEntry = readingState.preferredSeriesEntry(series);
  const startAction = startEntry ? volumeActionFor(series, startEntry.volume, startEntry.index) : null;
  const audioAlignedUrl = series?.audioAlignedUrl || volumes.find(volume => volume?.audioAlignedUrl)?.audioAlignedUrl || "";
  const cover = series?.cover || first?.cover || series?.coverThumb || first?.coverThumb || "";
  const backdrop = volumeArtwork(series, bannerVolume(series, identity)) || series?.coverThumb || first?.coverThumb || cover;

  return `
    <section class="series-hero">
      ${backdrop ? `<div class="series-backdrop" aria-hidden="true" style="background-image:url(${JSON.stringify(backdrop)})"></div>` : ""}
      <div class="series-hero-inner">
        ${cover ? `<img class="series-cover" src="${esc(cover)}" alt="${esc(series?.title)} cover" loading="eager" decoding="async" fetchpriority="high">` : `<div class="series-cover-fallback">${esc(series?.title)}</div>`}
        <div class="series-info">
          <p class="kicker">${series?.nsfw ? "ADULT · " : ""}${esc((series?.status || "SERIES").toUpperCase())}</p>
          <h1>${esc(series?.title)}</h1>
          <p class="series-byline">${esc(series?.author || "Unknown author")} ${series?.year ? `<span class="series-year">· ${series.year}</span>` : ""}${finishedCount ? ` <span class="series-year">· ${finishedCount}/${volumes.length} finished</span>` : ""}</p>
          <div class="series-actions">
            ${startAction ? `<a class="primary-button" ${attrs(startAction, esc)} href="${startAction.href}">${esc(startAction.label)}</a>` : ""}
            ${audioAlignedUrl ? `<a class="secondary-button audio-series-link" href="${esc(audioAlignedUrl)}" target="_blank" rel="noopener noreferrer">Audio EPUBs ↗</a>` : ""}
            <button id="pinButton" class="secondary-button ${pinned ? "pinned" : ""}" type="button">${pinned ? "◆ Pinned" : "◇ Pin to Garden"}</button>
          </div>
          <div class="tag-row">${tagLinks(series, urls, format)}</div>
        </div>
      </div>
    </section>
    <section class="series-body">
      ${series?.description ? `<p class="series-description">${esc(series.description)}</p>` : ""}
      <div class="series-section-head"><h2>Volumes</h2><span>${volumes.length} ${volumes.length === 1 ? "volume" : "volumes"}</span></div>
      <div class="volume-grid">${entries.map(entry => volumeCard(series, entry, dependencies)).join("")}</div>
    </section>`;
}

export function notFoundMarkup(home, format) {
  const esc = format.escapeHtml;
  return `<section class="not-found"><span>PATH LOST</span><h1>This shelf has slipped into shadow.</h1><p>The Garden could not find this series among its living shelves.</p><a class="primary-button" href="${esc(home)}">Return to the Garden</a></section>`;
}
