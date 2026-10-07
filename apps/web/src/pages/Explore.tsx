import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BASE32_ALPHA,
  BOOKS,
  PAGES,
  SHELVES,
  WALLS,
  assertBounds,
  normalizeRoomString,
  shortenRoom,
} from "@the-library/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bookPath } from "@/lib/routes";
import { ensureRoomKey, resolveRoom } from "@/lib/rooms";
import {
  bookmarkLabel,
  exportLibraryJson,
  importBookmarksJson,
  loadBookmarks,
  migrateBookmarks,
  toCoordinateExport,
  type Bookmark,
} from "@/lib/bookmarks";
import { cn } from "@/lib/utils";

const ROOM_CHAR_RE = new RegExp(`[^${BASE32_ALPHA}]`, "gi");
/** Manual typing cap; seeded rooms from the reader may be longer. */
const ROOM_INPUT_MAX = 256;

export type ExploreLocationState = {
  roomKey?: string;
  wall?: number;
  shelf?: number;
  book?: number;
  page?: number;
};

function sanitizeRoom(raw: string): string {
  return raw.toLowerCase().replace(ROOM_CHAR_RE, "").slice(0, ROOM_INPUT_MAX);
}

/** Digits only; empty while typing is allowed; clamp to [min, max] when non-empty. */
function sanitizeIntField(raw: string, min: number, max: number): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  if (n < min) return String(min);
  if (n > max) return String(max);
  return String(n);
}

function parseIntInRange(
  value: string,
  min: number,
  max: number,
  label: string
): number {
  if (value === "") throw new Error(`${label} is required`);
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return n;
}

type FieldProps = {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  inputMode?: "numeric" | "text";
  invalid?: boolean;
  maxLength?: number;
  readOnly?: boolean;
  /** When set, show ± steppers clamped to this range. */
  min?: number;
  max?: number;
};

