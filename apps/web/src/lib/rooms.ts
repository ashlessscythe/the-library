import { normalizeRoomString } from "@the-library/core";

/** Keep short rooms readable in the URL; longer rooms become @sha256. */
export const MAX_ROOM_IN_URL = 16;

const DB_NAME = "the-library";
const STORE = "rooms";
const DB_VERSION = 1;

/** In-memory cache so travel doesn't re-hash / re-write IndexedDB every step. */
const hashCache = new Map<string, string>();
const roomCache = new Map<string, string>();

/** Opt-in: set VITE_USE_ROOM_API=true and run `npm run dev:api` for server hash lookup. */
const USE_ROOM_API = import.meta.env.VITE_USE_ROOM_API === "true";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

async function idbPut(hash: string, room: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(room, hash);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB put failed"));
  });
  db.close();
}

async function idbGet(hash: string): Promise<string | null> {
  const db = await openDb();
  const value = await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(hash);
    req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
  });
  db.close();
  return value;
}

/** SHA-256 room hash matching babel-v3: "@" + hex with leading zeros stripped. */
export async function hashRoom(room: string): Promise<string> {
  const normalized = normalizeRoomString(room);
  const cached = hashCache.get(normalized);
  if (cached) return cached;

  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const trimmed = hex.replace(/^0+/, "") || "0";
  const hash = `@${trimmed}`;
  hashCache.set(normalized, hash);
  return hash;
}

export function isRoomHash(token: string): boolean {
  return token.startsWith("@");
}

/**
 * Persist room under its hash in IndexedDB.
 * No network — travel must work with `npm run dev` alone.
 */
export async function rememberRoom(room: string): Promise<string> {
  const normalized = normalizeRoomString(room);
  const hash = await hashRoom(normalized);

  if (roomCache.get(hash) === normalized) return hash;

  await idbPut(hash, normalized);
  roomCache.set(hash, normalized);
  hashCache.set(normalized, hash);
  return hash;
}

/**
 * Compact a room for use in the URL path.
 * Short rooms stay literal; long rooms become @hash and are stored locally.
 */
export async function ensureRoomKey(room: string): Promise<string> {
  const normalized = normalizeRoomString(room);
  if (normalized.length <= MAX_ROOM_IN_URL) return normalized;
  return rememberRoom(normalized);
}

/** Expand a URL room token (@hash or short base-32) to the full room string. */
export async function resolveRoom(token: string): Promise<string> {
  const key = decodeURIComponent(token);
  if (!isRoomHash(key)) {
    return normalizeRoomString(key);
  }

  const mem = roomCache.get(key);
  if (mem) return mem;

  const local = await idbGet(key);
  if (local) {
    roomCache.set(key, local);
    return local;
  }

  if (USE_ROOM_API) {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(key.slice(1))}`);
      if (res.ok) {
        const data = (await res.json()) as { room: string };
        await idbPut(key, data.room);
        roomCache.set(key, data.room);
        return data.room;
      }
    } catch {
      // API optional
    }
  }

  throw new Error(
    "Unknown room hash. Open this page from Search or Explore on this device, or share a short room id."
  );
}
