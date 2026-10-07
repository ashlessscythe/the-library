import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { MoveDirection, PageContent } from "@the-library/core";
import { PAGES, shortenRoom } from "@the-library/core";
import { Trackball } from "@/components/Trackball";
import { Button } from "@/components/ui/button";
import { useLibraryEngine } from "@/hooks/useLibraryEngine";
import { useTravelKeys } from "@/hooks/useTravelKeys";
import { addBookmark } from "@/lib/bookmarks";
import { formatPageNodes } from "@/lib/highlight";
import {
  bookPathFromIdentifier,
  resolveIdentifierFromParams,
} from "@/lib/routes";

export type ReaderLocationState = {
  searchQuery?: string;
};

export function Reader() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const searchState = (location.state as ReaderLocationState | null) ?? null;
  const searchQuery = searchState?.searchQuery?.trim() || null;

  const { ready, error: engineError, generatePage, move } = useLibraryEngine();
  const [identifier, setIdentifier] = useState<string | null>(null);
  const [page, setPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hudKey, setHudKey] = useState(0);
  const [busyMove, setBusyMove] = useState(false);
  const [highlightSearch, setHighlightSearch] = useState(Boolean(searchQuery));

  // Keep toggle available when arriving from search; reset if query changes.
  useEffect(() => {
    setHighlightSearch(Boolean(searchQuery));
  }, [searchQuery]);

  // Resolve @hash → full room, then generate
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIdentifier(null);
    setPage(null);

    resolveIdentifierFromParams(params)
      .then((id) => {
        if (!cancelled) setIdentifier(id);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.room, params.wall, params.shelf, params.book, params.page]);

  useEffect(() => {
    if (!ready || !identifier) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    generatePage(identifier)
      .then((result) => {
        if (!cancelled) {
          setPage(result);
          setHudKey((k) => k + 1);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, identifier, generatePage]);

  const onMove = useCallback(
    async (direction: MoveDirection) => {
      if (busyMove || !ready || !identifier) return;
      setBusyMove(true);
      try {
        const next = await move(identifier, direction);
        // Preserve search highlight state across lattice travel.
        navigate(await bookPathFromIdentifier(next), {
          state: searchQuery ? { searchQuery } : undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Move failed");
      } finally {
        setBusyMove(false);
      }
    },
    [busyMove, ready, move, identifier, navigate, searchQuery]
  );

  useTravelKeys(ready && !loading && !!identifier, onMove);

  const roomShort = page ? shortenRoom(page.room) : "…";

  let pageNodes: ReactNode = null;
  if (page) {
    pageNodes = formatPageNodes(
      page.content,
      highlightSearch && searchQuery ? searchQuery : null
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_13rem] md:gap-8 md:items-start">
      <div className="reader-stage order-1 min-w-0 space-y-6">
        <div
          key={hudKey}
          className="hud-animate flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--line)] pb-4"
        >
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span className="text-[var(--mark)]">{roomShort}</span>
            <span className="text-[var(--dim)]"> · </span>
            W{page?.wall ?? "—"}
            <span className="text-[var(--dim)]"> · </span>
            S{page?.shelf ?? "—"}
            <span className="text-[var(--dim)]"> · </span>
            B{page?.book ?? "—"}
            <span className="text-[var(--dim)]"> · </span>
            P{page?.page ?? "—"}
          </div>
          <div className="flex flex-wrap gap-2">
            {searchQuery && (
              <label className="inline-flex h-8 cursor-pointer items-center gap-2 border border-[var(--line)] px-3 font-mono text-xs text-[var(--muted)] hover:border-[var(--mark)]">
                <input
                  type="checkbox"
                  className="accent-[var(--mark)]"
                  checked={highlightSearch}
                  onChange={(e) => setHighlightSearch(e.target.checked)}
                />
                Highlight search
              </label>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!identifier}
              onClick={() => {
                if (!identifier) return;
                void addBookmark(identifier);
              }}
            >
              Bookmark
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link
                to="/explore"
                state={
                  params.room
                    ? {
                        roomKey: decodeURIComponent(params.room),
                        wall: Number(params.wall ?? 1),
                        shelf: Number(params.shelf ?? 1),
                        book: Number(params.book ?? 1),
                        page: Number(params.page ?? 1),
                      }
                    : undefined
                }
              >
                Coordinates
              </Link>
            </Button>
          </div>
        </div>

        {(engineError || error) && (
          <p className="font-mono text-xs text-red-400">{engineError ?? error}</p>
        )}

        {loading || !page ? (
          <p className="font-mono text-sm text-[var(--dim)]">Opening the volume…</p>
        ) : (
          <>
            <pre className="page-lines w-full border border-[var(--line)] bg-[var(--paper)] p-4 text-[var(--fg)] sm:p-5">
              {pageNodes}
            </pre>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onMove("pagePrev")}
              >
                ← Previous
              </Button>
              <label className="flex items-center gap-2 font-mono text-xs text-[var(--muted)]">
                Page
                <select
                  className="h-8 border border-[var(--line)] bg-[var(--panel)] px-2"
                  value={page.page}
                  onChange={async (e) => {
                    if (!identifier) return;
                    const next = identifier.replace(/\.\d+$/, `.${e.target.value}`);
                    navigate(await bookPathFromIdentifier(next), {
                      state: searchQuery ? { searchQuery } : undefined,
                    });
                  }}
                >
                  {Array.from({ length: PAGES }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onMove("pageNext")}
              >
                Next →
              </Button>
            </div>
          </>
        )}
      </div>

      <aside className="order-2 flex justify-center md:sticky md:top-8 md:justify-start md:self-start">
        <Trackball onMove={onMove} />
      </aside>
    </div>
  );
}
