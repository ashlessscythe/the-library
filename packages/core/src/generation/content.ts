/*
  Book / page generation and inverse lookup (babel-v3).
  Algorithm: Tom Snelling, tdjsnelling/babel (GPL-3.0).
  Implementation: native BigInt port for this derivative.
*/

import {
  ALPHA,
  BASE32_ALPHA,
  BOOK_LENGTH,
  BOOKS,
  PAGE_LENGTH,
  PAGES,
  SHELVES,
  WALLS,
} from "../constants";
import {
  coordinateFromSequential,
  formatIdentifier,
  parseIdentifier,
  sequentialFromCoordinate,
  shortenRoom,
} from "../coordinates/identifier";
import { toBase32Padded, contentValueFromBookText } from "../mathematics/base32";
import { getLibraryConstants } from "../mathematics/numbers";

const NUM_MAP: Record<string, string> = {};
const CHAR_DIGIT: Record<string, number> = {};
for (let i = 0; i < ALPHA.length; i++) {
  NUM_MAP[i.toString(32)] = ALPHA[i];
  CHAR_DIGIT[ALPHA[i]] = i;
}

export type PageContent = {
  content: string;
  roomShort: string;
  room: string;
  wall: string;
  shelf: string;
  book: string;
  page: string;
  nextIdentifier: string;
  prevIdentifier: string;
};

export type BookContent = {
  content: string;
  roomShort: string;
  room: string;
  wall: string;
  shelf: string;
  book: string;
};

function contentValueFromSeq(seq: bigint): bigint {
  const { C, N } = getLibraryConstants();
  return (C * seq) % N;
}

function seqFromContentValue(contentValue: bigint): bigint {
  const { I, N } = getLibraryConstants();
  return (contentValue * I) % N;
}

function digitsToText(hash: string, start: number, end: number): string {
  const out = new Array<string>(end - start);
  for (let i = 0; i < out.length; i++) {
    out[i] = NUM_MAP[hash[start + i]];
  }
  return out.join("");
}

/** Generate a full book or a single page from an identifier. */
export function generateContent(identifier: string, wholeBook: true): BookContent;
export function generateContent(identifier: string, wholeBook: false): PageContent;
export function generateContent(
  identifier: string,
  wholeBook: boolean
): BookContent | PageContent {
  const parsed = parseIdentifier(identifier);
  const seq = sequentialFromCoordinate(
    parsed.room,
    parsed.wall,
    parsed.shelf,
    parsed.book
  );

  const contentValue = contentValueFromSeq(seq);
  const hash = toBase32Padded(contentValue, BOOK_LENGTH);

  const start = wholeBook ? 0 : (parsed.page - 1) * PAGE_LENGTH;
  const end = wholeBook ? BOOK_LENGTH : start + PAGE_LENGTH;
  const content = digitsToText(hash, start, end);

  const room = parsed.roomString;
  const roomShort = shortenRoom(room);
  const wall = String(parsed.wall);
  const shelf = String(parsed.shelf);
  const book = String(parsed.book);

  if (wholeBook) {
    return { content, roomShort, room, wall, shelf, book };
  }

  let nextSeq = seq;
  let nextPage = parsed.page;
  if (nextPage === PAGES) {
    nextSeq = nextSeq + 1n;
    nextPage = 1;
  } else {
    nextPage++;
  }
  const next = coordinateFromSequential(nextSeq, nextPage);
  const nextIdentifier = formatIdentifier(
    next.roomString,
    next.wall,
    next.shelf,
    next.book,
    next.page
  );

  let prevSeq = seq;
  let prevPage = parsed.page;
  if (prevPage === 1) {
    prevSeq = prevSeq - 1n;
    prevPage = PAGES;
  } else {
    prevPage--;
  }
  const prev = coordinateFromSequential(prevSeq, prevPage);
  const prevIdentifier = formatIdentifier(
    prev.roomString,
    prev.wall,
    prev.shelf,
    prev.book,
    prev.page
  );

  return {
    content,
    roomShort,
    room,
    wall,
    shelf,
    book,
    page: String(parsed.page),
    nextIdentifier,
    prevIdentifier,
  };
}

/**
 * Inverse lookup: full book text (length BOOK_LENGTH) → identifier.
 * Caller is responsible for padding/construction (see search helpers).
 */
