/**
 * @acme/ext-tools — the extension framework's sync engine + lifecycle CLI.
 * The exports below are consumed by the registry drift test
 * (apps/nextjs/src/ext/registry-drift.test.ts), which recomputes the expected
 * generated files from the manifests and compares them to the committed ones.
 */
export {
  applyEnvExampleBlock,
  buildAllGeneratedFiles,
  buildEnvExampleBlock,
  type GeneratedFile,
} from "./generate";
export { loadExtensions, type LoadedExtension } from "./manifests";
export { buildLockModule } from "./generate";
export { readLock, readPins } from "./lock";
export type { ExtensionsLock, ExtLockEntry } from "./lock";
export { EXT_PATHS, findRepoRoot, toAbs } from "./paths";
