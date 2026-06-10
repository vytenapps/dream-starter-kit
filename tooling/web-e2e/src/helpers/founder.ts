/**
 * Where founder.setup.ts persists the founder's signed-in storage state for
 * specs that act as staff (staff-invite.spec.ts). Lives under test-results/ so
 * Playwright wipes it at the start of each run and git ignores it.
 *
 * In its own helper (not exported from founder.setup.ts) so importing it never
 * re-registers the founder setup test inside another spec file.
 */
export const FOUNDER_STORAGE_STATE = "test-results/.auth/founder.json";
