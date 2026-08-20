export function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("Shadow Garden could not persist reader data", error);
    return false;
  }
}

export function createReaderStorage(bookUrl) {
  const progressKey = `sg-progress:${bookUrl}`;
  const bookmarksKey = `sg-bookmarks:${bookUrl}`;
  const settingsKey = "sg-reader-settings";

  return {
    loadProgress() {
      return readJSON(progressKey, null);
    },
    saveProgress(value) {
      return writeJSON(progressKey, value);
    },
    loadBookmarks() {
      const value = readJSON(bookmarksKey, []);
      return Array.isArray(value) ? value : [];
    },
    saveBookmarks(value) {
      return writeJSON(bookmarksKey, Array.isArray(value) ? value : []);
    },
    loadSettings(defaults) {
      return { ...defaults, ...readJSON(settingsKey, {}) };
    },
    saveSettings(value) {
      return writeJSON(settingsKey, value);
    }
  };
}
