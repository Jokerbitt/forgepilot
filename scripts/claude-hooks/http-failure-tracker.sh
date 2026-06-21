#!/usr/bin/env bash
# Claude Code PostToolUse Hook: HTTP Failure Tracker
# Records failed WebFetch attempts for the circuit breaker.
# PostToolUse receives the tool result — check for 4xx/5xx.
#
# Install: add to .claude/settings.json under hooks.PostToolUse
# Matches: WebFetch tool

set -euo pipefail

INPUT=$(cat)
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
FAIL_CACHE="/tmp/fp-claude-http-fails-${SESSION_ID}"

# Extract URL and response status from result
URL=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # Try tool_input first, then result
    inp = d.get('tool_input', {})
    print(inp.get('url') or '')
except:
    print('')
" 2>/dev/null)

# Check if result contains error indicators
HAS_ERROR=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    result = str(d.get('result', ''))
    content = str(d.get('content', ''))
    combined = result + content
    # Check for HTTP errors or fetch failures
    error_indicators = ['4', '5', 'error', 'failed', 'timeout', 'ENOTFOUND', 'ETIMEDOUT']
    if any(ind in combined[:200].lower() for ind in ['error', 'failed', '404', '403', '500', 'timeout']):
        print('yes')
    else:
        print('no')
except:
    print('no')
" 2>/dev/null)

if [ "$HAS_ERROR" = "yes" ] && [ -n "$URL" ]; then
  URL_BASE=$(echo "$URL" | sed 's/?.*$//' | sed 's/#.*$//')
  echo "$URL_BASE" >> "$FAIL_CACHE"
fi

exit 0
