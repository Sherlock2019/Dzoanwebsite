#!/usr/bin/env bash
# Start the portfolio website — on this PC (WSL) or on a server such as AWS EC2.
#
#   ./start.sh              run in this terminal (Ctrl+C stops it). If the site is already running,
#                           it is stopped first — so ./start.sh always (re)starts it.
#   ./start.sh --bg         run in the background (keeps running after you log out); stop with ./stop.sh
#   ./start.sh --dev        development mode with live reload (combine with --bg if you like)
#
# Options (environment variables):
#   PORT=4000 ./start.sh               preferred port (default 3100). If busy, the next free port is used.
#   PUBLIC_HOST=1.2.3.4 ./start.sh     address to print/use. Auto-detected on EC2; otherwise "localhost".
#   PUBLIC_URL=https://my.domain ./start.sh   full public URL when you put HTTPS/a domain in front.
#   BIND=127.0.0.1 ./start.sh          listen on one interface only (default 0.0.0.0 = all).
#   OWNER_EMAIL=you@x.com ./start.sh   owner login created on the very first run.
#   FLOWISE=0 ./start.sh               don't start the Flowise container (Docker) alongside the site.
#   AI_DISABLED=1 ./start.sh           no AI at all: no chat, no Docker (Flowise + document DB stopped).
#                                      ./startsimple.sh does this for you.
#
# First run only: installs Node.js if needed (via nvm, no sudo), installs dependencies,
# creates .env.local with a one-time owner password (.data/OWNER_PASSWORD.txt) and loads the seed content.

set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

MODE="prod"
BACKGROUND=0
for arg in "$@"; do
  case "$arg" in
    --dev) MODE="dev" ;;
    --bg | --background) BACKGROUND=1 ;;
    -h | --help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)"; exit 1 ;;
  esac
done

PREFERRED_PORT="${PORT:-3100}"
BIND="${BIND:-0.0.0.0}"
OWNER="${OWNER_EMAIL:-dzoannguyentran@gmail.com}"
PID_FILE=".data/server.pid"
URL_FILE=".data/server.url"
LOG_FILE=".data/server.log"

say() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
mkdir -p .data && chmod 700 .data

# ---------------------------------------------------------------- already running? → restart
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  say "Restarting: stopping the copy running at $(cat "$URL_FILE" 2>/dev/null || echo "?")"
  bash ./stop.sh
  sleep 1   # let the port be released so the same port is reused
fi
rm -f "$PID_FILE"
# Also stop copies of THIS site started some other way (no PID file): Next.js processes whose
# working folder is this folder. Other apps are never touched.
strays=()
for p in $(pgrep -u "$(id -u)" -f "next-server|next start|next dev" 2>/dev/null || true); do
  [[ "$p" != "$$" && "$(readlink "/proc/$p/cwd" 2>/dev/null)" == "$PWD" ]] && strays+=("$p")
