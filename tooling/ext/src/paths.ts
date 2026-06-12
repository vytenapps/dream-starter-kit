import { existsSync } from "node:fs";
import path from "node:path";

/** Walk up from `start` until pnpm-workspace.yaml is found (the repo root). */
export function findRepoRoot(start = process.cwd()): string {
  let dir = path.resolve(start);
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find repo root (pnpm-workspace.yaml) above ${start}`,
      );
    }
    dir = parent;
  }
}

/**
 * Every path the framework owns, repo-relative (posix separators — they're
 * used as map keys and in the lock; convert with toAbs for fs access).
 */
export const EXT_PATHS = {
  extensionsDir: "extensions",
  rootLock: "extensions.lock",
  migrationPins: "extensions/.ext-lock.json",
  supabaseMigrationsDir: "supabase/migrations",
  supabaseFunctionsDir: "supabase/functions",
  envExample: ".env.example",
  // Generated registries (committed; drift fails `pnpm test`).
  nextClientRegistry: "apps/nextjs/src/ext/registry.client.generated.ts",
  nextServerRegistry: "apps/nextjs/src/ext/registry.server.generated.ts",
  nextPayloadRegistry: "apps/nextjs/src/ext/registry.payload.generated.ts",
  nextEnv: "apps/nextjs/src/ext/env.generated.ts",
  nextLockModule: "apps/nextjs/src/ext/lock.generated.ts",
  nextTranspileJson: "apps/nextjs/ext-packages.generated.json",
  expoRegistry: "apps/expo/src/ext/registry.generated.ts",
  expoEnv: "apps/expo/src/ext/env.generated.ts",
  // Stub roots (machine-owned subtrees, wiped + regenerated every sync).
  nextAppGroup: "apps/nextjs/src/app/(frontend)/(app)",
  nextPublicGroup: "apps/nextjs/src/app/(frontend)/(public)",
  expoAppGroup: "apps/expo/src/app/(app)",
} as const;

export function toAbs(repoRoot: string, repoRel: string): string {
  return path.join(repoRoot, ...repoRel.split("/"));
}
