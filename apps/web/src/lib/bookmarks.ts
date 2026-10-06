import { formatIdentifier, parseIdentifier } from "@the-library/core";
import { ensureRoomKey, resolveRoom } from "@/lib/rooms";

const KEY = "the-library-bookmarks";

/** Compact bookmark — never stores a megabyte room string. */
export type Bookmark = {
  id: string;
  roomKey: string;
  wall: number;
  shelf: number;
  book: number;
  page: number;
  label: string;
  savedAt: string;
};

export type CoordinateExport = {
  roomKey: string;
  wall: number;
  shelf: number;
  book: number;
  page: number;
};

export type LibraryExport = {
  version: 1;
  exportedAt: string;
  current: CoordinateExport | null;
  bookmarks: Bookmark[];
};

type LegacyBookmark = {
  id?: string;
  identifier?: string;
  roomKey?: string;
  wall?: number;
  shelf?: number;
  book?: number;
  page?: number;
  label?: string;
  savedAt?: string;
};

export function bookmarkLabel(b: {
  roomKey: string;
  wall: number;
  shelf: number;
  book: number;
  page: number;
}): string {
  const key = b.roomKey;
  const room =
    key.length > 22 ? `${key.slice(0, 10)}…${key.slice(-8)}` : key;
  return `${room} · W${b.wall} · S${b.shelf} · B${b.book} · P${b.page}`;
}

function readRaw(): LegacyBookmark[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LegacyBookmark[]) : [];
  } catch {
    return [];
  }
}

/** Sync load for UI — may still contain legacy rows until migrateBookmarks runs. */
export function loadBookmarks(): Bookmark[] {
  return readRaw()
    .map((b) => normalizeBookmarkSync(b))
    .filter((b): b is Bookmark => b !== null);
}

