import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLibraryEngine } from "@/hooks/useLibraryEngine";
import { bookPathFromIdentifier } from "@/lib/routes";

type Mode = "empty" | "emptybook" | "chars" | "space";

const modes: { id: Mode; label: string; hint: string }[] = [
  { id: "empty", label: "Empty page", hint: "Query on a random page; rest noise" },
  { id: "emptybook", label: "Empty book", hint: "Query at the start; rest spaces" },
  { id: "chars", label: "Random chars", hint: "Query at a random offset" },
  { id: "space", label: "Space pad", hint: "Deterministic discovery pad" },
];

export function Search() {
  const navigate = useNavigate();
  const { ready, search } = useLibraryEngine();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("empty");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const q = query.trim().toLowerCase();
      const result = await search(q, mode);
      navigate(await bookPathFromIdentifier(result.identifier), {
        state: { searchQuery: q },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-start">
        <img
          src="/art/search-scribe.jpg"
          alt="Charcoal scribe"
          className="charcoal-art"
        />
        <div className="space-y-3">
          <h1 className="font-[family-name:var(--font-display)] text-5xl">Search</h1>
          <p className="font-serif text-lg text-[var(--muted)]">
            Search does not scan the library. It constructs a book that contains
            your text, then finds the unique coordinate for that book.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="what you hope to find"
          rows={5}
        />
        <fieldset className="grid gap-2 sm:grid-cols-2">
          {modes.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer gap-3 border border-[var(--line)] p-3 hover:border-[var(--mark)]"
            >
              <input
                type="radio"
                name="mode"
                checked={mode === m.id}
                onChange={() => setMode(m.id)}
                className="mt-1"
              />
              <span>
                <span className="block font-mono text-xs uppercase tracking-wider">
                  {m.label}
                </span>
                <span className="text-sm text-[var(--muted)]">{m.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={!ready || busy || !query.trim()}>
          {busy ? "Working…" : "Find a volume"}
        </Button>
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      </form>
    </div>
  );
}
