import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildAllGeneratedFiles,
  findRepoRoot,
  loadExtensions,
  readLock,
  toAbs,
} from "@acme/ext-tools";

/**
 * The host consumes extensions ONLY through generated registries + route stubs
 * (docs/EXTENSIONS-PLAN.md §2). This test recomputes the expected contents
 * from each extension's extension.config.ts and fails the suite when the
 * committed files drift — i.e. someone changed an extension without running
 * `pnpm ext sync` and committing the result. Sibling of the existing
 * supabase migrations drift test (../lib/db/migrations-drift.test.ts).
 */
describe("generated extension registries", () => {
  const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));

  it("match the manifests — run `pnpm ext sync` if this fails", async () => {
    const exts = await loadExtensions(repoRoot);
    for (const file of buildAllGeneratedFiles(exts)) {
      const abs = toAbs(repoRoot, file.path);
      expect(existsSync(abs), `${file.path} is missing`).toBe(true);
      expect(readFileSync(abs, "utf8"), `content drift in ${file.path}`).toBe(
        file.content,
      );
    }
  });

  it("lock stub bookkeeping matches the generated stubs", async () => {
    const exts = await loadExtensions(repoRoot);
    const expected = buildAllGeneratedFiles(exts).filter((f) => f.slug);
    const lock = readLock(repoRoot);
    for (const ext of exts) {
      const recorded = [...(lock.extensions[ext.manifest.slug]?.stubs ?? [])];
      const wanted = expected
        .filter((f) => f.slug === ext.manifest.slug)
        .map((f) => f.path);
      expect(
        recorded.sort(),
        `stale stub records for ${ext.manifest.slug}`,
      ).toEqual(wanted.sort());
    }
  });

  it("every installed extension has a lock entry (and vice versa)", async () => {
    const exts = await loadExtensions(repoRoot);
    const lock = readLock(repoRoot);
    expect(Object.keys(lock.extensions).sort()).toEqual(
      exts.map((e) => e.manifest.slug).sort(),
    );
  });
});
