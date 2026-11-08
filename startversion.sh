#!/usr/bin/env bash
# Switch the website to a version (git branch) and start it without any AI (no LLM, no Flowise).
# Used by ./startv1.sh (main), ./startv2.sh (V2) and ./startv3.sh (V3).
#
#   ./startversion.sh <branch>
#
# Your live content in .data/ (database, uploads) is kept: it is backed up before switching and
# put back afterwards, so every version shows the same content. Backups: ../dzoan-data-backups/
# (the 5 most recent are kept). .env.local is never touched.

main() {
  set -euo pipefail
  cd "$(dirname "$(readlink -f "$0")")"
  local branch="${1:?usage: ./startversion.sh <branch>}"
  shift

  # Code changes made on the server (outside .data/) would be lost: stop and say so.
  local dirty
  dirty="$(git status --porcelain --untracked-files=no -- . ':(exclude).data')"
  if [[ -n "$dirty" ]]; then
    echo "Local code changes would be lost by switching branch:" >&2
    echo "$dirty" >&2
    echo "Commit or discard them first (git stash), then run this again." >&2
    exit 1
  fi

  echo "==> Stopping the website"
  ./stop.sh || true

  local backups="../dzoan-data-backups"
  local backup=""
  if [[ -d .data ]]; then
    mkdir -p "$backups"
    backup="$(mktemp -d "$backups/data-$(date +%Y%m%d-%H%M%S)-XXXX")"
    cp -a .data/. "$backup/"
    echo "==> Live content backed up to $backup"
  fi

  echo "==> Switching to $branch"
  git fetch origin
  # The server only follows GitHub: make the local branch exactly origin/<branch>.
  git checkout -f -B "$branch" "origin/$branch"
  git branch --set-upstream-to="origin/$branch" "$branch" >/dev/null

  if [[ -n "$backup" ]]; then
    rm -rf .data
    mkdir .data
    cp -a "$backup/." .data/
    echo "==> Live content restored"
    # Keep the 5 most recent backups.
    ls -1dt "$backups"/data-* 2>/dev/null | tail -n +6 | xargs -r rm -rf
  fi

  echo "==> Starting $branch (no Flowise, no LLM)"
  exec ./startsimple.sh "$@"
}

# The whole script is read before it runs, so switching branch (which rewrites this file) is safe.
main "$@"
exit
