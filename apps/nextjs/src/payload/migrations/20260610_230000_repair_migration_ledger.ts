import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Hand-written repair migration (no schema change).
 *
 * `20260610_212512_full_registry` was generated as a full-schema rebuild: it
 * DROPs and recreates `cms.payload_migrations` itself, which wipes the ledger
 * row the runner had just written for `20260609_224708_initial`. On a fresh
 * production database the sequence still applies cleanly, but every LATER boot
 * would re-run the initial migration (its ledger row is gone), fail on the
 * already-existing types/tables, and exit. Re-inserting the missing row keeps
 * prodMigrations idempotent. Safe everywhere: a no-op when the row exists.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  INSERT INTO "cms"."payload_migrations" ("name", "batch", "created_at", "updated_at")
  SELECT '20260609_224708_initial', 1, now(), now()
  WHERE NOT EXISTS (
    SELECT 1 FROM "cms"."payload_migrations" WHERE "name" = '20260609_224708_initial'
  );`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DELETE FROM "cms"."payload_migrations" WHERE "name" = '20260609_224708_initial';`)
}
