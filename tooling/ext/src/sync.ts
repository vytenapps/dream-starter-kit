import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
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
  buildLockModule,
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
  // 0. The apps must depend on every installed extension package (their
  //    registries/stubs import them) — sync owns those dependency entries.
  syncAppDependencies(repoRoot);

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
  const nextLock = { ...lock, extensions: nextExtensions };
  writeLock(repoRoot, nextLock);
  writeFileSync(
    toAbs(repoRoot, EXT_PATHS.nextLockModule),
    buildLockModule(nextLock),
  );

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

const KEPT_EXT_PACKAGES = new Set(["@acme/ext-kit", "@acme/ext-tools"]);

/**
 * Keep apps/nextjs + apps/expo `dependencies` in lockstep with extensions/*:
 * add @acme/ext-<slug> for every installed extension, drop entries whose
 * extension is gone, and `pnpm install` when anything changed so manifest
 * loading (which resolves @acme/ext-kit from each package) works.
 */
function syncAppDependencies(repoRoot: string): void {
  const extDir = toAbs(repoRoot, EXT_PATHS.extensionsDir);
  const slugs = existsSync(extDir)
    ? readdirSync(extDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name)
        .sort()
    : [];
  const wanted = slugs.map((s) => `@acme/ext-${s}`);

  let changed = false;
  for (const rel of ["apps/nextjs/package.json", "apps/expo/package.json"]) {
    const file = toAbs(repoRoot, rel);
    const pkg = JSON.parse(readFileSync(file, "utf8")) as {
      dependencies: Record<string, string>;
    };
    for (const name of Object.keys(pkg.dependencies)) {
      if (
        name.startsWith("@acme/ext-") &&
        !KEPT_EXT_PACKAGES.has(name) &&
        !wanted.includes(name)
      ) {
        delete pkg.dependencies[name];
        changed = true;
      }
    }
    for (const name of wanted) {
      if (!(name in pkg.dependencies)) {
        pkg.dependencies[name] = "workspace:*";
        changed = true;
      }
    }
    if (changed) {
      pkg.dependencies = Object.fromEntries(
        Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b)),
      );
      writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
    }
  }
  if (changed) {
    execSync("pnpm install", { cwd: repoRoot, stdio: "inherit" });
  }
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
