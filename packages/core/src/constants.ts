/*
  Library geometry and alphabet.
  Derived from tdjsnelling/babel (GPL-3.0) — Tom Snelling.
  Changing these values produces a different library.
*/

export const ALPHA = "abcdefghijklmnopqrstuvwxyz.,!?- ";
export const WALLS = 4;
export const SHELVES = 5;
export const BOOKS = 32;
export const PAGES = 410;
export const LINES = 40;
export const CHARS = 80;
export const PAGE_LENGTH = LINES * CHARS;
export const BOOK_LENGTH = PAGE_LENGTH * PAGES;
export const BOOKS_PER_ROOM = WALLS * SHELVES * BOOKS; // 640
export const BASE32_ALPHA = "0123456789abcdefghijklmnopqrstuv";
export const BASE32_LAST = BASE32_ALPHA[BASE32_ALPHA.length - 1];
export const LIBRARY_MODE = "babel-v3" as const;
