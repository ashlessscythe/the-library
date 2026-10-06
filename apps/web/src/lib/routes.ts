import type { TravelCoordinate } from "@the-library/core";
import { formatIdentifier, parseIdentifier } from "@the-library/core";

export function bookPath(coord: {
  roomString: string;
  wall: number;
  shelf: number;
  book: number;
  page: number;
}): string {
  return `/book/${encodeURIComponent(coord.roomString)}/wall/${coord.wall}/shelf/${coord.shelf}/book/${coord.book}/page/${coord.page}`;
}

export function bookPathFromIdentifier(identifier: string): string {
  return bookPath(parseIdentifier(identifier));
}

export function identifierFromParams(params: {
  room?: string;
  wall?: string;
  shelf?: string;
  book?: string;
  page?: string;
}): string {
  const room = decodeURIComponent(params.room ?? "1");
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
