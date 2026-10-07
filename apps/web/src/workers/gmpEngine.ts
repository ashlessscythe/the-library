/*
  Browser library engine via gmp-wasm (same approach as tdjsnelling/babel).

  Native JS BigInt cannot hold babel-v3 constants on JavaScriptCore (Safari /
  iOS): JSC caps BigInts at 2^20 bits (~1M) while N/C/I are ~6.5M bits.
  Multiplying those values throws:
    RangeError: Out of memory: BigInt generated from this operation is too big
*/

import { init, type GMPFunctions, type mpz_ptr } from "gmp-wasm";
import {
  ALPHA,
  BOOK_LENGTH,
  BOOKS,
  BOOKS_PER_ROOM,
  FLOOR_STRIDE,
  PAGE_LENGTH,
  PAGES,
  SHELVES,
  WALLS,
  randomIdentifier,
  type MoveDirection,
  type PageContent,
} from "@the-library/core";
import { attachGmpGeography } from "./gmpGeography";

const NUM_MAP: Record<string, string> = {};
const CHAR_MAP: Record<string, string> = {};
for (let i = 0; i < ALPHA.length; i++) {
  NUM_MAP[i.toString(32)] = ALPHA[i];
  CHAR_MAP[ALPHA[i]] = i.toString(32);
}

let binding: GMPFunctions | null = null;
let N: mpz_ptr | null = null;
let C: mpz_ptr | null = null;
let I: mpz_ptr | null = null;
let randState: number | null = null;

function gmp(): GMPFunctions {
  if (!binding) throw new Error("GMP engine not initialised");
  return binding;
}

function requireConsts(): { N: mpz_ptr; C: mpz_ptr; I: mpz_ptr } {
  if (N == null || C == null || I == null) {
    throw new Error("GMP constants not initialised");
  }
  return { N, C, I };
}

function shortenRoom(room: string): string {
  if (room.length <= 16) return room;
  return `${room.slice(0, 8)}...${room.slice(-8)}`;
}

function assertBounds(wall: number, shelf: number, book: number, page: number) {
  if (!Number.isInteger(wall) || wall < 1 || wall > WALLS) {
    throw new Error(`Wall must be between 1 and ${WALLS}`);
  }
  if (!Number.isInteger(shelf) || shelf < 1 || shelf > SHELVES) {
    throw new Error(`Shelf must be between 1 and ${SHELVES}`);
  }
  if (!Number.isInteger(book) || book < 1 || book > BOOKS) {
    throw new Error(`Book must be between 1 and ${BOOKS}`);
  }
  if (!Number.isInteger(page) || page < 1 || page > PAGES) {
    throw new Error(`Page must be between 1 and ${PAGES}`);
  }
}

function wrapWall(wall: number): { wall: number; roomDelta: number } {
  if (wall < 1) return { wall: WALLS, roomDelta: -1 };
  if (wall > WALLS) return { wall: 1, roomDelta: 1 };
  return { wall, roomDelta: 0 };
}

function formatParts(
  room: string,
  wall: number,
  shelf: number,
  book: number,
  page: number
): string {
  return [room, wall, shelf, book, page].join(".");
}

function normalizeRoom(roomRaw: string): string {
  let room = roomRaw.toLowerCase();
  if (room.length > 1 && room.startsWith("0")) {
    room = room.replace(/^0+/, "");
    if (room.length === 0) room = "0";
  }
  return room;
}

