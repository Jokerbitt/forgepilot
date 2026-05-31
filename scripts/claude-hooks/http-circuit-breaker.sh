#!/usr/bin/env bash
# Claude Code PreToolUse Hook: HTTP Circuit Breaker
# Blocks repeated fetches to the same failing URL.
# Saves tokens by preventing retry storms on broken URLs.
#
# Install: add to .claude/settings.json under hooks.PreToolUse
# Matches: WebFetch tool
#
# Usage: echo '<tool_input_json>' | ./http-circuit-breaker.sh

set -euo pipefail

INPUT=$(cat)
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
FAIL_CACHE="/tmp/fp-claude-http-fails-${SESSION_ID}"

# Extract URL from JSON input
URL=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('url') or '')
except:
    print('')
" 2>/dev/null)

if [ -z "$URL" ]; then
  exit 0
fi

# Normalize URL (strip query params for circuit breaker purposes)
URL_BASE=$(echo "$URL" | sed 's/?.*$//' | sed 's/#.*$//')

# Check failure count for this URL base
if [ -f "$FAIL_CACHE" ]; then
  FAIL_COUNT=$(grep -cF "$URL_BASE" "$FAIL_CACHE" 2>/dev/null || echo "0")
  if [ "$FAIL_COUNT" -ge 2 ]; then
    cat <<EOF
{"decision":"block","reason":"Circuit breaker: '${URL_BASE}' has failed ${FAIL_COUNT} times this session. Try a different URL or approach instead of retrying."}
EOF
    exit 0
  fi
fi

exit 0
