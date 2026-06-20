import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // The real `server-only` default export throws (Server-Component marker),
      // which would break importing server libs in node unit tests. Stub it the
      // same way the package's own `react-server` condition does (empty module).
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    // Scoped to pure logic (theme color/derivation, image-generation) + the
    // generated-file drift tests. Component/route code is exercised by
    // typecheck + Playwright, not unit tests.
    include: ["src/lib/**/*.test.ts", "src/ext/**/*.test.ts"],
  },
});
