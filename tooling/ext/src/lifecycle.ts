import { execFileSync, execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import semver from "semver";

import {
  checkoutExtensionTree,
  commitExtensionTree,
  currentBase,
  git,
  mergeTrees,
  modifiedFiles,
  snapshotExtension,
} from "./git";
import { readLock, readPins, writeLock } from "./lock";
import { loadExtensions } from "./manifests";
import { nextVersion } from "./migrations";
import { EXT_PATHS, toAbs } from "./paths";
import { sync } from "./sync";

/**
 * Extension lifecycle: add / update / remove / status / eject /
 * payload-migrate (docs/EXTENSIONS-PLAN.md §5). One implementation, two front
 * doors — developers run it via `pnpm ext`, the admin panel's GitHub Actions
 * workflow runs the same commands with --json.
 */

const SLUG_FROM_CONFIG = /slug:\s*["']([a-z][a-z0-9-]{1,30})["']/;
const VERSION_FROM_CONFIG = /version:\s*["'](\d+\.\d+\.\d+[^"']*)["']/;

interface Source {
  kind: "github" | "zip";
  /** github: clean repo url; zip: file path. */
  location: string;
  /** Requested tag (github), e.g. v1.2.3. */
  ref?: string;
}

function parseSource(arg: string): Source {
  if (arg.endsWith(".zip")) return { kind: "zip", location: arg };
  const [url, ref] = arg.split("#");
  if (!url) throw new Error(`unparseable source "${arg}"`);
  return { kind: "github", location: url, ref };
}

/** Clone (github) or unzip into a temp dir whose root is the package root. */
function fetchSource(src: Source): {
  dir: string;
  commit?: string;
  ref?: string;
} {
  const tmp = mkdtempSync(path.join(tmpdir(), "ext-src-"));
  if (src.kind === "zip") {
    execFileSync("unzip", ["-q", src.location, "-d", tmp]);
    // Tolerate a single top-level folder inside the zip.
    const entries = readdirSync(tmp);
    const root =
      entries.length === 1 && entries[0] && !entries[0].includes(".")
        ? path.join(tmp, entries[0])
        : tmp;
    return { dir: root };
  }

  let ref = src.ref;
  if (!ref) {
    // Latest semver tag.
    const out = execFileSync(
      "git",
      ["ls-remote", "--tags", "--refs", src.location],
      { encoding: "utf8" },
    );
    const tags = out
      .split("\n")
      .map((l) => l.split("\t")[1]?.replace("refs/tags/", "") ?? "")
      .map((t) => (t.startsWith("v") ? t.slice(1) : t))
      .filter((t) => semver.valid(t))
      .sort(semver.compare);
    const latest = tags.at(-1);
    if (!latest) throw new Error(`no semver tags found at ${src.location}`);
    ref = `v${latest}`;
  }
  execFileSync(
    "git",
    ["clone", "--depth", "1", "--branch", ref, src.location, tmp],
    { stdio: "pipe" },
  );
  const commit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: tmp,
    encoding: "utf8",
  }).trim();
  rmSync(path.join(tmp, ".git"), { recursive: true, force: true });
  return { dir: tmp, commit, ref };
}

function readManifestBasics(dir: string): { slug: string; version: string } {
  const config = path.join(dir, "extension.config.ts");
  if (!existsSync(config)) {
    throw new Error("source has no extension.config.ts at its root");
  }
  const text = readFileSync(config, "utf8");
  const slug = SLUG_FROM_CONFIG.exec(text)?.[1];
  const version = VERSION_FROM_CONFIG.exec(text)?.[1];
  if (!slug || !version) {
    throw new Error("could not read slug/version from extension.config.ts");
  }
  return { slug, version };
}

async function validateAndSync(repoRoot: string): Promise<void> {
  execSync("pnpm install", { cwd: repoRoot, stdio: "inherit" });
  await sync(repoRoot); // loadExtensions inside throws on any validation error
}

