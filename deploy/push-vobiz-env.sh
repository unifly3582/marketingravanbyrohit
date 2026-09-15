#!/usr/bin/env bash
# Copy the Vobiz dialing credentials from the local server/.env to the VPS env
# file, point PUBLIC_BASE_URL at the HTTPS site (so Vobiz gets an https
# answer_url and a wss:// stream URL), and restart the API.
#
# Run from the repo root on the dev machine:  bash deploy/push-vobiz-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."

HOST=root@147.93.28.140
REMOTE_ENV=/etc/marketingravan.env

val() { grep -E "^$1=" server/.env | head -1 | cut -d= -f2- | tr -d '"\r'; }
AUTH_ID=$(val VOBIZ_AUTH_ID); AUTH_TOKEN=$(val VOBIZ_AUTH_TOKEN); FROM=$(val VOBIZ_FROM_NUMBER)
[ -n "$AUTH_ID" ] && [ -n "$AUTH_TOKEN" ] && [ -n "$FROM" ] || { echo "VOBIZ_* missing in server/.env"; exit 1; }

# Everything runs in one remote script so no inner quotes cross PowerShell.
ssh -o BatchMode=yes "$HOST" bash -s <<REMOTE
set -e
cp $REMOTE_ENV $REMOTE_ENV.bak.\$(date +%Y%m%d%H%M%S)
sed -i '/^VOBIZ_AUTH_ID=/d;/^VOBIZ_AUTH_TOKEN=/d;/^VOBIZ_FROM_NUMBER=/d;/^PUBLIC_BASE_URL=/d' $REMOTE_ENV
cat >> $REMOTE_ENV <<EOV
VOBIZ_AUTH_ID=$AUTH_ID
VOBIZ_AUTH_TOKEN=$AUTH_TOKEN
VOBIZ_FROM_NUMBER=$FROM
PUBLIC_BASE_URL=https://marketingravan.com
EOV
systemctl restart marketingravan-api
sleep 3
systemctl is-active marketingravan-api
grep -o '^VOBIZ_[A-Z_]*=' $REMOTE_ENV
grep '^PUBLIC_BASE_URL=' $REMOTE_ENV
REMOTE
echo "done - now place ONE test call to your own number from the /admin panel"
