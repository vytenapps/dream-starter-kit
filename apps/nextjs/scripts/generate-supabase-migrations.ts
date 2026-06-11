/**
 * Inlines `supabase/migrations/*.sql` into a committed JSON module so the
 * runtime DB bootstrap (src/lib/db/bootstrap.ts) can apply them from the
 * serverless bundle — the SQL files themselves live at the repo root and are
 * not traced into the Next.js build output.
 *
 * Run `pnpm db:gen-migrations` (root or apps/nextjs) after adding a migration
 * and commit the regenerated file. Drift between the SQL files and the JSON is
 * caught by src/lib/db/migrations-drift.test.ts (part of `pnpm test` and CI).
 *
 * Same pattern as Payload's committed migrations (src/payload/migrations).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseMigrationFilename } from "../src/lib/db/bootstrap-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "../../../supabase/migrations");
const outFile = path.resolve(
  here,
  "../src/lib/db/supabase-migrations.generated.json",
);

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const migrations = files.map((file) => {
  const parsed = parseMigrationFilename(file);
  if (!parsed) {
    throw new Error(
      `Unexpected migration filename "${file}" — expected <14-digit-version>_<name>.sql`,
    );
  }
  return {
    ...parsed,
    sql: readFileSync(path.join(migrationsDir, file), "utf8"),
  };
});

writeFileSync(outFile, `${JSON.stringify(migrations, null, 2)}\n`);
console.log(
  `Wrote ${migrations.length} migration(s) to ${path.relative(process.cwd(), outFile)}`,
);
