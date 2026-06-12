import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  applyEnvExampleBlock,
  buildAllGeneratedFiles,
  buildEnvExampleBlock,
} from "./generate";
import { readLock, readPins, writeLock, writePins } from "./lock";
import { loadExtensions } from "./manifests";
import { syncSupabaseMigrations } from "./migrations";
import { EXT_PATHS, toAbs } from "./paths";

/**
 * `pnpm ext sync` — regenerate everything the host consumes from the vendored
 * extensions (docs/EXTENSIONS-PLAN.md §2). Idempotent; run it after any change
 * under extensions/ and commit the outputs (drift fails `pnpm test`).
 */
export async function sync(repoRoot: string): Promise<void> {
  const exts = await loadExtensions(repoRoot);
  const lock = readLock(repoRoot);

  // 1. Supabase migrations: pin + materialize (append-only).
  const migrationResult = syncSupabaseMigrations(
    repoRoot,
    exts,
    readPins(repoRoot),
  );
  writePins(repoRoot, migrationResult.pins);

  // 2. Edge functions: copy declared functions into supabase/functions/.
  for (const ext of exts) {
    for (const fn of ext.manifest.server.edgeFunctions) {
      const src = path.join(ext.dir, "supabase/functions", fn);
      if (!existsSync(src)) {
        throw new Error(
          `[${ext.manifest.slug}] declares edge function "${fn}" but supabase/functions/${fn}/ is missing`,
        );
      }
      const dest = path.join(
        toAbs(repoRoot, EXT_PATHS.supabaseFunctionsDir),
        fn,
      );
      rmSync(dest, { recursive: true, force: true });
      cpSync(src, dest, { recursive: true });
    }
  }

  // 3. Delete previously generated stubs (sync owns those paths), then write
  //    the new generation wholesale.
  const previousStubs = Object.values(lock.extensions).flatMap((e) => e.stubs);
  for (const rel of previousStubs) {
    rmSync(toAbs(repoRoot, rel), { force: true });
  }
  pruneEmptyDirs(repoRoot, previousStubs);

  const files = buildAllGeneratedFiles(exts);
  for (const file of files) {
    const abs = toAbs(repoRoot, file.path);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, file.content);
  }

  // 4. Refresh the lock: one entry per installed extension. Provenance fields
  //    (source/baseCommit) are owned by add/update; sync preserves them.
  const nextExtensions: typeof lock.extensions = {};
  for (const ext of exts) {
    const prior = lock.extensions[ext.manifest.slug];
    nextExtensions[ext.manifest.slug] = {
      version: ext.manifest.version,
      kitCompat: ext.manifest.kitCompat,
      source: prior?.source ?? "local",
      ...(prior?.pinned ? { pinned: true } : {}),
      ...(prior?.baseCommit ? { baseCommit: prior.baseCommit } : {}),
      installedVia: prior?.installedVia ?? "preinstalled",
      stubs: files
        .filter((f) => f.slug === ext.manifest.slug)
        .map((f) => f.path),
      edgeFunctions: ext.manifest.server.edgeFunctions,
    };
  }
  writeLock(repoRoot, { ...lock, extensions: nextExtensions });

  // 5. Rewrite the fenced extensions block in .env.example.
  const envExampleAbs = toAbs(repoRoot, EXT_PATHS.envExample);
  if (existsSync(envExampleAbs)) {
    writeFileSync(
      envExampleAbs,
      applyEnvExampleBlock(
        readFileSync(envExampleAbs, "utf8"),
        buildEnvExampleBlock(exts),
      ),
    );
  }

  // 6. Re-inline supabase migrations for the runtime bootstrap.
  execSync("pnpm db:gen-migrations", { cwd: repoRoot, stdio: "inherit" });

  const cmsTouched = exts.some((e) => {
    const c = e.manifest.cms;
    return c.collections.length > 0 || c.globals.length > 0 || c.hasSettings;
  });
  console.log(
    `\next sync: ${exts.length} extension(s), ${files.length} generated file(s), ` +
      `${migrationResult.added.length} newly pinned migration(s).`,
  );
  console.log(
    `Next steps: pnpm db:reset && pnpm db:gen-types${cmsTouched ? " && pnpm cms:gen-types" : ""}, then commit the generated files.`,
  );
}

/** Remove now-empty parent directories left behind by deleted stubs. */
function pruneEmptyDirs(repoRoot: string, deletedRelPaths: string[]): void {
  const dirs = new Set<string>(
    deletedRelPaths.map((p) => path.dirname(toAbs(repoRoot, p))),
  );
  for (const dir of dirs) {
    let current = dir;
    while (
      current.startsWith(repoRoot) &&
      current !== repoRoot &&
      existsSync(current)
    ) {
      try {
        // rmdirSync only succeeds on empty directories — exactly what we want.
        rmdirSync(current);
      } catch {
        break;
      }
      current = path.dirname(current);
    }
  }
}
