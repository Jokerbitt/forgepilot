#!/usr/bin/env bash
# Claude Code PreToolUse Hook: File Read Deduplication
# Warns when an agent reads the same file twice in the same session.
# Saves tokens by discouraging redundant file reads.
#
# Install: add to .claude/settings.json under hooks.PreToolUse
# Matches: Read, Edit, Write tools
#
# Usage: echo '<tool_input_json>' | ./file-read-dedup.sh

set -euo pipefail

INPUT=$(cat)
TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
CACHE_FILE="/tmp/fp-claude-reads-${SESSION_ID}"

# Extract file_path from JSON input
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('file_path') or d.get('path') or '')
except:
    print('')
" 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  # No file path found — let it through
  exit 0
fi

# Normalize path
NORMALIZED=$(realpath -m "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")

# Skip config files that are cheap (tsconfig, package.json)
BASENAME=$(basename "$NORMALIZED")

# Check for re-read
if [ -f "$CACHE_FILE" ] && grep -qF "$NORMALIZED" "$CACHE_FILE" 2>/dev/null; then
  # File was already read this session — emit a warning but don't block
  # (blocking would break legitimate re-reads after changes)
  READS=$(grep -cF "$NORMALIZED" "$CACHE_FILE" 2>/dev/null || echo "0")
  if [ "$READS" -ge 3 ]; then
    # After 3+ reads, output a hint but still allow
    cat <<EOF
{"decision":"warn","message":"⚠ Token waste: '${BASENAME}' has been read ${READS}+ times this session. Do you already have this content in context?"}
EOF
    echo "$NORMALIZED" >> "$CACHE_FILE"
    exit 0
  fi
fi

# Record this read
echo "$NORMALIZED" >> "$CACHE_FILE"
exit 0