/** `pnpm ext add <github-url[#vX.Y.Z] | path.zip>` */
export async function add(repoRoot: string, sourceArg: string): Promise<void> {
  const src = parseSource(sourceArg);
  const fetched = fetchSource(src);
  const { slug, version } = readManifestBasics(fetched.dir);

  const dest = toAbs(repoRoot, `extensions/${slug}`);
  if (existsSync(dest)) {
    throw new Error(`extensions/${slug} already exists — use \`ext update\``);
  }

  cpSync(fetched.dir, dest, { recursive: true });
  try {
    await validateAndSync(repoRoot);
  } catch (err) {
    rmSync(dest, { recursive: true, force: true });
    throw err;
  }

  const baseCommit = snapshotExtension(repoRoot, slug, version);
  const lock = readLock(repoRoot);
  const entry = lock.extensions[slug];
  if (entry) {
    entry.baseCommit = baseCommit;
    entry.installedVia = "cli";
    entry.source =
      src.kind === "zip"
        ? {
            type: "zip",
            sha256: sha256File(src.location),
            filename: path.basename(src.location),
          }
        : {
            type: "github",
            repo: src.location,
            ref: fetched.ref ?? "",
            commit: fetched.commit ?? "",
          };
    writeLock(repoRoot, lock);
  }

  console.log(
    `\nInstalled ${slug}@${version}. Next: pnpm db:reset && pnpm db:gen-types` +
      ` (and pnpm cms:gen-types if it has CMS surface), pnpm typecheck, commit.`,
  );
}

function sha256File(file: string): string {
  const out = execFileSync("sha256sum", [file], { encoding: "utf8" });
  return out.split(" ")[0] ?? "";
}

/** `pnpm ext update <slug> [--to vX.Y.Z] [--continue]` */
export async function update(
  repoRoot: string,
  slug: string,
  opts: { to?: string; cont?: boolean },
): Promise<void> {
  const lock = readLock(repoRoot);
  const entry = lock.extensions[slug];
  if (!entry) throw new Error(`"${slug}" is not installed`);

  if (opts.cont) {
    // Conflicts were resolved by hand — finish bookkeeping.
    await validateAndSync(repoRoot);
    console.log(`Update of ${slug} completed.`);
    return;
  }

  if (typeof entry.source !== "object" || entry.source.type !== "github") {
    throw new Error(
      `"${slug}" has a ${typeof entry.source === "string" ? entry.source : entry.source.type} origin — re-add it from its source to update`,
    );
  }

  const fetched = fetchSource({
    kind: "github",
    location: entry.source.repo,
    ref: opts.to,
  });
  const { version: newVersion } = readManifestBasics(fetched.dir);

  const base = entry.baseCommit ?? currentBase(repoRoot, slug) ?? undefined;
  if (!base) {
    throw new Error(
      `no pristine base for "${slug}" — refs/ext-base/${slug} is missing and the lock has no baseCommit`,
    );
  }

  // ours = current vendored tree (with any local modifications)
  const ours = commitExtensionTree(repoRoot, slug, `ours: ${slug}`);

  // theirs = new upstream, staged at the same path
  const backup = mkdtempSync(path.join(tmpdir(), "ext-backup-"));
  cpSync(toAbs(repoRoot, `extensions/${slug}`), path.join(backup, slug), {
    recursive: true,
  });
  rmSync(toAbs(repoRoot, `extensions/${slug}`), {
    recursive: true,
    force: true,
  });
  cpSync(fetched.dir, toAbs(repoRoot, `extensions/${slug}`), {
    recursive: true,
  });
  const theirs = commitExtensionTree(repoRoot, slug, `theirs: ${slug}`);

  const merged = mergeTrees(repoRoot, base, ours, theirs);
  checkoutExtensionTree(repoRoot, slug, merged.tree);
  rmSync(backup, { recursive: true, force: true });

  // The new pristine base is the upstream tree regardless of merge outcome.
  git(repoRoot, ["update-ref", `refs/ext-base/${slug}`, theirs]);
  entry.baseCommit = theirs;
  entry.version = newVersion;
  entry.source = {
    ...entry.source,
    ref: fetched.ref ?? entry.source.ref,
    commit: fetched.commit ?? entry.source.commit,
  };
  writeLock(repoRoot, lock);

  if (merged.conflicts.length > 0) {
    console.error(
      `\nMerge conflicts in:\n  - ${merged.conflicts.join("\n  - ")}\n` +
        `Resolve the markers, then run: pnpm ext update ${slug} --continue`,
    );
    process.exitCode = 1;
    return;
  }

  await validateAndSync(repoRoot);
  console.log(`Updated ${slug} to ${newVersion}.`);
}

