/** Bit length of |n| without decimal toString. */
export function bitLength(n: bigint): number {
  let x = n < 0n ? -n : n;
  if (x === 0n) return 0;
  let bits = 0;
  while (x > 0xffffffffffffffffn) {
    x >>= 64n;
    bits += 64;
  }
  const hi = Number(x >> 32n);
  const lo = Number(x & 0xffffffffn);
  if (hi > 0) return bits + 32 + (32 - Math.clz32(hi));
  if (lo > 0) return bits + (32 - Math.clz32(lo));
  return bits;
}
