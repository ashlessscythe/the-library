/*
  Physical distance, bearing, and human-readable formatting.
  Float only for final display; coordinates stay bigint.
*/

import { bitLength } from "./bitLength";
import { absBig, hexDistance, maxBig } from "./hex";
import {
  AU_METERS,
  COMPACT_DIGIT_BUDGET,
  FLOAT_SAFE_COORD,
  LIGHT_YEAR_METERS,
  ROOM_SPACING_METERS,
  TECHNICAL_DIGIT_BUDGET,
  type PhysicalLocation,
} from "./types";

/** Shell / grid distance from the Entrance: max(hexDist, abs(level)). */
export function roomDistanceFromOrigin(location: PhysicalLocation): bigint {
  return maxBig(hexDistance(location.q, location.r), absBig(location.level));
}

/** Alias matching the product spec name. */
export const physicalDistance = roomDistanceFromOrigin;

/** Horizontal center-to-center meters: hexDistance × ROOM_SPACING_METERS. */
export function horizontalDistanceMeters(location: PhysicalLocation): number {
  const h = hexDistance(location.q, location.r);
  return bigintTimesSpacing(h);
}

/** Vertical meters: abs(level) × ROOM_SPACING_METERS. */
export function verticalDistanceMeters(location: PhysicalLocation): number {
  return bigintTimesSpacing(absBig(location.level));
}

function bigintTimesSpacing(n: bigint): number {
  if (!isFloatSafeCoord(n)) {
    return Number.POSITIVE_INFINITY;
  }
  return Number(n) * ROOM_SPACING_METERS;
}

export function isFloatSafeCoord(n: bigint): boolean {
  return absBig(n) <= FLOAT_SAFE_COORD;
}

export function locationFloatSafe(location: PhysicalLocation): boolean {
  return (
    isFloatSafeCoord(location.q) &&
    isFloatSafeCoord(location.r) &&
    isFloatSafeCoord(location.level)
  );
}

/**
 * Axial → Cartesian (pointy-top), center spacing D:
 *   x = D * (3/2 * q)
 *   y = D * (√3 * (r + q/2))
 *   z = D * level
 */
export function physicalCartesianMeters(location: PhysicalLocation): {
  x: number;
  y: number;
  z: number;
} | null {
  if (!locationFloatSafe(location)) return null;
  const D = ROOM_SPACING_METERS;
  const q = Number(location.q);
  const r = Number(location.r);
  const level = Number(location.level);
  const x = D * (1.5 * q);
  const y = D * (Math.sqrt(3) * (r + q / 2));
  const z = D * level;
  return { x, y, z };
}

export function euclideanMeters(location: PhysicalLocation): number | null {
  const c = physicalCartesianMeters(location);
  if (!c) return null;
  return Math.hypot(c.x, c.y, c.z);
}

export function horizontalEuclideanMeters(
  location: PhysicalLocation
): number | null {
  const c = physicalCartesianMeters(location);
  if (!c) return null;
  return Math.hypot(c.x, c.y);
}

/**
 * Bearing from Entrance in degrees, 0° = North, 90° = East.
 * Uses atan2(x, y) with y-north / x-east convention.
 * Returns null when coordinates are not float-safe or at origin horizontally.
 */
