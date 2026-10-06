import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { MoveDirection, PageContent } from "@the-library/core";
import { PAGES, shortenRoom } from "@the-library/core";
import { Trackball } from "@/components/Trackball";
import { Button } from "@/components/ui/button";
import { useLibraryEngine } from "@/hooks/useLibraryEngine";
import { useTravelKeys } from "@/hooks/useTravelKeys";
import { addBookmark } from "@/lib/bookmarks";
import {
  bookPathFromIdentifier,
  identifierFromParams,
} from "@/lib/routes";

function formatPageText(content: string): string {
  const lines: string[] = [];
  for (let i = 0; i < content.length; i += 80) {
    lines.push(content.slice(i, i + 80));
  }
  return lines.map((line, idx) => `${String(idx + 1).padStart(2, " ")}  ${line}`).join("\n");
}

export function Reader() {
  const params = useParams();
  const navigate = useNavigate();
  const { ready, error: engineError, generatePage, move } = useLibraryEngine();
  const identifier = useMemo(() => identifierFromParams(params), [params]);
  const [page, setPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hudKey, setHudKey] = useState(0);
  const [busyMove, setBusyMove] = useState(false);

  useEffect(() => {
    if (!ready) return;
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
      if (busyMove || !ready) return;
      setBusyMove(true);
      try {
        const next = await move(identifier, direction);
        navigate(bookPathFromIdentifier(next));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Move failed");
      } finally {
        setBusyMove(false);
      }
    },
    [busyMove, ready, move, identifier, navigate]
  );

  useTravelKeys(ready && !loading, onMove);

  const roomShort = page ? shortenRoom(page.room) : "…";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_11rem]">
      <div className="space-y-6">
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addBookmark(identifier)}
            >
              Bookmark
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/explore">Coordinates</Link>
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
            <pre className="page-lines border border-[var(--line)] bg-[var(--paper)] p-4 text-[var(--fg)]">
              {formatPageText(page.content)}
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
                  onChange={(e) => {
                    const next = identifier.replace(/\.\d+$/, `.${e.target.value}`);
                    navigate(bookPathFromIdentifier(next));
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

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <Trackball onMove={onMove} />
      </aside>
    </div>
  );
}
