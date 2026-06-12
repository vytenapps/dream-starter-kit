import * as migration_20260612_023534_ext_billing from "./20260612_023534_ext_billing";

/**
 * Payload (cms-schema) migrations shipped by this extension — merged into the
 * host's prodMigrations by the generated payload registry (§3.2). This one
 * renames the billing catalog to the ext-billing-* slugs (drop + recreate —
 * part of the documented one-time breaking restructure). Generated with
 * `payload migrate:create` and relocated here; the paired .json snapshot
 * stays in the host's payload/migrations dir for schema-diff continuity.
 */
export const migrations = [
  {
    up: migration_20260612_023534_ext_billing.up,
    down: migration_20260612_023534_ext_billing.down,
    name: "20260612_023534_ext_billing",
  },
];
