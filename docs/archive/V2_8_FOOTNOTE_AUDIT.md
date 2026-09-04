# v2.8 Reader footnote/endnote compatibility audit

> **Status:** 🗄️ Archived — completed v2.8 compatibility audit  
> **Current roadmap:** [`../roadmaps/CURRENT_ROADMAP.md`](../roadmaps/CURRENT_ROADMAP.md)

Shadow Garden's EPUB.js 0.3.93 baseline treats internal hyperlinks uniformly and navigates the rendition to their target. That is correct for ordinary EPUB links, but it means explicit EPUB footnote/endnote references move the live reading position instead of behaving like transient notes.

## Supported patterns in this slice

- EPUB 3 `epub:type="noteref"` references.
- DPUB-ARIA `role="doc-noteref"` references.
- Conventional `rel="footnote"` / `rel="endnote"` and `noteref`, `note-ref`, `footnote-ref`, `endnote-ref` class tokens.
- Same-XHTML fragment targets.
- Cross-XHTML targets, including non-linear spine endnote resources.
- Footnote/endnote target semantics from `epub:type="footnote|endnote"` and `role="doc-footnote|doc-endnote"`.

## Behavior contract

- Explicit noterefs open a modal Reader-chrome note overlay and do not move the live rendition.
- Note content is copied as plain text paragraphs; publication scripts/markup are not injected into Shadow Garden chrome.
- Common backlink markers are omitted from the displayed note body.
- Closing the note restores focus to the originating reference when that document is still mounted.
- Ordinary internal EPUB links remain EPUB.js-owned and continue to navigate normally.
- If a marked noteref cannot be resolved as a popup target, Shadow Garden falls back to rendition navigation rather than swallowing the link.
- The feature is flow-neutral: Pages and Continuous use the same compatibility hook and do not gain a second navigation owner.

## Deterministic coverage

The Reader fixture includes:

1. A same-document EPUB 3 footnote.
2. A cross-document DPUB-ARIA endnote in a `linear="no"` spine item.
3. An ordinary internal link proving non-noteref navigation remains untouched.

Real-browser tests cover note labeling/content, multi-paragraph text, backlink removal, focus restoration, Escape/close behavior, unchanged chapter context, normal internal navigation, and Continuous-mode neutrality.
