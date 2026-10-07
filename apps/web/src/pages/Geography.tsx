import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BASE32_ALPHA,
  babelRoomToPhysicalLocation,
  formatBearing,
  formatCompactBigInt,
  formatLibraryDistance,
  formatNearbyAscii,
  formatPhysicalLocation,
  formatTechnicalCoordinates,
  euclideanMeters,
  move,
  nearbyMap,
  normalizeRoomString,
  parseBase32,
  physicalLocationToBabelRoom,
  physicalLocationToRoomIndex,
  randomBigIntBelow,
  roomDistanceFromOrigin,
  roomIndexToPhysicalLocation,
  roomToBase32,
  shortenRoom,
  type PhysicalDirection,
  type PhysicalLocation,
} from "@the-library/core";
import { GeographyAbout } from "@/components/GeographyAbout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLibraryEngine } from "@/hooks/useLibraryEngine";
import type { GeographyLocationState } from "@/lib/geographyNav";
import { bookPath } from "@/lib/routes";
import { ensureRoomKey, resolveRoom } from "@/lib/rooms";
import type { GeographySnapshot } from "@/workers/library.worker";

/** Manual Jump fields / sync BigInt path. Larger rooms use the GMP worker. */
const INPUT_DIGIT_CAP = 256;
/** Uniform random geo index bound — vast, but short enough for UI fields. */
const RANDOM_GEO_MAX = 10n ** 36n;
const ROOM_CHAR_RE = new RegExp(`[^${BASE32_ALPHA}]`, "gi");

const HORIZONTAL: PhysicalDirection[] = ["NW", "N", "NE", "SW", "S", "SE"];

function sanitizeBase32(raw: string): string {
  return raw.toLowerCase().replace(ROOM_CHAR_RE, "").slice(0, INPUT_DIGIT_CAP);
}

function sanitizeDecimal(raw: string): string {
  return raw.replace(/[^\d]/g, "").slice(0, INPUT_DIGIT_CAP);
}

function formatSignedLevel(level: bigint): string {
  if (level > 0n) return `+${formatCompactBigInt(level)}`;
  return formatCompactBigInt(level);
}

function Disclosure({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="group border border-[var(--line)] bg-[var(--paper)] open:bg-[var(--panel)]">
      <summary className="cursor-pointer list-none px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] marker:content-none hover:text-[var(--mark)] [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <span>{title}</span>
          <span className="text-[var(--dim)] transition-transform group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-[var(--line)] px-4 py-4">
        {children}
      </div>
    </details>
  );
}

