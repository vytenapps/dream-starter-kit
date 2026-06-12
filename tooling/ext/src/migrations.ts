import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { slugToSnake } from "@acme/ext-kit";

import type { MigrationPins } from "./lock";
import type { LoadedExtension } from "./manifests";
import { EXT_PATHS, toAbs } from "./paths";

/**
 * Supabase migration materialization (docs/EXTENSIONS-PLAN.md §3.1).
 *
 * Extensions ship LOCAL sequence numbers (001_initial.sql, …). On first sight
 * sync assigns the next 14-digit version, pins it (with a content hash) in
 * extensions/.ext-lock.json, and copies the file to
 * supabase/migrations/<version>_ext_<slug>_<local-name>.sql. Pins are
 * append-only: a pinned source file may never change content (hard error) and
 * versions are never reused — deployed ledgers stay valid forever.
 */

export const sha256 = (content: string): string =>
  createHash("sha256").update(content).digest("hex");

/** "20260611093015" + n seconds, kept as a real calendar timestamp. */
export function bumpVersion(version: string, seconds = 1): string {
  if (!/^\d{14}$/.test(version)) {
    throw new Error(`not a 14-digit version: "${version}"`);
  }
  const num = (from: number, to: number) => Number(version.slice(from, to));
  const date = new Date(
    Date.UTC(
      num(0, 4),
      num(4, 6) - 1,
      num(6, 8),
      num(8, 10),
      num(10, 12),
      num(12, 14) + seconds,
    ),
  );
  return formatVersion(date);
}

export function formatVersion(date: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`
  );
}

/** Next unused version: strictly greater than every taken version and `now`. */
export function nextVersion(taken: Set<string>, now: Date): string {
  let candidate = formatVersion(now);
  const max = [...taken].sort().at(-1);
  if (max && candidate <= max) candidate = bumpVersion(max);
  while (taken.has(candidate)) candidate = bumpVersion(candidate);
  return candidate;
}

export interface MigrationSyncResult {
  pins: MigrationPins;
  /** Newly pinned source files (slug/local-file). */
  added: string[];
  /** Materialized target files (re)written this run. */
  written: string[];
}

/**
 * Pin + copy every extension migration into supabase/migrations/. Idempotent:
 * already-pinned files are verified (content hash) and re-materialized only if
 * the target is missing. Throws on content drift of a pinned source.
 */
export function syncSupabaseMigrations(
  repoRoot: string,
  exts: LoadedExtension[],
  pins: MigrationPins,
  now: () => Date = () => new Date(),
): MigrationSyncResult {
  const hostDir = toAbs(repoRoot, EXT_PATHS.supabaseMigrationsDir);
  const taken = new Set<string>(
    readdirSync(hostDir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.slice(0, 14)),
  );
  for (const pin of Object.values(pins.pins)) taken.add(pin.version);

  const result: MigrationSyncResult = {
    pins: { pins: { ...pins.pins } },
    added: [],
    written: [],
  };

  for (const ext of exts) {
    const slug = ext.manifest.slug;
    const srcDir = path.join(ext.dir, "supabase/migrations");
    if (!existsSync(srcDir)) continue;
    const files = readdirSync(srcDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const key = `${slug}/${file}`;
      const content = readFileSync(path.join(srcDir, file), "utf8");
      const hash = sha256(content);
      const existing = result.pins.pins[key];

      if (existing) {
        if (existing.sha256 !== hash) {
          throw new Error(
            `[${slug}] supabase/migrations/${file} changed after it was synced (pinned ${existing.version}). ` +
              `Migrations are append-only on both sides — add a new migration instead.`,
          );
        }
        const target = path.join(hostDir, existing.target);
        if (!existsSync(target) || readFileSync(target, "utf8") !== content) {
          writeFileSync(target, content);
          result.written.push(existing.target);
        }
        continue;
      }

      const version = nextVersion(taken, now());
      taken.add(version);
      const targetName = `${version}_ext_${slugToSnake(slug)}_${file.replace(/\.sql$/, "")}.sql`;
      writeFileSync(path.join(hostDir, targetName), content);
      result.pins.pins[key] = { version, sha256: hash, target: targetName };
      result.added.push(key);
      result.written.push(targetName);
    }
  }

  return result;
}
