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

# Warn (do not block) if an un-migrated SQLite store is still sitting there.
if [[ -f "$APP_DIR/server/data.sqlite" ]]; then
  echo
  echo "NOTE: $APP_DIR/server/data.sqlite still exists."
  echo "      The new code does not read it. If it holds live leads/calls/messages, run:"
  echo "        node $APP_DIR/server/migrate-sqlite.mjs --apply"
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
