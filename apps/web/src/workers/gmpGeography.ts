/*
  Physical geography via gmp-wasm for book-scale Babel rooms.
  Keeps q/r/level as mpz session state so the UI never holds megabyte strings.
*/

import { type GMPFunctions, type mpz_ptr } from "gmp-wasm";
import type { PhysicalDirection } from "@the-library/core";

export type GeographySnapshot = {
  shellCompact: string;
  levelCompact: string;
  geoCompact: string;
  qCompact: string;
  rCompact: string;
  babelRoomShort: string;
  bearing: string | null;
  physicalDistanceLabel: string | null;
  /** Full babel room (base-32) — only for open-volume; may be huge. */
  babelRoom: string;
};

type Gmp = GMPFunctions;

let binding: Gmp | null = null;
let qPtr: mpz_ptr | null = null;
let rPtr: mpz_ptr | null = null;
let levelPtr: mpz_ptr | null = null;

export function attachGmpGeography(g: Gmp): void {
  binding = g;
  clearSession();
}

function gmp(): Gmp {
  if (!binding) throw new Error("GMP geography not attached");
  return binding;
}

function clearSession(): void {
  const g = binding;
  if (!g) return;
  if (qPtr) {
    g.mpz_clears(qPtr, rPtr!, levelPtr!);
    qPtr = rPtr = levelPtr = null;
  }
}

function ensureSession(): { q: mpz_ptr; r: mpz_ptr; level: mpz_ptr } {
  const g = gmp();
  if (!qPtr) {
    qPtr = g.mpz_t();
    rPtr = g.mpz_t();
    levelPtr = g.mpz_t();
    g.mpz_init(qPtr);
    g.mpz_init(rPtr!);
    g.mpz_init(levelPtr!);
  }
  return { q: qPtr!, r: rPtr!, level: levelPtr! };
}

function withTemp(g: Gmp, n: number, fn: (temps: mpz_ptr[]) => void): void {
  const temps: mpz_ptr[] = [];
  for (let i = 0; i < n; i++) {
    const t = g.mpz_t();
    g.mpz_init(t);
    temps.push(t);
  }
  try {
    fn(temps);
  } finally {
    for (const t of temps) g.mpz_clear(t);
  }
}

function withTempRet<T>(g: Gmp, n: number, fn: (temps: mpz_ptr[]) => T): T {
  const temps: mpz_ptr[] = [];
  for (let i = 0; i < n; i++) {
    const t = g.mpz_t();
    g.mpz_init(t);
    temps.push(t);
  }
  try {
    return fn(temps);
  } finally {
    for (const t of temps) g.mpz_clear(t);
  }
}

function hexDiskSize(g: Gmp, R: mpz_ptr, out: mpz_ptr): void {
  // 1 + 3R(R+1)
  withTemp(g, 1, ([t]) => {
    g.mpz_add_ui(t, R, 1);
    g.mpz_mul(out, R, t);
    g.mpz_mul_ui(out, out, 3);
    g.mpz_add_ui(out, out, 1);
  });
}

function totalThroughShell(g: Gmp, R: mpz_ptr, out: mpz_ptr): void {
  // (2R+1) * hexDisk(R)
  withTemp(g, 2, ([disk, twoR1]) => {
    hexDiskSize(g, R, disk);
    g.mpz_mul_ui(twoR1, R, 2);
    g.mpz_add_ui(twoR1, twoR1, 1);
    g.mpz_mul(out, twoR1, disk);
  });
}

function integerCbrt(g: Gmp, n: mpz_ptr, out: mpz_ptr): void {
  if (g.mpz_cmp_ui(n, 2) < 0) {
    g.mpz_set(out, n);
    return;
  }
  const bits = g.mpz_sizeinbase(n, 2);
  const exp = Math.floor((bits + 2) / 3);
  g.mpz_set_ui(out, 1);
  g.mpz_mul_2exp(out, out, exp);

  withTemp(g, 3, ([x2, next, tmp]) => {
    for (let iter = 0; iter < 64; iter++) {
      g.mpz_mul(x2, out, out);
      if (g.mpz_sgn(x2) === 0) break;
      g.mpz_tdiv_q(tmp, n, x2);
      g.mpz_mul_ui(next, out, 2);
      g.mpz_add(next, next, tmp);
      g.mpz_tdiv_q_ui(next, next, 3);
      if (g.mpz_cmp(next, out) >= 0) break;
      g.mpz_set(out, next);
    }
    // Settle ±1
    for (let i = 0; i < 8; i++) {
      g.mpz_add_ui(tmp, out, 1);
      g.mpz_mul(x2, tmp, tmp);
      g.mpz_mul(x2, x2, tmp);
      if (g.mpz_cmp(x2, n) <= 0) g.mpz_set(out, tmp);
      else break;
    }
    for (let i = 0; i < 8; i++) {
      g.mpz_mul(x2, out, out);
      g.mpz_mul(x2, x2, out);
      if (g.mpz_cmp(x2, n) > 0) g.mpz_sub_ui(out, out, 1);
      else break;
    }
  });
}

