import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLibraryEngine } from "@/hooks/useLibraryEngine";
import { bookPathFromIdentifier } from "@/lib/routes";

export function Home() {
  const navigate = useNavigate();
  const { ready, error, search } = useLibraryEngine();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !ready) return;
    setBusy(true);
    setStatus("Locating a volume…");
    try {
      const q = query.trim().toLowerCase();
      const result = await search(q, "empty");
      navigate(await bookPathFromIdentifier(result.identifier), {
        state: { searchQuery: q },
      });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center gap-10">
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-6xl leading-none tracking-wide text-[var(--fg)] sm:text-7xl md:text-8xl">
          The Library
        </h1>
        <p className="max-w-xl font-serif text-xl text-[var(--muted)] sm:text-2xl">
          Every book that can be written with thirty-two characters already
          exists. Find a page — or wander the hexagons.
        </p>
      </div>

      <form onSubmit={onSubmit} className="max-w-xl space-y-3">
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a sentence to locate…"
          aria-label="Search the library"
          rows={4}
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!ready || busy || !query.trim()}>
            {busy ? "Searching…" : "Search"}
          </Button>
          <Button asChild variant="outline">
            <Link to="/random">Random page</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/explore">Explore</Link>
          </Button>
        </div>
        {(status || error) && (
          <p className="font-mono text-xs text-[var(--muted)]">{error ?? status}</p>
        )}
        {!ready && !error && (
          <p className="font-mono text-xs text-[var(--dim)]">
            Loading the engine…
          </p>
        )}
      </form>
    </section>
  );
}
