const KEY = "the-library-bookmarks";

export type Bookmark = {
  id: string;
  identifier: string;
  label?: string;
  savedAt: string;
};

export function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Bookmark[];
  } catch {
    return [];
  }
}

export function saveBookmarks(list: Bookmark[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addBookmark(identifier: string, label?: string): Bookmark[] {
  const list = loadBookmarks();
  const next: Bookmark = {
    id: crypto.randomUUID(),
    identifier,
    label,
    savedAt: new Date().toISOString(),
  };
  const updated = [next, ...list].slice(0, 100);
  saveBookmarks(updated);
  return updated;
}

export function exportBookmarksJson(): string {
  return JSON.stringify(loadBookmarks(), null, 2);
}

export function importBookmarksJson(raw: string): Bookmark[] {
  const parsed = JSON.parse(raw) as Bookmark[];
  if (!Array.isArray(parsed)) throw new Error("Invalid bookmark file");
  saveBookmarks(parsed);
  return parsed;
}