function integerSqrt(g: Gmp, n: mpz_ptr, out: mpz_ptr): void {
  if (g.mpz_cmp_ui(n, 2) < 0) {
    g.mpz_set(out, n);
    return;
  }
  const bits = g.mpz_sizeinbase(n, 2);
  g.mpz_set_ui(out, 1);
  g.mpz_mul_2exp(out, out, Math.floor((bits + 1) / 2));
  withTemp(g, 2, ([next, tmp]) => {
    for (let iter = 0; iter < 64; iter++) {
      g.mpz_tdiv_q(tmp, n, out);
      g.mpz_add(next, out, tmp);
      g.mpz_tdiv_q_ui(next, next, 2);
      if (g.mpz_cmp(next, out) >= 0) break;
      g.mpz_set(out, next);
    }
    for (let i = 0; i < 8; i++) {
      g.mpz_add_ui(tmp, out, 1);
      g.mpz_mul(next, tmp, tmp);
      if (g.mpz_cmp(next, n) <= 0) g.mpz_set(out, tmp);
      else break;
    }
    for (let i = 0; i < 8; i++) {
      g.mpz_mul(next, out, out);
      if (g.mpz_cmp(next, n) > 0) g.mpz_sub_ui(out, out, 1);
      else break;
    }
  });
}

function findShell(g: Gmp, N: mpz_ptr, out: mpz_ptr): void {
  if (g.mpz_sgn(N) === 0) {
    g.mpz_set_ui(out, 0);
    return;
  }
  withTemp(g, 5, ([six, guess, lo, hi, tot]) => {
    g.mpz_set_ui(six, 6);
    g.mpz_tdiv_q(guess, N, six);
    integerCbrt(g, guess, guess);
    if (g.mpz_cmp_ui(guess, 1) < 0) g.mpz_set_ui(guess, 1);

    totalThroughShell(g, guess, tot);
    if (g.mpz_cmp(tot, N) > 0) {
      g.mpz_set(hi, guess);
      g.mpz_tdiv_q_ui(lo, guess, 2);
      while (g.mpz_sgn(lo) > 0) {
        totalThroughShell(g, lo, tot);
        if (g.mpz_cmp(tot, N) > 0) {
          g.mpz_set(hi, lo);
          g.mpz_tdiv_q_ui(lo, lo, 2);
        } else break;
      }
    } else {
      g.mpz_set(lo, guess);
      g.mpz_add_ui(hi, guess, 1);
      for (;;) {
        totalThroughShell(g, hi, tot);
        if (g.mpz_cmp(tot, N) > 0) break;
        g.mpz_set(lo, hi);
        g.mpz_mul_ui(hi, hi, 2);
        g.mpz_add_ui(hi, hi, 1);
      }
    }

    while (g.mpz_cmp(lo, hi) < 0) {
      // mid = (lo+hi)/2
      g.mpz_add(guess, lo, hi);
      g.mpz_tdiv_q_ui(guess, guess, 2);
      totalThroughShell(g, guess, tot);
      if (g.mpz_cmp(tot, N) > 0) g.mpz_set(hi, guess);
      else {
        g.mpz_add_ui(lo, guess, 1);
      }
    }
    g.mpz_set(out, lo);
  });
}

function findDiskRing(g: Gmp, offset: mpz_ptr, out: mpz_ptr): void {
  if (g.mpz_sgn(offset) === 0) {
    g.mpz_set_ui(out, 0);
    return;
  }
  withTemp(g, 5, ([guess, lo, hi, disk, tmp]) => {
    g.mpz_tdiv_q_ui(tmp, offset, 3);
    integerSqrt(g, tmp, guess);
    if (g.mpz_cmp_ui(guess, 1) < 0) g.mpz_set_ui(guess, 1);

    hexDiskSize(g, guess, disk);
    if (g.mpz_cmp(disk, offset) > 0) {
      g.mpz_set(hi, guess);
      g.mpz_set_ui(lo, 1);
      while (g.mpz_cmp(lo, hi) < 0) {
        g.mpz_add(tmp, lo, hi);
        g.mpz_tdiv_q_ui(tmp, tmp, 2);
        hexDiskSize(g, tmp, disk);
        if (g.mpz_cmp(disk, offset) > 0) g.mpz_set(hi, tmp);
        else g.mpz_add_ui(lo, tmp, 1);
      }
      g.mpz_set(out, lo);
      return;
    }

    g.mpz_set(lo, guess);
    g.mpz_add_ui(hi, guess, 1);
    for (;;) {
      hexDiskSize(g, hi, disk);
      if (g.mpz_cmp(disk, offset) > 0) break;
      g.mpz_set(lo, hi);
      g.mpz_mul_ui(hi, hi, 2);
      g.mpz_add_ui(hi, hi, 1);
    }
    while (g.mpz_cmp(lo, hi) < 0) {
      g.mpz_add(tmp, lo, hi);
      g.mpz_tdiv_q_ui(tmp, tmp, 2);
      hexDiskSize(g, tmp, disk);
      if (g.mpz_cmp(disk, offset) > 0) g.mpz_set(hi, tmp);
      else g.mpz_add_ui(lo, tmp, 1);
    }
    g.mpz_set(out, lo);
  });
}

/** Ring walk dirs: NW, SW, S, SE, NE, N as [dq, dr] */
const RING_DIRS: [number, number][] = [
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 1],
];

function ringCorner(g: Gmp, R: mpz_ptr, side: number, qOut: mpz_ptr, rOut: mpz_ptr): void {
  switch (side) {
    case 0:
      g.mpz_set(qOut, R);
      g.mpz_set_ui(rOut, 0);
      break;
    case 1:
      g.mpz_set_ui(qOut, 0);
      g.mpz_set(rOut, R);
      break;
    case 2:
      g.mpz_neg(qOut, R);
      g.mpz_set(rOut, R);
      break;
    case 3:
      g.mpz_neg(qOut, R);
      g.mpz_set_ui(rOut, 0);
      break;
    case 4:
      g.mpz_set_ui(qOut, 0);
      g.mpz_neg(rOut, R);
      break;
    case 5:
      g.mpz_set(qOut, R);
      g.mpz_neg(rOut, R);
      break;
    default:
      throw new Error("ringCorner: bad side");
  }
}

function hexRingUnrank(
  g: Gmp,
  R: mpz_ptr,
  i: mpz_ptr,
  qOut: mpz_ptr,
  rOut: mpz_ptr
): void {
  withTemp(g, 3, ([side, rem, tmp]) => {
    g.mpz_tdiv_qr(side, rem, i, R);
    const sideN = Number(g.mpz_get_ui(side));
    ringCorner(g, R, sideN, qOut, rOut);
    const [dq, dr] = RING_DIRS[sideN]!;
    if (dq !== 0) {
      g.mpz_mul_si(tmp, rem, dq);
      g.mpz_add(qOut, qOut, tmp);
    }
    if (dr !== 0) {
      g.mpz_mul_si(tmp, rem, dr);
      g.mpz_add(rOut, rOut, tmp);
    }
  });
}

function hexDiskUnrank(
  g: Gmp,
  R: mpz_ptr,
  offset: mpz_ptr,
  qOut: mpz_ptr,
  rOut: mpz_ptr
): void {
  if (g.mpz_sgn(offset) === 0) {
    g.mpz_set_ui(qOut, 0);
    g.mpz_set_ui(rOut, 0);
    return;
  }
  withTemp(g, 3, ([ring, ringStart, ringI]) => {
    findDiskRing(g, offset, ring);
    if (g.mpz_cmp(ring, R) > 0) {
      throw new Error("hexDiskUnrank: ring exceeds R");
    }
    g.mpz_sub_ui(ringStart, ring, 1);
    if (g.mpz_sgn(ringStart) < 0) {
      g.mpz_set_ui(qOut, 0);
      g.mpz_set_ui(rOut, 0);
      return;
    }
    hexDiskSize(g, ringStart, ringStart);
    g.mpz_sub(ringI, offset, ringStart);
    hexRingUnrank(g, ring, ringI, qOut, rOut);
  });
}

