import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/heavy-math.test.ts"],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
