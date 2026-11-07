#!/usr/bin/env bash
# Start the portfolio website WITHOUT any AI: no recruiter chat (LLM), no Flowise, no document
# database. Lighter on memory and CPU; every other page and the owner dashboard work as usual.
#
#   ./startsimple.sh          on AWS EC2: same as ./startaws.sh (domain + HTTPS), minus the AI
#                             elsewhere:  same as ./start.sh, minus the AI (options like --bg / --dev pass through)
#
# Running Flowise / document-database containers are stopped (their data is kept).
# To bring the AI back, start normally again: ./startaws.sh (EC2) or ./start.sh.

set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

export AI_DISABLED=1 FLOWISE=0

# On EC2 the instance metadata service answers; there the public site runs through startaws.sh.
token="$(curl -s -m 1 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' 2>/dev/null || true)"
if [[ -n "$token" ]] && curl -s -m 1 -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/instance-id >/dev/null 2>&1; then
  exec ./startaws.sh "$@"
fi
exec ./start.sh "$@"
