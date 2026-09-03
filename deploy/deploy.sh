#!/usr/bin/env bash
# Deploy latest main from GitHub. Run on the VPS: bash /var/www/marketingravan/deploy/deploy.sh
set -euo pipefail

APP_DIR=/var/www/marketingravan

cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main

cd "$APP_DIR/site"
npm ci --legacy-peer-deps
npm run build

cd "$APP_DIR/server"
npm ci --no-audit --no-fund

systemctl restart marketingravan-api
nginx -t && systemctl reload nginx

echo "Deployed $(git -C "$APP_DIR" rev-parse --short HEAD) at $(date)"
