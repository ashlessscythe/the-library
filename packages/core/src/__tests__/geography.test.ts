/*
  Physical geography — exhaustive small-range + large BigInt tests.
*/

import {
  AU_METERS,
  LIGHT_YEAR_METERS,
  ROOM_SPACING_METERS,
  babelRoomToPhysicalLocation,
  bearingDegrees,
  bitLength,
  findShell,
  integerCbrt,
  integerSqrt,
  formatCompactBigInt,
  formatLibraryDistance,
  formatPhysicalLocation,
  formatTechnicalBigInt,
  hexDiskRank,
  hexDiskSize,
  hexDiskUnrank,
  hexDistance,
  hexRingRank,
  hexRingUnrank,
  horizontalDistanceMeters,
  move,
  oppositeDirection,
  physicalLocationToBabelRoom,
  physicalLocationToRoomIndex,
  roomDistanceFromOrigin,
  roomIndexToPhysicalLocation,
  shellSize,
  totalThroughShell,
  verticalDistanceMeters,
  type PhysicalDirection,
  type PhysicalLocation,
} from "../geography";

function locKey(l: PhysicalLocation): string {
  return `${l.q},${l.r},${l.level}`;
}

describe("hex primitives", () => {
  it("computes hex distance examples from the spec", () => {
    expect(hexDistance(0n, 0n)).toBe(0n);
    expect(hexDistance(1n, 0n)).toBe(1n);
    expect(hexDistance(0n, 1n)).toBe(1n);
    expect(hexDistance(-1n, 1n)).toBe(1n);
    expect(hexDistance(5n, -2n)).toBe(5n);
  });

  it("round-trips ring unrank/rank for small radii", () => {
    for (const R of [1n, 2n, 3n, 5n, 10n]) {
      const size = 6n * R;
      for (let i = 0n; i < size; i++) {
        const { q, r } = hexRingUnrank(R, i);
        expect(hexDistance(q, r)).toBe(R);
        expect(hexRingRank(R, q, r)).toBe(i);
      }
    }
  });

  it("round-trips disk unrank/rank for small radii", () => {
    for (const R of [0n, 1n, 2n, 3n, 4n]) {
      const size = hexDiskSize(R);
      const seen = new Set<string>();
      for (let i = 0n; i < size; i++) {
        const { q, r } = hexDiskUnrank(R, i);
        expect(hexDistance(q, r) <= R).toBe(true);
        expect(hexDiskRank(q, r)).toBe(i);
        const k = `${q},${r}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
      expect(seen.size).toBe(Number(size));
    }
  });

  it("matches hexDisk formula", () => {
    expect(hexDiskSize(0n)).toBe(1n);
    expect(hexDiskSize(1n)).toBe(7n);
    expect(hexDiskSize(2n)).toBe(19n);
    expect(hexDiskSize(3n)).toBe(37n);
  });
});

describe("shell totals", () => {
  it("matches closed-form totals", () => {
    expect(totalThroughShell(0n)).toBe(1n);
    expect(totalThroughShell(1n)).toBe(21n);
    expect(totalThroughShell(2n)).toBe(95n);
    expect(totalThroughShell(3n)).toBe(259n);
  });

  it("shell sizes at boundaries", () => {
    expect(shellSize(0n)).toBe(1n);
    expect(shellSize(1n)).toBe(20n);
    expect(shellSize(2n)).toBe(74n);
  });

  it("findShell at total(R)-1 and total(R)", () => {
    for (let R = 0n; R <= 8n; R++) {
      const t = totalThroughShell(R);
      if (R === 0n) {
        expect(findShell(0n)).toBe(0n);
      } else {
        expect(findShell(t - 1n)).toBe(R);
        expect(findShell(totalThroughShell(R - 1n))).toBe(R);
      }
      // first index of next shell
      expect(findShell(t)).toBe(R + 1n);
    }
  });

  it("integer roots match small values", () => {
    expect(integerSqrt(0n)).toBe(0n);
    expect(integerSqrt(1n)).toBe(1n);
    expect(integerSqrt(15n)).toBe(3n);
    expect(integerSqrt(16n)).toBe(4n);
    expect(integerCbrt(0n)).toBe(0n);
    expect(integerCbrt(8n)).toBe(2n);
    expect(integerCbrt(27n)).toBe(3n);
    expect(integerCbrt(26n)).toBe(2n);
  });

  it("findShell handles huge indices without hanging", () => {
    const samples = [10n ** 40n, 10n ** 200n, 10n ** 500n];
    for (const n of samples) {
      const R = findShell(n);
      expect(totalThroughShell(R) > n).toBe(true);
      if (R > 0n) expect(totalThroughShell(R - 1n) <= n).toBe(true);
    }
  });
});

describe("room index ↔ physical location", () => {
  it("maps entrance", () => {
    expect(roomIndexToPhysicalLocation(0n)).toEqual({
      q: 0n,
      r: 0n,
      level: 0n,
    });
    expect(physicalLocationToRoomIndex({ q: 0n, r: 0n, level: 0n })).toBe(0n);
  });

  it("round-trips 0..100_000 with no duplicate locations", () => {
    const seen = new Set<string>();
    const N = 100_000;
    for (let i = 0; i <= N; i++) {
      const idx = BigInt(i);
      const loc = roomIndexToPhysicalLocation(idx);
      expect(physicalLocationToRoomIndex(loc)).toBe(idx);
      const k = locKey(loc);
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      // shell distance equals findShell
      expect(roomDistanceFromOrigin(loc)).toBe(findShell(idx));
    }
    expect(seen.size).toBe(N + 1);
  });

  it("covers negative levels in shell 1", () => {
    const locs = [];
    for (let i = 0n; i < totalThroughShell(1n); i++) {
      locs.push(roomIndexToPhysicalLocation(i));
    }
    expect(locs.some((l) => l.level === -1n)).toBe(true);
    expect(locs.some((l) => l.level === 1n)).toBe(true);
    expect(locs.some((l) => l.level === 0n)).toBe(true);
  });

  it("round-trips large BigInts beyond MAX_SAFE_INTEGER", () => {
    const samples = [
      10n ** 40n,
      10n ** 200n,
      9_007_199_254_740_993n, // just above MAX_SAFE_INTEGER
      totalThroughShell(1000n) - 1n,
      totalThroughShell(1000n),
      totalThroughShell(50_000n) + 12345n,
    ];
    for (const n of samples) {
      const loc = roomIndexToPhysicalLocation(n);
      expect(physicalLocationToRoomIndex(loc)).toBe(n);
      expect(roomDistanceFromOrigin(loc)).toBe(findShell(n));
    }
  });

  it("bridges Babel room 1 ↔ Entrance", () => {
    expect(babelRoomToPhysicalLocation(1n)).toEqual({
      q: 0n,
      r: 0n,
      level: 0n,
    });
    expect(
      physicalLocationToBabelRoom({ q: 0n, r: 0n, level: 0n })
    ).toBe(1n);
    expect(
      physicalLocationToBabelRoom(babelRoomToPhysicalLocation(42n))
    ).toBe(42n);
    expect(() => babelRoomToPhysicalLocation(0n)).toThrow();
  });
});

describe("movement", () => {
  const dirs: PhysicalDirection[] = [
    "N",
    "NE",
    "SE",
    "S",
    "SW",
    "NW",
    "UP",
    "DOWN",
  ];

  it("moves all six horizontal directions and UP/DOWN", () => {
    const origin: PhysicalLocation = { q: 0n, r: 0n, level: 0n };
    expect(move(origin, "N")).toEqual({ q: 0n, r: 1n, level: 0n });
    expect(move(origin, "NE")).toEqual({ q: 1n, r: 0n, level: 0n });
    expect(move(origin, "SE")).toEqual({ q: 1n, r: -1n, level: 0n });
    expect(move(origin, "S")).toEqual({ q: 0n, r: -1n, level: 0n });
    expect(move(origin, "SW")).toEqual({ q: -1n, r: 0n, level: 0n });
    expect(move(origin, "NW")).toEqual({ q: -1n, r: 1n, level: 0n });
    expect(move(origin, "UP")).toEqual({ q: 0n, r: 0n, level: 1n });
    expect(move(origin, "DOWN")).toEqual({ q: 0n, r: 0n, level: -1n });
  });

  it("is reversible for every direction", () => {
    const start: PhysicalLocation = { q: 3n, r: -2n, level: 5n };
    for (const d of dirs) {
      const back = move(move(start, d), oppositeDirection(d));
      expect(back).toEqual(start);
    }
  });

  it("horizontal move preserves level; vertical preserves q/r", () => {
    const start: PhysicalLocation = { q: 2n, r: 2n, level: 7n };
    for (const d of ["N", "NE", "SE", "S", "SW", "NW"] as const) {
      expect(move(start, d).level).toBe(7n);
    }
    expect(move(start, "UP").q).toBe(2n);
    expect(move(start, "UP").r).toBe(2n);
    expect(move(start, "DOWN").q).toBe(2n);
    expect(move(start, "DOWN").r).toBe(2n);
  });
});

describe("distance and formatting", () => {
  it("matches physicalDistance examples", () => {
    expect(roomDistanceFromOrigin({ q: 0n, r: 0n, level: 0n })).toBe(0n);
    expect(roomDistanceFromOrigin({ q: 1n, r: 0n, level: 0n })).toBe(1n);
    expect(roomDistanceFromOrigin({ q: 0n, r: 0n, level: 1n })).toBe(1n);
    expect(roomDistanceFromOrigin({ q: 0n, r: 0n, level: -1n })).toBe(1n);
    expect(roomDistanceFromOrigin({ q: 5n, r: -2n, level: 3n })).toBe(5n);
  });

  it("uses ROOM_SPACING_METERS for axis distances", () => {
    const loc: PhysicalLocation = { q: 2n, r: 0n, level: 3n };
    expect(horizontalDistanceMeters(loc)).toBe(2 * ROOM_SPACING_METERS);
    expect(verticalDistanceMeters(loc)).toBe(3 * ROOM_SPACING_METERS);
  });

  it("computes bearing with 0° = North", () => {
    // N = +r → positive y
    const north = bearingDegrees({ q: 0n, r: 1n, level: 0n });
    expect(north).not.toBeNull();
    expect(north!).toBeCloseTo(0, 5);

    const east = bearingDegrees({ q: 1n, r: 0n, level: 0n });
    expect(east).not.toBeNull();
    // NE axial (+1,0) is 30° east of pure east in pointy-top? 
    // x = 1.25*1.5, y = 1.25*sqrt(3)*(0+0.5) → atan2(x,y)
    expect(east!).toBeGreaterThan(0);
    expect(east!).toBeLessThan(180);
  });

  it("formats distances with unit escalation", () => {
    expect(formatLibraryDistance(12.5)).toMatch(/m$/);
    expect(formatLibraryDistance(4_672_800)).toMatch(/km/);
    expect(formatLibraryDistance(Number(AU_METERS) * 2)).toMatch(/AU/);
    expect(formatLibraryDistance(Number(LIGHT_YEAR_METERS) * 1.01)).toMatch(
      /LIGHT-YEARS/
    );
  });

  it("formats huge indices with scientific notation (no megabyte strings)", () => {
    const huge = 10n ** 200n;
    const s = formatCompactBigInt(huge);
    expect(s.length).toBeLessThan(40);
    expect(s).toMatch(/× 10/);

    const tech = formatTechnicalBigInt(huge);
    expect(tech.length).toBeLessThan(80);
    expect(tech).toMatch(/digits/);
  });

  it("formatPhysicalLocation includes core sections", () => {
    const text = formatPhysicalLocation({ q: 1n, r: 0n, level: 0n });
    expect(text).toContain("FROM THE ENTRANCE");
    expect(text).toContain("DISTANCE");
    expect(text).toContain("LEVEL");
    expect(text).toContain("BEARING");
    expect(text).toContain("PHYSICAL DISTANCE");
  });

  it("bitLength matches for powers of two", () => {
    expect(bitLength(0n)).toBe(0);
    expect(bitLength(1n)).toBe(1);
    expect(bitLength(2n)).toBe(2);
    expect(bitLength(255n)).toBe(8);
    expect(bitLength(256n)).toBe(9);
    expect(bitLength(1n << 100n)).toBe(101);
  });
});
