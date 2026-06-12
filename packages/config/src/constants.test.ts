import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { KIT_VERSION } from "./constants";

describe("KIT_VERSION", () => {
  it("matches the root package.json version", () => {
    const rootPkg = JSON.parse(
      readFileSync(
        path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../../../package.json",
        ),
        "utf8",
      ),
    ) as { version?: string };
    expect(KIT_VERSION).toBe(rootPkg.version);
  });

  it("is a plain semver version", () => {
    expect(KIT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
