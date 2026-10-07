/**
 * About block for /geography — shells, hex walk, wireframe diagrams.
 */

function HexRing({
  cx,
  cy,
  size,
  className,
}: {
  cx: number;
  cy: number;
  size: number;
  className?: string;
}) {
  // Pointy-top regular hexagon vertices
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    return `${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`;
  }).join(" ");
  return <polygon points={pts} className={className} />;
}

/** Concentric hex rings — plan view of shells 0–2. */
function HexShellPlan() {
  const cx = 120;
  const cy = 110;
  const step = 28;
  return (
    <svg
      viewBox="0 0 240 220"
      className="h-auto w-full max-w-sm"
      role="img"
      aria-label="Plan view of hexagonal shells around the Entrance"
    >
      <defs>
        <radialGradient id="geo-plan-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--mark)" stopOpacity="0.18" />
          <stop offset="70%" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={95} fill="url(#geo-plan-glow)" />

      {/* Shell 2, 1, 0 — outer first for paint order */}
      <HexRing
        cx={cx}
        cy={cy}
        size={step * 2.15}
        className="fill-none stroke-[var(--dim)] opacity-35"
      />
      <HexRing
        cx={cx}
        cy={cy}
        size={step * 1.35}
        className="fill-none stroke-[var(--muted)] opacity-55"
      />
      <polygon
        points={Array.from({ length: 6 }, (_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI) / 3;
          const s = step * 0.55;
          return `${cx + s * Math.cos(a)},${cy + s * Math.sin(a)}`;
        }).join(" ")}
        fill="var(--mark)"
        fillOpacity={0.12}
        stroke="var(--mark)"
        strokeWidth={1.25}
      />

      {/* Center mark */}
      <circle cx={cx} cy={cy} r={3.5} className="fill-[var(--mark)]" />

      {/* Direction ticks */}
      {(
        [
          [0, -1, "N"],
          [0.87, -0.5, "NE"],
          [0.87, 0.5, "SE"],
          [0, 1, "S"],
          [-0.87, 0.5, "SW"],
          [-0.87, -0.5, "NW"],
        ] as const
      ).map(([dx, dy, label]) => {
        const x1 = cx + dx * 72;
        const y1 = cy + dy * 72;
        const x2 = cx + dx * 88;
        const y2 = cy + dy * 88;
        const tx = cx + dx * 102;
        const ty = cy + dy * 102;
        return (
          <g key={label}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className="stroke-[var(--dim)]"
              strokeWidth={1}
            />
            <text
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[var(--dim)] font-mono text-[9px]"
            >
              {label}
            </text>
          </g>
        );
      })}

      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        className="fill-[var(--mark)] font-mono text-[8px] uppercase tracking-[0.2em]"
      >
        Entrance
      </text>
      <text
        x={12}
        y={208}
        className="fill-[var(--dim)] font-mono text-[8px] uppercase tracking-wider"
      >
        Plan · shells 0–2
      </text>
    </svg>
  );
}

/** Isometric wireframe cage — hex layers stacked through levels. */
function ShellWireCage() {
  // Isometric projection helpers
  const iso = (q: number, r: number, level: number) => {
    const x = 130 + (q - r) * 18;
    const y = 118 + (q + r) * 10 - level * 22;
    return { x, y };
  };

  const hexPoly = (q: number, r: number, level: number, scale = 1) => {
    const c = iso(q, r, level);
    const s = 14 * scale;
    return Array.from({ length: 6 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      // Flatten slightly for isometric read
      return `${c.x + s * Math.cos(a)},${c.y + s * Math.sin(a) * 0.58}`;
    }).join(" ");
  };

  const rings: { level: number; opacity: number; mark?: boolean }[] = [
    { level: 2, opacity: 0.22 },
    { level: 1, opacity: 0.35 },
    { level: 0, opacity: 0.7, mark: true },
    { level: -1, opacity: 0.35 },
    { level: -2, opacity: 0.22 },
  ];

  // Vertical struts at hex corners of shell-1 ring (simplified: 6 posts)
  const posts = Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    const q = Math.cos(a);
    const r = Math.sin(a) * 0.9;
    return { q, r };
  });

  return (
    <svg
      viewBox="0 0 260 240"
      className="h-auto w-full max-w-sm"
      role="img"
      aria-label="Wireframe of hexagonal rooms stacked through vertical levels"
    >
      <defs>
        <linearGradient id="geo-cage-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--mark)" stopOpacity="0.08" />
          <stop offset="50%" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--mark)" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="260" height="240" fill="url(#geo-cage-fade)" />

      {/* Vertical posts */}
      {posts.map((p, i) => {
        const top = iso(p.q * 1.1, p.r * 1.1, 2.2);
        const bot = iso(p.q * 1.1, p.r * 1.1, -2.2);
        return (
          <line
            key={`post-${i}`}
            x1={top.x}
            y1={top.y}
            x2={bot.x}
            y2={bot.y}
            className="stroke-[var(--dim)]"
            strokeWidth={1}
            strokeOpacity={0.45}
            strokeDasharray="3 4"
          />
        );
      })}

      {/* Level hexes */}
      {rings.map(({ level, opacity, mark }) => (
        <g key={level}>
          <polygon
            points={hexPoly(0, 0, level, 1.55)}
            fill={mark ? "var(--mark)" : "none"}
            fillOpacity={mark ? 0.1 : 0}
            stroke={mark ? "var(--mark)" : "var(--muted)"}
            strokeWidth={mark ? 1.4 : 1}
            strokeOpacity={opacity}
          />
          <polygon
            points={hexPoly(0, 0, level, 0.7)}
            className="fill-none stroke-[var(--dim)]"
            strokeWidth={0.8}
            strokeOpacity={opacity * 0.8}
          />
        </g>
      ))}

      {/* Entrance node */}
      {(() => {
        const c = iso(0, 0, 0);
        return (
          <>
            <circle
              cx={c.x}
              cy={c.y}
              r={4}
              className="fill-[var(--mark)]"
            />
            <text
              x={c.x + 14}
              y={c.y + 3}
              className="fill-[var(--mark)] font-mono text-[8px] uppercase tracking-wider"
            >
              Lv 0
            </text>
          </>
        );
      })()}

      {/* Level labels */}
      <text
        x={22}
        y={48}
        className="fill-[var(--dim)] font-mono text-[8px]"
      >
        +2
      </text>
      <text
        x={22}
        y={118}
        className="fill-[var(--muted)] font-mono text-[8px]"
      >
        0
      </text>
      <text
        x={22}
        y={188}
        className="fill-[var(--dim)] font-mono text-[8px]"
      >
        −2
      </text>

      <text
        x={12}
        y={228}
        className="fill-[var(--dim)] font-mono text-[8px] uppercase tracking-wider"
      >
        Wireframe · levels through a shell
      </text>
    </svg>
  );
}

