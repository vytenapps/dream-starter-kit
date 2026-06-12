import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import semver from "semver";

import type { ExtensionManifest } from "@acme/ext-kit";
import { KIT_VERSION } from "@acme/config";
import {
  envPrefixes,
  extensionManifestSchema,
  lintExtensionSql,
  validateManifest,
  validateManifestSet,
} from "@acme/ext-kit";

import { EXT_PATHS, toAbs } from "./paths";

/** A vendored extension, loaded + validated from extensions/<slug>/. */
export interface LoadedExtension {
  manifest: ExtensionManifest;
  /** Absolute path of extensions/<slug>. */
  dir: string;
  /** @acme/ext-<slug> */
  packageName: string;
  /**
   * Client env keys declared in ./env (UNPREFIXED form `EXT_<SLUG>_*`) — the
   * generated env modules map them to NEXT_PUBLIC_* / EXPO_PUBLIC_* reads.
   */
  envClientKeys: string[];
  /** Server env keys declared in ./env (`EXT_<SLUG>_*`). */
  envServerKeys: string[];
}

interface EnvModule {
  default?: {
    server?: Record<string, unknown>;
    client?: Record<string, unknown>;
  };
}

export class ExtValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`extension validation failed:\n  - ${errors.join("\n  - ")}`);
  }
}

/**
 * Discover, load and validate every extension under extensions/*. Throws
 * ExtValidationError with ALL problems aggregated. Returns extensions sorted
 * by slug (the deterministic order every generated registry uses).
 */
export async function loadExtensions(
  repoRoot: string,
): Promise<LoadedExtension[]> {
  const extDir = toAbs(repoRoot, EXT_PATHS.extensionsDir);
  if (!existsSync(extDir)) return [];

  const dirs = readdirSync(extDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();

  const errors: string[] = [];
  const loaded: LoadedExtension[] = [];

  for (const dirName of dirs) {
    const dir = path.join(extDir, dirName);
    const configFile = path.join(dir, "extension.config.ts");
    if (!existsSync(configFile)) {
      errors.push(`extensions/${dirName}/ has no extension.config.ts`);
      continue;
    }

    let manifest: ExtensionManifest;
    try {
      const mod = (await import(pathToFileURL(configFile).href)) as {
        default?: unknown;
      };
      manifest = extensionManifestSchema.parse(mod.default);
    } catch (err) {
      errors.push(
        `extensions/${dirName}/extension.config.ts failed to load: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    if (manifest.slug !== dirName) {
      errors.push(
        `extensions/${dirName}/ manifest slug is "${manifest.slug}" — directory and slug must match`,
      );
    }

    const packageName = `@acme/ext-${manifest.slug}`;
    const pkgFile = path.join(dir, "package.json");
    if (!existsSync(pkgFile)) {
      errors.push(`[${manifest.slug}] missing package.json`);
    } else {
      const pkg = JSON.parse(readFileSync(pkgFile, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (pkg.name !== packageName) {
        errors.push(
          `[${manifest.slug}] package.json name "${pkg.name}" must be "${packageName}"`,
        );
      }
      if (pkg.version !== manifest.version) {
        errors.push(
          `[${manifest.slug}] package.json version "${pkg.version}" must match manifest version "${manifest.version}"`,
        );
      }
    }

    if (!semver.satisfies(KIT_VERSION, manifest.kitCompat)) {
      errors.push(
        `[${manifest.slug}] kitCompat "${manifest.kitCompat}" does not include kit version ${KIT_VERSION}`,
      );
    }

    errors.push(...validateManifest(manifest));

    // Env contract: enumerate ./env keys (sync bakes them into the generated
    // env modules) and enforce the EXT_<SLUG>_ prefix.
    let envClientKeys: string[] = [];
    let envServerKeys: string[] = [];
    if (manifest.env.hasServer || manifest.env.hasClient) {
      const envFile = path.join(dir, "src/env.ts");
      if (!existsSync(envFile)) {
        errors.push(
          `[${manifest.slug}] env.hasServer/hasClient set but src/env.ts is missing`,
        );
      } else {
        try {
          const mod = (await import(pathToFileURL(envFile).href)) as EnvModule;
          envServerKeys = Object.keys(mod.default?.server ?? {}).sort();
          envClientKeys = Object.keys(mod.default?.client ?? {}).sort();
        } catch (err) {
          errors.push(
            `[${manifest.slug}] src/env.ts failed to load: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        const serverPrefix = envPrefixes(manifest.slug)[0] ?? "";
        for (const key of [...envServerKeys, ...envClientKeys]) {
          if (!key.startsWith(serverPrefix)) {
            errors.push(
              `[${manifest.slug}] env key "${key}" must be prefixed "${serverPrefix}" (codegen adds NEXT_PUBLIC_/EXPO_PUBLIC_ for client keys)`,
            );
          }
        }
        if (manifest.env.hasServer && envServerKeys.length === 0) {
          errors.push(
            `[${manifest.slug}] env.hasServer is true but src/env.ts exports no server shape`,
          );
        }
        if (manifest.env.hasClient && envClientKeys.length === 0) {
          errors.push(
            `[${manifest.slug}] env.hasClient is true but src/env.ts exports no client shape`,
          );
        }
      }
    }

    loaded.push({ manifest, dir, packageName, envClientKeys, envServerKeys });
  }

  const manifests = loaded.map((l) => l.manifest);
  errors.push(...validateManifestSet(manifests));

  // SQL ownership lint over each extension's migrations + drop.sql.
  for (const ext of loaded) {
    const allowedDml = ext.manifest.database.dml;
    const sqlDir = path.join(ext.dir, "supabase/migrations");
    const sqlFiles = existsSync(sqlDir)
      ? readdirSync(sqlDir)
          .filter((f) => f.endsWith(".sql"))
          .sort()
          .map((f) => path.join(sqlDir, f))
      : [];
    const dropFile = path.join(ext.dir, "supabase/drop.sql");
    if (existsSync(dropFile)) sqlFiles.push(dropFile);
    for (const file of sqlFiles) {
      errors.push(
        ...lintExtensionSql(readFileSync(file, "utf8"), {
          slug: ext.manifest.slug,
          file: path.relative(ext.dir, file),
          ownTables: ext.manifest.database.tables,
          allowedDmlTables: allowedDml,
        }),
      );
    }
  }

  if (errors.length > 0) throw new ExtValidationError(errors);
  return loaded;
}
