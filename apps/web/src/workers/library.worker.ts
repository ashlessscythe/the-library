import {
  ALPHA,
  PAGE_LENGTH,
  buildEmptyBookContent,
  buildEmptyPageBookContent,
  buildRandomCharsBookContent,
  buildSpacePaddedBook,
  generateContent,
  loadNumbersFromHexJson,
  lookupContent,
  moveIdentifier,
  type MoveDirection,
  type PageContent,
} from "@the-library/core";

const SEARCH_ALLOWED = new Set(ALPHA);

/** Mirror of apps/web sanitizeSearchQuery — keep lookup free of bad chars. */
function sanitizeSearchContent(raw: string): string {
  let out = "";
  for (const ch of raw.replace(/\r\n?/g, "\n").toLowerCase()) {
    if (ch === "\n" || SEARCH_ALLOWED.has(ch)) out += ch;
  }
  return out.slice(0, PAGE_LENGTH);
}

export type WorkerRequest =
  | { id: number; type: "init"; hexJson: string }
  | { id: number; type: "generatePage"; identifier: string }
  | {
      id: number;
      type: "search";
      content: string;
      mode: "empty" | "emptybook" | "chars" | "space";
    }
  | { id: number; type: "move"; identifier: string; direction: MoveDirection }
  | { id: number; type: "random" };

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

let ready = false;

function ensureReady() {
  if (!ready) throw new Error("Library engine not initialised");
}

function randomIdentifier(): string {
  const wall = 1 + Math.floor(Math.random() * 4);
  const shelf = 1 + Math.floor(Math.random() * 5);
  const book = 1 + Math.floor(Math.random() * 32);
  const page = 1 + Math.floor(Math.random() * 410);
  // Modest random room for UX; full space is enormous.
  const room = (1n + BigInt(Math.floor(Math.random() * 1_000_000))).toString(32);
  return `${room}.${wall}.${shelf}.${book}.${page}`;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case "init": {
        loadNumbersFromHexJson(msg.hexJson);
        ready = true;
        postMessage({ id: msg.id, ok: true, result: true } satisfies WorkerResponse);
        break;
      }
      case "generatePage": {
        ensureReady();
        const page: PageContent = generateContent(msg.identifier, false);
        postMessage({ id: msg.id, ok: true, result: page } satisfies WorkerResponse);
        break;
      }
      case "search": {
        ensureReady();
        const content = sanitizeSearchContent(msg.content);
        let book: string;
        let page = 1;
        let highlight: unknown = null;
        if (msg.mode === "emptybook") {
          book = buildEmptyBookContent(content);
          page = 1;
        } else if (msg.mode === "chars") {
          const built = buildRandomCharsBookContent(content);
          book = built.book;
          highlight = built.highlight;
          page = Math.floor(built.highlight.startLine / 40) + 1;
        } else if (msg.mode === "space") {
          const built = buildSpacePaddedBook(content, 1);
          book = built.book;
          page = built.page;
        } else {
          const built = buildEmptyPageBookContent(content);
          book = built.book;
          page = built.page;
        }
        const identifier = lookupContent(book, page);
        postMessage({
          id: msg.id,
          ok: true,
          result: { identifier, highlight },
        } satisfies WorkerResponse);
        break;
      }
      case "move": {
        ensureReady();
        const identifier = moveIdentifier(msg.identifier, msg.direction);
        postMessage({ id: msg.id, ok: true, result: identifier } satisfies WorkerResponse);
        break;
      }
      case "random": {
        ensureReady();
        const identifier = randomIdentifier();
        postMessage({ id: msg.id, ok: true, result: identifier } satisfies WorkerResponse);
        break;
      }
      default:
        throw new Error("Unknown worker message");
    }
  } catch (err) {
    postMessage({
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } satisfies WorkerResponse);
  }
};
