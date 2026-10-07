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

/** log₁₀(|n|) without materializing a full decimal string. */
export function log10AbsBigInt(n: bigint): number {
  const a = absBig(n);
  if (a === 0n) return -Infinity;
  const bits = bitLength(a);
  const shift = Math.max(0, bits - 53);
  const top = shift > 0 ? a >> BigInt(shift) : a;
  return Math.log10(Number(top)) + shift * Math.log10(2);
}

function scientificFromBigInt(a: bigint): string {
  if (a === 0n) return "0";
  return formatScientificMantissa(log10AbsBigInt(a));
}

/** `m.mm × 10ᵉ` from a log₁₀ value (e may be any finite integer). */
export function formatScientificMantissa(log10: number): string {
  if (!Number.isFinite(log10)) return "∞";
  if (log10 < 0) {
    // Sub-unit values: still show scientific when useful
    const e = Math.floor(log10);
    const mant = 10 ** (log10 - e);
    return `${mant.toFixed(2)} × 10${toSuperscript(e)}`;
  }
  const e = Math.floor(log10);
  let mant = 10 ** (log10 - e);
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
 * meters → km → AU → light-years (scientific when the value overflows floats).
 */
export function formatLibraryDistance(meters: number): string {
  if (!Number.isFinite(meters)) {
    return "beyond float range";
  }
  if (meters === 0) return "0 m";
  return formatLibraryDistanceFromLog10Meters(Math.log10(Math.abs(meters)));
}

/**
 * Same unit ladder as {@link formatLibraryDistance}, from log₁₀(meters).
 * Safe for shell radii whose meter length exceeds `Number.MAX_VALUE`.
 */
export function formatLibraryDistanceFromLog10Meters(log10Meters: number): string {
  if (!Number.isFinite(log10Meters)) {
    return "beyond float range";
  }
  const log10Au = Math.log10(Number(AU_METERS));
  const log10Ly = Math.log10(Number(LIGHT_YEAR_METERS));

  // meters
  if (log10Meters < 3) {
    const meters = 10 ** log10Meters;
    return formatFixed(meters, meters < 10 ? 2 : 1) + " m";
  }
  // kilometers
  if (log10Meters < log10Au - 1) {
    return formatUnitFromLog10(log10Meters - 3, "km", 6);
  }
  // AU
  if (log10Meters < log10Ly - 1) {
    return formatUnitFromLog10(log10Meters - log10Au, "AU", 6);
  }
  // light-years (including megadigit exponents)
  return formatUnitFromLog10(log10Meters - log10Ly, "LIGHT-YEARS", 6);
}

/**
 * Grid walk estimate: `shell` rooms × {@link ROOM_SPACING_METERS}.
 * Appends `(grid)` so Euclidean vs shell-radius estimates stay distinct.
 */
export function formatGridDistanceFromShell(shell: bigint): string {
  if (shell === 0n) return "0 m (grid)";
  const log10Meters =
    log10AbsBigInt(shell) + Math.log10(ROOM_SPACING_METERS);
  return `${formatLibraryDistanceFromLog10Meters(log10Meters)} (grid)`;
}

/**
 * Grid walk estimate from log₁₀(shell rooms). Used when only a log shell
 * estimate is available (book-scale Babel rooms).
 */
export function formatGridDistanceFromLog10Shell(log10Shell: number): string {
  if (!Number.isFinite(log10Shell) || log10Shell < 0) {
    return formatGridDistanceFromShell(0n);
  }
  if (log10Shell === 0) return "1.25 m (grid)";
  const log10Meters = log10Shell + Math.log10(ROOM_SPACING_METERS);
  return `${formatLibraryDistanceFromLog10Meters(log10Meters)} (grid)`;
}

/** Plain or scientific quantity + unit from log₁₀(|value|). */
function formatUnitFromLog10(
  log10Value: number,
  unit: string,
  scientificFromDigits: number
): string {
  if (log10Value < scientificFromDigits && log10Value > -3) {
    const v = 10 ** log10Value;
    if (Number.isFinite(v)) {
      const digits = v < 10 ? 2 : v < 100 ? 2 : 2;
      return `${formatFixed(v, digits)} ${unit}`;
    }
  }
  return `${formatScientificMantissa(log10Value)} ${unit}`;
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
    // Float-unsafe coords: shell × spacing still yields AU / ly via log₁₀.
    const shell = roomDistanceFromOrigin(location);
    lines.push("", "PHYSICAL DISTANCE", formatGridDistanceFromShell(shell));
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