function unrankInShell(
  g: Gmp,
  R: mpz_ptr,
  offset: mpz_ptr,
  qOut: mpz_ptr,
  rOut: mpz_ptr,
  levelOut: mpz_ptr
): void {
  if (g.mpz_sgn(R) === 0) {
    g.mpz_set_ui(qOut, 0);
    g.mpz_set_ui(rOut, 0);
    g.mpz_set_ui(levelOut, 0);
    return;
  }
  withTemp(g, 5, ([D, H, midTotal, o, tmp]) => {
    hexDiskSize(g, R, D);
    g.mpz_mul_ui(H, R, 6);
    // midBands = 2R-1
    g.mpz_mul_ui(tmp, R, 2);
    g.mpz_sub_ui(tmp, tmp, 1);
    g.mpz_mul(midTotal, tmp, H);

    if (g.mpz_cmp(offset, D) < 0) {
      hexDiskUnrank(g, R, offset, qOut, rOut);
      g.mpz_neg(levelOut, R);
      return;
    }

    g.mpz_add(tmp, D, midTotal);
    if (g.mpz_cmp(offset, tmp) < 0) {
      g.mpz_sub(o, offset, D);
      g.mpz_tdiv_qr(tmp, o, o, H); // tmp = levelIndex, o = ringI
      // level = -R + 1 + levelIndex
      g.mpz_neg(levelOut, R);
      g.mpz_add_ui(levelOut, levelOut, 1);
      g.mpz_add(levelOut, levelOut, tmp);
      hexRingUnrank(g, R, o, qOut, rOut);
      return;
    }

    g.mpz_sub(o, offset, tmp);
    hexDiskUnrank(g, R, o, qOut, rOut);
    g.mpz_set(levelOut, R);
  });
}

function roomIndexToPhysical(
  g: Gmp,
  geo: mpz_ptr,
  qOut: mpz_ptr,
  rOut: mpz_ptr,
  levelOut: mpz_ptr
): void {
  withTemp(g, 3, ([R, start, offset]) => {
    findShell(g, geo, R);
    if (g.mpz_sgn(R) === 0) {
      g.mpz_set_ui(qOut, 0);
      g.mpz_set_ui(rOut, 0);
      g.mpz_set_ui(levelOut, 0);
      return;
    }
    g.mpz_sub_ui(start, R, 1);
    if (g.mpz_sgn(start) < 0) g.mpz_set_ui(start, 0);
    else totalThroughShell(g, start, start);
    g.mpz_sub(offset, geo, start);
    unrankInShell(g, R, offset, qOut, rOut, levelOut);
  });
}

function shortenRoom(room: string): string {
  if (room.length <= 16) return room;
  return `${room.slice(0, 8)}...${room.slice(-8)}`;
}

function withCommas(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function mpzCompact(g: Gmp, x: mpz_ptr): string {
  const neg = g.mpz_sgn(x) < 0;
  return withTempRet(g, 2, ([abs, top]) => {
    g.mpz_abs(abs, x);
    if (g.mpz_sgn(abs) === 0) return "0";
    const bits = g.mpz_sizeinbase(abs, 2);
    const approxDigits = Math.floor(bits * Math.LOG10E * Math.LN2) + 1;
    if (approxDigits <= 24) {
      const s = g.mpz_to_string(abs, 10);
      return (neg ? "-" : "") + withCommas(s);
    }
    const shift = Math.max(0, bits - 53);
    g.mpz_tdiv_q_2exp(top, abs, shift);
    const topNum = Number(g.mpz_to_string(top, 10));
    const log10 = Math.log10(topNum) + shift * Math.log10(2);
    const e = Math.floor(log10);
    let mant = 10 ** (log10 - e);
    if (mant >= 10) {
      mant /= 10;
      return `${neg ? "-" : ""}${mant.toFixed(2)} × 10${toSuperscript(e + 1)}`;
    }
    return `${neg ? "-" : ""}${mant.toFixed(2)} × 10${toSuperscript(e)}`;
  });
}

const SUPERSCRIPTS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
};

