/*
  Base-32 BigInt helpers for babel-v3 book-scale integers.
  Copyright (C) Tom Snelling — original algorithm in babel.ts (GPL-3.0).
  This file: BigInt port for Tony's Library derivative.
*/

import { BASE32_ALPHA, BOOK_LENGTH } from "../constants";

const DIGIT_VALUE: Record<string, number> = {};
for (let i = 0; i < BASE32_ALPHA.length; i++) {
  DIGIT_VALUE[BASE32_ALPHA[i]] = i;
}

/**
 * Parse a base-32 digit string into a BigInt.
 * Converts 4 digits → 5 hex chars (32^4 = 2^20), then native BigInt('0x…').
 */
export function parseBase32(digits: string): bigint {
  if (digits.length === 0) return 0n;
  const pad = (4 - (digits.length % 4)) % 4;
  const parts: string[] = [];
  let i = 0;
  if (pad > 0) {
    let n = 0;
    for (; i < 4 - pad; i++) {
      const d = DIGIT_VALUE[digits[i]];
      if (d === undefined) throw new Error(`Invalid base-32 digit at ${i}`);
      n = n * 32 + d;
    }
    parts.push(n.toString(16).padStart(5, "0"));
  }
  for (; i < digits.length; i += 4) {
    const a = DIGIT_VALUE[digits[i]];
    const b = DIGIT_VALUE[digits[i + 1]];
    const c = DIGIT_VALUE[digits[i + 2]];
    const d = DIGIT_VALUE[digits[i + 3]];
    if (a === undefined || b === undefined || c === undefined || d === undefined) {
      throw new Error(`Invalid base-32 digit near ${i}`);
    }
    const n = a * 32768 + b * 1024 + c * 32 + d;
    parts.push(n.toString(16).padStart(5, "0"));
  }
  return BigInt("0x" + parts.join(""));
}

/** Encode a BigInt as a base-32 string, left-padded to `length` digits. */
export function toBase32Padded(value: bigint, length: number = BOOK_LENGTH): string {
  if (value < 0n) {
    throw new Error("Negative values cannot be encoded");
  }
  const raw = value.toString(32);
  if (raw.length > length) {
    throw new Error(`Value does not fit in ${length} base-32 digits`);
  }
  if (raw.length < length) {
    return "0".repeat(length - raw.length) + raw;
  }
  return raw;
}

/**
 * Build content BigInt from book text via digit string → parseBase32.
 */
export function contentValueFromBookText(
  content: string,
  charToDigit: (c: string) => number
): bigint {
  const digits = new Array<string>(content.length);
  for (let i = 0; i < content.length; i++) {
    digits[i] = charToDigit(content[i]).toString(32);
  }
  return parseBase32(digits.join(""));
}

export function modMul(a: bigint, b: bigint, m: bigint): bigint {
  return (a * b) % m;
}
