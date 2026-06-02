import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Generous: a freshly-booted CI Supabase can be slow to settle.
    testTimeout: 45_000,
    hookTimeout: 45_000,
    retry: process.env.CI ? 1 : 0,
  },
});
