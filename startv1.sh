#!/usr/bin/env bash
# Launch VERSION 1 of the website (branch "main") without any AI: no LLM chat, no Flowise.
# Your live content (.data/) and .env.local are kept. Other versions: ./startv2.sh, ./startv3.sh.
exec "$(dirname "$(readlink -f "$0")")/startversion.sh" main "$@"