/** Compact rose of the six walk directions + UP/DOWN. */
function NavRose() {
  return (
    <svg
      viewBox="0 0 200 160"
      className="h-auto w-full max-w-[14rem]"
      role="img"
      aria-label="Navigation rose: six hex directions plus up and down"
    >
      <circle
        cx="100"
        cy="78"
        r="52"
        className="fill-none stroke-[var(--line)]"
        strokeWidth={1}
      />
      <circle
        cx="100"
        cy="78"
        r="18"
        className="fill-[var(--paper)] stroke-[var(--mark)]"
        strokeWidth={1}
      />
      <text
        x="100"
        y="81"
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-[var(--mark)] font-mono text-[8px] uppercase tracking-wider"
      >
        You
      </text>
      {(
        [
          [100, 22, "N"],
          [148, 48, "NE"],
          [148, 108, "SE"],
          [100, 134, "S"],
          [52, 108, "SW"],
          [52, 48, "NW"],
        ] as const
      ).map(([x, y, label]) => (
        <text
          key={label}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-[var(--muted)] font-mono text-[9px]"
        >
          {label}
        </text>
      ))}
      <text
        x="178"
        y="70"
        textAnchor="middle"
        className="fill-[var(--dim)] font-mono text-[8px]"
      >
        UP
      </text>
      <text
        x="178"
        y="90"
        textAnchor="middle"
        className="fill-[var(--dim)] font-mono text-[8px]"
      >
        DN
      </text>
      <line
        x1="162"
        y1="78"
        x2="170"
        y2="78"
        className="stroke-[var(--dim)]"
        strokeWidth={1}
      />
    </svg>
  );
}

export function GeographyAbout() {
  return (
    <section className="space-y-8 border border-[var(--line)] bg-[var(--paper)] p-6 sm:p-8">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--mark)]">
          About
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
          Shells &amp; navigation
        </h2>
        <p className="max-w-2xl font-serif text-lg leading-relaxed text-[var(--muted)]">
          Every room sits on an infinite hexagonal floor plate and an integer
          level. Distance from the Entrance is a{" "}
          <span className="text-[var(--fg)]">shell</span> — the farthest of
          horizontal hex steps and vertical level steps.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        <figure className="space-y-3">
          <div className="border border-[var(--line)] bg-[var(--panel)]/60 p-3 backdrop-blur-[2px]">
            <HexShellPlan />
          </div>
          <figcaption className="font-mono text-[10px] uppercase tracking-wider text-[var(--dim)]">
            Horizontal rings · center-to-center 1.25&nbsp;m
          </figcaption>
        </figure>

        <figure className="space-y-3">
          <div className="border border-[var(--line)] bg-[var(--panel)]/60 p-3 backdrop-blur-[2px]">
            <ShellWireCage />
          </div>
          <figcaption className="font-mono text-[10px] uppercase tracking-wider text-[var(--dim)]">
            See-through stack · UP / DOWN change level only
          </figcaption>
        </figure>
      </div>

      <div className="grid gap-8 border-t border-[var(--line)] pt-8 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="space-y-4 font-serif text-base leading-relaxed text-[var(--muted)]">
          <p>
            Shell{" "}
            <span className="font-mono text-sm text-[var(--fg)]">0</span> is
            only the Entrance. Shell{" "}
            <span className="font-mono text-sm text-[var(--fg)]">1</span> wraps
            the six neighboring hexes and the rooms directly above and below —
            then the Library expands forever.
          </p>
          <p>
            Walk with{" "}
            <span className="font-mono text-sm text-[var(--fg)]">
              N NE SE S SW NW
            </span>{" "}
            on the floor, or{" "}
            <span className="font-mono text-sm text-[var(--fg)]">UP / DOWN</span>{" "}
            between levels. Vestibules connect rooms but are not rooms
            themselves — coordinates jump cell to cell.
          </p>
          <p className="font-mono text-[11px] text-[var(--dim)]">
            Low Babel room numbers stay near the Entrance. Exact hex unranking
            of book-scale search rooms is deferred; those show an estimated
            shell distance instead.
          </p>
        </div>
        <figure className="justify-self-center space-y-2 sm:justify-self-end">
          <div className="border border-[var(--line)] bg-[var(--panel)]/60 p-3">
            <NavRose />
          </div>
          <figcaption className="text-center font-mono text-[10px] uppercase tracking-wider text-[var(--dim)]">
            Move rose
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
