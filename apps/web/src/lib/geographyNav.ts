import { BASE32_ALPHA } from "@the-library/core";

/**
 * Router state for seeding /geography from Explore or the Reader.
 * Prefer a short roomKey (literal or @hash) — never put megabyte rooms in state.
 */
export type GeographyLocationState = {
  roomKey?: string;
};

/** Room length used when opening Geography from the site header. */
export const GEOGRAPHY_NAV_ROOM_LENGTH = 4;

/**
 * Random Babel room string of a fixed length (crypto-uniform base-32 digits).
 * Leading digit is never `0`, matching {@link randomRoomString} from core.
 */
export function randomGeographyNavRoom(
  length: number = GEOGRAPHY_NAV_ROOM_LENGTH
): string {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error("length must be an integer ≥ 1");
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const chars = new Array<string>(length);
  chars[0] = BASE32_ALPHA[1 + (bytes[0]! % 31)]!;
  for (let i = 1; i < length; i++) {
    chars[i] = BASE32_ALPHA[bytes[i]! & 31]!;
  }
  return chars.join("");
}
