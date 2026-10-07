import {
  ALPHA,
  PAGE_LENGTH,
  buildEmptyBookContent,
  buildEmptyPageBookContent,
  buildRandomCharsBookContent,
  buildSpacePaddedBook,
  type MoveDirection,
  type PageContent,
  type PhysicalDirection,
} from "@the-library/core";
import {
  gmpGeneratePage,
  gmpLookupContent,
  gmpMoveIdentifier,
  gmpRandomIdentifier,
  initGmpEngine,
} from "./gmpEngine";
import {
  gmpGeographyMove,
  gmpGeographyResetEntrance,
  gmpGeographySeedFromRoom,
  type GeographySnapshot,
} from "./gmpGeography";

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
  | { id: number; type: "random" }
  | { id: number; type: "geographySeed"; room: string }
  | { id: number; type: "geographyMove"; direction: PhysicalDirection }
  | { id: number; type: "geographyReset" };

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

export type { GeographySnapshot };

let ready = false;

function ensureReady() {
  if (!ready) throw new Error("Library engine not initialised");
}

async function handleMessage(msg: WorkerRequest): Promise<void> {
  try {
    switch (msg.type) {
      case "init": {
        // GMP avoids JSC's native BigInt size cap (Safari / iOS).
        await initGmpEngine(msg.hexJson);
        ready = true;
        postMessage({ id: msg.id, ok: true, result: true } satisfies WorkerResponse);
        break;
      }
      case "generatePage": {
        ensureReady();
        const page: PageContent = gmpGeneratePage(msg.identifier);
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
        const identifier = gmpLookupContent(book, page);
        postMessage({
          id: msg.id,
          ok: true,
          result: { identifier, highlight },
        } satisfies WorkerResponse);
        break;
      }
      case "move": {
        ensureReady();
        const identifier = gmpMoveIdentifier(msg.identifier, msg.direction);
        postMessage({ id: msg.id, ok: true, result: identifier } satisfies WorkerResponse);
        break;
      }
      case "random": {
        ensureReady();
        const identifier = gmpRandomIdentifier();
        postMessage({ id: msg.id, ok: true, result: identifier } satisfies WorkerResponse);
        break;
      }
      case "geographySeed": {
        ensureReady();
        const snap: GeographySnapshot = gmpGeographySeedFromRoom(msg.room);
        postMessage({ id: msg.id, ok: true, result: snap } satisfies WorkerResponse);
        break;
      }
      case "geographyMove": {
        ensureReady();
        const snap: GeographySnapshot = gmpGeographyMove(msg.direction);
        postMessage({ id: msg.id, ok: true, result: snap } satisfies WorkerResponse);
        break;
      }
      case "geographyReset": {
        ensureReady();
        const snap: GeographySnapshot = gmpGeographyResetEntrance();
        postMessage({ id: msg.id, ok: true, result: snap } satisfies WorkerResponse);
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
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void handleMessage(event.data);
};
