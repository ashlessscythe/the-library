import type { TravelCoordinate } from "@the-library/core";
import { formatIdentifier, parseIdentifier } from "@the-library/core";
import { ensureRoomKey, resolveRoom } from "@/lib/rooms";

export function bookPath(coord: {
  roomKey: string;
  wall: number;
  shelf: number;
  book: number;
  page: number;
}): string {
  // roomKey is already short (literal or @hash) — never put megabyte rooms in the path
  const roomSeg = encodeURIComponent(coord.roomKey);
  return `/book/${roomSeg}/wall/${coord.wall}/shelf/${coord.shelf}/book/${coord.book}/page/${coord.page}`;
}

/** Build a short shareable reader URL (hashes long rooms). */
export async function bookPathFromIdentifier(identifier: string): Promise<string> {
  const parsed = parseIdentifier(identifier);
  const roomKey = await ensureRoomKey(parsed.roomString);
  return bookPath({
    roomKey,
    wall: parsed.wall,
    shelf: parsed.shelf,
    book: parsed.book,
    page: parsed.page,
  });
}

/** Resolve route params to a full generate-able identifier. */
export async function resolveIdentifierFromParams(params: {
  room?: string;
  wall?: string;
  shelf?: string;
  book?: string;
  page?: string;
}): Promise<string> {
  const room = await resolveRoom(params.room ?? "1");
  return formatIdentifier(
    room,
    Number(params.wall ?? 1),
    Number(params.shelf ?? 1),
    Number(params.book ?? 1),
    Number(params.page ?? 1)
  );
}

export function coordFromIdentifier(identifier: string): TravelCoordinate {
  return parseIdentifier(identifier);
}
