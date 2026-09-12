#!/usr/bin/env bash
# Terminate TLS for marketingravan.com on this VPS, so the site (and the voice
# agent's WebSocket) can be served straight from Mumbai without Cloudflare's
# proxy in the path. Safe to run while Cloudflare is still proxying: nothing
# here changes what :80 serves to it.
#
# Usage, on the VPS as root:
#   bash /root/marketingravan-direct/go-direct.sh
# Then, in Cloudflare DNS, set the A records for `marketingravan.com` and `www`
# to "DNS only" (grey cloud). Within ~5 minutes browsers hit :443 here directly.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
CONF_SRC="${CONF_SRC:-$HERE/nginx-marketingravan.conf}"
CONF_DST=/etc/nginx/sites-available/marketingravan

echo "== 1/4 certificate for marketingravan.com + www"
# `certonly` so certbot does not rewrite the nginx file; the repo copy is the
# source of truth. The nginx authenticator answers the HTTP-01 challenge on :80,
# which works both through Cloudflare's proxy and directly.
certbot certonly --nginx --non-interactive --agree-tos --keep-until-expiring \
  --register-unsafely-without-email \
  -d marketingravan.com -d www.marketingravan.com

echo "== 2/4 install nginx vhost"
cp -a "$CONF_DST" "/root/marketingravan.nginx.bak-$(date +%s)"
cp "$CONF_SRC" "$CONF_DST"
nginx -t

echo "== 3/4 reload nginx"
systemctl reload nginx

echo "== 4/4 verify from the box itself (bypassing DNS)"
for host in marketingravan.com www.marketingravan.com; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --resolve "$host:443:127.0.0.1" "https://$host/api/voice/web/config")
  echo "  https://$host/api/voice/web/config -> $code   (expect 200)"
done
code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: marketingravan.com' http://127.0.0.1/)
echo "  plain http, no X-Forwarded-Proto      -> $code   (expect 301 to https)"
code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: marketingravan.com' -H 'X-Forwarded-Proto: https' http://127.0.0.1/)
echo "  plain http as Cloudflare sends it     -> $code   (expect 200, no loop)"
echo
echo "Done. Now flip marketingravan.com and www to DNS only (grey cloud) in Cloudflare."
