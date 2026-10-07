import { formatIdentifier, normalizeRoomString, parseIdentifier } from "@the-library/core";
import { ensureRoomKey, isRoomHash, resolveRoom } from "@/lib/rooms";

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

/**
 * Portable coordinate for JSON files.
 * `room` is always the complete base-32 room string (may be megabytes).
 * `roomKey` is the URL/bookmark slug (short literal or @hash).
 */
export type CoordinateExport = {
  room: string;
  roomKey: string;
  wall: number;
  shelf: number;
  book: number;
  page: number;
};

export type LibraryExport = {
  version: 1 | 2;
  exportedAt: string;
  current: CoordinateExport | null;
  bookmarks: CoordinateExport[];
};

type LegacyBookmark = {
  id?: string;
  identifier?: string;
  /** Full room (export v2) or legacy roomKey field. */
  room?: string;
  roomKey?: string;
  wall?: number | string;
  shelf?: number | string;
  book?: number | string;
  page?: number | string;
  label?: string;
  savedAt?: string;
};

/** Accept JSON numbers or numeric strings from hand-edited exports. */
function coerceInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isInteger(n) ? n : null;
  }
  return null;
}

/**
 * Resolve an imported coordinate's room from either a full base-32 code or an
 * @hash slug (fields may appear as `room`, `roomKey`, or both).
 * Full rooms are remembered in IndexedDB; hashes alone stay as slugs.
 */
async function resolveImportedRoomRef(
  b: Pick<LegacyBookmark, "room" | "roomKey">
): Promise<{ room: string; roomKey: string; hasFullRoom: boolean } | null> {
  const roomField = typeof b.room === "string" ? b.room.trim() : "";
  const keyField = typeof b.roomKey === "string" ? b.roomKey.trim() : "";

  const fullFromRoom =
    roomField && !isRoomHash(roomField)
      ? normalizeRoomString(roomField)
      : null;
  const fullFromKey =
    keyField && !isRoomHash(keyField)
      ? normalizeRoomString(keyField)
      : null;
  const full = fullFromRoom ?? fullFromKey;

  const hashFromKey = keyField && isRoomHash(keyField) ? keyField : null;
  const hashFromRoom = roomField && isRoomHash(roomField) ? roomField : null;
  const hash = hashFromKey ?? hashFromRoom;

  if (full && full !== "0" && /^[0-9a-v]+$/.test(full)) {
    // Prefer complete room — portable across devices; slug stays hashed.
    const roomKey = await ensureRoomKey(full);
    return { room: full, roomKey, hasFullRoom: true };
  }

  if (hash) {
    try {
      const room = await resolveRoom(hash);
      return { room, roomKey: hash, hasFullRoom: true };
    } catch {
      // Unknown hash: keep the bookmark slug; cannot seed explore until resolved.
      return { room: hash, roomKey: hash, hasFullRoom: false };
    }
  }

  return null;
}

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
    // Never hydrate megabyte rooms into React state from localStorage.
    if (!isRoomHash(b.roomKey) && b.roomKey.length > 256) return null;
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
      coerceInt(b.wall) !== null &&
      !b.identifier &&
      !b.room
    ) {
      // Compact long literal rooms that slipped into localStorage.
      if (!isRoomHash(b.roomKey) && b.roomKey.length > 16) {
        try {
          const compacted = await compactImportedCoord(b);
          if (compacted) {
            out.push(compacted);
            changed = true;
          }
          continue;
        } catch {
          changed = true;
          continue;
        }
      }
      const compact = normalizeBookmarkSync({
        ...b,
        wall: coerceInt(b.wall) ?? undefined,
        shelf: coerceInt(b.shelf) ?? undefined,
        book: coerceInt(b.book) ?? undefined,
        page: coerceInt(b.page) ?? undefined,
      });
      if (compact) out.push(compact);
      continue;
    }

    if (typeof b.room === "string" && coerceInt(b.wall) !== null) {
      try {
        const compacted = await compactImportedCoord(b);
        if (compacted) {
          out.push(compacted);
          changed = true;
        }
        continue;
      } catch {
        changed = true;
        continue;
      }
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
  if (changed || raw.some((b) => typeof b.identifier === "string" || typeof b.room === "string")) {
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
  const normalized = normalizeRoomString(room);
  const roomKey = await ensureRoomKey(normalized);
  return { room: normalized, roomKey, wall, shelf, book, page };
}

async function expandBookmarkToExport(b: Bookmark): Promise<CoordinateExport> {
  const room = await resolveRoom(b.roomKey);
  return {
    room,
    roomKey: b.roomKey,
    wall: b.wall,
    shelf: b.shelf,
    book: b.book,
    page: b.page,
  };
}

export async function buildExportPayload(
  current: CoordinateExport | null
): Promise<LibraryExport> {
  const bookmarks = loadBookmarks();
  const expanded = await Promise.all(bookmarks.map(expandBookmarkToExport));
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    current,
    bookmarks: expanded,
  };
}

export async function exportLibraryJson(
  current: CoordinateExport | null
): Promise<string> {
  return JSON.stringify(await buildExportPayload(current), null, 2);
}

/**
 * Turn an imported coordinate (hash and/or full room) into a compact bookmark.
 * Full room strings are remembered in IndexedDB only — never localStorage.
 */
