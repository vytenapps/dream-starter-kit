#!/usr/bin/env bash
# Enables TLS — with a throwaway SELF-SIGNED cert (CN=localhost) — on the LOCAL
# Supabase Postgres container, mirroring hosted Supabase's posture: hosted
# Postgres presents a cert chain rooted in Supabase's own CA, which no client
# trust store verifies. With this on (plus `sslmode=require` in the DB URLs),
# the runtime DB bootstrap and Payload's pool exercise the exact hosted code
# path in e2e — the path that once shipped a SELF_SIGNED_CERT_IN_CHAIN
# regression while CI stayed green over plaintext.
#
# Plaintext clients keep working: `ssl = on` does not force SSL (pg_hba `host`
# rules still accept non-SSL connections), so the Supabase stack itself, psql
# provisioning, and any URL without `sslmode` are unaffected.
#
# Idempotent; needs only docker + openssl on the host (psql runs inside the
# container). The cert/key live INSIDE PGDATA with relative GUC paths so they
# share the docker volume's lifecycle with the persisted postgresql.auto.conf
# (a cert outside the volume would outlive `supabase stop` in config but not on
# disk, and the next boot would fail). `--disable` turns TLS back off.
#
# Usage: bash tooling/scripts/enable-supabase-db-tls.sh [--disable]
set -euo pipefail

# Local stack defaults (supabase/config.toml); the password is the local-dev
# throwaway. Both superuser roles share it; `supabase_admin` is the superuser
# (the local `postgres` role is not) and ALTER SYSTEM needs superuser.
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-postgres}"

CONTAINER="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n1)"
if [[ -z "$CONTAINER" ]]; then
  echo "::error::no supabase_db_* container found — run 'supabase start' first" >&2
  exit 1
fi

run_sql() {
  docker exec -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER" \
    psql -h 127.0.0.1 -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -Atc "$1"
}

# Whether an sslmode=require connection actually negotiates TLS. Probing from
# inside the container is equivalent to the host: the published port maps to
# the same postmaster, and TLS is negotiated end-to-end with it.
require_tls_probe() {
  docker exec -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER" \
    psql "postgresql://supabase_admin@127.0.0.1:5432/postgres?sslmode=require" \
    -Atc 'select ssl from pg_stat_ssl where pid = pg_backend_pid()' 2>/dev/null ||
    true
}

if [[ "${1:-}" == "--disable" ]]; then
  run_sql "alter system set ssl = off" >/dev/null
  run_sql "alter system reset ssl_cert_file" >/dev/null
  run_sql "alter system reset ssl_key_file" >/dev/null
  run_sql "select pg_reload_conf()" >/dev/null
  echo "TLS disabled on $CONTAINER"
  exit 0
fi

if [[ "$(require_tls_probe)" == "t" ]]; then
  echo "TLS already enabled on $CONTAINER"
  exit 0
fi

# Throwaway self-signed cert — the point is a chain NO trust store accepts.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=localhost" \
  -keyout "$TMP/server.key" -out "$TMP/server.crt" 2>/dev/null

PGDATA_DIR="$(run_sql 'show data_directory')"
docker cp "$TMP/server.crt" "$CONTAINER:$PGDATA_DIR/server.crt"
docker cp "$TMP/server.key" "$CONTAINER:$PGDATA_DIR/server.key"
docker exec -u root "$CONTAINER" sh -c \
  "chown postgres:postgres '$PGDATA_DIR/server.crt' '$PGDATA_DIR/server.key' &&
   chmod 0600 '$PGDATA_DIR/server.key' && chmod 0644 '$PGDATA_DIR/server.crt'"

# Relative paths resolve against PGDATA. ssl* GUCs are sighup-reloadable
# (PostgreSQL >= 10) — no restart; only new connections negotiate TLS, and all
# the connections we care about are new.
run_sql "alter system set ssl_cert_file = 'server.crt'" >/dev/null
run_sql "alter system set ssl_key_file = 'server.key'" >/dev/null
run_sql "alter system set ssl = on" >/dev/null
run_sql "select pg_reload_conf()" >/dev/null

# Hard verification — if TLS silently failed to come up, the e2e gate would be
# testing plaintext and the regression coverage would evaporate.
if [[ "$(require_tls_probe)" != "t" ]]; then
  echo "::error::TLS enable failed — an sslmode=require connection is not encrypted" >&2
  exit 1
fi
# ...and plaintext must keep working (shared container: stack + psql steps).
docker exec -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER" \
  psql "postgresql://supabase_admin@127.0.0.1:5432/postgres?sslmode=disable" \
  -Atc 'select 1' >/dev/null

echo "TLS enabled on $CONTAINER (self-signed, CN=localhost)"
