import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, "../../web/dist");

/** In-memory hash → room store (replace with Neon later). */
const roomStore = new Map<string, string>();

function normalizeRoom(room: string): string {
  let r = room.toLowerCase();
  if (r.length > 1 && r.startsWith("0")) {
    r = r.replace(/^0+/, "") || "0";
  }
  return r;
}

function hashRoom(room: string): string {
  const hex = createHash("sha256").update(normalizeRoom(room)).digest("hex");
  let h = hex.replace(/^0+/, "");
  if (h.length === 0) h = "0";
  return `@${h}`;
}

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  })
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.post("/api/rooms", async (c) => {
  const body = await c.req.json<{ room?: string }>();
  if (!body.room || !/^[0-9a-v]+$/i.test(body.room)) {
    return c.json({ error: "Invalid room" }, 400);
  }
  const room = normalizeRoom(body.room);
  const hash = hashRoom(room);
  roomStore.set(hash, room);
  return c.json({ hash, room });
});

app.get("/api/rooms/:hash", (c) => {
  let hash = c.req.param("hash");
  if (!hash.startsWith("@")) hash = `@${hash}`;
  const room = roomStore.get(hash);
  if (!room) return c.json({ error: "Unknown room hash" }, 404);
  return c.json({ hash, room });
});

if (existsSync(webDist)) {
  app.use(
    "/*",
    serveStatic({
      root: path.relative(process.cwd(), webDist) || ".",
    })
  );
  app.get("*", async (c) => {
    const html = await readFile(path.join(webDist, "index.html"), "utf8");
    return c.html(html);
  });
} else {
  app.get("*", (c) =>
    c.text("Web build not found. Run: npm run build -w @the-library/web", 503)
  );
}

const port = Number(process.env.PORT ?? 3000);
console.log(`The Library API listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });
