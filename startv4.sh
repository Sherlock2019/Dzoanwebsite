#!/usr/bin/env bash
# Launch VERSION 4 of the website (branch "V4") without any AI: no LLM chat, no Flowise.
# Your live content (.data/) and .env.local are kept. Other versions: ./startv1.sh … ./startv3.sh.
exec "$(dirname "$(readlink -f "$0")")/startversion.sh" V4 "$@"
