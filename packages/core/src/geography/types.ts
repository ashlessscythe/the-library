/*
  Physical Library geography types and constants.
  Axial hex (q, r) + independent vertical level.
*/

export type PhysicalLocation = {
  q: bigint;
  r: bigint;
  level: bigint;
};

/** Horizontal hex directions + vertical. */
export type PhysicalDirection =
  | "N"
  | "NE"
  | "SE"
  | "S"
  | "SW"
  | "NW"
  | "UP"
  | "DOWN";

/** Center-to-center spacing between horizontally adjacent rooms (meters). */
export const ROOM_SPACING_METERS = 1.25;

/** Exact astronomical unit in meters. */
export const AU_METERS = 149_597_870_700n;

/** Exact light-year in meters (IAU conventional). */
export const LIGHT_YEAR_METERS = 9_460_730_472_580_800n;

/**
 * Axial deltas for pointy-top hex, N = +r.
 * N/NE/SE/S/SW/NW must match ring walk and movement.
 */
export const HEX_DIRECTIONS: Record<
  Exclude<PhysicalDirection, "UP" | "DOWN">,
  readonly [bigint, bigint]
> = {
  N: [0n, 1n],
  NE: [1n, 0n],
  SE: [1n, -1n],
  S: [0n, -1n],
  SW: [-1n, 0n],
  NW: [-1n, 1n],
};

export const OPPOSITE_DIRECTION: Record<PhysicalDirection, PhysicalDirection> = {
  N: "S",
  NE: "SW",
  SE: "NW",
  S: "N",
  SW: "NE",
  NW: "SE",
  UP: "DOWN",
  DOWN: "UP",
};

/**
 * Ring walk from corner (+R, 0), counterclockwise.
 * Each direction is taken exactly R steps.
 */
export const RING_WALK_DIRS: ReadonlyArray<
  Exclude<PhysicalDirection, "UP" | "DOWN">
> = ["NW", "SW", "S", "SE", "NE", "N"];

/** Max decimal digits before compact/scientific formatting (human paths). */
export const COMPACT_DIGIT_BUDGET = 24;

/** Max digits shown in technical coordinate expansion before truncation. */
export const TECHNICAL_DIGIT_BUDGET = 64;

/** Max |q|,|r|,|level| for float Euclidean / bearing. */
export const FLOAT_SAFE_COORD = 9_007_199_254_740_991n; // Number.MAX_SAFE_INTEGER
