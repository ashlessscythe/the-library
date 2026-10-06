/*
  Coordinate ↔ sequential book index.
  Port of logic from src/babel.ts (Tom Snelling / GPL-3.0).
*/

import {
  BOOKS,
  BOOKS_PER_ROOM,
  PAGES,
  SHELVES,
  WALLS,
} from "../constants";
import { parseBase32 } from "../mathematics/base32";

export type LibraryCoordinate = {
  room: bigint;
  wall: number;
  shelf: number;
  book: number;
  page: number;
};

export type ParsedIdentifier = LibraryCoordinate & {
  /** Original room string as provided (base-32). */
  roomString: string;
};

const ROOM_RE = /^[0-9a-v]+$/i;

export function normalizeRoomString(room: string): string {
  let r = room.toLowerCase();
  if (r.length > 1 && r.startsWith("0")) {
    r = r.replace(/^0+/, "");
    if (r.length === 0) r = "0";
  }
  return r;
}

export function parseIdentifier(identifier: string): ParsedIdentifier {
  const parts = identifier.split(".");
  if (parts.length !== 5) {
    throw new Error("Identifier must be ROOM.WALL.SHELF.BOOK.PAGE");
  }
  const [roomStringRaw, wallS, shelfS, bookS, pageS] = parts;
  const roomString = normalizeRoomString(roomStringRaw);
  if (!ROOM_RE.test(roomString)) {
    throw new Error("Room must be a base-32 string [0-9a-v]");
  }

  const wall = Number(wallS);
  const shelf = Number(shelfS);
  const book = Number(bookS);
  const page = Number(pageS);

  assertBounds(wall, shelf, book, page);

  const room = parseBase32(roomString);

  if (room < 1n) {
    throw new Error("Room cannot be smaller than 1");
  }

  return { room, roomString, wall, shelf, book, page };
}

export function assertBounds(
  wall: number,
  shelf: number,
  book: number,
  page: number
): void {
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

export function sequentialFromCoordinate(
  room: bigint,
  wall: number,
  shelf: number,
  book: number
): bigint {
  const pBooks = BigInt(book);
  const pShelves = BigInt((shelf - 1) * BOOKS);
  const pWalls = BigInt((wall - 1) * SHELVES * BOOKS);
  const pRooms = (room - 1n) * BigInt(BOOKS_PER_ROOM);
  return pRooms + pWalls + pShelves + pBooks;
}

export function coordinateFromSequential(
  seqNumber: bigint,
  page: number
): LibraryCoordinate & { roomString: string } {
  let seq = seqNumber - 1n;
  if (seq < 0n) {
    return {
      room: 1n,
      roomString: "1",
      wall: 1,
      shelf: 1,
      book: 1,
      page,
    };
  }

  const room = seq / BigInt(BOOKS_PER_ROOM) + 1n;
  seq = seq % BigInt(BOOKS_PER_ROOM);

  const wall = Number(seq / BigInt(SHELVES * BOOKS)) + 1;
  seq = seq % BigInt(SHELVES * BOOKS);

  const shelf = Number(seq / BigInt(BOOKS)) + 1;
  seq = seq % BigInt(BOOKS);

  const book = Number(seq) + 1;

  return {
    room,
    roomString: roomToBase32(room),
    wall,
    shelf,
    book,
    page,
  };
}

export function formatIdentifier(
  roomString: string,
  wall: number,
  shelf: number,
  book: number,
  page: number
): string {
  return [roomString, wall, shelf, book, page].join(".");
}

export function roomToBase32(room: bigint): string {
  return room.toString(32);
}

/** Short display form for very long rooms (UI only). */
export function shortenRoom(roomString: string): string {
  if (roomString.length <= 16) return roomString;
  return `${roomString.slice(0, 8)}...${roomString.slice(-8)}`;
}