/** `pnpm ext remove <slug> [--keep-data]` */
export async function remove(
  repoRoot: string,
  slug: string,
  opts: { keepData?: boolean },
): Promise<void> {
  const exts = await loadExtensions(repoRoot);
  const target = exts.find((e) => e.manifest.slug === slug);
  if (!target) throw new Error(`"${slug}" is not installed`);

  const dependents = exts.filter((e) => e.manifest.requires.includes(slug));
  if (dependents.length > 0) {
    throw new Error(
      `cannot remove "${slug}": required by ${dependents
        .map((d) => d.manifest.slug)
        .join(", ")} — remove those first`,
    );
  }

  // 1. Host drop migration (data teardown) unless --keep-data.
  if (!opts.keepData && target.manifest.database.tables.length > 0) {
    const dropFile = path.join(target.dir, "supabase/drop.sql");
    const dropSql = existsSync(dropFile)
      ? readFileSync(dropFile, "utf8")
      : target.manifest.database.tables
          .map((t) => `drop table if exists public.${t} cascade;`)
          .join("\n") + "\n";
    const hostDir = toAbs(repoRoot, EXT_PATHS.supabaseMigrationsDir);
    const taken = new Set(
      readdirSync(hostDir)
        .filter((f) => f.endsWith(".sql"))
        .map((f) => f.slice(0, 14)),
    );
    const pins = readPins(repoRoot);
    for (const pin of Object.values(pins.pins)) taken.add(pin.version);
    const version = nextVersion(taken, new Date());
    writeFileSync(
      path.join(hostDir, `${version}_drop_ext_${slug.replace(/-/g, "_")}.sql`),
      `-- Teardown for the removed "${slug}" extension (pnpm ext remove).\n${dropSql}`,
    );
  }

  // 2. CMS drop scaffold (best-effort) into the CORE migrations dir — the
  //    extension package is about to vanish.
  const cms = target.manifest.cms;
  const cmsSlugs = [
    ...cms.collections,
    ...cms.globals,
    ...(cms.hasSettings ? [`ext-${slug}-settings`] : []),
  ];
  if (!opts.keepData && cmsSlugs.length > 0) {
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "_")
      .slice(0, 15);
    const name = `${stamp}_drop_ext_${slug.replace(/-/g, "_")}`;
    const drops = cmsSlugs
      .flatMap((s) => {
        const snake = s.replace(/-/g, "_");
        return [snake, `${snake}_rels`, `_${snake}_v`, `_${snake}_v_rels`];
      })
      .map((t) => `  DROP TABLE IF EXISTS "cms"."${t}" CASCADE;`)
      .join("\n");
    const dir = toAbs(repoRoot, "apps/nextjs/src/payload/migrations");
    writeFileSync(
      path.join(dir, `${name}.ts`),
      `import { MigrateDownArgs, MigrateUpArgs, sql } from "@payloadcms/db-postgres";

// Best-effort teardown for the removed "${slug}" extension's cms tables
// (pnpm ext remove). VERIFY the table list — array/child tables may differ.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql\`
${drops}
  \`);
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Irreversible — restore from a backup if needed.
}
`,
    );
    const indexFile = path.join(dir, "index.ts");
    const idx = readFileSync(indexFile, "utf8");
    writeFileSync(
      indexFile,
      idx
        .replace(
          /^export const migrations = \[/m,
          `import * as migration_${name} from "./${name}";\n\nexport const migrations = [`,
        )
        .replace(
          /\];\s*$/,
          `  {\n    up: migration_${name}.up,\n    down: migration_${name}.down,\n    name: "${name}",\n  },\n];\n`,
        ),
    );
  }

  // 3. Remove copied edge functions, the vendored dir, and the base ref;
  //    tombstone the lock (version pins are never reused).
  const lock = readLock(repoRoot);
  for (const fn of lock.extensions[slug]?.edgeFunctions ?? []) {
    rmSync(toAbs(repoRoot, `supabase/functions/${fn}`), {
      recursive: true,
      force: true,
    });
  }
  rmSync(target.dir, { recursive: true, force: true });
  try {
    git(repoRoot, ["update-ref", "-d", `refs/ext-base/${slug}`]);
  } catch {
    /* no ref */
  }
  const removedVersion = lock.extensions[slug]?.version ?? "unknown";
  lock.tombstones[slug] = { removedAtVersion: removedVersion };
  writeLock(repoRoot, lock);

  // 4. Regenerate everything (drops the registries/stubs/lock entry).
  await sync(repoRoot);
  console.log(
    `Removed ${slug}${opts.keepData ? " (data kept — tables orphaned but harmless)" : ""}. ` +
      `Run pnpm db:reset locally; review the generated drop migration(s) before deploying.`,
  );
}