function toSuperscript(n: number): string {
  return String(n)
    .split("")
    .map((c) => SUPERSCRIPTS[c] ?? c)
    .join("");
}

function hexDistance(g: Gmp, q: mpz_ptr, r: mpz_ptr, out: mpz_ptr): void {
  // max(|q|, |r|, |-q-r|)
  withTemp(g, 3, ([aq, ar, as_]) => {
    g.mpz_abs(aq, q);
    g.mpz_abs(ar, r);
    g.mpz_add(as_, q, r);
    g.mpz_neg(as_, as_);
    g.mpz_abs(as_, as_);
    g.mpz_set(out, aq);
    if (g.mpz_cmp(ar, out) > 0) g.mpz_set(out, ar);
    if (g.mpz_cmp(as_, out) > 0) g.mpz_set(out, as_);
  });
}

function shellDistance(
  g: Gmp,
  q: mpz_ptr,
  r: mpz_ptr,
  level: mpz_ptr,
  out: mpz_ptr
): void {
  withTemp(g, 2, ([h, al]) => {
    hexDistance(g, q, r, h);
    g.mpz_abs(al, level);
    g.mpz_set(out, h);
    if (g.mpz_cmp(al, out) > 0) g.mpz_set(out, al);
  });
}

function snapshotFromSession(g: Gmp, babelRoom: string): GeographySnapshot {
  const { q, r, level } = ensureSession();
  return withTempRet(g, 2, ([shell, geo]) => {
    shellDistance(g, q, r, level, shell);
    // geo = physicalLocationToRoomIndex — expensive; derive from babelRoom-1 for display
    const roomMpz = g.mpz_t();
    g.mpz_init(roomMpz);
    g.mpz_set_string(roomMpz, babelRoom, 32);
    g.mpz_sub_ui(geo, roomMpz, 1);
    if (g.mpz_sgn(geo) < 0) g.mpz_set_ui(geo, 0);

    const levelCompact = mpzCompact(g, level);
    const signedLevel =
      g.mpz_sgn(level) > 0 ? `+${levelCompact}` : levelCompact;

    // Bearing only when coords fit float
    let bearing: string | null = null;
    let physicalDistanceLabel: string | null = null;
    const qBits = g.mpz_sizeinbase(q, 2);
    const rBits = g.mpz_sizeinbase(r, 2);
    const lBits = g.mpz_sizeinbase(level, 2);
    if (qBits <= 53 && rBits <= 53 && lBits <= 53) {
      const qn = Number(g.mpz_to_string(q, 10));
      const rn = Number(g.mpz_to_string(r, 10));
      const ln = Number(g.mpz_to_string(level, 10));
      const D = 1.25;
      const x = D * (1.5 * qn);
      const y = D * (Math.sqrt(3) * (rn + qn / 2));
      const z = D * ln;
      if (x !== 0 || y !== 0) {
        let deg = (Math.atan2(x, y) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        const whole = Math.floor(deg);
        let minutes = Math.round((deg - whole) * 60);
        let d = whole;
        if (minutes === 60) {
          minutes = 0;
          d = (d + 1) % 360;
        }
        bearing = `${d}° ${String(minutes).padStart(2, "0")}′`;
      }
      const euc = Math.hypot(x, y, z);
      physicalDistanceLabel = formatMeters(euc);
    }

    g.mpz_clear(roomMpz);

    return {
      shellCompact: mpzCompact(g, shell),
      levelCompact: signedLevel,
      geoCompact: mpzCompact(g, geo),
      qCompact: mpzCompact(g, q),
      rCompact: mpzCompact(g, r),
      babelRoomShort: shortenRoom(babelRoom),
      bearing,
      physicalDistanceLabel,
      babelRoom,
    };
  });
}

function formatMeters(meters: number): string {
  if (!Number.isFinite(meters)) return "beyond float range";
  const abs = Math.abs(meters);
  if (abs < 1000) return `${meters.toFixed(meters < 10 ? 2 : 1)} m`;
  const km = meters / 1000;
  if (abs < 1e10) return `${km.toFixed(km < 100 ? 1 : 0)} km`;
  return `${(meters / 9.4607304725808e15).toFixed(2)} LIGHT-YEARS`;
}

/** Seed session from a Babel room base-32 string (any size). */
export function gmpGeographySeedFromRoom(roomRaw: string): GeographySnapshot {
  const g = gmp();
  let room = roomRaw.toLowerCase();
  if (room.length > 1 && room.startsWith("0")) {
    room = room.replace(/^0+/, "") || "0";
  }
  if (!/^[0-9a-v]+$/.test(room)) {
    throw new Error("Room must be a base-32 string [0-9a-v]");
  }

  const { q, r, level } = ensureSession();
  withTemp(g, 2, ([babel, geo]) => {
    if (g.mpz_set_string(babel, room, 32) !== 0) {
      throw new Error("Failed to parse Babel room");
    }
    if (g.mpz_cmp_ui(babel, 1) < 0) {
      throw new Error("Babel room must be ≥ 1");
    }
    g.mpz_sub_ui(geo, babel, 1);
    roomIndexToPhysical(g, geo, q, r, level);
  });
  return snapshotFromSession(g, room);
}

export function gmpGeographyResetEntrance(): GeographySnapshot {
  const g = gmp();
  const { q, r, level } = ensureSession();
  g.mpz_set_ui(q, 0);
  g.mpz_set_ui(r, 0);
  g.mpz_set_ui(level, 0);
  return snapshotFromSession(g, "1");
}

const MOVE_DELTA: Record<
  Exclude<PhysicalDirection, "UP" | "DOWN">,
  [number, number]
> = {
  N: [0, 1],
  NE: [1, 0],
  SE: [1, -1],
  S: [0, -1],
  SW: [-1, 0],
  NW: [-1, 1],
};

/** Move session; returns new snapshot including updated babel room. */
export function gmpGeographyMove(direction: PhysicalDirection): GeographySnapshot {
  const g = gmp();
  const { q, r, level } = ensureSession();
  if (direction === "UP") {
    g.mpz_add_ui(level, level, 1);
  } else if (direction === "DOWN") {
    g.mpz_sub_ui(level, level, 1);
  } else {
    const [dq, dr] = MOVE_DELTA[direction];
    if (dq > 0) g.mpz_add_ui(q, q, dq);
    else if (dq < 0) g.mpz_sub_ui(q, q, -dq);
    if (dr > 0) g.mpz_add_ui(r, r, dr);
    else if (dr < 0) g.mpz_sub_ui(r, r, -dr);
  }

  // Convert physical → babel room via ranking
  const room = physicalToBabelRoom(g, q, r, level);
  return snapshotFromSession(g, room);
}

function physicalToBabelRoom(
  g: Gmp,
  q: mpz_ptr,
  r: mpz_ptr,
  level: mpz_ptr
): string {
  return withTempRet(g, 6, ([h, R, start, within, geo, tmp]) => {
    hexDistance(g, q, r, h);
    g.mpz_abs(tmp, level);
    g.mpz_set(R, h);
    if (g.mpz_cmp(tmp, R) > 0) g.mpz_set(R, tmp);

    if (g.mpz_sgn(R) === 0) return "1";

    g.mpz_sub_ui(start, R, 1);
    if (g.mpz_sgn(start) < 0) g.mpz_set_ui(start, 0);
    else totalThroughShell(g, start, start);

    rankInShell(g, R, q, r, level, within);
    g.mpz_add(geo, start, within);
    g.mpz_add_ui(geo, geo, 1);
    return g.mpz_to_string(geo, 32);
  });
}

function hexDiskRank(g: Gmp, q: mpz_ptr, r: mpz_ptr, out: mpz_ptr): void {
  withTemp(g, 3, ([d, prev, ringI]) => {
    hexDistance(g, q, r, d);
    if (g.mpz_sgn(d) === 0) {
      g.mpz_set_ui(out, 0);
      return;
    }
    g.mpz_sub_ui(prev, d, 1);
    hexDiskSize(g, prev, prev);
    hexRingRank(g, d, q, r, ringI);
    g.mpz_add(out, prev, ringI);
  });
}

function hexRingRank(
  g: Gmp,
  R: mpz_ptr,
  q: mpz_ptr,
  r: mpz_ptr,
  out: mpz_ptr
): void {
  withTemp(g, 2, ([t, sum]) => {
    g.mpz_add(sum, q, r);

    // Side 0: (R-t, t) → q+r===R && q>0 && 0<=r<R → index r
    if (
      g.mpz_cmp(sum, R) === 0 &&
      g.mpz_sgn(q) > 0 &&
      g.mpz_sgn(r) >= 0 &&
      g.mpz_cmp(r, R) < 0
    ) {
      g.mpz_set(out, r);
      return;
    }

    // Side 1: (-t, R) → r===R && -R<q<=0 → index R + (-q)
    g.mpz_neg(t, R);
    if (
      g.mpz_cmp(r, R) === 0 &&
      g.mpz_sgn(q) <= 0 &&
      g.mpz_cmp(q, t) > 0
    ) {
      g.mpz_neg(t, q);
      g.mpz_add(out, R, t);
      return;
    }

    // Side 2: (-R, R-t) → q===-R && 0<r<=R → index 2R + (R-r)
    g.mpz_neg(t, R);
    if (
      g.mpz_cmp(q, t) === 0 &&
      g.mpz_sgn(r) > 0 &&
      g.mpz_cmp(r, R) <= 0
    ) {
      g.mpz_sub(t, R, r);
      g.mpz_mul_ui(out, R, 2);
      g.mpz_add(out, out, t);
      return;
    }

    // Side 3: (-R+t, -t) → q+r===-R && -R<r<=0 → index 3R + (-r)
    g.mpz_neg(t, R);
    if (
      g.mpz_cmp(sum, t) === 0 &&
      g.mpz_sgn(r) <= 0 &&
      g.mpz_cmp(r, t) > 0
    ) {
      g.mpz_neg(t, r);
      g.mpz_mul_ui(out, R, 3);
      g.mpz_add(out, out, t);
      return;
    }

    // Side 4: (t, -R) → r===-R && 0<=q<R → index 4R + q
    g.mpz_neg(t, R);
    if (
      g.mpz_cmp(r, t) === 0 &&
      g.mpz_sgn(q) >= 0 &&
      g.mpz_cmp(q, R) < 0
    ) {
      g.mpz_mul_ui(out, R, 4);
      g.mpz_add(out, out, q);
      return;
    }

    // Side 5: (R, -R+t) → q===R && -R<=r<0 → index 5R + (r+R)
    if (
      g.mpz_cmp(q, R) === 0 &&
      g.mpz_sgn(r) < 0 &&
      g.mpz_cmp(r, t) >= 0
    ) {
      g.mpz_add(t, r, R);
      g.mpz_mul_ui(out, R, 5);
      g.mpz_add(out, out, t);
      return;
    }

    throw new Error("hexRingRank: failed to classify side");
  });
}

function rankInShell(
  g: Gmp,
  R: mpz_ptr,
  q: mpz_ptr,
  r: mpz_ptr,
  level: mpz_ptr,
  out: mpz_ptr
): void {
  if (g.mpz_sgn(R) === 0) {
    g.mpz_set_ui(out, 0);
    return;
  }
  withTemp(g, 4, ([D, H, absLevel, tmp]) => {
    hexDiskSize(g, R, D);
    g.mpz_mul_ui(H, R, 6);
    g.mpz_abs(absLevel, level);

    // level === -R
    g.mpz_neg(tmp, R);
    if (g.mpz_cmp(level, tmp) === 0) {
      hexDiskRank(g, q, r, out);
      return;
    }
    // level === R
    if (g.mpz_cmp(level, R) === 0) {
      // D + (2R-1)*H + diskRank
      g.mpz_mul_ui(tmp, R, 2);
      g.mpz_sub_ui(tmp, tmp, 1);
      g.mpz_mul(tmp, tmp, H);
      g.mpz_add(tmp, D, tmp);
      hexDiskRank(g, q, r, out);
      g.mpz_add(out, tmp, out);
      return;
    }
    // mid: D + levelIndex*H + ringRank, levelIndex = level + R - 1
    g.mpz_add(tmp, level, R);
    g.mpz_sub_ui(tmp, tmp, 1);
    g.mpz_mul(tmp, tmp, H);
    g.mpz_add(tmp, D, tmp);
    hexRingRank(g, R, q, r, out);
    g.mpz_add(out, tmp, out);
  });
}

export function gmpGeographyGetBabelRoom(): string {
  const g = gmp();
  const { q, r, level } = ensureSession();
  return physicalToBabelRoom(g, q, r, level);
}
