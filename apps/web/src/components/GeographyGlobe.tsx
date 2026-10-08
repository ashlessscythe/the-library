/**
 * Non-interactive wireframe shell globe for /geography.
 * Center = Entrance; arrow = direction to the current room (bearing + level).
 */

import {
  physicalCartesianMeters,
  roomDistanceFromOrigin,
  type PhysicalLocation,
} from "@the-library/core";
import { cn } from "@/lib/utils";

const TOOLTIP =
  "Shell direction from the Entrance — a wireframe globe of your room’s bearing (compass) and level (up/down) relative to the center.";

type Vec3 = { x: number; y: number; z: number };

/** Library coords: x = east, y = north, z = up (level). */
export function directionFromLocation(
  location: PhysicalLocation
): Vec3 | null {
  const c = physicalCartesianMeters(location);
  if (!c) return null;
  const len = Math.hypot(c.x, c.y, c.z);
  if (len === 0) return null;
  return { x: c.x / len, y: c.y / len, z: c.z / len };
}

/**
 * Direction from display fields when raw q/r/level are unavailable
 * (large-room GMP snapshot). Returns null when approximate or incomplete.
 */
export function directionFromDisplay(opts: {
  bearing: string | null;
  levelCompact: string;
  shellCompact: string;
  exact: boolean;
}): Vec3 | null {
  if (!opts.exact) return null;
  const level = parseCompactNumber(opts.levelCompact);
  const shell = parseCompactNumber(opts.shellCompact);
  if (level == null || shell == null) return null;
  if (shell === 0) return null;

  const bearingDeg = parseBearingDegrees(opts.bearing);
  // Pure vertical: no compass bearing
  if (bearingDeg == null) {
    if (level === 0) return null;
    return { x: 0, y: 0, z: level > 0 ? 1 : -1 };
  }

  // shell = max(hexDist, |level|). When |level| < shell, hexDist === shell.
  // When |level| === shell and a bearing exists, hexDist ∈ [1, shell] — use shell.
  const hexDist = shell;
  const len = Math.hypot(hexDist, level);
  if (len === 0) return null;

  const rad = (bearingDeg * Math.PI) / 180;
  // bearing 0° = north (+y), 90° = east (+x)
  const east = Math.sin(rad) * (hexDist / len);
  const north = Math.cos(rad) * (hexDist / len);
  const up = level / len;
  return { x: east, y: north, z: up };
}

function parseBearingDegrees(bearing: string | null): number | null {
  if (!bearing) return null;
  const m = bearing.trim().match(/^(\d+)\s*°\s*(\d+)/);
  if (!m) return null;
  const d = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(d) || !Number.isFinite(minutes)) return null;
  return d + minutes / 60;
}

/** Parse compact display ints like "-56", "+1,234". Rejects scientific / ≈. */
function parseCompactNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s || s.includes("≈") || s.includes("×") || s.includes("10")) return null;
  const cleaned = s.replace(/,/g, "");
  if (!/^[+-]?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}

/** Camera: slight yaw + pitch so the globe reads as a 3D shell. */
function project(v: Vec3, scale: number): { sx: number; sy: number; depth: number } {
  const yaw = (22 * Math.PI) / 180;
  const pitch = (32 * Math.PI) / 180;

  const x1 = v.x * Math.cos(yaw) - v.y * Math.sin(yaw);
  const y1 = v.x * Math.sin(yaw) + v.y * Math.cos(yaw);
  const z1 = v.z;

  const y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
  const z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch);

  return {
    sx: x1 * scale,
    sy: -z2 * scale,
    depth: y2,
  };
}

function latLonToVec(latDeg: number, lonDeg: number): Vec3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  // lon 0 = north, 90 = east; lat +90 = up
  const cl = Math.cos(lat);
  return {
    x: Math.sin(lon) * cl,
    y: Math.cos(lon) * cl,
    z: Math.sin(lat),
  };
}

function polylinePoints(
  pts: Vec3[],
  cx: number,
  cy: number,
  scale: number
): string {
  return pts
    .map((p) => {
      const { sx, sy } = project(p, scale);
      return `${cx + sx},${cy + sy}`;
    })
    .join(" ");
}

