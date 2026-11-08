#!/usr/bin/env bash
# Launch VERSION 2 of the website (branch "V2") without any AI: no LLM chat, no Flowise.
# Your live content (.data/) and .env.local are kept. Other versions: ./startv1.sh, ./startv3.sh.
exec "$(dirname "$(readlink -f "$0")")/startversion.sh" V2 "$@"
