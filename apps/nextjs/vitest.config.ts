import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Scoped to pure logic (theme color/derivation). Component/route code is
    // exercised by typecheck + Playwright, not unit tests.
    include: ["src/lib/**/*.test.ts"],
  },
});
