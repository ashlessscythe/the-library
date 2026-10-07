/*
  Bijection: 0-based geo room index ↔ PhysicalLocation via shell enumeration.
  Babel rooms are 1-based; use bridge helpers below.
*/

import {
  absBig,
  hexDiskRank,
  hexDiskSize,
  hexDiskUnrank,
  hexDistance,
  hexRingRank,
  hexRingSize,
  hexRingUnrank,
} from "./hex";
import { findShell, shellStartIndex, totalThroughShell } from "./shells";
import type { PhysicalLocation } from "./types";

/**
 * Map 0-based geography index → physical location.
 * Index 0 is the Entrance (0,0,0).
 */
export function roomIndexToPhysicalLocation(roomIndex: bigint): PhysicalLocation {
  if (roomIndex < 0n) {
    throw new Error("roomIndexToPhysicalLocation: index must be >= 0");
  }
  const R = findShell(roomIndex);
  if (R === 0n) {
    return { q: 0n, r: 0n, level: 0n };
  }

  const start = shellStartIndex(R);
  const offset = roomIndex - start;
  return unrankInShell(R, offset);
}

/**
 * Map physical location → 0-based geography index.
 */
export function physicalLocationToRoomIndex(location: PhysicalLocation): bigint {
  const { q, r, level } = location;
  const h = hexDistance(q, r);
  const R = h > absBig(level) ? h : absBig(level);

  if (R === 0n) return 0n;

  const start = shellStartIndex(R);
  const within = rankInShell(R, q, r, level);
  return start + within;
}

/**
 * Babel mathematical room (≥ 1) → physical location.
 * Entrance (0,0,0) ↔ Babel room 1.
 */
export function babelRoomToPhysicalLocation(babelRoom: bigint): PhysicalLocation {
  if (babelRoom < 1n) {
    throw new Error("babelRoomToPhysicalLocation: Babel room must be >= 1");
  }
  return roomIndexToPhysicalLocation(babelRoom - 1n);
}

/**
 * Physical location → Babel mathematical room (≥ 1).
 */
export function physicalLocationToBabelRoom(location: PhysicalLocation): bigint {
  return physicalLocationToRoomIndex(location) + 1n;
}

/**
 * Unrank offset within shell R (offset ∈ [0, shellSize(R))).
 *
 * Ordering:
 * 1. Levels from -R through +R
 * 2. abs(level) < R → hex ring at radius R (6R cells)
 * 3. abs(level) === R → hex disk radius 0..R
 */
export function unrankInShell(R: bigint, offset: bigint): PhysicalLocation {
  if (R === 0n) {
    if (offset !== 0n) throw new Error("unrankInShell: bad offset for R=0");
    return { q: 0n, r: 0n, level: 0n };
  }

  const D = hexDiskSize(R);
  const H = hexRingSize(R); // 6R
  const midBands = 2n * R - 1n; // levels -R+1 .. R-1
  const midTotal = midBands * H;

  if (offset < D) {
    const { q, r } = hexDiskUnrank(R, offset);
    return { q, r, level: -R };
  }

  if (offset < D + midTotal) {
    const o = offset - D;
    const levelIndex = o / H; // 0 .. 2R-2
    const ringI = o % H;
    const level = -R + 1n + levelIndex;
    const { q, r } = hexRingUnrank(R, ringI);
    return { q, r, level };
  }

  const o = offset - D - midTotal;
  if (o < 0n || o >= D) {
    throw new Error("unrankInShell: offset out of shell");
  }
  const { q, r } = hexDiskUnrank(R, o);
  return { q, r, level: R };
}

export function rankInShell(
  R: bigint,
  q: bigint,
  r: bigint,
  level: bigint
): bigint {
  if (R === 0n) return 0n;

  const D = hexDiskSize(R);
  const H = hexRingSize(R);
  const absLevel = absBig(level);

  if (absLevel > R || hexDistance(q, r) > R) {
    throw new Error("rankInShell: location outside shell R");
  }
  if (absLevel < R && hexDistance(q, r) !== R) {
    throw new Error("rankInShell: interior point not on shell");
  }
  if (absLevel === R && hexDistance(q, r) > R) {
    throw new Error("rankInShell: disk point outside R");
  }

  if (level === -R) {
    return hexDiskRank(q, r);
  }

  if (level === R) {
    const midBands = 2n * R - 1n;
    return D + midBands * H + hexDiskRank(q, r);
  }

  // abs(level) < R: on outer ring
  const levelIndex = level + R - 1n; // 0 .. 2R-2
  return D + levelIndex * H + hexRingRank(R, q, r);
}

/** Re-export for callers that need cumulative totals. */
export { totalThroughShell, findShell, shellStartIndex };
