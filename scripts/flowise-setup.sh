#!/usr/bin/env bash
# Install the "Portfolio document analyzer" chatflow into the local Flowise (docker service "flowise")
# and point the site at it (FLOWISE_CHATFLOW_ID in .env.local). Safe to re-run; called by start.sh.
#
# Flowise keeps its data in the "flowise" database on rag-db, so the flow is written there directly
# (the Flowise management API needs an API key; the prediction API the site uses does not).
# The flow can also be imported by hand: Flowise → Chatflows → Add New → ⚙ → Load Chatflow →
# flowise/portfolio-document-analyzer.json.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."

FLOW_ID="5f0c2d7e-3b1a-4c55-9d1e-6a2f8b7c4e01"   # fixed, so the site's setting is predictable
FLOW_NAME="Portfolio document analyzer"
FLOW_FILE="flowise/portfolio-document-analyzer.json"
psql() { docker exec -i myweb-rag-db psql -U myweb -d flowise -v ON_ERROR_STOP=1 -tAq "$@"; }

if ! docker ps --format '{{.Names}}' | grep -qx myweb-flowise; then
  echo "  Flowise is not running; skipping chatflow setup."; exit 0
fi
workspace="$(psql -c "SELECT id FROM workspace ORDER BY \"createdDate\" LIMIT 1" 2>/dev/null || true)"
if [[ -z "$workspace" ]]; then
  echo "  Flowise: open it once and create the admin account, then run ./start.sh again to install the chatflow."
  exit 0
fi

if [[ "$(psql -c "SELECT count(*) FROM chat_flow WHERE id = '$FLOW_ID'")" == "0" ]]; then
  # flowData goes in through a psql variable, so no quoting of the JSON is needed.
  docker exec -i myweb-rag-db sh -c 'cat > /tmp/flow.json' < "$FLOW_FILE"
  psql <<SQL
\set flow \`cat /tmp/flow.json\`
INSERT INTO chat_flow (id, name, "flowData", deployed, "isPublic", type, "workspaceId", category)
VALUES ('$FLOW_ID', '$FLOW_NAME', :'flow', false, false, 'CHATFLOW', '$workspace', 'Portfolio');
SQL
  docker exec myweb-rag-db rm -f /tmp/flow.json
  echo "  Flowise: installed chatflow \"$FLOW_NAME\"."
fi

if ! grep -q "^FLOWISE_CHATFLOW_ID=$FLOW_ID\$" .env.local; then
  if grep -q '^FLOWISE_CHATFLOW_ID=' .env.local; then
    current="$(grep '^FLOWISE_CHATFLOW_ID=' .env.local | tail -1 | cut -d= -f2)"
    if [[ -z "$current" ]]; then
      sed -i "s/^FLOWISE_CHATFLOW_ID=\$/FLOWISE_CHATFLOW_ID=$FLOW_ID/" .env.local
    else
      echo "  Flowise: keeping your FLOWISE_CHATFLOW_ID ($current)."; exit 0
    fi
  else
    printf 'FLOWISE_CHATFLOW_ID=%s\n' "$FLOW_ID" >> .env.local
  fi
  echo "  Flowise: document analysis now runs through the chatflow."
fi
