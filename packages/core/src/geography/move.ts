/*
  Exact physical movement on the hex + level lattice.
*/

import {
  HEX_DIRECTIONS,
  OPPOSITE_DIRECTION,
  type PhysicalDirection,
  type PhysicalLocation,
} from "./types";

export function move(
  location: PhysicalLocation,
  direction: PhysicalDirection
): PhysicalLocation {
  if (direction === "UP") {
    return { ...location, level: location.level + 1n };
  }
  if (direction === "DOWN") {
    return { ...location, level: location.level - 1n };
  }
  const [dq, dr] = HEX_DIRECTIONS[direction];
  return {
    q: location.q + dq,
    r: location.r + dr,
    level: location.level,
  };
}

export function oppositeDirection(
  direction: PhysicalDirection
): PhysicalDirection {
  return OPPOSITE_DIRECTION[direction];
}

/** All eight physical directions in a stable order. */
export const PHYSICAL_DIRECTIONS: readonly PhysicalDirection[] = [
  "N",
  "NE",
  "SE",
  "S",
  "SW",
  "NW",
  "UP",
  "DOWN",
] as const;
