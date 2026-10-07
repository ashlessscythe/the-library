/*
  Concentric physical shells: total(R), shell find via BigInt binary search.
*/

import { hexDiskSize, hexRingSize } from "./hex";
import { integerCbrt } from "./roots";

export { bitLength } from "./bitLength";
export { integerCbrt, integerSqrt } from "./roots";

/**
 * Cumulative count of physical locations with
 * max(hexDistance, abs(level)) <= R.
 *
 * total(R) = (2R + 1) * hexDisk(R)
 */
export function totalThroughShell(R: bigint): bigint {
  if (R < 0n) throw new Error("totalThroughShell: R must be >= 0");
  return (2n * R + 1n) * hexDiskSize(R);
}

/** Number of locations exactly on shell R. */
export function shellSize(R: bigint): bigint {
  if (R < 0n) throw new Error("shellSize: R must be >= 0");
  if (R === 0n) return 1n;
  return totalThroughShell(R) - totalThroughShell(R - 1n);
}

/**
 * Index of first room in shell R (0-based geo index).
 * shellStart(0) = 0; shellStart(R) = total(R-1) for R > 0.
 */
export function shellStartIndex(R: bigint): bigint {
  if (R < 0n) throw new Error("shellStartIndex: R must be >= 0");
  if (R === 0n) return 0n;
  return totalThroughShell(R - 1n);
}

/**
 * Band size within shell R for a given level.
 * abs(level) === R → full disk; abs(level) < R → outer ring only.
 */
export function shellBandSize(R: bigint, level: bigint): bigint {
  const absLevel = level < 0n ? -level : level;
  if (absLevel > R) {
    throw new Error("shellBandSize: level outside shell");
  }
  if (R === 0n) return 1n;
  if (absLevel === R) return hexDiskSize(R);
  return hexRingSize(R);
}

/**
 * Smallest R such that total(R) > N.
 *
 * Uses Newton integer cube-root to seed a tight window, then a short
 * binary search. Must NOT binary-search a 2^(bits/3) range (that is
 * O(bits) iterations and hangs on book-scale indices).
 */
export function findShell(N: bigint): bigint {
  if (N < 0n) throw new Error("findShell: N must be >= 0");
  if (N === 0n) return 0n;

  // total(R) = 6R³ + 9R² + 5R + 1 ≈ 6R³  ⇒  R ≈ cbrt(N/6)
  let guess = integerCbrt(N / 6n);
  if (guess < 1n) guess = 1n;

  let lo: bigint;
  let hi: bigint;
  if (totalThroughShell(guess) > N) {
    hi = guess;
    lo = guess > 2n ? guess / 2n : 0n;
    while (lo > 0n && totalThroughShell(lo) > N) {
      hi = lo;
      lo = lo / 2n;
    }
  } else {
    lo = guess;
    hi = guess + 1n;
    while (totalThroughShell(hi) <= N) {
      lo = hi;
      hi = hi * 2n + 1n;
    }
  }

  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (totalThroughShell(mid) > N) hi = mid;
    else lo = mid + 1n;
  }
  return lo;
}

/**
 * Upper bound for shell radius of index N (testing / diagnostics).
 * Prefer findShell — do not binary-search this alone for huge N.
 */
export function estimateShellUpperBound(N: bigint): bigint {
  if (N <= 1n) return 1n;
  return integerCbrt(N / 6n) + 4n;
}