function CoordField({
  label,
  hint,
  value,
  onChange,
  onBlur,
  inputMode = "numeric",
  invalid,
  maxLength,
  readOnly,
  min,
  max,
}: FieldProps) {
  const steppers = min != null && max != null && !readOnly;
  const n = Number(value);
  const atMin = !Number.isInteger(n) || n <= min!;
  const atMax = !Number.isInteger(n) || n >= max!;

  const step = (delta: number) => {
    const base = Number.isInteger(n) ? n : min!;
    const next = Math.min(max!, Math.max(min!, base + delta));
    onChange(String(next));
  };

  return (
    <label className="space-y-1">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--dim)]">
          {label}
        </span>
        <span className="font-mono text-[10px] text-[var(--dim)]">{hint}</span>
      </span>
      <span className={cn("relative block", steppers && "pr-0")}>
        <Input
          value={value}
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          maxLength={maxLength}
          readOnly={readOnly}
          aria-invalid={invalid || undefined}
          className={cn(
            invalid && "border-red-500/70 focus-visible:ring-red-400",
            readOnly && "opacity-80",
            steppers && "pr-8"
          )}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {steppers && (
          <span className="absolute inset-y-0 right-0 flex w-7 flex-col border-l border-[var(--line)]">
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Increase ${label}`}
              disabled={atMax}
              className="flex flex-1 items-center justify-center text-[10px] leading-none text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--mark)] disabled:opacity-30"
              onClick={() => step(1)}
            >
              ▲
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label={`Decrease ${label}`}
              disabled={atMin}
              className="flex flex-1 items-center justify-center border-t border-[var(--line)] text-[10px] leading-none text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--mark)] disabled:opacity-30"
              onClick={() => step(-1)}
            >
              ▼
            </button>
          </span>
        )}
      </span>
    </label>
  );
}

export function Explore() {
  const navigate = useNavigate();
  const location = useLocation();
  const seed = (location.state as ExploreLocationState | null) ?? null;

  const [room, setRoom] = useState("1");
  const [wall, setWall] = useState(() =>
    seed?.wall != null ? String(seed.wall) : "1"
  );
  const [shelf, setShelf] = useState(() =>
    seed?.shelf != null ? String(seed.shelf) : "1"
  );
  const [book, setBook] = useState(() =>
    seed?.book != null ? String(seed.book) : "1"
  );
  const [page, setPage] = useState(() =>
    seed?.page != null ? String(seed.page) : "1"
  );
  const [seeded, setSeeded] = useState(Boolean(seed?.roomKey));
  /** Full room for submit — never put megabyte strings into React state. */
  const fullRoomRef = useRef<string | null>(null);
  const [roomLocked, setRoomLocked] = useState(false);
  /** Bumped when fullRoomRef is filled so memos recompute. */
  const [roomEpoch, setRoomEpoch] = useState(0);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks());
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // Seed from reader using compact roomKey only (resolve full room into a ref).
  useEffect(() => {
    if (!seed?.roomKey) return;
    let cancelled = false;
    setSeeded(true);
    setWall(String(seed.wall ?? 1));
    setShelf(String(seed.shelf ?? 1));
    setBook(String(seed.book ?? 1));
    setPage(String(seed.page ?? 1));
    setRoom(seed.roomKey);
    resolveRoom(seed.roomKey)
      .then((full) => {
        if (cancelled) return;
        if (full.length <= ROOM_INPUT_MAX) {
          fullRoomRef.current = null;
          setRoomLocked(false);
          setRoom(full);
        } else {
          fullRoomRef.current = full;
          setRoomLocked(true);
          setRoom(seed.roomKey!);
        }
        setRoomEpoch((n) => n + 1);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [seed?.roomKey, seed?.wall, seed?.shelf, seed?.book, seed?.page]);

  // Compact legacy bookmarks that stored megabyte room strings (fixes hover jank).
  useEffect(() => {
    let cancelled = false;
    migrateBookmarks()
      .then((list) => {
        if (!cancelled) setBookmarks(list);
      })
      .catch(() => {
        /* keep sync list */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const roomDisplay = roomLocked
    ? room.startsWith("@")
      ? room
      : shortenRoom(room)
    : room;

  const resolvedRoom = (): string | null => {
    if (fullRoomRef.current) return fullRoomRef.current;
    const roomString = normalizeRoomString(sanitizeRoom(room));
    if (!roomString || roomString === "0" || !/^[0-9a-v]+$/.test(roomString)) {
      return null;
    }
    return roomString;
  };

  const currentFields = useMemo(() => {
    try {
      const roomString = fullRoomRef.current
        ? fullRoomRef.current
        : normalizeRoomString(sanitizeRoom(room));
      if (
        !roomString ||
        roomString === "0" ||
        (roomString.startsWith("@") ? false : !/^[0-9a-v]+$/.test(roomString))
      ) {
        // Still resolving a hashed room
        if (room.startsWith("@") && !fullRoomRef.current) return null;
        if (!roomString || roomString === "0" || !/^[0-9a-v]+$/.test(roomString)) {
          return null;
        }
      }
      const w = parseIntInRange(wall === "" ? "1" : wall, 1, WALLS, "Wall");
      const s = parseIntInRange(shelf === "" ? "1" : shelf, 1, SHELVES, "Shelf");
      const b = parseIntInRange(book === "" ? "1" : book, 1, BOOKS, "Book");
      const p = parseIntInRange(page === "" ? "1" : page, 1, PAGES, "Page");
      assertBounds(w, s, b, p);
      const finalRoom = fullRoomRef.current ?? roomString;
      if (!finalRoom || finalRoom.startsWith("@")) return null;
      return { room: finalRoom, wall: w, shelf: s, book: b, page: p };
    } catch {
      return null;
    }
  }, [room, wall, shelf, book, page, roomLocked, seeded, roomEpoch]);

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (roomLocked && fullRoomRef.current) {
      // ok
    } else if (room.startsWith("@") && !fullRoomRef.current) {
      issues.push("Resolving room…");
    } else {
      const roomNorm = normalizeRoomString(room || "0");
      if (!room || !/^[0-9a-v]+$/i.test(roomNorm) || roomNorm === "0") {
        issues.push("Room must be a base-32 id ([0-9a-v], ≥ 1)");
      }
    }
    const nums: [string, number, number, string][] = [
      [wall, 1, WALLS, "Wall"],
      [shelf, 1, SHELVES, "Shelf"],
      [book, 1, BOOKS, "Book"],
      [page, 1, PAGES, "Page"],
    ];
    for (const [value, min, max, label] of nums) {
      const n = Number(value);
      if (value === "" || !Number.isInteger(n) || n < min || n > max) {
        issues.push(`${label} must be ${min}–${max}`);
      }
    }
    return issues;
  }, [room, wall, shelf, book, page]);

  const formInvalid = validation.length > 0;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);

    // Snap empties to mins before validate
    const nextWall = wall === "" ? "1" : wall;
    const nextShelf = shelf === "" ? "1" : shelf;
    const nextBook = book === "" ? "1" : book;
    const nextPage = page === "" ? "1" : page;
    setWall(nextWall);
    setShelf(nextShelf);
    setBook(nextBook);
    setPage(nextPage);

    try {
      const roomString = resolvedRoom();
      if (!roomString) {
        throw new Error("Room must be a base-32 id ([0-9a-v], ≥ 1)");
      }
      const w = parseIntInRange(nextWall, 1, WALLS, "Wall");
      const s = parseIntInRange(nextShelf, 1, SHELVES, "Shelf");
      const b = parseIntInRange(nextBook, 1, BOOKS, "Book");
      const p = parseIntInRange(nextPage, 1, PAGES, "Page");
      assertBounds(w, s, b, p);
      const roomKey = await ensureRoomKey(roomString);
      navigate(
        bookPath({
          roomKey,
          wall: w,
          shelf: s,
          book: b,
          page: p,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid coordinates");
    }
  };

  const onExport = async () => {
    try {
      const current = currentFields
        ? await toCoordinateExport(
            currentFields.room,
            currentFields.wall,
            currentFields.shelf,
            currentFields.book,
            currentFields.page
          )
        : null;
      const json = await exportLibraryJson(current);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = current ? "library-coordinate.json" : "library-bookmarks.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  const onImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const { bookmarks: next, current } = await importBookmarksJson(text);
      setBookmarks(next);
      if (current) {
        // Full room is ephemeral: hold in a ref for submit, show slug in the input.
        if (current.room.length > ROOM_INPUT_MAX) {
          fullRoomRef.current = current.room;
          setRoomLocked(true);
          setRoom(current.roomKey);
        } else {
          fullRoomRef.current = null;
          setRoomLocked(false);
          setRoom(current.room);
        }
        setRoomEpoch((n) => n + 1);
        setWall(String(current.wall));
        setShelf(String(current.shelf));
        setBook(String(current.book));
        setPage(String(current.page));
        setSeeded(true);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-5xl">Explore</h1>
        <img
          src="/art/explore-shelves.jpg"
          alt="Charcoal library shelves"
          className="charcoal-art charcoal-art--banner"
        />
        <p className="max-w-xl font-serif text-lg text-[var(--muted)]">
          Enter coordinates within the hexagon — walls 1–{WALLS} are the shelved
          sides (two sides stay open). Invalid characters are stripped as you
          type.
          {seeded && (
            <span className="mt-2 block font-mono text-sm text-[var(--mark)]">
              Loaded from the page you were reading.
            </span>
          )}
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-5" noValidate>
        <CoordField
          label="Room"
          hint={roomLocked ? "from reader · locked" : "base-32 · [0-9a-v]"}
          value={roomDisplay}
          inputMode="text"
          maxLength={ROOM_INPUT_MAX}
          readOnly={roomLocked}
          invalid={touched && (!room || room === "0")}
          onChange={(v) => {
            if (roomLocked) return;
            setRoom(sanitizeRoom(v));
          }}
          onBlur={() => {
            if (!room) setRoom("1");
          }}
        />
        <CoordField
          label="Wall"
          hint={`1–${WALLS}`}
          value={wall}
          min={1}
          max={WALLS}
          invalid={touched && (wall === "" || Number(wall) < 1 || Number(wall) > WALLS)}
          onChange={(v) => setWall(sanitizeIntField(v, 1, WALLS))}
          onBlur={() => {
            if (wall === "") setWall("1");
          }}
        />
        <CoordField
          label="Shelf"
          hint={`1–${SHELVES}`}
          value={shelf}
          min={1}
          max={SHELVES}
          invalid={touched && (shelf === "" || Number(shelf) < 1 || Number(shelf) > SHELVES)}
          onChange={(v) => setShelf(sanitizeIntField(v, 1, SHELVES))}
          onBlur={() => {
            if (shelf === "") setShelf("1");
          }}
        />
        <CoordField
          label="Book"
          hint={`1–${BOOKS}`}
          value={book}
          min={1}
          max={BOOKS}
          invalid={touched && (book === "" || Number(book) < 1 || Number(book) > BOOKS)}
          onChange={(v) => setBook(sanitizeIntField(v, 1, BOOKS))}
          onBlur={() => {
            if (book === "") setBook("1");
          }}
        />
        <CoordField
          label="Page"
          hint={`1–${PAGES}`}
          value={page}
          min={1}
          max={PAGES}
          invalid={touched && (page === "" || Number(page) < 1 || Number(page) > PAGES)}
          onChange={(v) => setPage(sanitizeIntField(v, 1, PAGES))}
          onBlur={() => {
            if (page === "") setPage("1");
          }}
        />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-5">
          <Button type="submit" disabled={formInvalid}>
            Open volume
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!currentFields}
            onClick={() => void onExport()}
          >
            Export JSON
          </Button>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--dim)]">
            Wall 1–{WALLS} · Shelf 1–{SHELVES} · Book 1–{BOOKS} · Page 1–{PAGES}
          </p>
        </div>
      </form>
      {(error || (touched && formInvalid)) && (
        <p className="font-mono text-xs text-red-400">
          {error ?? validation[0]}
        </p>
      )}

      <section className="space-y-3 border-t border-[var(--line)] pt-8">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Bookmarks
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!currentFields && bookmarks.length === 0}
            onClick={() => void onExport()}
          >
            Export JSON
          </Button>
          <label className="inline-flex h-8 cursor-pointer items-center border border-[var(--line)] px-3 font-mono text-xs hover:border-[var(--mark)]">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => void onImport(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {bookmarks.length === 0 ? (
          <p className="font-mono text-xs text-[var(--dim)]">No bookmarks yet.</p>
        ) : (
          <ul className="space-y-2 font-mono text-xs">
            {bookmarks.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className="max-w-full truncate text-left text-[var(--muted)] hover:text-[var(--mark)]"
                  title={b.label}
                  onClick={() => {
                    navigate(
                      bookPath({
                        roomKey: b.roomKey,
                        wall: b.wall,
                        shelf: b.shelf,
                        book: b.book,
                        page: b.page,
                      })
                    );
                  }}
                >
                  {b.label || bookmarkLabel(b)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
