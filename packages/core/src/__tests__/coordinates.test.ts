/*
  Fast unit tests — no book-scale `numbers` load.
*/

import {
  ALPHA,
  BOOKS,
  BOOKS_PER_ROOM,
  BOOK_LENGTH,
  PAGES,
  SHELVES,
  WALLS,
} from "../constants";
import {
  coordinateFromSequential,
  formatIdentifier,
  parseIdentifier,
  sequentialFromCoordinate,
} from "../coordinates/identifier";
import { parseBase32, toBase32Padded } from "../mathematics/base32";
import { parseNumbersFile } from "../mathematics/numbers";
import { buildEmptyBookContent, buildSpacePaddedBook } from "../search/build";

describe("constants", () => {
  it("keeps babel-v3 geometry", () => {
    expect(ALPHA).toHaveLength(32);
    expect(WALLS * SHELVES * BOOKS).toBe(BOOKS_PER_ROOM);
    expect(BOOKS_PER_ROOM).toBe(640);
    expect(BOOK_LENGTH).toBe(1_312_000);
    expect(PAGES).toBe(410);
  });
});

describe("coordinates", () => {
  it("round-trips sequential indices for small rooms", () => {
    const samples: [bigint, number, number, number][] = [
      [1n, 1, 1, 1],
      [1n, 1, 1, 2],
      [1n, 1, 2, 1],
      [1n, 2, 1, 1],
      [2n, 1, 1, 1],
      [90n, 1, 3, 16],
    ];
    for (const [room, wall, shelf, book] of samples) {
      const seq = sequentialFromCoordinate(room, wall, shelf, book);
      const back = coordinateFromSequential(seq, 1);
      expect(back.room).toBe(room);
      expect(back.wall).toBe(wall);
      expect(back.shelf).toBe(shelf);
      expect(back.book).toBe(book);
    }
  });

  it("matches README examples for book indices", () => {
    expect(sequentialFromCoordinate(1n, 1, 1, 1)).toBe(1n);
    expect(sequentialFromCoordinate(1n, 1, 1, 2)).toBe(2n);
    expect(sequentialFromCoordinate(1n, 1, 2, 1)).toBe(33n);
    expect(sequentialFromCoordinate(1n, 2, 1, 1)).toBe(161n);
  });

  it("parses and formats identifiers", () => {
    const id = "2q.1.3.16.200";
    const parsed = parseIdentifier(id);
    expect(parsed.wall).toBe(1);
    expect(parsed.shelf).toBe(3);
    expect(parsed.book).toBe(16);
    expect(parsed.page).toBe(200);
    expect(
      formatIdentifier(
        parsed.roomString,
        parsed.wall,
        parsed.shelf,
        parsed.book,
        parsed.page
      )
    ).toBe(id);
  });

  it("rejects out-of-range wall/shelf/book/page", () => {
    expect(() => parseIdentifier("1.0.1.1.1")).toThrow(/Wall/);
    expect(() => parseIdentifier("1.1.6.1.1")).toThrow(/Shelf/);
    expect(() => parseIdentifier("1.1.1.33.1")).toThrow(/Book/);
    expect(() => parseIdentifier("1.1.1.1.411")).toThrow(/Page/);
  });
});

describe("base32", () => {
  it("round-trips small values", () => {
    expect(toBase32Padded(0n, 4)).toBe("0000");
    expect(parseBase32("v")).toBe(31n);
    expect(parseBase32(toBase32Padded(12345n, 8))).toBe(12345n);
  });

  it("parses long digit strings via chunking", () => {
    const digits = "v".repeat(1000);
    const value = parseBase32(digits);
    expect(toBase32Padded(value, 1000)).toBe(digits);
  });
});

describe("search builders", () => {
  it("emptybook content is BOOK_LENGTH and starts with query", () => {
    const book = buildEmptyBookContent("hello");
    expect(book).toHaveLength(BOOK_LENGTH);
    expect(book.startsWith("hello")).toBe(true);
  });

  it("space-padded discovery is deterministic", () => {
    expect(buildSpacePaddedBook("tony", 1).book).toBe(
      buildSpacePaddedBook("tony", 1).book
    );
  });
});

describe("numbers file parsing (synthetic)", () => {
  it("parses three-line payload", () => {
    // Small synthetic N,C,I — not the real library.
    const N = 31n; // v in base32
    const C = 7n;
    const I = 9n; // 7*9=63 ≡ 1 (mod 31)
    expect((C * I) % N).toBe(1n);
    const file = `${N.toString(32)}\n${C.toString(32)}\n${I.toString(32)}\n`;
    const parsed = parseNumbersFile(file);
    expect(parsed.N).toBe(N);
    expect(parsed.C).toBe(C);
    expect(parsed.I).toBe(I);
  });
});
