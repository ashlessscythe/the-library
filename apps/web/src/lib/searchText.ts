import { ALPHA, PAGE_LENGTH } from "@the-library/core";

const ALLOWED = new Set(ALPHA);

/**
 * Keep only library alphabet chars (a–z . , ! ? - space) plus newlines for
 * multi-line empty-page layout. Lowercases and strips everything else so
 * lookup never throws "Unsupported character".
 */
export function sanitizeSearchQuery(raw: string): string {
  let out = "";
  for (const ch of raw.replace(/\r\n?/g, "\n").toLowerCase()) {
    if (ch === "\n" || ALLOWED.has(ch)) out += ch;
  }
  return out.slice(0, PAGE_LENGTH);
}
