#!/usr/bin/env bash
# Launch VERSION 3 of the website (branch "V3") without any AI: no LLM chat, no Flowise.
#
#   ./startv3.sh      stops the running site, switches to V3, pulls the latest, starts it
#
# Other versions: ./startv1.sh (branch main), ./startv2.sh (branch V2).
# Your .env.local and data are not touched.

BRANCH=V3

main() {
  set -euo pipefail
  cd "$(dirname "$(readlink -f "$0")")"

  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Local changes to tracked files would be lost by switching branch:" >&2
    git status --short --untracked-files=no >&2
    echo "Commit or discard them first (git stash), then run this again." >&2
    exit 1
  fi

  echo "==> Switching to $BRANCH"
  git fetch origin
  ./stop.sh || true
  git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" --track "origin/$BRANCH"
  git pull --ff-only origin "$BRANCH"

  echo "==> Starting $BRANCH (no Flowise, no LLM)"
  exec ./startsimple.sh "$@"
}

# The whole script is read before it runs, so switching branch (which rewrites this file) is safe.
main "$@"
exit
