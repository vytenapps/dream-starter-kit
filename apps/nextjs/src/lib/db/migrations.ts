import migrationsJson from "./supabase-migrations.generated.json";

/** One `supabase/migrations/*.sql` file, inlined for the runtime bootstrap. */
export interface SqlMigration {
  /** 14-digit timestamp prefix — the primary key of the CLI's ledger. */
  version: string;
  /** Filename remainder, e.g. "initial". */
  name: string;
  /** Entire file contents (may contain many statements / DO $$ blocks). */
  sql: string;
}

/**
 * The kit's Supabase migrations, generated from `supabase/migrations/*.sql` by
 * `pnpm db:gen-migrations` (see scripts/generate-supabase-migrations.ts) and
 * committed. Ordered by version — the order `supabase db push` applies them.
 */
export const supabaseMigrations: SqlMigration[] = migrationsJson;
