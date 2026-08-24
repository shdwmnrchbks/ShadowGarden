import { cleanIdentities, cleanIdentity, isBookId } from "../domain/book-identity.js";
import { readBookmarksAliases, writeBookmarksAliases } from "../domain/bookmarks.js";
import { progressForAliases, writeProgressAliases } from "../domain/progress.js";
import { readJson, writeJson } from "../domain/storage.js";

export const READER_SETTINGS_KEY = "sg-reader-settings";

export function readJSON(key, fallback) {
  return readJson(key, fallback);
}

export function writeJSON(key, value) {
  return writeJson(key, value);
}

export function createReaderStorage(bookUrl) {
  const sourceIdentity = cleanIdentity(bookUrl) || "__missing__";
  const publicIdentity = cleanIdentity(globalThis.__sgReaderPublicBookId);
  const canonicalIdentity = isBookId(publicIdentity) ? publicIdentity : sourceIdentity;
  const aliases = cleanIdentities([sourceIdentity, canonicalIdentity]);

  return {
    identities: aliases,
    canonicalIdentity,
    loadProgress() {
      return progressForAliases(aliases);
    },
    saveProgress(value) {
      return writeProgressAliases(aliases, value, { canonicalIdentity });
    },
    loadBookmarks() {
      return readBookmarksAliases(aliases);
    },
    saveBookmarks(value) {
      return writeBookmarksAliases(aliases, Array.isArray(value) ? value : []);
    },
    loadSettings(defaults) {
      return { ...defaults, ...readJson(READER_SETTINGS_KEY, {}) };
    },
    saveSettings(value) {
      return writeJson(READER_SETTINGS_KEY, value);
    }
  };
}