export function bearingDegrees(location: PhysicalLocation): number | null {
  const c = physicalCartesianMeters(location);
  if (!c) return null;
  if (c.x === 0 && c.y === 0) return null;
  let deg = (Math.atan2(c.x, c.y) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

export function formatBearing(location: PhysicalLocation): string | null {
  const deg = bearingDegrees(location);
  if (deg === null) return null;
  const whole = Math.floor(deg);
  const minutes = Math.round((deg - whole) * 60);
  let d = whole;
  let m = minutes;
  if (m === 60) {
    m = 0;
    d = (d + 1) % 360;
  }
  return `${d}° ${String(m).padStart(2, "0")}′`;
}

/** Approximate decimal digit count of |n| without full toString when huge. */
export function approxDecimalDigits(n: bigint): number {
  const a = absBig(n);
  if (a === 0n) return 1;
  const bits = bitLength(a);
  return Math.max(1, Math.floor(bits * Math.LOG10E * Math.LN2) + 1);
}

/**
 * Compact bigint for display: commas when small, scientific when large.
 * Never materializes multi-megabyte decimal strings.
 */
export function formatCompactBigInt(n: bigint): string {
  const neg = n < 0n;
  const a = absBig(n);
  const digits = approxDecimalDigits(a);
  if (digits <= COMPACT_DIGIT_BUDGET) {
    const s = a.toString();
    return (neg ? "-" : "") + withCommas(s);
  }
  return (neg ? "-" : "") + scientificFromBigInt(a);
}

function withCommas(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function scientificFromBigInt(a: bigint): string {
  const bits = bitLength(a);
  if (bits === 0) return "0";
  const shift = Math.max(0, bits - 53);
  const top = shift > 0 ? a >> BigInt(shift) : a;
  const topNum = Number(top);
  const log10 = Math.log10(topNum) + shift * Math.log10(2);
  const e = Math.floor(log10);
  let mant = 10 ** (log10 - e);
  // Normalize floating error
  if (mant >= 10) {
    return `${(mant / 10).toFixed(2)} × 10${toSuperscript(e + 1)}`;
  }
  return `${mant.toFixed(2)} × 10${toSuperscript(e)}`;
}

const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
  "+": "⁺",
};

function toSuperscript(n: number): string {
  return String(n)
    .split("")
    .map((c) => SUPERSCRIPTS[c] ?? c)
    .join("");
}

/**
 * Format a meter distance with automatic unit selection.
 * meters → km → AU → light-years.
 */
export function formatLibraryDistance(meters: number): string {
  if (!Number.isFinite(meters)) {
    return "beyond float range";
  }
  const abs = Math.abs(meters);
  const au = Number(AU_METERS);
  const ly = Number(LIGHT_YEAR_METERS);

  if (abs < 1000) {
    return formatFixed(meters, meters < 10 ? 2 : 1) + " m";
  }
  const km = meters / 1000;
  if (abs < au / 10) {
    return formatFixed(km, km < 100 ? 1 : 0) + " km";
  }
  if (abs < ly / 10) {
    const auVal = meters / au;
    return formatFixed(auVal, auVal < 10 ? 2 : 2) + " AU";
  }
  const lyVal = meters / ly;
  return formatFixed(lyVal, lyVal < 10 ? 2 : 2) + " LIGHT-YEARS";
}

function formatFixed(n: number, digits: number): string {
  const s = n.toFixed(digits);
  // Trim trailing zeros after decimal for cleaner output when digits>0
  if (digits === 0) return withCommas(String(Math.round(n)));
  const [whole, frac] = s.split(".");
  const signed = whole!.startsWith("-");
  const w = signed ? whole!.slice(1) : whole!;
  const body = withCommas(w) + (frac != null ? "." + frac : "");
  return (signed ? "-" : "") + body;
}

export type FormattedPhysicalLocation = {
  summary: string;
  technical: string;
};

/**
 * Human-facing location block (summary). Technical coords separately.
 */
export function formatPhysicalLocation(location: PhysicalLocation): string {
  const dist = roomDistanceFromOrigin(location);
  const level = location.level;
  const levelStr =
    (level > 0n ? "+" : "") + formatCompactBigInt(level);

  const lines = [
    "FROM THE ENTRANCE",
    "",
    "DISTANCE",
    `${formatCompactBigInt(dist)} ROOMS`,
    "",
    "LEVEL",
    levelStr,
  ];

  const bearing = formatBearing(location);
  if (bearing) {
    lines.push("", "BEARING", bearing);
  }

  const euc = euclideanMeters(location);
  if (euc != null) {
    lines.push("", "PHYSICAL DISTANCE", formatLibraryDistance(euc));
  } else {
    // Fall back to max of axis-aligned spacing distances when float-unsafe
    const shell = roomDistanceFromOrigin(location);
    if (approxDecimalDigits(shell) <= COMPACT_DIGIT_BUDGET) {
      const meters = Number(shell) * ROOM_SPACING_METERS;
      if (Number.isFinite(meters)) {
        lines.push("", "PHYSICAL DISTANCE", formatLibraryDistance(meters) + " (grid)");
      }
    }
  }

  return lines.join("\n");
}

/**
 * Technical Q / R / LEVEL expansion with truncation for huge values.
 */
export function formatTechnicalCoordinates(location: PhysicalLocation): string {
  return [
    "Q",
    formatTechnicalBigInt(location.q),
    "",
    "R",
    formatTechnicalBigInt(location.r),
    "",
    "LEVEL",
    (location.level > 0n ? "+" : "") + formatTechnicalBigInt(location.level),
  ].join("\n");
}

export function formatTechnicalBigInt(n: bigint): string {
  const neg = n < 0n;
  const a = absBig(n);
  const digits = approxDecimalDigits(a);
  if (digits <= TECHNICAL_DIGIT_BUDGET) {
    return (neg ? "-" : "") + a.toString();
  }
  // Avoid full toString: scientific + digit estimate
  return `${neg ? "-" : ""}${scientificFromBigInt(a)} (${digits} digits)`;
}
