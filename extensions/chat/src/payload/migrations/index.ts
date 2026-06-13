import * as migration_20260612_015425_ext_chat_settings from "./20260612_015425_ext_chat_settings";
import * as migration_20260613_021834_ext_chat_skills_and_settings_tabs from "./20260613_021834_ext_chat_skills_and_settings_tabs";

/**
 * Payload (cms-schema) migrations shipped by this extension — merged into the
 * host's prodMigrations by the generated payload registry, sorted by the
 * timestamp prefix (docs/EXTENSIONS-PLAN.md §3.2). Generated with
 * `payload migrate:create` and relocated here; the paired .json snapshot
 * stays in the host's payload/migrations dir so future schema diffs stay
 * continuous. Never hand-edit migration files.
 */
export const migrations = [
  {
    up: migration_20260612_015425_ext_chat_settings.up,
    down: migration_20260612_015425_ext_chat_settings.down,
    name: "20260612_015425_ext_chat_settings",
  },
  {
    up: migration_20260613_021834_ext_chat_skills_and_settings_tabs.up,
    down: migration_20260613_021834_ext_chat_skills_and_settings_tabs.down,
    name: "20260613_021834_ext_chat_skills_and_settings_tabs",
  },
];
