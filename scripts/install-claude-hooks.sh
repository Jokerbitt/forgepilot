#!/usr/bin/env bash
# install-claude-hooks.sh — installs ForgePilot token-efficiency hooks for Claude Code
# Run this once: bash scripts/install-claude-hooks.sh
# Requires: Claude Code CLI installed (claude --version)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SETTINGS="$PROJECT_ROOT/.claude/settings.json"

echo "🔧 Installing ForgePilot token-efficiency hooks..."

# Create hooks dir if needed
mkdir -p "$PROJECT_ROOT/.claude/hooks"
cp "$SCRIPT_DIR/claude-hooks/"*.sh "$PROJECT_ROOT/.claude/hooks/"
chmod +x "$PROJECT_ROOT/.claude/hooks/"*.sh

# Update settings.json — add hooks block while preserving permissions
python3 - <<PYEOF
import json, sys

settings_path = "$SETTINGS"

with open(settings_path, 'r') as f:
    settings = json.load(f)

hooks_dir = ".claude/hooks"

settings['hooks'] = {
    "PreToolUse": [
        {
            "matcher": "WebFetch",
            "hooks": [{"type": "command", "command": f"bash {hooks_dir}/http-circuit-breaker.sh"}]
        }
    ],
    "PostToolUse": [
        {
            "matcher": "WebFetch",
            "hooks": [{"type": "command", "command": f"bash {hooks_dir}/http-failure-tracker.sh"}]
        }
    ]
}

with open(settings_path, 'w') as f:
    json.dump(settings, f, indent=2)
    f.write('\n')

print("✅ Hooks written to .claude/settings.json")
PYEOF

echo ""
echo "✅ Installed hooks:"
echo "   PreToolUse  WebFetch  → http-circuit-breaker.sh  (blocks 3rd attempt on broken URL)"
echo "   PostToolUse WebFetch  → http-failure-tracker.sh  (tracks failures per session)"
echo ""
echo "💡 To also enable file-read dedup warning, add manually to .claude/settings.json:"
echo '   "PreToolUse": [{"matcher": "Read", "hooks": [{"type": "command", "command": "bash .claude/hooks/file-read-dedup.sh"}]}]'
