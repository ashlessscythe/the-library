/**
 * Router state for seeding /geography from Explore or the Reader.
 * Prefer a short roomKey (literal or @hash) — never put megabyte rooms in state.
 */
export type GeographyLocationState = {
  roomKey?: string;
};
