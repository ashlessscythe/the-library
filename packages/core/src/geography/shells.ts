/*
  Concentric physical shells: total(R), shell find via BigInt binary search.
*/

import { hexDiskSize, hexRingSize } from "./hex";

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
 * O(log R) BigInt arithmetic; no linear R++ scan.
 */
export function findShell(N: bigint): bigint {
  if (N < 0n) throw new Error("findShell: N must be >= 0");
  if (N === 0n) return 0n;

  let hi = estimateShellUpperBound(N);
  while (totalThroughShell(hi) <= N) {
    hi *= 2n;
  }
  let lo = 0n;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    if (totalThroughShell(mid) > N) hi = mid;
    else lo = mid + 1n;
  }
  return lo;
}

/**
 * Upper bound for shell radius of index N.
 * Uses bit length so we never walk R from 0.
 */
export function estimateShellUpperBound(N: bigint): bigint {
  if (N <= 1n) return 1n;
  const bits = bitLength(N);
  // 2^ceil(bits/3)+margin is a generous bound for cbrt(N)
  const exp = BigInt(Math.floor((bits + 2) / 3) + 2);
  const hi = 1n << exp;
  return hi < 2n ? 2n : hi;
}

/** Bit length of |n| without decimal toString. */
export function bitLength(n: bigint): number {
  let x = n < 0n ? -n : n;
  if (x === 0n) return 0;
  let bits = 0;
  while (x > 0xffffffffffffffffn) {
    x >>= 64n;
    bits += 64;
  }
  // Residual fits in 64 bits; split to 32-bit halves (Number safe).
  const hi = Number(x >> 32n);
  const lo = Number(x & 0xffffffffn);
  if (hi > 0) return bits + 32 + (32 - Math.clz32(hi));
  if (lo > 0) return bits + (32 - Math.clz32(lo));
  return bits;
}