/** Load N, C, I from numbers.hex.json payload into GMP integers. */
export async function initGmpEngine(hexJson: string): Promise<void> {
  const lib = await init();
  binding = lib.binding;
  const g = binding;

  const data = JSON.parse(hexJson) as { N?: string; C?: string; I?: string };
  if (!data.N?.startsWith("0x") || !data.C?.startsWith("0x") || !data.I?.startsWith("0x")) {
    throw new Error("numbers.hex.json must contain 0x-prefixed N, C, I");
  }

  const nPtr = g.mpz_t();
  const cPtr = g.mpz_t();
  const iPtr = g.mpz_t();
  g.mpz_init(nPtr);
  g.mpz_init(cPtr);
  g.mpz_init(iPtr);

  if (g.mpz_set_string(nPtr, data.N.slice(2), 16) !== 0) {
    throw new Error("Failed to parse N");
  }
  if (g.mpz_set_string(cPtr, data.C.slice(2), 16) !== 0) {
    throw new Error("Failed to parse C");
  }
  if (g.mpz_set_string(iPtr, data.I.slice(2), 16) !== 0) {
    throw new Error("Failed to parse I");
  }

  N = nPtr;
  C = cPtr;
  I = iPtr;

  // gmp-wasm accepts a numeric state handle; 0 is the conventional default slot.
  randState = 0;
  g.gmp_randinit_default(randState as never);
  g.gmp_randseed_ui(randState as never, (Date.now() >>> 0) || 1);

  attachGmpGeography(g);
}

function seqFromIdentifier(identifier: string): {
  seq: mpz_ptr;
  page: number;
  room: string;
  wall: number;
  shelf: number;
  book: number;
} {
  const g = gmp();
  const parts = identifier.split(".");
  if (parts.length !== 5) {
    throw new Error("Identifier must be ROOM.WALL.SHELF.BOOK.PAGE");
  }
  const [roomRaw, wallS, shelfS, bookS, pageS] = parts;
  const room = normalizeRoom(roomRaw);
  if (!/^[0-9a-v]+$/.test(room)) {
    throw new Error("Room must be a base-32 string [0-9a-v]");
  }

  const wall = Number(wallS);
  const shelf = Number(shelfS);
  const book = Number(bookS);
  const page = Number(pageS);
  assertBounds(wall, shelf, book, page);

  const intRoom = g.mpz_t();
  g.mpz_init(intRoom);
  g.mpz_set_string(intRoom, room, 32);
  if (g.mpz_cmp_ui(intRoom, 1) < 0) {
    g.mpz_clear(intRoom);
    throw new Error("Room cannot be smaller than 1");
  }

  const pRooms = g.mpz_t();
  g.mpz_init(pRooms);
  g.mpz_sub_ui(pRooms, intRoom, 1);
  g.mpz_mul_ui(pRooms, pRooms, BOOKS_PER_ROOM);

  const seq = g.mpz_t();
  g.mpz_init(seq);
  g.mpz_add_ui(
    seq,
    pRooms,
    (wall - 1) * SHELVES * BOOKS + (shelf - 1) * BOOKS + book
  );

  g.mpz_clears(intRoom, pRooms);
  return { seq, page, room, wall, shelf, book };
}

/**
 * Convert 1-based sequential book index → identifier.
 * Consumes/mutates `seq` (caller must not reuse it).
 */
function identifierFromSeq(seq: mpz_ptr, page: number): string {
  const g = gmp();
  g.mpz_sub_ui(seq, seq, 1);

  if (g.mpz_sgn(seq) < 0) {
    return formatParts("1", 1, 1, 1, page < 1 ? 1 : page);
  }

  const room = g.mpz_t();
  g.mpz_init(room);
  g.mpz_tdiv_q_ui(room, seq, BOOKS_PER_ROOM);
  g.mpz_add_ui(room, room, 1);
  g.mpz_mod_ui(seq, seq, BOOKS_PER_ROOM);

  const wallMpz = g.mpz_t();
  g.mpz_init(wallMpz);
  g.mpz_tdiv_q_ui(wallMpz, seq, SHELVES * BOOKS);
  g.mpz_add_ui(wallMpz, wallMpz, 1);
  g.mpz_mod_ui(seq, seq, SHELVES * BOOKS);

  const shelfMpz = g.mpz_t();
  g.mpz_init(shelfMpz);
  g.mpz_tdiv_q_ui(shelfMpz, seq, BOOKS);
  g.mpz_add_ui(shelfMpz, shelfMpz, 1);
  g.mpz_mod_ui(seq, seq, BOOKS);

  g.mpz_add_ui(seq, seq, 1);

  const roomString = g.mpz_to_string(room, 32);
  const wall = Number(g.mpz_get_ui(wallMpz));
  const shelf = Number(g.mpz_get_ui(shelfMpz));
  const book = Number(g.mpz_get_ui(seq));

  g.mpz_clears(room, wallMpz, shelfMpz);

  return formatParts(roomString, wall, shelf, book, page);
}