async function compactImportedCoord(
  b: LegacyBookmark
): Promise<Bookmark | null> {
  const wall = coerceInt(b.wall);
  const shelf = coerceInt(b.shelf);
  const book = coerceInt(b.book);
  const page = coerceInt(b.page);
  if (wall === null || shelf === null || book === null || page === null) {
    return null;
  }

  const ref = await resolveImportedRoomRef(b);
  if (!ref) return null;

  return {
    id: b.id ?? crypto.randomUUID(),
    roomKey: ref.roomKey,
    wall,
    shelf,
    book,
    page,
    label:
      b.label && b.label.length < 120
        ? b.label
        : bookmarkLabel({
            roomKey: ref.roomKey,
            wall,
            shelf,
            book,
            page,
          }),
    savedAt: b.savedAt ?? new Date().toISOString(),
  };
}

export type ImportResult = {
  bookmarks: Bookmark[];
  /** Ephemeral full room for seeding the explore form — not persisted as bookmark text. */
  current: {
    room: string;
    roomKey: string;
    wall: number;
    shelf: number;
    book: number;
    page: number;
  } | null;
};

/**
 * Import bookmarks / coordinates from JSON.
 * Accepts v2 (`room` full + `roomKey` hash), v1 (`roomKey` only), arrays,
 * single coords, and legacy `{identifier}` rows.
 * Full room strings are used ephemerally then compacted to @hash + IDB.
 */
export async function importBookmarksJson(raw: string): Promise<ImportResult> {
  const parsed: unknown = JSON.parse(raw);
  let incoming: LegacyBookmark[] = [];
  let currentRaw: LegacyBookmark | null = null;
  /** Full library exports replace stored bookmarks; single coords merge. */
  let replaceAll = false;

  if (Array.isArray(parsed)) {
    incoming = parsed as LegacyBookmark[];
    replaceAll = true;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Partial<LibraryExport> & LegacyBookmark & {
      current?: LegacyBookmark | CoordinateExport | null;
    };

    if (Array.isArray(obj.bookmarks)) {
      incoming = obj.bookmarks as LegacyBookmark[];
      replaceAll = true;
      if (obj.current && typeof obj.current === "object") {
        currentRaw = obj.current as LegacyBookmark;
      }
    } else if (
      (obj.room || obj.roomKey) &&
      coerceInt(obj.wall) !== null
    ) {
      incoming = [obj];
      currentRaw = obj;
    } else if (typeof obj.identifier === "string") {
      incoming = [obj];
    } else {
      throw new Error("Invalid bookmark file");
    }
  } else {
    throw new Error("Invalid bookmark file");
  }

  const out: Bookmark[] = [];
  const seen = new Set<string>();

  const pushUnique = (b: Bookmark) => {
    const k = `${b.roomKey}|${b.wall}|${b.shelf}|${b.book}|${b.page}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(b);
  };

  if (!replaceAll) {
    for (const b of loadBookmarks()) pushUnique(b);
  }

  if (currentRaw) {
    const compacted = await compactImportedCoord(currentRaw);
    if (compacted) pushUnique(compacted);
  }

  for (const b of incoming) {
    if (typeof b.identifier === "string") {
      try {
        const parts = b.identifier.split(".");
        if (parts.length !== 5) continue;
        const [room, w, s, bk, p] = parts;
        const roomKey = await ensureRoomKey(room);
        pushUnique({
          id: b.id ?? crypto.randomUUID(),
          roomKey,
          wall: Number(w),
          shelf: Number(s),
          book: Number(bk),
          page: Number(p),
          label: bookmarkLabel({
            roomKey,
            wall: Number(w),
            shelf: Number(s),
            book: Number(bk),
            page: Number(p),
          }),
          savedAt: b.savedAt ?? new Date().toISOString(),
        });
      } catch {
        /* skip */
      }
      continue;
    }
    const compacted = await compactImportedCoord(b);
    if (compacted) pushUnique(compacted);
  }

  saveBookmarks(out.slice(0, 100));

  let current: ImportResult["current"] = null;
  try {
    if (currentRaw) {
      current = await resolveImportedCurrent(currentRaw);
    } else if (incoming.length === 1) {
      current = await resolveImportedCurrent(incoming[0]!);
    }
  } catch {
    current = null;
  }

  return { bookmarks: loadBookmarks(), current };
}

async function resolveImportedCurrent(
  b: LegacyBookmark
): Promise<ImportResult["current"]> {
  const wall = coerceInt(b.wall);
  const shelf = coerceInt(b.shelf);
  const book = coerceInt(b.book);
  const page = coerceInt(b.page);
  if (wall === null || shelf === null || book === null || page === null) {
    return null;
  }

  const ref = await resolveImportedRoomRef(b);
  // Need a real room string to seed Explore — hash-only without IDB cannot.
  if (!ref || !ref.hasFullRoom) return null;

  return {
    room: ref.room,
    roomKey: ref.roomKey,
    wall,
    shelf,
    book,
    page,
  };
}

/** @deprecated Prefer importBookmarksJson().current — kept for simple coord peek. */
export function parseCurrentFromImport(raw: string): {
  roomKey: string;
  wall: number;
  shelf: number;
  book: number;
  page: number;
  room?: string;
} | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const obj = parsed as Partial<LibraryExport> & LegacyBookmark;
    const src = (obj.current ?? obj) as LegacyBookmark;
    const wall = coerceInt(src.wall);
    const shelf = coerceInt(src.shelf);
    const book = coerceInt(src.book);
    const page = coerceInt(src.page);
    if (wall === null || shelf === null || book === null || page === null) {
      return null;
    }
    if (typeof src.room === "string" && !isRoomHash(src.room)) {
      return {
        room: src.room,
        roomKey: typeof src.roomKey === "string" ? src.roomKey : src.room.slice(0, 16),
        wall,
        shelf,
        book,
        page,
      };
    }
    if (typeof src.roomKey === "string") {
      return {
        roomKey: src.roomKey,
        wall,
        shelf,
        book,
        page,
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
