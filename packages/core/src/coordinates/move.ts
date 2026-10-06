/*
  Lattice travel on the library coordinate grid.
  Inspired by Borges' hexagonal rooms; transforms stay on-lattice.
*/

import { BOOKS, PAGES, SHELVES, WALLS } from "../constants";
import {
  assertBounds,
  coordinateFromSequential,
  formatIdentifier,
  parseIdentifier,
  roomToBase32,
  sequentialFromCoordinate,
  type LibraryCoordinate,
} from "./identifier";

export type MoveDirection =
  | "up" // shelf +
  | "down" // shelf −
  | "left" // wall −
  | "right" // wall +
  | "forward" // book +
  | "back" // book −
  | "pageNext"
  | "pagePrev"
  | "roomNext" // hex / room +1
  | "roomPrev" // hex / room −1
  | "floorUp" // vertical neighbor (room + FLOOR_STRIDE)
  | "floorDown";

/** Room step used for PageUp/PageDown “floor” travel (hex-stack metaphor). */
export const FLOOR_STRIDE = 6;

export type TravelCoordinate = LibraryCoordinate & { roomString: string };

function withRoom(coord: TravelCoordinate, room: bigint): TravelCoordinate {
  return {
    ...coord,
    room,
    roomString: roomToBase32(room),
  };
}

function wrapWall(wall: number): { wall: number; roomDelta: number } {
  if (wall < 1) return { wall: WALLS, roomDelta: -1 };
  if (wall > WALLS) return { wall: 1, roomDelta: 1 };
  return { wall, roomDelta: 0 };
}

function applyRoomDelta(room: bigint, delta: number): bigint {
  const next = room + BigInt(delta);
  return next < 1n ? 1n : next;
}

/** Move one step on the lattice. Page moves walk sequential books when wrapping. */
export function moveCoordinate(
  coord: TravelCoordinate,
  direction: MoveDirection
): TravelCoordinate {
  assertBounds(coord.wall, coord.shelf, coord.book, coord.page);

  switch (direction) {
    case "up": {
      if (coord.shelf < SHELVES) {
        return { ...coord, shelf: coord.shelf + 1 };
      }
      const wrapped = wrapWall(coord.wall + 1);
      const room = applyRoomDelta(coord.room, wrapped.roomDelta);
      return {
        ...coord,
        room,
        roomString: roomToBase32(room),
        wall: wrapped.wall,
        shelf: 1,
      };
    }
    case "down": {
      if (coord.shelf > 1) {
        return { ...coord, shelf: coord.shelf - 1 };
      }
      const wrapped = wrapWall(coord.wall - 1);
      const room = applyRoomDelta(coord.room, wrapped.roomDelta);
      return {
        ...coord,
        room,
        roomString: roomToBase32(room),
        wall: wrapped.wall,
        shelf: SHELVES,
      };
    }
    case "left": {
      const wrapped = wrapWall(coord.wall - 1);
      const room = applyRoomDelta(coord.room, wrapped.roomDelta);
      return {
        ...coord,
        room,
        roomString: roomToBase32(room),
        wall: wrapped.wall,
      };
    }
    case "right": {
      const wrapped = wrapWall(coord.wall + 1);
      const room = applyRoomDelta(coord.room, wrapped.roomDelta);
      return {
        ...coord,
        room,
        roomString: roomToBase32(room),
        wall: wrapped.wall,
      };
    }
    case "forward": {
      if (coord.book < BOOKS) {
        return { ...coord, book: coord.book + 1 };
      }
      if (coord.shelf < SHELVES) {
        return { ...coord, shelf: coord.shelf + 1, book: 1 };
      }
      const wrapped = wrapWall(coord.wall + 1);
      const room = applyRoomDelta(coord.room, wrapped.roomDelta);
      return {
        ...coord,
        room,
        roomString: roomToBase32(room),
        wall: wrapped.wall,
        shelf: 1,
        book: 1,
      };
    }
    case "back": {
      if (coord.book > 1) {
        return { ...coord, book: coord.book - 1 };
      }
      if (coord.shelf > 1) {
        return { ...coord, shelf: coord.shelf - 1, book: BOOKS };
      }
      const wrapped = wrapWall(coord.wall - 1);
      const room = applyRoomDelta(coord.room, wrapped.roomDelta);
      return {
        ...coord,
        room,
        roomString: roomToBase32(room),
        wall: wrapped.wall,
        shelf: SHELVES,
        book: BOOKS,
      };
    }
    case "pageNext": {
      const seq = sequentialFromCoordinate(
        coord.room,
        coord.wall,
        coord.shelf,
        coord.book
      );
      if (coord.page < PAGES) {
        return { ...coord, page: coord.page + 1 };
      }
      return coordinateFromSequential(seq + 1n, 1);
    }
    case "pagePrev": {
      const seq = sequentialFromCoordinate(
        coord.room,
        coord.wall,
        coord.shelf,
        coord.book
      );
      if (coord.page > 1) {
        return { ...coord, page: coord.page - 1 };
      }
      if (seq <= 1n) {
        return { ...coord, page: 1 };
      }
      return coordinateFromSequential(seq - 1n, PAGES);
    }
    case "roomNext":
      return withRoom(coord, applyRoomDelta(coord.room, 1));
    case "roomPrev":
      return withRoom(coord, applyRoomDelta(coord.room, -1));
    case "floorUp":
      return withRoom(coord, applyRoomDelta(coord.room, FLOOR_STRIDE));
    case "floorDown":
      return withRoom(coord, applyRoomDelta(coord.room, -FLOOR_STRIDE));
  }
}

export function moveIdentifier(
  identifier: string,
  direction: MoveDirection
): string {
  const parsed = parseIdentifier(identifier);
  const next = moveCoordinate(parsed, direction);
  return formatIdentifier(
    next.roomString,
    next.wall,
    next.shelf,
    next.book,
    next.page
  );
}
