import { useMemo, useState, type FormEvent } from "react";
import {
  BASE32_ALPHA,
  babelRoomToPhysicalLocation,
  formatCompactBigInt,
  formatNearbyAscii,
  formatPhysicalLocation,
  formatTechnicalCoordinates,
  move,
  normalizeRoomString,
  parseBase32,
  physicalLocationToBabelRoom,
  physicalLocationToRoomIndex,
  roomDistanceFromOrigin,
  roomIndexToPhysicalLocation,
  type PhysicalDirection,
  type PhysicalLocation,
} from "@the-library/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Cap pasted room / index digits so the tab cannot freeze. */
const INPUT_DIGIT_CAP = 256;

const ROOM_CHAR_RE = new RegExp(`[^${BASE32_ALPHA}]`, "gi");

const HORIZONTAL: PhysicalDirection[] = ["N", "NE", "SE", "S", "SW", "NW"];

type Mode = "babel" | "geo";

function sanitizeBase32(raw: string): string {
  return raw.toLowerCase().replace(ROOM_CHAR_RE, "").slice(0, INPUT_DIGIT_CAP);
}

function sanitizeDecimal(raw: string): string {
  return raw.replace(/[^\d]/g, "").slice(0, INPUT_DIGIT_CAP);
}

export function DevGeography() {
  const [mode, setMode] = useState<Mode>("babel");
  const [babelRoom, setBabelRoom] = useState("1");
  const [geoIndex, setGeoIndex] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<PhysicalLocation>(() =>
    roomIndexToPhysicalLocation(0n)
  );
  const [showTechnical, setShowTechnical] = useState(false);

  function applyLocation(next: PhysicalLocation) {
    setLocation(next);
    const geo = physicalLocationToRoomIndex(next);
    const babel = physicalLocationToBabelRoom(next);
    setGeoIndex(geo.toString());
    setBabelRoom(babel.toString(32));
    setError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      if (mode === "babel") {
        const roomStr = normalizeRoomString(babelRoom);
        if (!roomStr) throw new Error("Enter a Babel room (base-32)");
        if (roomStr.length > INPUT_DIGIT_CAP) {
          throw new Error(`Room limited to ${INPUT_DIGIT_CAP} base-32 digits`);
        }
        const room = parseBase32(roomStr);
        if (room < 1n) throw new Error("Babel room must be ≥ 1");
        applyLocation(babelRoomToPhysicalLocation(room));
      } else {
        const digits = geoIndex.replace(/^0+(?=\d)/, "") || "0";
        if (digits.length > INPUT_DIGIT_CAP) {
          throw new Error(`Index limited to ${INPUT_DIGIT_CAP} digits`);
        }
        applyLocation(roomIndexToPhysicalLocation(BigInt(digits)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function step(dir: PhysicalDirection) {
    applyLocation(move(location, dir));
  }

  const ascii = useMemo(() => formatNearbyAscii(location), [location]);
  const summary = useMemo(() => formatPhysicalLocation(location), [location]);
  const technical = useMemo(
    () => formatTechnicalCoordinates(location),
    [location]
  );
  const shell = roomDistanceFromOrigin(location);

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--dim)]">
          Developer
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl">
          Physical geography
        </h1>
        <p className="font-serif text-lg text-[var(--muted)]">
          Debug view of hex + level location. Neighbors only — shells are never
          enumerated. Inputs capped at {INPUT_DIGIT_CAP} digits.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={mode === "babel" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("babel")}
          >
            Babel room
          </Button>
          <Button
            type="button"
            variant={mode === "geo" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("geo")}
          >
            Geo index
          </Button>
        </div>

        {mode === "babel" ? (
          <label className="block space-y-1">
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--dim)]">
              Room (base-32)
            </span>
            <Input
              value={babelRoom}
              onChange={(e) => setBabelRoom(sanitizeBase32(e.target.value))}
              spellCheck={false}
              autoComplete="off"
              className="font-mono"
            />
          </label>
        ) : (
          <label className="block space-y-1">
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--dim)]">
              Geography index (decimal)
            </span>
            <Input
              value={geoIndex}
              onChange={(e) => setGeoIndex(sanitizeDecimal(e.target.value))}
              inputMode="numeric"
              spellCheck={false}
              autoComplete="off"
              className="font-mono"
            />
          </label>
        )}

        <Button type="submit">Locate</Button>
        {error ? (
          <p className="font-mono text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
      </form>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--dim)]">
          You are here
        </h2>
        <p className="font-mono text-sm text-[var(--muted)]">
          Shell distance: {formatCompactBigInt(shell)} rooms · Level{" "}
          {location.level > 0n ? "+" : ""}
          {formatCompactBigInt(location.level)}
        </p>
        <pre className="overflow-x-auto whitespace-pre rounded border border-[var(--line)] bg-[var(--panel)] p-4 font-mono text-xs leading-relaxed text-[var(--fg)]">
          {ascii}
        </pre>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--dim)]">
          Move
        </h2>
        <div className="flex flex-wrap gap-2">
          {HORIZONTAL.map((d) => (
            <Button
              key={d}
              type="button"
              variant="outline"
              size="sm"
              className="min-w-[3rem] font-mono"
              onClick={() => step(d)}
            >
              {d}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-mono"
            onClick={() => step("UP")}
          >
            UP
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-mono"
            onClick={() => step("DOWN")}
          >
            DOWN
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-mono text-xs uppercase tracking-wider text-[var(--dim)]">
          From the Entrance
        </h2>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-[var(--line)] bg-[var(--panel)] p-4 font-mono text-xs leading-relaxed text-[var(--fg)]">
          {summary}
        </pre>
        <button
          type="button"
          className={cn(
            "font-mono text-xs uppercase tracking-wider text-[var(--muted)] underline-offset-4 hover:text-[var(--mark)] hover:underline"
          )}
          onClick={() => setShowTechnical((v) => !v)}
        >
          {showTechnical ? "Hide" : "Show"} technical coordinates
        </button>
        {showTechnical ? (
          <pre className="overflow-x-auto whitespace-pre-wrap rounded border border-[var(--line)] bg-[var(--panel)] p-4 font-mono text-xs leading-relaxed text-[var(--fg)]">
            {technical}
          </pre>
        ) : null}
      </section>
    </article>
  );
}
