/*
  Random identifier — fast tests (no book-scale load).
*/

import { BASE32_ALPHA, BOOKS, PAGES, SHELVES, WALLS } from "../constants";
import {
  randomBigIntBelow,
  randomIdentifier,
  randomRoomLength,
  randomRoomString,
} from "../generation/content";
import { parseIdentifier } from "../coordinates/identifier";
import { parseBase32 } from "../mathematics/base32";

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
  it("emits a parseable identifier within geometry bounds", () => {
    let counter = 0;
    const fill = (bytes: Uint8Array) => {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = (counter++ * 31 + 7) & 0xff;
      }
    };
    let step = 0;
    const random = () => {
      step += 1;
      return (step % 10) / 10;
    };

    // Cap room length so tests stay fast and BigInt-parseable.
    const id = randomIdentifier(fill, random, 48);
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
    expect(parsed.roomString.length).toBeLessThanOrEqual(48);
  });

  it("varies room digit length under log-uniform sampling", () => {
    let counter = 0;
    const fill = (bytes: Uint8Array) => {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = (counter++ * 17 + 3) & 0xff;
      }
    };
    const lengths = new Set<number>();
    for (let i = 0; i < 64; i++) {
      const id = randomIdentifier(fill, () => 0, 32);
      lengths.add(id.split(".")[0].length);
    }
    expect(lengths.size).toBeGreaterThan(1);
  });
});

describe("randomRoomLength", () => {
  it("stays in [1, maxLength] and spreads across magnitudes", () => {
    let counter = 0;
    const fill = (bytes: Uint8Array) => {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = (counter++ * 17 + 3) & 0xff;
      }
    };
    const maxLength = 1_000_000;
    let below1k = 0;
    let between1kAnd100k = 0;
    let above100k = 0;
    for (let i = 0; i < 300; i++) {
      const L = randomRoomLength(maxLength, fill);
      expect(L).toBeGreaterThanOrEqual(1);
      expect(L).toBeLessThanOrEqual(maxLength);
      if (L < 1_000) below1k++;
      else if (L < 100_000) between1kAnd100k++;
      else above100k++;
    }
    // Log-uniform: each decade band should get hits in a few hundred draws.
    expect(below1k).toBeGreaterThan(0);
    expect(between1kAnd100k).toBeGreaterThan(0);
    expect(above100k).toBeGreaterThan(0);
  });

  it("rejects invalid maxLength", () => {
    expect(() => randomRoomLength(0)).toThrow(/maxLength/);
    expect(() => randomRoomLength(1.5)).toThrow(/maxLength/);
  });
});

describe("randomRoomString", () => {
  function sequentialFill(seed = 0) {
    let counter = seed;
    return (bytes: Uint8Array) => {
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = (counter++ * 17 + 3) & 0xff;
      }
    };
  }

  it("returns base-32 rooms with length in [1, maxLength] and value ≥ 1", () => {
    const fill = sequentialFill();
    const maxLength = 64;
    const lengths = new Set<number>();
    for (let i = 0; i < 128; i++) {
      const room = randomRoomString(maxLength, fill);
      expect(room.length).toBeGreaterThanOrEqual(1);
      expect(room.length).toBeLessThanOrEqual(maxLength);
      expect(room[0]).not.toBe("0");
      for (const ch of room) {
        expect(BASE32_ALPHA.includes(ch)).toBe(true);
      }
      expect(parseBase32(room)).toBeGreaterThanOrEqual(1n);
      lengths.add(room.length);
    }
    expect(lengths.size).toBeGreaterThan(1);
  });

  it("maps u=0 toward length 1 and u→1 toward maxLength", () => {
    const shortFill = (bytes: Uint8Array) => {
      bytes.fill(0);
    };
    expect(randomRoomLength(20, shortFill)).toBe(1);
    expect(randomRoomString(20, shortFill).length).toBe(1);

    // Unit interval ≈ 1 − ε → length near max.
    const longFill = (bytes: Uint8Array) => {
      bytes.fill(0xff);
    };
    const L = randomRoomLength(20, longFill);
    expect(L).toBeGreaterThan(10);
    expect(L).toBeLessThanOrEqual(20);
  });
});
