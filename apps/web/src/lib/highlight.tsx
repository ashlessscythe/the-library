import type { ReactNode } from "react";

const CHARS_PER_LINE = 80;

/** Find non-overlapping occurrences of `phrase` in `haystack` (case-insensitive). */
export function findPhraseRanges(
  haystack: string,
  phrase: string
): { start: number; end: number }[] {
  const q = phrase.toLowerCase();
  if (!q) return [];
  const lower = haystack.toLowerCase();
  const ranges: { start: number; end: number }[] = [];
  let from = 0;
  while (from <= lower.length - q.length) {
    const i = lower.indexOf(q, from);
    if (i < 0) break;
    ranges.push({ start: i, end: i + q.length });
    from = i + q.length;
  }
  return ranges;
}

function markLineSegment(
  line: string,
  lineStart: number,
  ranges: { start: number; end: number }[]
): ReactNode {
  const overlaps = ranges
    .map((r) => ({
      start: Math.max(0, r.start - lineStart),
      end: Math.min(line.length, r.end - lineStart),
    }))
    .filter((r) => r.end > r.start);

  if (overlaps.length === 0) return line;

  const parts: ReactNode[] = [];
  let cursor = 0;
  overlaps.forEach((r, idx) => {
    if (r.start > cursor) {
      parts.push(line.slice(cursor, r.start));
    }
    parts.push(
      <mark key={`${lineStart}-${idx}`} className="page-mark">
        {line.slice(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  });
  if (cursor < line.length) parts.push(line.slice(cursor));
  return parts;
}

/**
 * Format page content with line numbers, optionally wrapping the search phrase
 * in `<mark>` elements.
 */
export function formatPageNodes(
  content: string,
  highlightPhrase: string | null
): ReactNode {
  const ranges =
    highlightPhrase && highlightPhrase.length > 0
      ? findPhraseRanges(content, highlightPhrase)
      : [];

  const lineCount = Math.ceil(content.length / CHARS_PER_LINE) || 1;
  const nodes: ReactNode[] = [];

  for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
    const lineStart = lineIdx * CHARS_PER_LINE;
    const line = content.slice(lineStart, lineStart + CHARS_PER_LINE);
    const prefix = `${String(lineIdx + 1).padStart(2, " ")}  `;
    nodes.push(
      <span key={lineIdx}>
        {prefix}
        {ranges.length > 0
          ? markLineSegment(line, lineStart, ranges)
          : line}
        {lineIdx < lineCount - 1 ? "\n" : null}
      </span>
    );
  }

  return nodes;
}
