import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { EXT_PATHS, toAbs } from "./paths";

/**
 * Lock I/O. Two committed, CLI-owned files (docs/EXTENSIONS-PLAN.md §3.1, §4):
 *
 * - `extensions.lock` (repo root) — the install registry: per-slug version,
 *   origin/provenance, generated-stub paths, copied edge functions,
 *   tombstones. Phase 8 adds baseCommit/pristine-ref provenance.
 * - `extensions/.ext-lock.json` — Supabase migration version pins: local
 *   sequence file → assigned 14-digit version + content hash. Append-only;
 *   pinned versions are never reused (tombstoned on removal).
 */

export type ExtSource =
  | "local"
  | { type: "github"; repo: string; ref: string; commit: string }
  | { type: "zip"; sha256: string; filename: string };

export interface ExtLockEntry {
  version: string;
  kitCompat: string;
  source: ExtSource;
  /** Excluded from auto-update when true (admin "Pin" toggle / CLI). */
  pinned?: boolean;
  /** Pristine-base merge anchor (Phase 8 — refs/ext-base/<slug>). */
  baseCommit?: string;
  installedVia?: "cli" | "workflow" | "preinstalled";
  /** Repo-relative paths of generated route stubs — sync owns + deletes these. */
  stubs: string[];
  /** Edge function dirs copied into supabase/functions/. */
  edgeFunctions: string[];
}

export interface ExtensionsLock {
  lockVersion: 1;
  extensions: Record<string, ExtLockEntry>;
  /** Removed extensions — version pins are never reused. */
  tombstones: Record<string, { removedAtVersion: string }>;
}

export interface MigrationPin {
  /** Assigned 14-digit version — deterministic forever after. */
  version: string;
  /** sha256 of the source SQL — sync hard-errors if it changes after pinning. */
  sha256: string;
  /** Filename materialized into supabase/migrations/. */
  target: string;
}

export interface MigrationPins {
  pins: Record<string, MigrationPin>;
}

const sortKeys = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)),
  ) as T;

export function readLock(repoRoot: string): ExtensionsLock {
  const file = toAbs(repoRoot, EXT_PATHS.rootLock);
  if (!existsSync(file)) {
    return { lockVersion: 1, extensions: {}, tombstones: {} };
  }
  return JSON.parse(readFileSync(file, "utf8")) as ExtensionsLock;
}

export function writeLock(repoRoot: string, lock: ExtensionsLock): void {
  const file = toAbs(repoRoot, EXT_PATHS.rootLock);
  const stable: ExtensionsLock = {
    lockVersion: 1,
    extensions: sortKeys(lock.extensions),
    tombstones: sortKeys(lock.tombstones),
  };
  writeFileSync(file, `${JSON.stringify(stable, null, 2)}\n`);
}

export function readPins(repoRoot: string): MigrationPins {
  const file = toAbs(repoRoot, EXT_PATHS.migrationPins);
  if (!existsSync(file)) return { pins: {} };
  return JSON.parse(readFileSync(file, "utf8")) as MigrationPins;
}

export function writePins(repoRoot: string, pins: MigrationPins): void {
  const file = toAbs(repoRoot, EXT_PATHS.migrationPins);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    `${JSON.stringify({ pins: sortKeys(pins.pins) }, null, 2)}\n`,
  );
}
