#!/usr/bin/env bash
# Publish the portfolio on AWS EC2 at https://dzoannguyentran.jobsmatchnow.com (run this ON the EC2).
#
#   ./startaws.sh
#
# What it does (safe to re-run):
#   1. DNS     — makes dzoannguyentran.jobsmatchnow.com point at this EC2's public IP. With a GoDaddy API key
#                (GODADDY_API_KEY / GODADDY_API_SECRET) it creates the A record itself; otherwise it
#                prints the record to add in the GoDaddy DNS page and waits until it is live.
#   2. Website — starts the site in the background on 127.0.0.1:9065, or the next free port if another
#                program has it (private; only the proxy reaches it).
#   3. Proxy   — adds dzoannguyentran.jobsmatchnow.com to the web server already on port 80 (nginx or Caddy)
#                and gets a free HTTPS certificate (Let's Encrypt).
#   4. Check   — fetches https://dzoannguyentran.jobsmatchnow.com and prints the result.
#
# Options (environment variables):
#   SUBDOMAIN=dzoannguyentran  DOMAIN=jobsmatchnow.com  PORT=9065  (a PORT you pick is remembered in .data/aws.port)
#   CERT_EMAIL=you@x.com            Let's Encrypt contact (default: OWNER_EMAIL from .env.local)
#   GODADDY_API_KEY=… GODADDY_API_SECRET=…   create the DNS record automatically
#   DNS_WAIT=600                    seconds to wait for the DNS record to become live
#
# Needs: sudo, and ports 80 + 443 open to the internet in the EC2 security group (9065 stays closed).

set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

SUBDOMAIN="${SUBDOMAIN:-dzoannguyentran}"
DOMAIN="${DOMAIN:-jobsmatchnow.com}"
FQDN="$SUBDOMAIN.$DOMAIN"
PORT="${PORT:-$(cat .data/aws.port 2>/dev/null || echo 9065)}"
[[ "$PORT" =~ ^[0-9]+$ ]] || { echo "PORT must be a number (got '$PORT')"; exit 1; }
DNS_WAIT="${DNS_WAIT:-600}"
SITE_URL="https://$FQDN"

say() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

command -v curl >/dev/null || die "curl is required."
if ! sudo -n true 2>/dev/null; then
  echo "sudo is needed to configure the web server and HTTPS."
  echo "(On EC2 the 'ubuntu' user normally has password-less sudo; on this instance it asks for a password.)"
  sudo -v || die "No sudo access. Restore password-less sudo (README → 'sudo asks for a password'), then re-run."
fi

