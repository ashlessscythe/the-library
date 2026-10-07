/*
  Random identifier — fast tests with synthetic N (no book-scale load).
*/

import { BOOKS, PAGES, SHELVES, WALLS } from "../constants";
import { randomBigIntBelow, randomIdentifier } from "../generation/content";
import { parseIdentifier } from "../coordinates/identifier";
import {
  clearLibraryConstants,
  setLibraryConstants,
} from "../mathematics/numbers";

describe("randomBigIntBelow", () => {
  it("returns values in [0, max)", () => {
    const max = 1000n;
    let counter = 0;
    const fill = (bytes: Uint8Array) => {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = (counter++ * 17 + 3) & 0xff;
      }
    };
    for (let i = 0; i < 64; i++) {
      const v = randomBigIntBelow(max, fill);
      expect(v >= 0n).toBe(true);
      expect(v < max).toBe(true);
    }
  });

  it("rejects max <= 0", () => {
    expect(() => randomBigIntBelow(0n)).toThrow(/positive/);
  });
});

describe("randomIdentifier", () => {
  beforeEach(() => {
    // Small modulus; C/I unused by randomIdentifier.
    setLibraryConstants({ N: 10_000n, C: 1n, I: 1n });
  });

  afterEach(() => {
    clearLibraryConstants();
  });

  it("emits a parseable identifier within geometry bounds", () => {
    let counter = 0;
    const fill = (bytes: Uint8Array) => {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = (counter++ * 31 + 7) & 0xff;
      }
    };
    let pageCounter = 0;
    const random = () => {
      pageCounter = (pageCounter + 1) % PAGES;
      return pageCounter / PAGES;
    };

    const id = randomIdentifier(fill, random);
    const parsed = parseIdentifier(id);
    expect(parsed.wall).toBeGreaterThanOrEqual(1);
    expect(parsed.wall).toBeLessThanOrEqual(WALLS);
    expect(parsed.shelf).toBeGreaterThanOrEqual(1);
    expect(parsed.shelf).toBeLessThanOrEqual(SHELVES);
    expect(parsed.book).toBeGreaterThanOrEqual(1);
    expect(parsed.book).toBeLessThanOrEqual(BOOKS);
    expect(parsed.page).toBeGreaterThanOrEqual(1);
    expect(parsed.page).toBeLessThanOrEqual(PAGES);
    expect(parsed.room).toBeGreaterThanOrEqual(1n);
  });

  it("is not capped to ~4-character rooms when N is large enough", () => {
    // N = 32^8 − 1 → bit mask fits exactly; high random bytes yield long rooms.
    setLibraryConstants({ N: 32n ** 8n - 1n, C: 1n, I: 1n });
    const fill = (bytes: Uint8Array) => {
      bytes.fill(0xff);
      // Keep value < N (all-ones would equal the mask / reject forever).
      bytes[bytes.length - 1] = 0xfe;
    };
    const id = randomIdentifier(fill, () => 0);
    const room = id.split(".")[0];
    expect(room.length).toBeGreaterThan(4);
  });
});