export function lookupContent(content: string, page: number): string {
  if (content.length !== BOOK_LENGTH) {
    throw new Error(`Content must be exactly ${BOOK_LENGTH} characters`);
  }

  for (let i = 0; i < BOOK_LENGTH; i++) {
    if (CHAR_DIGIT[content[i]] === undefined) {
      throw new Error(`Unsupported character at ${i}`);
    }
  }

  const contentValue = contentValueFromBookText(
    content,
    (c) => CHAR_DIGIT[c]
  );
  const seq = seqFromContentValue(contentValue);
  const coord = coordinateFromSequential(seq, page);
  return formatIdentifier(
    coord.roomString,
    coord.wall,
    coord.shelf,
    coord.book,
    coord.page
  );
}

/** Verify C·I ≡ 1 (mod N) — smoke invariant. */
export function assertInverseIdentity(): void {
  const { N, C, I } = getLibraryConstants();
  if ((C * I) % N !== 1n) {
    throw new Error("C·I mod N !== 1 — numbers file invalid");
  }
}

/** Fill a buffer with CSPRNG bytes (chunked — browsers cap getRandomValues at 64KiB). */
function fillCryptoRandom(bytes: Uint8Array): void {
  const CHUNK = 65536;
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + CHUNK, bytes.length)));
  }
}

/** Fast Uint8Array → bigint via hex (byte-at-a-time shifts are O(n²)). */
function bytesToBigInt(bytes: Uint8Array): bigint {
  if (bytes.length === 0) return 0n;
  // Build hex without a leading-zero-only edge case for BigInt('0x…').
  let hex = "";
  const HEX = "0123456789abcdef";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    hex += HEX[b >> 4];
    hex += HEX[b & 15];
  }
  return BigInt(`0x${hex}`);
}

/**
 * Uniform random bigint in `[0, max)`.
 * Rejection sampling keeps the distribution unbiased.
 */
export function randomBigIntBelow(
  max: bigint,
  fillRandom: (bytes: Uint8Array) => void = fillCryptoRandom
): bigint {
  if (max <= 0n) throw new Error("max must be positive");
  const bits = max.toString(2).length;
  const byteLength = Math.ceil(bits / 8);
  const mask = (1n << BigInt(bits)) - 1n;
  for (;;) {
    const bytes = new Uint8Array(byteLength);
    fillRandom(bytes);
    const value = bytesToBigInt(bytes) & mask;
    if (value < max) return value;
  }
}

/**
 * Random Babel room string with length chosen uniformly in `[1, maxLength]`.
 *
 * Uniform-over-value sampling in `[1, N]` almost always yields ~`BOOK_LENGTH`
 * digits (the measure concentrates at the top). Length-uniform sampling gives
 * short, mid, and book-scale rooms with equal probability — no hard-coded
 * target sizes.
 *
 * Remaining digits are crypto-uniform over the base-32 alphabet. The leading
 * digit is chosen in `[1, 31]` (never `0`) so the room is always ≥ 1.
 */
export function randomRoomString(
  maxLength: number = BOOK_LENGTH,
  fillRandom: (bytes: Uint8Array) => void = fillCryptoRandom
): string {
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new Error("maxLength must be an integer ≥ 1");
  }
  const length = 1 + Number(randomBigIntBelow(BigInt(maxLength), fillRandom));
  const bytes = new Uint8Array(length);
  fillRandom(bytes);
  const chars = new Array<string>(length);
  // Map 0–255 → 1–31; tiny modulo bias, never hangs on a zero-only fill.
  chars[0] = BASE32_ALPHA[1 + (bytes[0] % 31)];
  for (let i = 1; i < length; i++) {
    chars[i] = BASE32_ALPHA[bytes[i] & 31];
  }
  return chars.join("");
}

/**
 * Random page identifier (babel-v3).
 *
 * Room length is uniform in `[1, maxRoomLength]` (see {@link randomRoomString});
 * wall / shelf / book / page are uniform over their geometry bounds.
 * Value-uniform sampling over `[1, N]` is intentionally avoided — it almost
 * always produces ~`BOOK_LENGTH`-digit rooms.
 */
export function randomIdentifier(
  fillRandom: (bytes: Uint8Array) => void = fillCryptoRandom,
  random: () => number = Math.random,
  maxRoomLength: number = BOOK_LENGTH
): string {
  const roomString = randomRoomString(maxRoomLength, fillRandom);
  const wall = 1 + Math.floor(random() * WALLS);
  const shelf = 1 + Math.floor(random() * SHELVES);
  const book = 1 + Math.floor(random() * BOOKS);
  const page = 1 + Math.floor(random() * PAGES);
  return formatIdentifier(roomString, wall, shelf, book, page);
}
