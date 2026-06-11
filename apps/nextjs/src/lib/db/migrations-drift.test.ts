import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseMigrationFilename } from "./bootstrap-core";
import { supabaseMigrations } from "./migrations";

/**
 * The runtime DB bootstrap applies `supabase/migrations/*.sql` from the
 * committed, generated JSON module (see scripts/generate-supabase-migrations.ts).
 * This test fails the suite when the two drift apart — i.e. someone added or
 * edited a migration without regenerating. Fix: `pnpm db:gen-migrations` and
 * commit the result.
 */
describe("supabase-migrations.generated.json", () => {
  const migrationsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../../supabase/migrations",
  );
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  it("bundles every supabase/migrations/*.sql exactly — run `pnpm db:gen-migrations` if this fails", () => {
    expect(supabaseMigrations.map((m) => `${m.version}_${m.name}.sql`)).toEqual(
      files,
    );
    for (const [i, file] of files.entries()) {
      expect(supabaseMigrations[i]?.sql, `content drift in ${file}`).toBe(
        readFileSync(path.join(migrationsDir, file), "utf8"),
      );
    }
  });

  it("only contains well-formed migration filenames", () => {
    for (const file of files) {
      expect(
        parseMigrationFilename(file),
        `"${file}" must match <14-digit-version>_<name>.sql`,
      ).not.toBeNull();
    }
  });

  it("is ordered by version", () => {
    const versions = supabaseMigrations.map((m) => m.version);
    expect(versions).toEqual([...versions].sort());
  });
});