done
if (( ${#strays[@]} )); then
  say "Stopping another running copy of this site (pid ${strays[*]})"
  kill "${strays[@]}" 2>/dev/null || true
  sleep 2
fi

# ---------------------------------------------------------------- Node.js 20+
node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
if ! command -v node >/dev/null || (( $(node_major) < 20 )); then
  export NVM_DIR="$HOME/.nvm"
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    say "Installing Node.js 22 with nvm (in your home folder, no sudo)"
    command -v curl >/dev/null || { echo "curl is required to install Node.js. Install curl, or install Node.js 20+ yourself."; exit 1; }
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  fi
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install 22 >/dev/null
  nvm use 22 >/dev/null
fi

# ---------------------------------------------------------------- dependencies (re-done when moved to another machine type)
RUNTIME="$(uname -sm) node$(node_major)"
if [[ -d node_modules && "$(cat .data/.runtime 2>/dev/null)" != "$RUNTIME" && -f .data/.runtime ]]; then
  say "Different machine or Node version detected ($RUNTIME) — reinstalling dependencies"
  rm -rf node_modules .next
fi
if [[ ! -d node_modules || package-lock.json -nt node_modules ]]; then
  say "Installing dependencies"
  npm ci --no-audit --no-fund || npm install --no-audit --no-fund
  touch node_modules
fi
echo "$RUNTIME" > .data/.runtime

# ---------------------------------------------------------------- owner sign-in config
if [[ ! -f .env.local ]]; then
  say "Creating .env.local for $OWNER"
  out="$(npm run --silent setup -- "$OWNER")"
  echo "$out" | grep -v "Owner password"
  echo "$out" | grep "Owner password" | sed 's/Owner password: *//' > .data/OWNER_PASSWORD.txt
  chmod 600 .data/OWNER_PASSWORD.txt
  echo "One-time password saved to .data/OWNER_PASSWORD.txt — copy it to your password manager, then delete the file."
fi

# ---------------------------------------------------------------- AI document database (optional, Docker)
flowise_healthy() { [[ "$(docker inspect -f '{{.State.Health.Status}}' myweb-flowise 2>/dev/null)" == "healthy" ]]; }
if [[ "${AI_DISABLED:-0}" =~ ^(1|true|yes)$ ]]; then
  say "AI disabled (AI_DISABLED=1): no chat, no Flowise, no document database"
  # Free their memory if an earlier run started them. Data volumes are kept.
  if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
    for c in myweb-flowise myweb-rag-db; do
      if docker ps --format '{{.Names}}' | grep -qx "$c"; then
        if docker stop "$c" >/dev/null; then echo "  Stopped $c (data kept)."; else warn "Could not stop $c."; fi
      fi
    done
  fi
elif [[ -f docker-compose.yml ]] && command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  if ! grep -q '^RAG_DATABASE_URL=postgres' .env.local; then
    pw="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
    printf '\n# AI document database (docker compose service "rag-db", created by start.sh)\nRAG_DB_PASSWORD=%s\nRAG_DATABASE_URL=postgres://myweb:%s@127.0.0.1:55434/myweb\n' "$pw" "$pw" >> .env.local
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx myweb-rag-db; then
    say "Starting the AI document database (Docker)"
    docker compose --env-file .env.local up -d --wait rag-db >/dev/null 2>&1 \
      || warn "Could not start the document database; AI documents stay disabled until Docker works."
  fi
  # Flowise backend (AI orchestration), on FLOWISE_PORT (default 3110).
  if [[ "${FLOWISE:-1}" != "0" ]]; then
    grep -q '^FLOWISE_PORT=' .env.local || printf '\n# Flowise (docker compose service "flowise", started by start.sh)\nFLOWISE_PORT=3110\n' >> .env.local
    FLOWISE_PORT_USED="$(grep '^FLOWISE_PORT=' .env.local | tail -1 | cut -d= -f2)"
    if ! grep -q '^FLOWISE_URL=http' .env.local; then
      printf 'FLOWISE_URL=http://127.0.0.1:%s\n' "$FLOWISE_PORT_USED" >> .env.local
    elif grep -qx 'FLOWISE_URL=http://127.0.0.1:3000' .env.local; then
      # Old default from .env.example; point it at this site's own Flowise.
      sed -i "s#^FLOWISE_URL=http://127.0.0.1:3000\$#FLOWISE_URL=http://127.0.0.1:$FLOWISE_PORT_USED#" .env.local
    fi
    # Flowise stores its data in its own database on rag-db.
    if docker ps --format '{{.Names}}' | grep -qx myweb-rag-db \
      && ! docker exec myweb-rag-db psql -U myweb -d myweb -tAc "SELECT 1 FROM pg_database WHERE datname = 'flowise'" | grep -q 1; then
      docker exec myweb-rag-db createdb -U myweb flowise
    fi
    # "up" is a no-op when the container is current and recreates it after docker-compose.yml changes.
    flowise_healthy || say "Starting Flowise (Docker; the first run downloads the image, a few minutes)"
    docker compose --env-file .env.local up -d --wait flowise >/dev/null 2>&1 \
      || warn "Flowise did not start (docker logs myweb-flowise). Analysis still works directly with Qwen."
    flowise_healthy && { bash scripts/flowise-setup.sh || warn "Flowise chatflow setup failed (scripts/flowise-setup.sh)."; }
  fi
else
  grep -q '^RAG_DATABASE_URL=postgres' .env.local 2>/dev/null || echo "  (Docker not available: AI document features are off. The site works without them.)"
fi

# ---------------------------------------------------------------- content
if [[ ! -f .data/db.json ]]; then
  if [[ -f content/seed/seed.json ]]; then
    say "Loading seed content"
    npm run --silent seed
  else
    echo "No database and no seed file — starting with an empty site."
  fi
fi

# ---------------------------------------------------------------- free port
# Read the list of listening sockets instead of connecting: on some WSL setups a connection to a
# closed localhost port hangs instead of being refused. Fallback (no `ss`): 1-second connect test.
port_busy() {
  if command -v ss >/dev/null; then
    ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]$1\$"
  else
    timeout 1 bash -c "exec 3<>/dev/tcp/127.0.0.1/$1" 2>/dev/null
  fi
}
PORT_TO_USE=""
for ((p = PREFERRED_PORT; p < PREFERRED_PORT + 100; p++)); do
  if ! port_busy "$p"; then PORT_TO_USE="$p"; break; fi
done
[[ -n "$PORT_TO_USE" ]] || { echo "No free port between $PREFERRED_PORT and $((PREFERRED_PORT + 99))."; exit 1; }
[[ "$PORT_TO_USE" != "$PREFERRED_PORT" ]] && warn "Port $PREFERRED_PORT is busy — using $PORT_TO_USE instead."

# ---------------------------------------------------------------- public address (EC2 auto-detect)
detect_host() {
  if [[ -n "${PUBLIC_HOST:-}" ]]; then echo "$PUBLIC_HOST"; return; fi
  if command -v curl >/dev/null; then
    local token ip
    token="$(curl -s -m 1 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' 2>/dev/null || true)"
    ip="$(curl -s -m 1 -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || true)"
    if [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then echo "$ip"; return; fi
  fi
  echo "localhost"
}
HOST_NAME="$(detect_host)"
SITE="${PUBLIC_URL:-http://$HOST_NAME:$PORT_TO_USE}"
export SITE_URL="${SITE%/}"   # overrides the value in .env.local for this run

# ---------------------------------------------------------------- build (only when needed)
if [[ "$MODE" == "prod" ]]; then
  needs_build=0
  if [[ ! -f .next/BUILD_ID ]]; then
    needs_build=1
  elif [[ -n "$(find app components lib next.config.ts package.json -newer .next/BUILD_ID -print -quit 2>/dev/null)" ]]; then
    needs_build=1
  fi
  if (( needs_build )); then
    say "Building the site (about a minute)"
    mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
    if (( mem_kb > 0 && mem_kb < 1800000 )); then
      warn "Less than 2 GB RAM: if the build is killed, add swap (see README → EC2)."
      export NODE_OPTIONS="--max-old-space-size=1024"
    fi
    npm run build
  fi
fi

# ---------------------------------------------------------------- run
CMD=(node_modules/.bin/next start -H "$BIND" -p "$PORT_TO_USE")
[[ "$MODE" == "dev" ]] && CMD=(node_modules/.bin/next dev -H "$BIND" -p "$PORT_TO_USE")

echo "$SITE_URL" > "$URL_FILE"
echo "$PORT_TO_USE" > .data/server.port   # the port actually used (startaws.sh points the proxy at it)
say "Website:          $SITE_URL"
echo "  Owner dashboard: $SITE_URL/admin"
echo "  API docs:        $SITE_URL/api-docs   (Swagger UI, owner sign-in)"
if [[ -n "${FLOWISE_PORT_USED:-}" ]] && flowise_healthy; then
  echo "  Flowise:         http://$HOST_NAME:$FLOWISE_PORT_USED   (API: http://$HOST_NAME:$FLOWISE_PORT_USED/api/v1)"
  flow_id="$(grep '^FLOWISE_CHATFLOW_ID=' .env.local | tail -1 | cut -d= -f2)"
  [[ -n "$flow_id" ]] && echo "  Analysis flow:   POST http://$HOST_NAME:$FLOWISE_PORT_USED/api/v1/prediction/$flow_id"
fi
[[ "$HOST_NAME" != "localhost" ]] && echo "  On this machine: http://localhost:$PORT_TO_USE"
if [[ "$HOST_NAME" != "localhost" && "$SITE_URL" == http://* ]]; then
  warn "Public site over plain HTTP: open TCP port $PORT_TO_USE in the EC2 security group."
  warn "Sign-in passwords travel unencrypted over HTTP — put HTTPS in front before using /admin remotely (README → EC2)."
fi

if (( BACKGROUND )); then
  setsid nohup "${CMD[@]}" > "$LOG_FILE" 2>&1 < /dev/null &
  echo $! > "$PID_FILE"
  sleep 3
  if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "  Running in the background (log: $LOG_FILE). Stop with ./stop.sh"
  else
    echo "The server failed to start — last log lines:"; tail -20 "$LOG_FILE"; rm -f "$PID_FILE"; exit 1
  fi
else
  echo "  Press Ctrl+C to stop (or run ./stop.sh from another terminal)."
  # Run the server as a child and handle Ctrl+C here: Next.js alone can wait indefinitely for
  # open browser connections to close. Ask it to stop, then force it after 3 seconds.
  "${CMD[@]}" &
  SERVER_PID=$!
  echo "$SERVER_PID" > "$PID_FILE"
  shutdown() {
    trap '' INT TERM
    printf '\nStopping the website…\n'
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    for _ in $(seq 1 30); do kill -0 "$SERVER_PID" 2>/dev/null || break; sleep 0.1; done
    kill -KILL "$SERVER_PID" 2>/dev/null || true
    rm -f "$PID_FILE"
    echo "Website stopped."
    exit 0
  }
  trap shutdown INT TERM
  wait "$SERVER_PID" || true
  rm -f "$PID_FILE"
fi
