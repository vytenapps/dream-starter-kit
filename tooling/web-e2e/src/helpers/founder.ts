import { readFile } from "node:fs/promises";

/**
 * Where founder.setup.ts persists the founder's signed-in storage state (for
 * specs that act as staff, e.g. staff-invite.spec.ts) and credentials (for
 * specs that sign IN as the founder, e.g. admin-login.spec.ts). Lives under
 * test-results/ so Playwright wipes it at the start of each run and git
 * ignores it.
 *
 * In its own helper (not exported from founder.setup.ts) so importing it never
 * re-registers the founder setup test inside another spec file.
 */
export const FOUNDER_STORAGE_STATE = "test-results/.auth/founder.json";
export const FOUNDER_META = "test-results/.auth/founder-meta.json";

export async function readFounderEmail(): Promise<string> {
  const meta = JSON.parse(await readFile(FOUNDER_META, "utf8")) as {
    email: string;
  };
  return meta.email;
}
