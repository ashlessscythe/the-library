import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@the-library/core": path.resolve(__dirname, "../../packages/core/src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["@the-library/core", "gmp-wasm"],
  },
  build: {
    // gmp-wasm ships a large embedded wasm payload; keep it external to the
    // main bundle (worker imports it on its own chunk).
    commonjsOptions: {
      include: [/gmp-wasm/, /node_modules/],
    },
  },
});