function applyRoomDelta(roomStr: string, delta: number): string {
  const g = gmp();
  const room = g.mpz_t();
  g.mpz_init(room);
  g.mpz_set_string(room, roomStr, 32);
  if (delta >= 0) g.mpz_add_ui(room, room, delta);
  else g.mpz_sub_ui(room, room, -delta);
  if (g.mpz_cmp_ui(room, 1) < 0) g.mpz_set_ui(room, 1);
  const out = g.mpz_to_string(room, 32);
  g.mpz_clear(room);
  return out;
}

export function gmpGeneratePage(identifier: string): PageContent {
  const g = gmp();
  const { C: cPtr, N: nPtr } = requireConsts();
  const { seq, page, room, wall, shelf, book } = seqFromIdentifier(identifier);

  const result = g.mpz_t();
  g.mpz_init(result);
  g.mpz_mul(result, cPtr, seq);
  g.mpz_mod(result, result, nPtr);

  let hash = g.mpz_to_string(result, 32);
  g.mpz_clear(result);

  if (hash.length < BOOK_LENGTH) {
    hash = "0".repeat(BOOK_LENGTH - hash.length) + hash;
  } else if (hash.length > BOOK_LENGTH) {
    throw new Error("Content hash longer than BOOK_LENGTH");
  }

  const start = (page - 1) * PAGE_LENGTH;
  const end = start + PAGE_LENGTH;
  const contentArr = new Array<string>(end - start);
  for (let i = 0; i < contentArr.length; i++) {
    contentArr[i] = NUM_MAP[hash[start + i]];
  }
  const content = contentArr.join("");

  const nextSeq = g.mpz_t();
  g.mpz_init(nextSeq);
  g.mpz_set(nextSeq, seq);
  let nextPage = page;
  if (nextPage === PAGES) {
    g.mpz_add_ui(nextSeq, nextSeq, 1);
    nextPage = 1;
  } else {
    nextPage++;
  }
  const nextIdentifier = identifierFromSeq(nextSeq, nextPage);
  g.mpz_clear(nextSeq);

  // Match native generateContent: page-1 wraps to previous book's last page
  // (coordinateFromSequential(0, …) clamps to room 1.1.1.1).
  const prevSeq = g.mpz_t();
  g.mpz_init(prevSeq);
  g.mpz_set(prevSeq, seq);
  let prevPage = page;
  if (prevPage === 1) {
    g.mpz_sub_ui(prevSeq, prevSeq, 1);
    prevPage = PAGES;
  } else {
    prevPage--;
  }
  const prevIdentifier = identifierFromSeq(prevSeq, prevPage);
  g.mpz_clear(prevSeq);

  g.mpz_clear(seq);

  return {
    content,
    roomShort: shortenRoom(room),
    room,
    wall: String(wall),
    shelf: String(shelf),
    book: String(book),
    page: String(page),
    nextIdentifier,
    prevIdentifier,
  };
}

export function gmpLookupContent(content: string, page: number): string {
  const g = gmp();
  const { I: iPtr, N: nPtr } = requireConsts();
  if (content.length !== BOOK_LENGTH) {
    throw new Error(`Content must be exactly ${BOOK_LENGTH} characters`);
  }

  const digits = new Array<string>(BOOK_LENGTH);
  for (let i = 0; i < BOOK_LENGTH; i++) {
    const d = CHAR_MAP[content[i]];
    if (d === undefined) throw new Error(`Unsupported character at ${i}`);
    digits[i] = d;
  }

  const seq = g.mpz_t();
  g.mpz_init(seq);
  g.mpz_set_string(seq, digits.join(""), 32);
  g.mpz_mul(seq, seq, iPtr);
  g.mpz_mod(seq, seq, nPtr);

  const identifier = identifierFromSeq(seq, page);
  g.mpz_clear(seq);
  return identifier;
}

/**
 * Length-uniform random identifier (same distribution as core
 * {@link randomIdentifier} / Geography “Jump to random”).
 * Value-uniform sampling over the book space almost always yields ~book-length
 * room ids; length-uniform sampling spreads short → book-scale evenly.
 */
export function gmpRandomIdentifier(): string {
  // Engine must be ready (N/C/I loaded) before /random is offered, but room
  // sampling no longer depends on those constants.
  gmp();
  return randomIdentifier();
}

export function gmpMoveIdentifier(
  identifier: string,
  direction: MoveDirection
): string {
  const g = gmp();
  const parts = identifier.split(".");
  if (parts.length !== 5) {
    throw new Error("Identifier must be ROOM.WALL.SHELF.BOOK.PAGE");
  }
  let room = normalizeRoom(parts[0]);
  let wall = Number(parts[1]);
  let shelf = Number(parts[2]);
  let book = Number(parts[3]);
  let page = Number(parts[4]);
  assertBounds(wall, shelf, book, page);

  const finish = () => formatParts(room, wall, shelf, book, page);

  switch (direction) {
    case "up": {
      if (shelf < SHELVES) {
        shelf += 1;
        return finish();
      }
      const wrapped = wrapWall(wall + 1);
      room = applyRoomDelta(room, wrapped.roomDelta);
      wall = wrapped.wall;
      shelf = 1;
      return finish();
    }
    case "down": {
      if (shelf > 1) {
        shelf -= 1;
        return finish();
      }
      const wrapped = wrapWall(wall - 1);
      room = applyRoomDelta(room, wrapped.roomDelta);
      wall = wrapped.wall;
      shelf = SHELVES;
      return finish();
    }
    case "left": {
      const wrapped = wrapWall(wall - 1);
      room = applyRoomDelta(room, wrapped.roomDelta);
      wall = wrapped.wall;
      return finish();
    }
    case "right": {
      const wrapped = wrapWall(wall + 1);
      room = applyRoomDelta(room, wrapped.roomDelta);
      wall = wrapped.wall;
      return finish();
    }
    case "forward": {
      if (book < BOOKS) {
        book += 1;
        return finish();
      }
      if (shelf < SHELVES) {
        shelf += 1;
        book = 1;
        return finish();
      }
      const wrapped = wrapWall(wall + 1);
      room = applyRoomDelta(room, wrapped.roomDelta);
      wall = wrapped.wall;
      shelf = 1;
      book = 1;
      return finish();
    }
    case "back": {
      if (book > 1) {
        book -= 1;
        return finish();
      }
      if (shelf > 1) {
        shelf -= 1;
        book = BOOKS;
        return finish();
      }
      const wrapped = wrapWall(wall - 1);
      room = applyRoomDelta(room, wrapped.roomDelta);
      wall = wrapped.wall;
      shelf = SHELVES;
      book = BOOKS;
      return finish();
    }
    case "pageNext": {
      if (page < PAGES) {
        page += 1;
        return finish();
      }
      const { seq } = seqFromIdentifier(identifier);
      g.mpz_add_ui(seq, seq, 1);
      const next = identifierFromSeq(seq, 1);
      g.mpz_clear(seq);
      return next;
    }
    case "pagePrev": {
      if (page > 1) {
        page -= 1;
        return finish();
      }
      const { seq } = seqFromIdentifier(identifier);
      if (g.mpz_cmp_ui(seq, 1) <= 0) {
        g.mpz_clear(seq);
        return formatParts(room, wall, shelf, book, 1);
      }
      g.mpz_sub_ui(seq, seq, 1);
      const prev = identifierFromSeq(seq, PAGES);
      g.mpz_clear(seq);
      return prev;
    }
    case "roomNext":
      room = applyRoomDelta(room, 1);
      return finish();
    case "roomPrev":
      room = applyRoomDelta(room, -1);
      return finish();
    case "floorUp":
      room = applyRoomDelta(room, FLOOR_STRIDE);
      return finish();
    case "floorDown":
      room = applyRoomDelta(room, -FLOOR_STRIDE);
      return finish();
    default:
      throw new Error(`Unknown direction: ${String(direction)}`);
  }
}
