/*
  Integer square / cube roots via Newton — O(log bitLength) iterations.
  Used by shell/disk finders so huge indices never scan 2^(bits/3) ranges.
*/

import { bitLength } from "./bitLength";

/**
 * Integer cube root: largest x with x³ ≤ n.
 */
export function integerCbrt(n: bigint): bigint {
  if (n < 0n) throw new Error("integerCbrt: n must be >= 0");
  if (n < 2n) return n;

  const bits = bitLength(n);
  let x = 1n << BigInt(Math.floor((bits + 2) / 3));
  for (;;) {
    const x2 = x * x;
    const next = (2n * x + n / x2) / 3n;
    if (next >= x) {
      let y = x;
      while ((y + 1n) * (y + 1n) * (y + 1n) <= n) y++;
      while (y * y * y > n) y--;
      return y;
    }
    x = next;
  }
}

/**
 * Integer square root: largest x with x² ≤ n.
 */
export function integerSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("integerSqrt: n must be >= 0");
  if (n < 2n) return n;

  const bits = bitLength(n);
  let x = 1n << BigInt(Math.floor((bits + 1) / 2));
  for (;;) {
    const next = (x + n / x) / 2n;
    if (next >= x) {
      let y = x;
      while ((y + 1n) * (y + 1n) <= n) y++;
      while (y * y > n) y--;
      return y;
    }
    x = next;
  }
}
