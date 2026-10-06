import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bookPath } from "@/lib/routes";
import {
  exportBookmarksJson,
  importBookmarksJson,
  loadBookmarks,
  type Bookmark,
} from "@/lib/bookmarks";

export function Explore() {
  const navigate = useNavigate();
  const [room, setRoom] = useState("1");
  const [wall, setWall] = useState("1");
  const [shelf, setShelf] = useState("1");
  const [book, setBook] = useState("1");
  const [page, setPage] = useState("1");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadBookmarks());
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      navigate(
        bookPath({
          roomString: room.toLowerCase(),
          wall: Number(wall),
          shelf: Number(shelf),
          book: Number(book),
          page: Number(page),
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid coordinates");
    }
  };

  const onImport = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      setBookmarks(importBookmarksJson(text));
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
          Enter a room, wall, shelf, book, and page. Rooms are base-32
          ([0-9a-v]).
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-5">
        {(
          [
            ["Room", room, setRoom],
            ["Wall", wall, setWall],
            ["Shelf", shelf, setShelf],
            ["Book", book, setBook],
            ["Page", page, setPage],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--dim)]">
              {label}
            </span>
            <Input value={value} onChange={(e) => set(e.target.value)} />
          </label>
        ))}
        <div className="sm:col-span-5">
          <Button type="submit">Open volume</Button>
        </div>
      </form>
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}

      <section className="space-y-3 border-t border-[var(--line)] pt-8">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Bookmarks
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([exportBookmarksJson()], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "library-bookmarks.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export JSON
          </Button>
          <label className="inline-flex h-8 cursor-pointer items-center border border-[var(--line)] px-3 font-mono text-xs hover:border-[var(--mark)]">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => onImport(e.target.files?.[0] ?? null)}
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
                  className="text-left text-[var(--muted)] hover:text-[var(--mark)]"
                  onClick={() => {
                    const [r, w, s, bk, p] = b.identifier.split(".");
                    navigate(
                      bookPath({
                        roomString: r,
                        wall: Number(w),
                        shelf: Number(s),
                        book: Number(bk),
                        page: Number(p),
                      })
                    );
                  }}
                >
                  {b.label ?? b.identifier}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
