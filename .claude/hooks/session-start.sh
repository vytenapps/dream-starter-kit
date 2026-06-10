#!/bin/bash
# SessionStart hook — boots the full local stack for Claude Code on the web.
#
# Cloud session containers start with no Docker daemon, no Supabase CLI, and no
# .env, so out of the box nothing that needs the backend (dev server, e2e, RLS
# tests) can run. This hook makes a fresh cloud session match local dev:
#
#   1. start dockerd
#   2. install the Supabase CLI (npm) if missing
#   3. pnpm install
#   4. supabase start  — WITHOUT edge-runtime: that container sets rlimits the
#      sandboxed (nested) container runtime forbids, so it cannot boot here.
#      Edge functions (Stripe webhook, process-reminders) don't run in cloud
#      sessions; everything else works.
#   5. write .env from .env.example with the local Supabase keys (anon/service
#      role/S3) and a generated PAYLOAD_SECRET. Unset optional vars (Stripe, AI
#      gateway, OAuth) are commented out — empty strings fail the zod env
#      schema's min(1) checks.
#   6. pnpm db:reset  (supabase migrations + seeds + Payload CMS migrations)
#   7. install Playwright's Chromium — the preview pane doesn't work in cloud
#      sessions, so visual testing happens by driving the app headlessly with
#      Playwright (screenshots, e2e specs in tooling/web-e2e). Cached under
#      $PLAYWRIGHT_BROWSERS_PATH, so re-runs are no-ops.
#
# It does NOT start the Next.js dev server — use the "web" configuration in
# .claude/launch.json (the cloud preview browser) or `pnpm dev:next`.
#
# Idempotent: every step is skipped when already done, so resumes are fast.
set -euo pipefail

# Cloud sessions only — local dev manages Docker/Supabase itself.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "[session-start] 1/7 docker daemon"
if ! docker info >/dev/null 2>&1; then
  nohup dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
  docker info >/dev/null 2>&1 || { echo "[session-start] dockerd failed to start; see /tmp/dockerd.log" >&2; exit 1; }
fi

echo "[session-start] 2/7 supabase CLI"
if ! command -v supabase >/dev/null 2>&1; then
  npm install -g supabase
fi

echo "[session-start] 3/7 pnpm install"
pnpm install --prefer-offline

echo "[session-start] 4/7 supabase start (no edge-runtime)"
if ! supabase status >/dev/null 2>&1; then
  supabase start -x edge-runtime
fi

echo "[session-start] 5/7 .env"
if [ ! -f .env ]; then
  eval "$(supabase status -o env 2>/dev/null | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|S3_PROTOCOL_ACCESS_KEY_ID|S3_PROTOCOL_ACCESS_KEY_SECRET)=')"
  PAYLOAD_SECRET_VALUE=$(openssl rand -base64 32)
  cp .env.example .env
  sed -i \
    -e "s|^# NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=\"http://127.0.0.1:54321\"|" \
    -e "s|^# NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=\"$ANON_KEY\"|" \
    -e "s|^EXPO_PUBLIC_SUPABASE_ANON_KEY=.*|EXPO_PUBLIC_SUPABASE_ANON_KEY=\"$ANON_KEY\"|" \
    -e "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=\"$SERVICE_ROLE_KEY\"|" \
    -e "s|^PAYLOAD_SECRET=.*|PAYLOAD_SECRET=\"$PAYLOAD_SECRET_VALUE\"|" \
    -e "s|^S3_ACCESS_KEY_ID=.*|S3_ACCESS_KEY_ID=\"$S3_PROTOCOL_ACCESS_KEY_ID\"|" \
    -e "s|^S3_SECRET_ACCESS_KEY=.*|S3_SECRET_ACCESS_KEY=\"$S3_PROTOCOL_ACCESS_KEY_SECRET\"|" \
    -e "s|^CRON_SECRET=.*|CRON_SECRET=\"local-dev-cron-secret\"|" \
    -e "s|^AI_GATEWAY_API_KEY=.*|AI_GATEWAY_API_KEY=\"dummy-local-key-not-real\"|" \
    -e "s|^STRIPE_WEBHOOKS_ENDPOINT_SECRET=.*|STRIPE_WEBHOOKS_ENDPOINT_SECRET=\"whsec_e2e_test_secret\"|" \
    .env
  # Unset optional vars must be absent, not empty — min(1) rejects "".
  # (Use `/` as the s-delimiter: `|` would collide with the alternation.)
  sed -i -E 's/^(AI_GATEWAY_API_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|STRIPE_WEBHOOKS_ENDPOINT_SECRET|STRIPE_PRICE_MONTHLY|STRIPE_PRICE_YEARLY|PAYLOAD_PREVIEW_SECRET|NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY|SUPABASE_AUTH_EXTERNAL_[A-Z_]+|EXPO_PUBLIC_EAS_PROJECT_ID|SITE_URL)=""$/# \1=""/' .env
fi

echo "[session-start] 6/7 db reset (supabase + payload migrations)"
pnpm db:reset

echo "[session-start] 7/7 playwright chromium (visual testing + e2e)"
pnpm -F @acme/web-e2e exec playwright install chromium

echo "[session-start] done — Supabase API :54321, Studio :54323, Mailpit :54324"
