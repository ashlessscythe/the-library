import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MoveDirection,
  PageContent,
  PhysicalDirection,
} from "@the-library/core";
import type {
  GeographySnapshot,
  WorkerRequest,
  WorkerResponse,
} from "@/workers/library.worker";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
};

let sharedWorker: Worker | null = null;
let initPromise: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL("../workers/library.worker.ts", import.meta.url),
      { type: "module" }
    );
    sharedWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error));
    };
  }
  return sharedWorker;
}

function call<T>(payload: WorkerRequest): Promise<T> {
  const worker = getWorker();
  return new Promise<T>((resolve, reject) => {
    pending.set(payload.id, {
      resolve: (v) => resolve(v as T),
      reject,
    });
    worker.postMessage(payload);
  });
}

function nextRequestId() {
  return nextId++;
}


async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const res = await fetch("/numbers.hex.json");
      if (!res.ok) throw new Error("Failed to load library constants");
      const hexJson = await res.text();
      await call({ id: nextRequestId(), type: "init", hexJson });
    })();
  }
  return initPromise;
}

export function useLibraryEngine() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    ensureInit()
      .then(() => setReady(true))
      .catch((e: Error) => setError(e.message));
  }, []);

  const generatePage = useCallback(async (identifier: string) => {
    await ensureInit();
    return call<PageContent>({
      id: nextRequestId(),
      type: "generatePage",
      identifier,
    });
  }, []);

  const search = useCallback(
    async (
      content: string,
      mode: "empty" | "emptybook" | "chars" | "space"
    ) => {
      await ensureInit();
      return call<{ identifier: string; highlight: unknown }>({
        id: nextRequestId(),
        type: "search",
        content,
        mode,
      });
    },
    []
  );

  const move = useCallback(async (identifier: string, direction: MoveDirection) => {
    await ensureInit();
    return call<string>({
      id: nextRequestId(),
      type: "move",
      identifier,
      direction,
    });
  }, []);

  const random = useCallback(async () => {
    await ensureInit();
    return call<string>({ id: nextRequestId(), type: "random" });
  }, []);

  const geographySeed = useCallback(async (room: string) => {
    await ensureInit();
    return call<GeographySnapshot>({
      id: nextRequestId(),
      type: "geographySeed",
      room,
    });
  }, []);

  const geographyMove = useCallback(async (direction: PhysicalDirection) => {
    await ensureInit();
    return call<GeographySnapshot>({
      id: nextRequestId(),
      type: "geographyMove",
      direction,
    });
  }, []);

  const geographyReset = useCallback(async () => {
    await ensureInit();
    return call<GeographySnapshot>({
      id: nextRequestId(),
      type: "geographyReset",
    });
  }, []);

  const geographyGetRoom = useCallback(async () => {
    await ensureInit();
    return call<string>({
      id: nextRequestId(),
      type: "geographyGetRoom",
    });
  }, []);

  return {
    ready,
    error,
    generatePage,
    search,
    move,
    random,
    geographySeed,
    geographyMove,
    geographyReset,
    geographyGetRoom,
  };
}
