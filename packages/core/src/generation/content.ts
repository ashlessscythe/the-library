/*
  Book / page generation and inverse lookup (babel-v3).
  Algorithm: Tom Snelling, tdjsnelling/babel (GPL-3.0).
  Implementation: native BigInt port for this derivative.
*/

import {
  ALPHA,
  BOOK_LENGTH,
  PAGE_LENGTH,
  PAGES,
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
