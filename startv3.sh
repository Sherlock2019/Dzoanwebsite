#!/usr/bin/env bash
# Launch VERSION 3 of the website (branch "V3") without any AI: no LLM chat, no Flowise.
# Your live content (.data/) and .env.local are kept. Other versions: ./startv1.sh, ./startv2.sh.
exec "$(dirname "$(readlink -f "$0")")/startversion.sh" V3 "$@"
