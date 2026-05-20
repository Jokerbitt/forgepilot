#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Scope-aware pre-commit gate for autonomous agents
#
# Blocks `git commit` when an agent stages files outside its claimed scope.
# Opt-in: only runs when the AGENT_ID env var is set, so human commits are
# never blocked.
#
# Wire-up (one-time, per checkout):
#   ln -sf ../../scripts/pre-commit-scope-check.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# Or invoke directly from a workflow before `git commit`:
#   AGENT_ID=my-agent bash scripts/pre-commit-scope-check.sh
# ─────────────────────────────────────────────────────────────────────────────

# Skip entirely for human commits — only enforce when AGENT_ID is set.
if [ -z "${AGENT_ID:-}" ]; then
  exit 0
fi

# Resolve the real script path — invoked either directly or via a symlink
# in `.git/hooks/pre-commit`, where `$0` would otherwise resolve into `.git/`.
SCRIPT_PATH="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$0" 2>/dev/null || echo "$0")"
ROOT="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "pre-commit-scope-check: node not on PATH — skipping" >&2
  exit 0
fi

# Delegate to the CLI. The CLI exits 0 (no staged files or all in scope),
# 1 (out-of-scope / overlap / no claim), or 2 (usage error).
node "$ROOT/scripts/agent-coord.mjs" check-staged --agent "$AGENT_ID"
EXIT=$?

if [ $EXIT -ne 0 ]; then
  echo "" >&2
  echo "pre-commit-scope-check: blocked." >&2
  echo "  AGENT_ID=$AGENT_ID" >&2
  echo "  Either widen your claim, unstage out-of-scope files, or unset AGENT_ID." >&2
  exit $EXIT
fi

exit 0