export function Geography() {
  const navigate = useNavigate();
  const route = useLocation();
  const seed = (route.state as GeographyLocationState | null) ?? null;
  const {
    ready: engineReady,
    error: engineError,
    geographySeed,
    geographyMove,
    geographyReset,
    geographyGetRoom,
  } = useLibraryEngine();

  const [location, setLocation] = useState<PhysicalLocation>(() =>
    roomIndexToPhysicalLocation(0n)
  );
  /** GMP session snapshot for book-scale rooms (compact fields only). */
  const [largeSnap, setLargeSnap] = useState<GeographySnapshot | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(Boolean(seed?.roomKey));
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [jumpMode, setJumpMode] = useState<"babel" | "geo">("babel");
  const [babelRoom, setBabelRoom] = useState("1");
  const [geoIndex, setGeoIndex] = useState("0");

  const largeMode = largeSnap != null;

  const shell = largeMode
    ? null
    : roomDistanceFromOrigin(location);
  const babel = largeMode ? null : physicalLocationToBabelRoom(location);
  const babelStr = largeMode
    ? largeSnap.babelRoomShort
    : roomToBase32(babel!);
  const geo = largeMode ? null : physicalLocationToRoomIndex(location);
  const bearing = largeMode
    ? largeSnap.bearing
    : formatBearing(location);
  const euc = largeMode ? null : euclideanMeters(location);
  const neighbors = useMemo(
    () => (largeMode ? null : nearbyMap(location)),
    [location, largeMode]
  );

  function applySyncLocation(next: PhysicalLocation) {
    setLargeSnap(null);
    setLocation(next);
    const nextGeo = physicalLocationToRoomIndex(next);
    const nextBabel = physicalLocationToBabelRoom(next);
    setGeoIndex(nextGeo.toString());
    setBabelRoom(roomToBase32(nextBabel));
    setError(null);
  }

  function applyLargeSnap(snap: GeographySnapshot) {
    setLargeSnap(snap);
    // Never put megabyte room ids into controlled inputs.
    setBabelRoom("");
    setGeoIndex("");
    setError(null);
  }

  // Seed from Explore / Reader when they pass a roomKey in location.state.
  useEffect(() => {
    const key = seed?.roomKey;
    if (!key) {
      setSeeding(false);
      return;
    }
    let cancelled = false;
    setSeeding(true);
    setError(null);

    (async () => {
      try {
        const full = await resolveRoom(key);
        if (cancelled) return;
        const norm = normalizeRoomString(full);
        if (norm.length <= INPUT_DIGIT_CAP) {
          const room = parseBase32(norm);
          if (room < 1n) throw new Error("Babel room must be ≥ 1");
          applySyncLocation(babelRoomToPhysicalLocation(room));
          setSeeding(false);
          return;
        }
        // Book-scale room: GMP worker (Safari-safe, no megabyte React state).
        if (!engineReady) {
          // Wait for engine — effect re-runs when ready flips.
          return;
        }
        const snap = await geographySeed(norm);
        if (cancelled) return;
        applyLargeSnap(snap);
        setSeeding(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load room");
          setSeeding(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [seed?.roomKey, engineReady, geographySeed]);

  async function step(dir: PhysicalDirection) {
    if (busy) return;
    if (largeMode) {
      setBusy(true);
      setError(null);
      try {
        const snap = await geographyMove(dir);
        applyLargeSnap(snap);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Move failed");
      } finally {
        setBusy(false);
      }
      return;
    }
    applySyncLocation(move(location, dir));
  }

  async function resetToEntrance() {
    if (largeMode && engineReady) {
      setBusy(true);
      try {
        await geographyReset();
      } catch {
        /* session reset best-effort; UI returns to Entrance either way */
      } finally {
        setBusy(false);
      }
    }
    applySyncLocation(roomIndexToPhysicalLocation(0n));
  }

  async function openVolume() {
    setOpening(true);
    setError(null);
    try {
      const roomString = largeMode
        ? await geographyGetRoom()
        : roomToBase32(physicalLocationToBabelRoom(location));
      const roomKey = await ensureRoomKey(roomString);
      navigate(
        bookPath({
          roomKey,
          wall: 1,
          shelf: 1,
          book: 1,
          page: 1,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open volume");
      setOpening(false);
    }
  }

  function onJump(e: FormEvent) {
    e.preventDefault();
    try {
      if (jumpMode === "babel") {
        const roomStr = normalizeRoomString(babelRoom);
        if (!roomStr) throw new Error("Enter a Babel room (base-32)");
        if (roomStr.length > INPUT_DIGIT_CAP) {
          throw new Error(
            `Paste rooms up to ${INPUT_DIGIT_CAP} digits here. Open a large room from Explore or the Reader — Geography will locate it via the engine.`
          );
        }
        const room = parseBase32(roomStr);
        if (room < 1n) throw new Error("Babel room must be ≥ 1");
        applySyncLocation(babelRoomToPhysicalLocation(room));
      } else {
        const digits = geoIndex.replace(/^0+(?=\d)/, "") || "0";
        if (digits.length > INPUT_DIGIT_CAP) {
          throw new Error(`Index limited to ${INPUT_DIGIT_CAP} digits`);
        }
        applySyncLocation(roomIndexToPhysicalLocation(BigInt(digits)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function jumpToRandom() {
    try {
      const geoN = randomBigIntBelow(RANDOM_GEO_MAX);
      applySyncLocation(roomIndexToPhysicalLocation(geoN));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Random jump failed");
    }
  }

  const levelDisplay = largeMode
    ? largeSnap.levelCompact
    : formatSignedLevel(location.level);
  const shellDisplay = largeMode
    ? largeSnap.shellCompact
    : formatCompactBigInt(shell!);
  const shellIsOne = !largeMode && shell === 1n;
  const geoDisplay = largeMode
    ? largeSnap.geoCompact
    : formatCompactBigInt(geo!);
  const distLabel = largeMode
    ? largeSnap.physicalDistanceLabel
    : euc != null
      ? formatLibraryDistance(euc)
      : null;

  return (
    <article className="mx-auto max-w-4xl space-y-10">
      <header className="space-y-4">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--dim)]">
          Place
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-5xl">
          Geography
        </h1>
        <p className="max-w-xl font-serif text-lg leading-relaxed text-[var(--muted)]">
          Walk the infinite hexagonal Library from the Entrance. Every step is a
          real room — open a volume when you arrive.
        </p>
      </header>

      <section className="space-y-6 border border-[var(--line)] bg-[var(--paper)] p-6 sm:p-8">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--mark)]">
            You are here
          </p>
          <p className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
            Level {levelDisplay}
          </p>
          <p className="font-serif text-lg text-[var(--muted)]">
            {shellDisplay} {shellIsOne ? "room" : "rooms"} from the Entrance
            {bearing ? (
              <span className="text-[var(--dim)]"> · bearing {bearing}</span>
            ) : null}
          </p>
          {distLabel ? (
            <p className="font-mono text-xs uppercase tracking-wider text-[var(--dim)]">
              ≈ {distLabel}
            </p>
          ) : null}
          <p className="font-mono text-xs text-[var(--dim)]">
            Babel room{" "}
            <span className="text-[var(--muted)]">
              {largeMode ? largeSnap.babelRoomShort : shortenRoom(babelStr)}
            </span>
            <span className="mx-2 text-[var(--line)]">·</span>
            Geo {geoDisplay}
          </p>
          {largeMode ? (
            <p className="font-mono text-[10px] text-[var(--dim)]">
              {largeSnap.exact
                ? "Large room — exact place via the library engine (compact display)."
                : "Book-scale room — shell distance estimated (exact hex unrank is deferred). Open the volume or reset to walk."}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--dim)]">
            Move
          </p>
          <div className="mx-auto grid max-w-[16rem] grid-cols-3 gap-2">
            {HORIZONTAL.map((d) => (
              <Button
                key={d}
                type="button"
                variant="outline"
                size="sm"
                className="font-mono"
                disabled={busy || seeding || (largeMode && !largeSnap.exact)}
                onClick={() => void step(d)}
              >
                {d}
              </Button>
            ))}
          </div>
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-[5rem] font-mono"
              disabled={busy || seeding || (largeMode && !largeSnap.exact)}
              onClick={() => void step("UP")}
            >
              UP
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-[5rem] font-mono"
              disabled={busy || seeding || (largeMode && !largeSnap.exact)}
              onClick={() => void step("DOWN")}
            >
              DOWN
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-[var(--line)] pt-6">
          <Button
            type="button"
            variant="outline"
            disabled={busy || seeding}
            onClick={() => void resetToEntrance()}
          >
            Reset to Entrance
          </Button>
          <Button
            type="button"
            variant="mark"
            disabled={opening || seeding}
            onClick={() => void openVolume()}
          >
            {opening ? "Opening…" : "Open volume in this room"}
          </Button>
        </div>
        {seeding ? (
          <p className="font-mono text-xs text-[var(--dim)]">
            Locating this room…
            {!engineReady
              ? " (starting engine)"
              : " (book-scale ids can take a moment)"}
          </p>
        ) : null}
        {engineError ? (
          <p className="font-mono text-xs text-red-500">{engineError}</p>
        ) : null}
        {error ? (
          <p className="font-mono text-xs text-red-500">{error}</p>
        ) : null}
      </section>

      <GeographyAbout />

      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--dim)]">
          Details
        </p>

        <Disclosure title="Neighbors">
          {largeMode ? (
            <p className="font-mono text-[11px] text-[var(--muted)]">
              Neighbor index list is omitted for book-scale rooms (use the move
              buttons above). Technical Q/R stay available below.
            </p>
          ) : (
            <>
              <pre className="overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed text-[var(--fg)]">
                {formatNearbyAscii(location)}
              </pre>
              <ul className="grid gap-1 font-mono text-[11px] text-[var(--muted)] sm:grid-cols-2">
                {neighbors!.neighbors.map((n) => (
                  <li key={n.direction}>
                    <button
                      type="button"
                      className="hover:text-[var(--mark)]"
                      onClick={() => applySyncLocation(n.location)}
                    >
                      {n.direction} → geo {formatCompactBigInt(n.geoIndex)}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Disclosure>

        <Disclosure title="From the Entrance">
          {largeMode ? (
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--fg)]">
              {[
                "FROM THE ENTRANCE",
                "",
                "DISTANCE",
                `${largeSnap.shellCompact} ROOMS`,
                "",
                "LEVEL",
                largeSnap.levelCompact,
                ...(largeSnap.bearing
                  ? ["", "BEARING", largeSnap.bearing]
                  : []),
                ...(largeSnap.physicalDistanceLabel
                  ? ["", "PHYSICAL DISTANCE", largeSnap.physicalDistanceLabel]
                  : []),
              ].join("\n")}
            </pre>
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--fg)]">
              {formatPhysicalLocation(location)}
            </pre>
          )}
        </Disclosure>

        <Disclosure title="Technical coordinates">
          {largeMode ? (
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--fg)]">
              {[
                "Q",
                largeSnap.qCompact,
                "",
                "R",
                largeSnap.rCompact,
                "",
                "LEVEL",
                largeSnap.levelCompact,
              ].join("\n")}
            </pre>
          ) : (
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--fg)]">
              {formatTechnicalCoordinates(location)}
            </pre>
          )}
          <p className="font-mono text-[10px] text-[var(--dim)]">
            Exact axial hex (q, r) and level. Huge values are compacted.
          </p>
        </Disclosure>

        <Disclosure title="Jump to a place">
          <form onSubmit={onJump} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={jumpMode === "babel" ? "default" : "outline"}
                size="sm"
                onClick={() => setJumpMode("babel")}
              >
                Babel room
              </Button>
              <Button
                type="button"
                variant={jumpMode === "geo" ? "default" : "outline"}
                size="sm"
                onClick={() => setJumpMode("geo")}
              >
                Geo index
              </Button>
            </div>
            {jumpMode === "babel" ? (
              <label className="block space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--dim)]">
                  Room (base-32, ≤{INPUT_DIGIT_CAP} digits)
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
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--dim)]">
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
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm">
                Locate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={jumpToRandom}
              >
                Jump to random
              </Button>
            </div>
            <p className="font-mono text-[10px] text-[var(--dim)]">
              Random picks a crypto-uniform geography index out to 10³⁶. Search
              rooms with million-digit ids locate automatically when opened from
              Explore or the Reader.
            </p>
          </form>
        </Disclosure>
      </div>

      <p className="font-mono text-[10px] text-[var(--dim)]">
        Mathematical addresses stay on{" "}
        <Link to="/explore" className="text-[var(--muted)] hover:text-[var(--mark)]">
          Explore
        </Link>
        . Low-level debug remains at{" "}
        <Link
          to="/dev/geography"
          className="text-[var(--muted)] hover:text-[var(--mark)]"
        >
          /dev/geography
        </Link>
        .
      </p>
    </article>
  );
}