/** `pnpm ext list` / `pnpm ext status [--json]` */
// eslint-disable-next-line @typescript-eslint/require-await
export async function status(
  repoRoot: string,
  opts: { json?: boolean; checkUpstream?: boolean },
): Promise<void> {
  const lock = readLock(repoRoot);
  const rows = Object.entries(lock.extensions).map(([slug, entry]) => {
    const modified = entry.baseCommit
      ? modifiedFiles(repoRoot, slug, entry.baseCommit)
      : [];
    let latest: string | null = null;
    if (
      opts.checkUpstream &&
      typeof entry.source === "object" &&
      entry.source.type === "github"
    ) {
      try {
        const out = execFileSync(
          "git",
          ["ls-remote", "--tags", "--refs", entry.source.repo],
          { encoding: "utf8" },
        );
        latest =
          out
            .split("\n")
            .map((l) => l.split("\t")[1]?.replace("refs/tags/v", "") ?? "")
            .filter((t) => semver.valid(t))
            .sort(semver.compare)
            .at(-1) ?? null;
      } catch {
        latest = null;
      }
    }
    return {
      slug,
      version: entry.version,
      source:
        typeof entry.source === "string" ? entry.source : entry.source.type,
      pinned: entry.pinned ?? false,
      modifiedFiles: modified.length,
      latest,
      updateAvailable:
        latest !== null && semver.gt(latest, entry.version) && !entry.pinned,
    };
  });

  if (opts.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  for (const r of rows) {
    console.log(
      `${r.slug}@${r.version} [${r.source}]` +
        (r.pinned ? " pinned" : "") +
        (r.modifiedFiles > 0 ? ` modified(${r.modifiedFiles})` : "") +
        (r.updateAvailable ? ` → ${r.latest} available` : ""),
    );
  }
}

/** `pnpm ext payload-migrate <slug> <desc>` — §3.2's one-command wrapper. */
// eslint-disable-next-line @typescript-eslint/require-await
export async function payloadMigrate(
  repoRoot: string,
  slug: string,
  desc: string,
): Promise<void> {
  const name = `ext_${slug.replace(/-/g, "_")}_${desc}`;
  execSync(`pnpm cms:migrate:create ${name}`, {
    cwd: repoRoot,
    stdio: "inherit",
  });
  const hostDir = toAbs(repoRoot, "apps/nextjs/src/payload/migrations");
  const created = readdirSync(hostDir)
    .filter((f) => f.endsWith(`_${name}.ts`))
    .sort()
    .at(-1);
  if (!created) throw new Error("migrate:create produced no migration");
  const migName = created.replace(/\.ts$/, "");

  // Relocate the .ts into the extension (the .json snapshot stays in the host
  // dir for schema-diff continuity) and deregister it from the core index.
  const extMigDir = toAbs(
    repoRoot,
    `extensions/${slug}/src/payload/migrations`,
  );
  execSync(`mkdir -p ${JSON.stringify(extMigDir)}`);
  cpSync(path.join(hostDir, created), path.join(extMigDir, created));
  rmSync(path.join(hostDir, created));
  const indexFile = path.join(hostDir, "index.ts");
  const idx = readFileSync(indexFile, "utf8")
    .replace(
      new RegExp(
        `import \\* as migration_${migName} from '\\./${migName}';\\n`,
      ),
      "",
    )
    .replace(
      new RegExp(
        `  \\{\\n    up: migration_${migName}\\.up,\\n    down: migration_${migName}\\.down,\\n    name: '${migName}'\\n?,?\\n?  \\},\\n`,
      ),
      "",
    );
  writeFileSync(indexFile, idx);

  console.log(
    `Created extensions/${slug}/src/payload/migrations/${created}.\n` +
      `Export it from the extension's ./payload \`migrations\` array, set ` +
      `cms.hasMigrations: true in its manifest, then run pnpm ext sync.`,
  );
}

/** `pnpm ext eject <slug> --repo <url>` — publish to its own repo. */
// eslint-disable-next-line @typescript-eslint/require-await
export async function eject(
  repoRoot: string,
  slug: string,
  repoUrl: string,
): Promise<void> {
  const lock = readLock(repoRoot);
  const entry = lock.extensions[slug];
  if (!entry) throw new Error(`"${slug}" is not installed`);

  const tmp = mkdtempSync(path.join(tmpdir(), "ext-eject-"));
  cpSync(toAbs(repoRoot, `extensions/${slug}`), tmp, { recursive: true });
  const run = (args: string[]) =>
    execFileSync("git", args, { cwd: tmp, stdio: "pipe", encoding: "utf8" });
  run(["init", "-b", "main"]);
  run(["add", "-A"]);
  run(["commit", "-m", `${slug} v${entry.version}`]);
  run(["tag", `v${entry.version}`]);
  run(["remote", "add", "origin", repoUrl]);
  run(["push", "-u", "origin", "main", "--tags"]);
  const commit = run(["rev-parse", "HEAD"]).trim();
  rmSync(tmp, { recursive: true, force: true });

  entry.source = {
    type: "github",
    repo: repoUrl,
    ref: `v${entry.version}`,
    commit,
  };
  entry.baseCommit = snapshotExtension(repoRoot, slug, entry.version);
  writeLock(repoRoot, lock);
  console.log(`Ejected ${slug} to ${repoUrl} (tag v${entry.version}).`);
}