function arrowHead(
  from: { sx: number; sy: number },
  to: { sx: number; sy: number },
  size: number
): string {
  const dx = to.sx - from.sx;
  const dy = to.sy - from.sy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const tip = to;
  const baseX = tip.sx - ux * size;
  const baseY = tip.sy - uy * size;
  return [
    `${tip.sx},${tip.sy}`,
    `${baseX + px * size * 0.55},${baseY + py * size * 0.55}`,
    `${baseX - px * size * 0.55},${baseY - py * size * 0.55}`,
  ].join(" ");
}

export type GeographyGlobeProps = {
  /** Preferred: exact physical location (sync / small rooms). */
  location?: PhysicalLocation | null;
  /** Fallback for large-room snapshots (compact display fields). */
  bearing?: string | null;
  levelCompact?: string;
  shellCompact?: string;
  exact?: boolean;
  className?: string;
};

export function GeographyGlobe({
  location = null,
  bearing = null,
  levelCompact = "0",
  shellCompact = "0",
  exact = true,
  className,
}: GeographyGlobeProps) {
  const direction =
    location != null
      ? directionFromLocation(location)
      : directionFromDisplay({
          bearing,
          levelCompact,
          shellCompact,
          exact,
        });

  const atEntrance =
    location != null
      ? roomDistanceFromOrigin(location) === 0n
      : exact && parseCompactNumber(shellCompact) === 0;

  const cx = 100;
  const cy = 98;
  const scale = 72;

  // Meridians every 30°, parallels every 30°
  const meridians: string[] = [];
  for (let lon = 0; lon < 360; lon += 30) {
    const pts: Vec3[] = [];
    for (let lat = -90; lat <= 90; lat += 6) {
      pts.push(latLonToVec(lat, lon));
    }
    meridians.push(polylinePoints(pts, cx, cy, scale));
  }

  const parallels: string[] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts: Vec3[] = [];
    for (let lon = 0; lon <= 360; lon += 6) {
      pts.push(latLonToVec(lat, lon));
    }
    parallels.push(polylinePoints(pts, cx, cy, scale));
  }

  // Equator emphasized
  const equator = polylinePoints(
    Array.from({ length: 61 }, (_, i) => latLonToVec(0, i * 6)),
    cx,
    cy,
    scale
  );

  const compass: { lon: number; label: string }[] = [
    { lon: 0, label: "N" },
    { lon: 90, label: "E" },
    { lon: 180, label: "S" },
    { lon: 270, label: "W" },
  ];

  const tip = direction
    ? project(direction, scale * 0.92)
    : null;
  const origin = { sx: 0, sy: 0 };

  const aria =
    direction == null
      ? atEntrance
        ? "Shell globe: you are at the Entrance (center)"
        : "Shell globe: direction unavailable for this room"
      : "Shell globe showing direction from the Entrance to this room";

  return (
    <figure className={cn("relative", className)} title={TOOLTIP}>
      <svg
        viewBox="0 0 200 210"
        className="h-auto w-full max-w-[14rem]"
        role="img"
        aria-label={aria}
      >
        <defs>
          <radialGradient id="geo-globe-glow" cx="45%" cy="40%" r="55%">
            <stop offset="0%" stopColor="var(--mark)" stopOpacity="0.14" />
            <stop offset="70%" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={cx} cy={cy} r={scale + 6} fill="url(#geo-globe-glow)" />

        {/* Outer silhouette */}
        <circle
          cx={cx}
          cy={cy}
          r={scale}
          className="fill-none stroke-[var(--muted)]"
          strokeWidth={1.15}
          strokeOpacity={0.55}
        />

        {/* Wireframe meridians */}
        {meridians.map((pts, i) => (
          <polyline
            key={`m-${i}`}
            points={pts}
            fill="none"
            className="stroke-[var(--dim)]"
            strokeWidth={0.7}
            strokeOpacity={i % 3 === 0 ? 0.55 : 0.28}
          />
        ))}

        {/* Wireframe parallels */}
        {parallels.map((pts, i) => (
          <polyline
            key={`p-${i}`}
            points={pts}
            fill="none"
            className="stroke-[var(--dim)]"
            strokeWidth={0.7}
            strokeOpacity={0.32}
          />
        ))}

        {/* Equator (level 0) */}
        <polyline
          points={equator}
          fill="none"
          className="stroke-[var(--muted)]"
          strokeWidth={1.1}
          strokeOpacity={0.7}
        />

        {/* Vertical axis (up / down) */}
        {(() => {
          const top = project({ x: 0, y: 0, z: 1 }, scale);
          const bot = project({ x: 0, y: 0, z: -1 }, scale);
          return (
            <line
              x1={cx + top.sx}
              y1={cy + top.sy}
              x2={cx + bot.sx}
              y2={cy + bot.sy}
              className="stroke-[var(--dim)]"
              strokeWidth={1}
              strokeOpacity={0.5}
              strokeDasharray="3 3"
            />
          );
        })()}

        {/* Compass ticks on equator */}
        {compass.map(({ lon, label }) => {
          const p = project(latLonToVec(0, lon), scale * 1.08);
          return (
            <text
              key={label}
              x={cx + p.sx}
              y={cy + p.sy}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[var(--dim)] font-mono text-[8px]"
            >
              {label}
            </text>
          );
        })}

        {/* Up / down labels */}
        {(() => {
          const top = project({ x: 0, y: 0, z: 1 }, scale * 1.12);
          const bot = project({ x: 0, y: 0, z: -1 }, scale * 1.12);
          return (
            <>
              <text
                x={cx + top.sx}
                y={cy + top.sy}
                textAnchor="middle"
                className="fill-[var(--dim)] font-mono text-[7px] uppercase tracking-wider"
              >
                UP
              </text>
              <text
                x={cx + bot.sx}
                y={cy + bot.sy + 3}
                textAnchor="middle"
                className="fill-[var(--dim)] font-mono text-[7px] uppercase tracking-wider"
              >
                DN
              </text>
            </>
          );
        })()}

        {/* Center = Entrance */}
        <circle cx={cx} cy={cy} r={3.2} className="fill-[var(--mark)]" />
        <circle
          cx={cx}
          cy={cy}
          r={6}
          className="fill-none stroke-[var(--mark)]"
          strokeWidth={0.8}
          strokeOpacity={0.45}
        >
          <animate
            attributeName="r"
            values="5;7.5;5"
            dur="3.2s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-opacity"
            values="0.55;0.15;0.55"
            dur="3.2s"
            repeatCount="indefinite"
          />
        </circle>

        {/* Direction arrow to current room */}
        {tip ? (
          <g>
            <line
              x1={cx}
              y1={cy}
              x2={cx + tip.sx * 0.88}
              y2={cy + tip.sy * 0.88}
              className="stroke-[var(--mark)]"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <animate
                attributeName="stroke-opacity"
                values="0.55;1;0.55"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </line>
            <polygon
              points={arrowHead(origin, tip, 8)
                .split(" ")
                .map((pair) => {
                  const [x, y] = pair.split(",");
                  return `${cx + Number(x)},${cy + Number(y)}`;
                })
                .join(" ")}
              className="fill-[var(--mark)]"
            />
            <circle
              cx={cx + tip.sx}
              cy={cy + tip.sy}
              r={3.2}
              className="fill-[var(--paper)] stroke-[var(--mark)]"
              strokeWidth={1.4}
            />
          </g>
        ) : null}

        <text
          x={cx}
          y={198}
          textAnchor="middle"
          className="fill-[var(--dim)] font-mono text-[8px] uppercase tracking-wider"
        >
          {atEntrance
            ? "Shell · at Entrance"
            : tip
              ? "Shell · you are here"
              : "Shell · direction n/a"}
        </text>
      </svg>
      <figcaption className="absolute h-px w-px overflow-hidden whitespace-nowrap p-0 [clip:rect(0,0,0,0)]">
        {TOOLTIP}
      </figcaption>
    </figure>
  );
}
