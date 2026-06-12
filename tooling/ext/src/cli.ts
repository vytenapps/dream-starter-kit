import { ExtValidationError } from "./manifests";
import { findRepoRoot } from "./paths";
import { sync } from "./sync";

/**
 * Extension lifecycle CLI (docs/EXTENSIONS-PLAN.md §5). One implementation,
 * two front doors: developers run `pnpm ext <cmd>`, the admin panel's GitHub
 * Actions workflow runs the same commands with --ci.
 *
 * Phase 1 ships `sync`; add/update/remove/status/create/eject/payload-migrate
 * land with the lifecycle phase (§8 step 8).
 */
const HELP = `Usage: pnpm ext <command>

Commands:
  sync    Regenerate registries, route stubs, migrations and env from
          extensions/*/extension.config.ts. Run after any change under
          extensions/ and commit the outputs (drift fails \`pnpm test\`).
`;

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);
  switch (command) {
    case "sync":
      await sync(findRepoRoot());
      return;
    case undefined:
    case "help":
    case "--help":
      console.log(HELP);
      return;
    default:
      console.error(`Unknown command "${command}".\n\n${HELP}`);
      process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  if (err instanceof ExtValidationError) {
    console.error(`\next sync failed — ${err.message}\n`);
  } else {
    console.error(err);
  }
  process.exitCode = 1;
});
