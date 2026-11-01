#!/usr/bin/env bash
# Stop the website started with ./start.sh (foreground or --bg). Only touches this site's own process.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

# ./stop.sh --all also stops the Docker services (document database and Flowise); by default they
# keep running so the next ./start.sh is fast.
if [[ "${1:-}" == "--all" ]] && command -v docker >/dev/null && [[ -f docker-compose.yml ]]; then
  docker compose --env-file .env.local stop >/dev/null 2>&1 && echo "Docker services (rag-db, flowise) stopped."
fi

PID_FILE=".data/server.pid"
if [[ ! -f "$PID_FILE" ]] || ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "The website is not running (no live $PID_FILE)."
  rm -f "$PID_FILE"
  exit 0
fi

pid="$(cat "$PID_FILE")"
# Background runs are their own process group (setsid); stop the whole group, else just the process.
kill -- "-$pid" 2>/dev/null || kill "$pid"
for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
kill -0 "$pid" 2>/dev/null && { kill -9 -- "-$pid" 2>/dev/null || kill -9 "$pid"; }
rm -f "$PID_FILE"
echo "Website stopped."
