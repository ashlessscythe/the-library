/*
  Load and hold N, C, I for babel-v3.
  Prefer `numbers.hex.json` (fast BigInt('0x…') load).
  Fall back to base-32 `numbers` file (slow to parse ~90s/line).
*/

import { parseBase32 } from "./base32";

export type LibraryConstants = {
  N: bigint;
  C: bigint;
  I: bigint;
};

let cached: LibraryConstants | null = null;

/** Parse the three-line `numbers` payload (N, C, I in base-32). */
export function parseNumbersFile(contents: string): LibraryConstants {
  const lines = contents.replace(/\r\n/g, "\n").split("\n");
  const [nStr, cStr, iStr] = lines;
  if (!nStr || !cStr || !iStr) {
    throw new Error("numbers file must contain three non-empty lines (N, C, I)");
  }
  return {
    N: parseBase32(nStr.trim()),
    C: parseBase32(cStr.trim()),
    I: parseBase32(iStr.trim()),
  };
}

/** Parse hex JSON produced by scripts/convert-numbers-to-hex.mjs */
export function parseNumbersHexJson(contents: string): LibraryConstants {
  const data = JSON.parse(contents) as {
    N: string;
    C: string;
    I: string;
  };
  if (
    !data.N?.startsWith("0x") ||
    !data.C?.startsWith("0x") ||
    !data.I?.startsWith("0x")
  ) {
    throw new Error("numbers.hex.json must contain 0x-prefixed N, C, I");
  }
  return {
    N: BigInt(data.N),
    C: BigInt(data.C),
    I: BigInt(data.I),
  };
}

export function setLibraryConstants(constants: LibraryConstants): void {
  cached = constants;
}

export function getLibraryConstants(): LibraryConstants {
  if (!cached) {
    throw new Error("Library constants not initialised — call loadNumbers first");
  }
  return cached;
}

export function clearLibraryConstants(): void {
  cached = null;
}

export function loadNumbersFromString(contents: string): LibraryConstants {
  const constants = parseNumbersFile(contents);
  setLibraryConstants(constants);
  return constants;
}

export function loadNumbersFromHexJson(contents: string): LibraryConstants {
  const constants = parseNumbersHexJson(contents);
  setLibraryConstants(constants);
  return constants;
}
