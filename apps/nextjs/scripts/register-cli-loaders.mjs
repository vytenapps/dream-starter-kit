/**
 * Registers the CLI module-customization hooks (./stub-asset-imports.mjs) on
 * the main thread. `node --import <file>` only runs a module for its side
 * effects — exported `resolve`/`load` hooks do nothing unless handed to
 * `module.register`, which is what this shim does. Loaded after `--import tsx`
 * so the asset stub chains ahead of tsx's TypeScript resolver.
 *
 * Used by `pnpm cms:seed` / `pnpm cms:backfill-users` (apps/nextjs/package.json).
 */
import { register } from "node:module";

register("./stub-asset-imports.mjs", import.meta.url);