function normalizeBookmarkSync(b: LegacyBookmark): Bookmark | null {
  if (
    typeof b.roomKey === "string" &&
    typeof b.wall === "number" &&
    typeof b.shelf === "number" &&
    typeof b.book === "number" &&
    typeof b.page === "number"
  ) {
    return {
      id: b.id ?? crypto.randomUUID(),
      roomKey: b.roomKey,
      wall: b.wall,
      shelf: b.shelf,
      book: b.book,
      page: b.page,
      label: b.label && b.label.length < 120 ? b.label : bookmarkLabel({
        roomKey: b.roomKey,
        wall: b.wall,
        shelf: b.shelf,
        book: b.book,
        page: b.page,
      }),
      savedAt: b.savedAt ?? new Date().toISOString(),
    };
  }

  // Legacy huge identifier — don't put it in React state; placeholder until migrate.
  if (typeof b.identifier === "string" && b.identifier.length < 200) {
    try {
      const parsed = parseIdentifier(b.identifier);
      const roomKey = parsed.roomString;
      return {
        id: b.id ?? crypto.randomUUID(),
        roomKey,
        wall: parsed.wall,
        shelf: parsed.shelf,
        book: parsed.book,
        page: parsed.page,
        label: bookmarkLabel({
          roomKey,
          wall: parsed.wall,
          shelf: parsed.shelf,
          book: parsed.book,
          page: parsed.page,
        }),
        savedAt: b.savedAt ?? new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  // Huge legacy entry: skip in sync render (migrateBookmarks will compact + restore)
  if (typeof b.identifier === "string" && b.identifier.length >= 200) {
    return null;
  }

  return null;
}

export function saveBookmarks(list: Bookmark[]) {
  // Guard: never persist megabyte identifiers
  const safe = list.map((b) => ({
    id: b.id,
    roomKey: b.roomKey,
    wall: b.wall,
    shelf: b.shelf,
    book: b.book,
    page: b.page,
    label: b.label.length > 120 ? bookmarkLabel(b) : b.label,
    savedAt: b.savedAt,
  }));
  localStorage.setItem(KEY, JSON.stringify(safe));
}

/**
 * Rewrite legacy bookmarks that stored full room strings into @hash + IDB.
 * Call once on Explore mount.
 */
export async function migrateBookmarks(): Promise<Bookmark[]> {
  const raw = readRaw();
  if (raw.length === 0) return [];

  const out: Bookmark[] = [];
  let changed = false;

  for (const b of raw) {
    if (
      typeof b.roomKey === "string" &&
      typeof b.wall === "number" &&
      !b.identifier
    ) {
      const compact = normalizeBookmarkSync(b);
      if (compact) out.push(compact);
      continue;
    }

    if (typeof b.identifier === "string") {
      try {
        // ROOM is base-32 without dots → exactly 5 segments
        const parts = b.identifier.split(".");
        if (parts.length !== 5) {
          changed = true;
          continue;
        }
        const [room, w, s, bk, p] = parts;
        const roomKey = await ensureRoomKey(room);
        const wall = Number(w);
        const shelf = Number(s);
        const book = Number(bk);
        const page = Number(p);
        out.push({
          id: b.id ?? crypto.randomUUID(),
          roomKey,
          wall,
          shelf,
          book,
          page,
          label: bookmarkLabel({ roomKey, wall, shelf, book, page }),
          savedAt: b.savedAt ?? new Date().toISOString(),
        });
        changed = true;
        continue;
      } catch {
        changed = true;
        continue;
      }
    }

    const compact = normalizeBookmarkSync(b);
    if (compact) out.push(compact);
    else changed = true;
  }

  // Always rewrite if any legacy identifier keys existed (purge huge strings)
  if (changed || raw.some((b) => typeof b.identifier === "string")) {
    saveBookmarks(out);
  }
  return out;
}

export async function addBookmark(identifier: string): Promise<Bookmark[]> {
  const parsed = parseIdentifier(identifier);
  const roomKey = await ensureRoomKey(parsed.roomString);
  const entry: Bookmark = {
    id: crypto.randomUUID(),
    roomKey,
    wall: parsed.wall,
    shelf: parsed.shelf,
    book: parsed.book,
    page: parsed.page,
    label: bookmarkLabel({
      roomKey,
      wall: parsed.wall,
      shelf: parsed.shelf,
      book: parsed.book,
      page: parsed.page,
    }),
    savedAt: new Date().toISOString(),
  };

  const list = loadBookmarks().filter(
    (b) =>
      !(
        b.roomKey === entry.roomKey &&
        b.wall === entry.wall &&
        b.shelf === entry.shelf &&
        b.book === entry.book &&
        b.page === entry.page
      )
  );
  const updated = [entry, ...list].slice(0, 100);
  saveBookmarks(updated);
  return updated;
}

export async function toCoordinateExport(
  room: string,
  wall: number,
  shelf: number,
  book: number,
  page: number
): Promise<CoordinateExport> {
  const roomKey = await ensureRoomKey(room);
  return { roomKey, wall, shelf, book, page };
}

export function buildExportPayload(
  current: CoordinateExport | null
): LibraryExport {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    current,
    bookmarks: loadBookmarks(),
  };
}

export function exportLibraryJson(current: CoordinateExport | null): string {
  return JSON.stringify(buildExportPayload(current), null, 2);
}

export async function importBookmarksJson(raw: string): Promise<Bookmark[]> {
  const parsed: unknown = JSON.parse(raw);
  let incoming: LegacyBookmark[] = [];

  if (Array.isArray(parsed)) {
    incoming = parsed as LegacyBookmark[];
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Partial<LibraryExport> & LegacyBookmark & {
      current?: CoordinateExport | null;
    };

    if (Array.isArray(obj.bookmarks)) {
      incoming = obj.bookmarks as LegacyBookmark[];
      if (obj.current?.roomKey) {
        incoming = [
          {
            id: crypto.randomUUID(),
            roomKey: obj.current.roomKey,
            wall: obj.current.wall,
            shelf: obj.current.shelf,
            book: obj.current.book,
            page: obj.current.page,
            label: bookmarkLabel(obj.current),
            savedAt: new Date().toISOString(),
          },
          ...incoming,
        ];
      }
    } else if (obj.roomKey && typeof obj.wall === "number") {
      incoming = [obj];
    } else if (typeof obj.identifier === "string") {
      incoming = [obj];
    } else {
      throw new Error("Invalid bookmark file");
    }
  } else {
    throw new Error("Invalid bookmark file");
  }

  // Stash then migrate (handles legacy full identifiers)
  localStorage.setItem(KEY, JSON.stringify(incoming));
  return migrateBookmarks();
}

export function parseCurrentFromImport(raw: string): CoordinateExport | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Partial<LibraryExport> & CoordinateExport & {
      identifier?: string;
      room?: string;
    };
    if (obj.current?.roomKey) return obj.current;
    if (
      typeof obj.roomKey === "string" &&
      typeof obj.wall === "number" &&
      typeof obj.shelf === "number" &&
      typeof obj.book === "number" &&
      typeof obj.page === "number"
    ) {
      return {
        roomKey: obj.roomKey,
        wall: obj.wall,
        shelf: obj.shelf,
        book: obj.book,
        page: obj.page,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Resolve a compact bookmark / export into a full generate-able identifier. */
export async function resolveBookmarkIdentifier(
  b: Pick<Bookmark, "roomKey" | "wall" | "shelf" | "book" | "page">
): Promise<string> {
  const room = await resolveRoom(b.roomKey);
  return formatIdentifier(room, b.wall, b.shelf, b.book, b.page);
}
