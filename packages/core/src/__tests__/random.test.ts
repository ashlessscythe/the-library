/*
  Random identifier — fast tests (no book-scale load).
*/

import { BASE32_ALPHA, BOOKS, PAGES, SHELVES, WALLS } from "../constants";
import {
  randomBigIntBelow,
  randomIdentifier,
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

  it("varies room digit length under length-uniform sampling", () => {
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

  it("can produce short and mid-length rooms under a controlled fill", () => {
    const shortFill = (bytes: Uint8Array) => {
      bytes.fill(0);
    };
    expect(randomRoomString(20, shortFill).length).toBe(1);

    // Length draw: return 11 → room length 12.
    const midFill = (bytes: Uint8Array) => {
      bytes.fill(0);
      if (bytes.length >= 1) bytes[bytes.length - 1] = 11;
    };
    const mid = randomRoomString(20, midFill);
    expect(mid.length).toBe(12);
  });

  it("rejects invalid maxLength", () => {
    expect(() => randomRoomString(0)).toThrow(/maxLength/);
    expect(() => randomRoomString(1.5)).toThrow(/maxLength/);
  });
});
