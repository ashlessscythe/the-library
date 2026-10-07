/*
  Axial hex utilities: distance, closed-form ring/disk rank & unrank.
  All O(1) space — never materialize rings or disks.
*/

import { integerSqrt } from "./roots";
import {
  HEX_DIRECTIONS,
  RING_WALK_DIRS,
  type PhysicalLocation,
} from "./types";

export function absBig(n: bigint): bigint {
  return n < 0n ? -n : n;
}

export function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

export function minBig(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

/** Cube-compatible axial hex distance from origin. */
export function hexDistance(q: bigint, r: bigint): bigint {
  const s = -q - r;
  return maxBig(absBig(q), maxBig(absBig(r), absBig(s)));
}

export function hexDistanceBetween(
  a: Pick<PhysicalLocation, "q" | "r">,
  b: Pick<PhysicalLocation, "q" | "r">
): bigint {
  return hexDistance(a.q - b.q, a.r - b.r);
}

/** Cells in a hex disk of radius R (inclusive). */
export function hexDiskSize(R: bigint): bigint {
  if (R < 0n) throw new Error("hexDiskSize: R must be >= 0");
  return 1n + 3n * R * (R + 1n);
}

/** Cells on a hex ring of radius R. Ring 0 is the origin (1 cell). */
export function hexRingSize(R: bigint): bigint {
  if (R < 0n) throw new Error("hexRingSize: R must be >= 0");
  if (R === 0n) return 1n;
  return 6n * R;
}

/** Corner of ring R at the start of walk side `side` (0..5). */
export function ringCorner(R: bigint, side: bigint): { q: bigint; r: bigint } {
  // Corners after 0..side full edges from (+R, 0) via RING_WALK_DIRS.
  // Closed form matching walk [NW, SW, S, SE, NE, N]:
  switch (side) {
    case 0n:
      return { q: R, r: 0n };
    case 1n:
      return { q: 0n, r: R };
    case 2n:
      return { q: -R, r: R };
    case 3n:
      return { q: -R, r: 0n };
    case 4n:
      return { q: 0n, r: -R };
    case 5n:
      return { q: R, r: -R };
    default:
      throw new Error("ringCorner: side must be 0..5");
  }
}

/**
 * Unrank index i on ring R to axial (q, r).
 * R > 0, i ∈ [0, 6R).
 * Start corner (+R, 0), walk RING_WALK_DIRS.
 */
export function hexRingUnrank(R: bigint, i: bigint): { q: bigint; r: bigint } {
  if (R <= 0n) throw new Error("hexRingUnrank: R must be > 0");
  const size = 6n * R;
  if (i < 0n || i >= size) {
    throw new Error("hexRingUnrank: i out of range");
  }
  const side = i / R;
  const rem = i % R;
  const corner = ringCorner(R, side);
  const dirName = RING_WALK_DIRS[Number(side)]!;
  const [dq, dr] = HEX_DIRECTIONS[dirName];
  return {
    q: corner.q + rem * dq,
    r: corner.r + rem * dr,
  };
}

/**
 * Rank axial (q, r) on ring R → index in [0, 6R).
 */
export function hexRingRank(R: bigint, q: bigint, r: bigint): bigint {
  if (R <= 0n) throw new Error("hexRingRank: R must be > 0");
  if (hexDistance(q, r) !== R) {
    throw new Error("hexRingRank: (q,r) not on ring R");
  }
  // Side 0: (R-t, t) for t in 0..R-1
  if (q + r === R && q > 0n && r >= 0n && r < R) {
    return 0n * R + r; // t = r, q = R-r
  }
  // Side 1: (-t, R) for t in 0..R-1
  if (r === R && q <= 0n && q > -R) {
    return 1n * R + -q;
  }
  // Side 2: (-R, R-t) for t in 0..R-1
  if (q === -R && r > 0n && r <= R) {
    return 2n * R + (R - r);
  }
  // Side 3: (-R+t, -t) for t in 0..R-1
  if (q + r === -R && r <= 0n && r > -R) {
    return 3n * R + -r;
  }
  // Side 4: (t, -R) for t in 0..R-1
  if (r === -R && q >= 0n && q < R) {
    return 4n * R + q;
  }
  // Side 5: (R, -R+t) for t in 0..R-1
  if (q === R && r < 0n && r >= -R) {
    return 5n * R + (r + R);
  }
  throw new Error("hexRingRank: failed to classify side");
}

/**
 * Find smallest ring radius k such that hexDiskSize(k) > offset.
 * offset ≥ 0. Returns k where the offset falls in ring k
 * (for disk unrank: ring containing that disk index).
 */
export function findDiskRing(offset: bigint): bigint {
  if (offset < 0n) throw new Error("findDiskRing: offset must be >= 0");
  if (offset === 0n) return 0n;
  // Solve 1 + 3k(k+1) > offset ⇒ 3k² + 3k + 1 > offset ≈ 3k².
  // Seed with isqrt — do not double from 1 (O(bits) for huge offsets).
  let guess = integerSqrt(offset / 3n);
  if (guess < 1n) guess = 1n;

  let lo: bigint;
  let hi: bigint;
  if (hexDiskSize(guess) > offset) {
    hi = guess;
    lo = 1n;
    while (lo < hi) {
      const mid = (lo + hi) / 2n;
      if (hexDiskSize(mid) > offset) hi = mid;
      else lo = mid + 1n;
    }
    return lo;
  }

  lo = guess;
  hi = guess + 1n;
  while (hexDiskSize(hi) <= offset) {
    lo = hi;
    hi = hi * 2n + 1n;
  }
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (hexDiskSize(mid) > offset) hi = mid;
    else lo = mid + 1n;
  }
  return lo;
}

/** Unrank disk offset ∈ [0, hexDiskSize(R)) to (q,r) within disk radius R. */
export function hexDiskUnrank(R: bigint, offset: bigint): { q: bigint; r: bigint } {
  if (R < 0n) throw new Error("hexDiskUnrank: R must be >= 0");
  const size = hexDiskSize(R);
  if (offset < 0n || offset >= size) {
    throw new Error("hexDiskUnrank: offset out of range");
  }
  if (offset === 0n) return { q: 0n, r: 0n };
  const ring = findDiskRing(offset);
  if (ring > R) throw new Error("hexDiskUnrank: ring exceeds R");
  const ringStart = hexDiskSize(ring - 1n);
  return hexRingUnrank(ring, offset - ringStart);
}

/** Rank (q,r) within its disk (radius = hexDistance). */
export function hexDiskRank(q: bigint, r: bigint): bigint {
  const d = hexDistance(q, r);
  if (d === 0n) return 0n;
  return hexDiskSize(d - 1n) + hexRingRank(d, q, r);
}