# ---------------------------------------------------------------- this EC2's public IP
token="$(curl -s -m 2 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)"
IP="$(curl -s -m 2 -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/public-ipv4 || true)"
[[ "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || IP="${PUBLIC_HOST:-}"
[[ -n "$IP" ]] || die "Could not detect the public IP (not on EC2?). Set PUBLIC_HOST=1.2.3.4 and re-run."
say "This EC2: $IP  →  $FQDN"

# ---------------------------------------------------------------- 1. DNS
# Ask Google's public DNS, so the answer is what the internet (and Let's Encrypt) sees.
dns_ip() {
  curl -s -m 5 "https://dns.google/resolve?name=$FQDN&type=A" \
    | grep -o '"data": *"[0-9.]*"' | head -1 | grep -o '[0-9.]\{7,\}' || true
}
if [[ "$(dns_ip)" == "$IP" ]]; then
  echo "  DNS already points $FQDN to $IP."
else
  if [[ -n "${GODADDY_API_KEY:-}" && -n "${GODADDY_API_SECRET:-}" ]]; then
    say "Creating DNS record $FQDN → $IP (GoDaddy API)"
    code="$(curl -s -o /tmp/godaddy.out -w '%{http_code}' -X PUT \
      "https://api.godaddy.com/v1/domains/$DOMAIN/records/A/$SUBDOMAIN" \
      -H "Authorization: sso-key $GODADDY_API_KEY:$GODADDY_API_SECRET" \
      -H 'Content-Type: application/json' -d "[{\"data\":\"$IP\",\"ttl\":3600}]")"
    if [[ "$code" == "200" ]]; then
      echo "  Record created."
    else
      warn "GoDaddy API answered $code: $(cat /tmp/godaddy.out). Add the record by hand (below)."
    fi
    rm -f /tmp/godaddy.out
  fi
  if [[ "$(dns_ip)" != "$IP" ]]; then
    say "Add this record in GoDaddy → $DOMAIN → DNS → Add New Record:"
    printf '\n    Type: A     Name: %s     Data: %s     TTL: 1 Hour\n\n' "$SUBDOMAIN" "$IP"
    echo "  Waiting up to $DNS_WAIT s for it to go live (Ctrl+C to stop; re-run later is fine)…"
    for ((t = 0; t < DNS_WAIT; t += 15)); do
      [[ "$(dns_ip)" == "$IP" ]] && break
      sleep 15
    done
  fi
  current="$(dns_ip)"
  [[ "$current" == "$IP" ]] || die "$FQDN resolves to '${current:-nothing}', not $IP yet. Re-run ./startaws.sh once the record is live."
  echo "  DNS is live: $FQDN → $IP"
fi

# ---------------------------------------------------------------- 2. website on 127.0.0.1:$PORT
say "Starting the website on 127.0.0.1 (port $PORT, or the next free one if another program has it)"
# start.sh restarts a copy running from THIS folder (freeing its port) and never touches other programs:
# if $PORT is theirs, it takes the next free port. The proxy below is pointed at whichever port it used.
if [[ -f .env.local ]]; then
  if grep -q '^SITE_URL=' .env.local; then
    sed -i "s#^SITE_URL=.*#SITE_URL=$SITE_URL#" .env.local
  else
    printf '\nSITE_URL=%s\n' "$SITE_URL" >> .env.local
  fi
fi
rm -f .data/server.port
PORT="$PORT" BIND=127.0.0.1 PUBLIC_URL="$SITE_URL" PUBLIC_HOST="$IP" ./start.sh --bg
grep -q '^SITE_URL=' .env.local || printf '\nSITE_URL=%s\n' "$SITE_URL" >> .env.local   # first run creates .env.local
used="$(cat .data/server.port 2>/dev/null || true)"
[[ "$used" =~ ^[0-9]+$ ]] || die "start.sh did not report the port it used (.data/server.port). See .data/server.log."
[[ "$used" != "$PORT" ]] && warn "Port $PORT is taken by another program — the site runs on $used instead."
PORT="$used"
code="$(curl -s -o /dev/null -w '%{http_code}' -m 15 "http://127.0.0.1:$PORT/" || true)"
[[ "$code" == "200" ]] || die "The site is not answering on 127.0.0.1:$PORT (HTTP $code) — see .data/server.log."
mkdir -p .data && echo "$PORT" > .data/aws.port   # re-runs (after git pull) reuse this port

# ---------------------------------------------------------------- 3. reverse proxy + HTTPS
CERT_EMAIL="${CERT_EMAIL:-$(grep '^OWNER_EMAIL=' .env.local 2>/dev/null | cut -d= -f2 || true)}"
CERT_EMAIL="${CERT_EMAIL:-dzoannguyentran@gmail.com}"
web_server="$(sudo ss -ltnpH 'sport = :80' 2>/dev/null | grep -o 'users:(("[^"]*' | head -1 | cut -d'"' -f2 || true)"

install_pkg() {
  if command -v apt-get >/dev/null; then sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
  elif command -v dnf >/dev/null; then sudo dnf install -y -q "$@"
  else die "No apt-get or dnf: install $* yourself and re-run."; fi
}

nginx_conf() {
  cat <<EOF
# $FQDN → portfolio website (written by Myweb/startaws.sh). HTTPS lines are added by certbot.
server {
    listen 80;
    server_name $FQDN;
    client_max_body_size 50m;                 # document and media uploads

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_buffering off;                  # the recruiter chat streams its replies
        proxy_read_timeout 300s;              # AI document analysis can take a while
    }
}
EOF
}

case "$web_server" in
  nginx | "")
    if [[ -z "$web_server" ]]; then
      say "Nothing is listening on port 80 — installing nginx"
      install_pkg nginx
      sudo systemctl enable --now nginx
    fi
    conf=/etc/nginx/conf.d/myweb-$SUBDOMAIN.conf
    if [[ -f "$conf" ]]; then
      # Keep certbot's HTTPS lines, but make sure the proxy points at the port the site runs on now.
      if sudo grep -q "proxy_pass http://127.0.0.1:$PORT;" "$conf"; then
        echo "  nginx already has $conf (kept as is)."
      else
        say "Pointing $conf at port $PORT"
        sudo sed -i "s#proxy_pass http://127\.0\.0\.1:[0-9]*;#proxy_pass http://127.0.0.1:$PORT;#" "$conf"
      fi
    else
      say "Adding $FQDN to nginx ($conf)"
      nginx_conf | sudo tee "$conf" >/dev/null
    fi
    sudo nginx -t || die "nginx rejected the configuration (see above). Fix or remove $conf, then re-run."
    sudo systemctl reload nginx

    if ! command -v certbot >/dev/null; then
      say "Installing certbot (Let's Encrypt)"
      install_pkg certbot python3-certbot-nginx || {
        # Amazon Linux without the nginx plugin package: certbot in its own Python environment.
        install_pkg python3 augeas-libs
        sudo python3 -m venv /opt/certbot && sudo /opt/certbot/bin/pip install -q certbot certbot-nginx
        sudo ln -sf /opt/certbot/bin/certbot /usr/local/bin/certbot
      }
    fi
    say "Getting the HTTPS certificate for $FQDN"
    sudo certbot --nginx -d "$FQDN" -n --agree-tos -m "$CERT_EMAIL" --redirect --keep-until-expiring \
      || die "certbot failed. Check that ports 80 and 443 are open in the EC2 security group, then re-run."
    ;;
  caddy)
    caddyfile=/etc/caddy/Caddyfile
    if sudo grep -q "^$FQDN" "$caddyfile" 2>/dev/null; then
      echo "  Caddy already serves $FQDN; making sure it points at port $PORT."
      sudo cp "$caddyfile" "$caddyfile.bak.$(date +%Y%m%d%H%M%S)"
      sudo sed -i "/^${FQDN//./\\.} {/,/^}/ s#reverse_proxy 127\.0\.0\.1:[0-9]*#reverse_proxy 127.0.0.1:$PORT#" "$caddyfile"
    else
      say "Adding $FQDN to Caddy ($caddyfile) — Caddy gets the HTTPS certificate itself"
      sudo cp "$caddyfile" "$caddyfile.bak.$(date +%Y%m%d%H%M%S)"
      printf '\n# Portfolio website (Myweb/startaws.sh)\n%s {\n    reverse_proxy 127.0.0.1:%s {\n        flush_interval -1\n    }\n    request_body {\n        max_size 50MB\n    }\n}\n' \
        "$FQDN" "$PORT" | sudo tee -a "$caddyfile" >/dev/null
    fi
    sudo caddy validate --config "$caddyfile" --adapter caddyfile >/dev/null || die "Caddy rejected the Caddyfile (backup saved next to it)."
    sudo systemctl reload caddy
    ;;
  *)
    warn "Port 80 is served by '$web_server', which this script does not configure."
    echo "  Point it at http://127.0.0.1:$PORT for host $FQDN. For reference, the nginx version:"
    nginx_conf
    exit 1
    ;;
esac

# ---------------------------------------------------------------- 4. check
say "Checking $SITE_URL"
for _ in 1 2 3 4 5 6; do
  code="$(curl -s -o /dev/null -w '%{http_code}' -m 15 "$SITE_URL/" || true)"
  [[ "$code" == "200" ]] && break
  sleep 5
done
if [[ "$code" == "200" ]]; then
  say "Live: $SITE_URL"
  echo "  Owner dashboard: $SITE_URL/admin"
  echo "  API docs:        $SITE_URL/api-docs"
  echo "  Stop the site with ./stop.sh; re-run ./startaws.sh after updates (git pull)."
else
  warn "$SITE_URL answered HTTP ${code:-nothing}. Check the EC2 security group allows ports 80 and 443,"
  warn "and the site log: .data/server.log"
  exit 1
fi
