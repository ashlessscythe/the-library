/*
  Search book construction (application layer on top of inverse lookup).
  Behaviour mirrors src/search.ts (GPL-3.0 / Tom Snelling) for compatibility.
*/

import { ALPHA, BOOK_LENGTH, CHARS, LINES, PAGE_LENGTH, PAGES } from "../constants";

const allowed = new Set(ALPHA);

export type Highlight = {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

const getHighlightPos = (start: number, length: number): Highlight => {
  const startLine = Math.floor(start / CHARS);
  const startCol = start % CHARS;
  const endPos = start + length;
  const endLine = Math.floor(endPos / CHARS);
  const endCol = endPos % CHARS;
  return { startLine, startCol, endLine, endCol };
};

const randAlphaChar = (random: () => number = Math.random) =>
  ALPHA[(random() * ALPHA.length) | 0];

/** Deterministic pad: query at start of book, remainder spaces (emptybook). */
export function buildEmptyBookContent(content: string): string {
  const lines = content.split("\n");

  let book = "";
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li] ?? "";
    let out = "";
    for (
      let i = 0;
      i < line.length + (CHARS - (line.length % CHARS));
      i++
    ) {
      const c = line[i] ?? " ";
      out += allowed.has(c) ? c : " ";
    }
    book += out;
  }

  book = book.slice(0, BOOK_LENGTH);

  const bookArr = new Array(BOOK_LENGTH).fill(" ");
  for (let i = 0; i < book.length; i++) {
    bookArr[i] = book[i];
  }

  return bookArr.join("");
}

/** Place query on a random page; rest of book random chars (default search). */
export function buildEmptyPageBookContent(
  content: string,
  random: () => number = Math.random
): { book: string; page: number } {
  const randomPage = Math.floor(random() * PAGES);
  const startChar = randomPage * PAGE_LENGTH;
  const lines = content.split("\n");

  let page = "";
  for (let li = 0; li < LINES; li++) {
    const line = lines[li] ?? "";
    let out = "";
    for (
      let i = 0;
      i < line.length + (CHARS - (line.length % CHARS));
      i++
    ) {
      const c = line[i] ?? " ";
      out += allowed.has(c) ? c : " ";
    }
    page += out;
  }
  page = page.slice(0, PAGE_LENGTH);

  const bookArr = new Array(BOOK_LENGTH);
  for (let i = 0; i < BOOK_LENGTH; i++) bookArr[i] = randAlphaChar(random);
  for (let i = 0; i < page.length; i++) bookArr[startChar + i] = page[i];

  return { book: bookArr.join(""), page: randomPage + 1 };
}

/** Embed query at random offset among random chars. */
export function buildRandomCharsBookContent(
  content: string,
  random: () => number = Math.random
): { book: string; highlight: Highlight } {
  const noLineBreaks = content.replace(/\r/g, "").replace(/\n/g, "");
  const randomStartPosition =
    Math.floor(
      random() * (BOOK_LENGTH - noLineBreaks.length + 1) + noLineBreaks.length
    ) - noLineBreaks.length;

  const bookArr = new Array(BOOK_LENGTH);
  for (let i = 0; i < BOOK_LENGTH; i++) bookArr[i] = randAlphaChar(random);
  for (let i = 0; i < noLineBreaks.length; i++) {
    bookArr[randomStartPosition + i] = noLineBreaks[i];
  }

  return {
    book: bookArr.join(""),
    highlight: getHighlightPos(randomStartPosition, noLineBreaks.length),
  };
}

/**
 * Deterministic discovery helper (new — not upstream).
 * Places sanitized text at the start of the given page; rest spaces.
 */
export function buildSpacePaddedBook(
  content: string,
  page = 1
): { book: string; page: number } {
  const sanitized = content
    .toLowerCase()
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .split("")
    .map((c) => (allowed.has(c) ? c : " "))
    .join("");

  const pageStart = (page - 1) * PAGE_LENGTH;
  const bookArr = new Array(BOOK_LENGTH).fill(" ");
  const max = Math.min(sanitized.length, PAGE_LENGTH);
  for (let i = 0; i < max; i++) {
    bookArr[pageStart + i] = sanitized[i];
  }
  return { book: bookArr.join(""), page };
}
