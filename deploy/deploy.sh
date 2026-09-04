#!/usr/bin/env bash
# Deploy latest main from GitHub. Run on the VPS: bash /var/www/marketingravan/deploy/deploy.sh
set -euo pipefail

APP_DIR=/var/www/marketingravan
ENV_FILE=/etc/marketingravan.env

# ---------------------------------------------------------------- preflight
#
# The server now exits on boot without Supabase and Google credentials. Without
# this check a deploy that forgets them restarts into a crash loop and takes the
# live call-request and voice-agent endpoints down with it. Fail here instead,
# while the old service is still happily running.

REQUIRED_ENV=(
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  GOOGLE_GENERATIVE_AI_API_KEY
  GOOGLE_API_KEY
  SARVAM_SAMVAAD_API_KEY
  SARVAM_ORG_ID
  SARVAM_WORKSPACE_ID
  AGENT_PHONE_NUMBER
  ADMIN_PASSWORD
)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ABORT: $ENV_FILE not found. The systemd unit reads its environment from there."
  exit 1
fi

missing=()
for key in "${REQUIRED_ENV[@]}"; do
  # Present and non-empty, ignoring comments.
  if ! grep -qE "^[[:space:]]*${key}=.+" "$ENV_FILE"; then
    missing+=("$key")
  fi
done

if (( ${#missing[@]} )); then
  echo "ABORT: $ENV_FILE is missing values for:"
  printf '  %s\n' "${missing[@]}"
  echo
  echo "Add them, then re-run. Nothing has been changed; the running service is untouched."
  exit 1
fi

echo "preflight ok — $ENV_FILE has all required keys"

# Vite inlines VITE_* at build time, so a missing site/.env does not fail the
# build — it silently ships a bundle whose Supabase client throws on load, and
# only /live is broken. Catch it here instead of in front of a client.
SITE_ENV="$APP_DIR/site/.env"
if ! grep -qE "^[[:space:]]*VITE_SUPABASE_URL=.+" "$SITE_ENV" 2>/dev/null ||
   ! grep -qE "^[[:space:]]*VITE_SUPABASE_PUBLISHABLE_KEY=.+" "$SITE_ENV" 2>/dev/null; then
  echo "ABORT: $SITE_ENV needs VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY."
  echo "       These are the publishable (browser-safe) values — RLS is what protects the data."
  echo "       Create it with:"
  echo
  echo "         printf 'VITE_SUPABASE_URL=%s\\nVITE_SUPABASE_PUBLISHABLE_KEY=%s\\n' \\"
  echo "           'https://<project>.supabase.co' '<publishable key>' > $SITE_ENV"
  echo
  exit 1
fi

echo "preflight ok — $SITE_ENV has the browser keys"

# @mastra/core needs >=22.13, @supabase/supabase-js and @ai-sdk/google need >=22.
# npm only warns about engine mismatches, so without this check the install
# "succeeds" and the service misbehaves at runtime instead.
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if (( NODE_MAJOR < 22 )); then
  echo "ABORT: node $(node --version 2>/dev/null || echo 'not found') — this app needs >= 22."
  echo "       Other services on this box may pin the system node, so install 22"
  echo "       side-by-side and point only this unit at it:"
  echo "         ExecStart=/opt/node22/bin/node /var/www/marketingravan/server/index.mjs"
  exit 1
fi
echo "preflight ok — node $(node --version)"

# Warn (do not block) if an un-migrated SQLite store is still sitting there.
# The old store honoured DB_PATH, so it is usually NOT under server/.
LEGACY_DB=$(grep -oE '^[[:space:]]*DB_PATH=.+' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'"'"' ')
LEGACY_DB=${LEGACY_DB:-$APP_DIR/server/data.sqlite}
if [[ -f "$LEGACY_DB" ]]; then
  echo
  echo "NOTE: $LEGACY_DB still exists (plus any -wal holding uncheckpointed rows)."
  echo "      The new code does not read it. If it holds live leads/calls/messages:"
  echo "        node $APP_DIR/server/migrate-sqlite.mjs '$LEGACY_DB'          # dry run"
  echo "        node $APP_DIR/server/migrate-sqlite.mjs '$LEGACY_DB' --apply"
  echo "      Keep the file as a cold backup either way."
  echo
fi

# ------------------------------------------------------------------- deploy

cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main

cd "$APP_DIR/site"
npm ci --legacy-peer-deps
npm run build

cd "$APP_DIR/server"
npm ci --no-audit --no-fund

systemctl restart marketingravan-api

# Give it a moment to fall over, so a bad deploy is reported here rather than
# discovered by a customer.
sleep 3
if ! systemctl is-active --quiet marketingravan-api; then
  echo
  echo "FAILED: marketingravan-api did not stay running. Recent logs:"
  journalctl -u marketingravan-api -n 30 --no-pager
  exit 1
fi

nginx -t && systemctl reload nginx

echo "Deployed $(git -C "$APP_DIR" rev-parse --short HEAD) at $(date)"
