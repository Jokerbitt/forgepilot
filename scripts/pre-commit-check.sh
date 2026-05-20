#!/usr/bin/env bash
# Pre-commit validation — run before git commit
# Usage: bash scripts/pre-commit-check.sh [--quick]
# --quick: only type-check + changed-file tests (< 10s)
# (full): type-check + all tests (< 15s)

set -e

QUICK="${1:-}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "ForgePilot Pre-commit Check"
echo "================================"

# 1. TypeScript
echo -n "  TypeScript... "
if npm run type-check --silent 2>/dev/null; then
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${RED}FEHLER -- type-check gescheitert${NC}"
  npm run type-check 2>&1 | grep "error TS" | head -5
  exit 1
fi

# 2. Tests
if [ "$QUICK" = "--quick" ]; then
  echo -n "  Tests (changed files)... "
  CHANGED=$(git diff --cached --name-only | grep -E '\.test\.(ts|tsx)$' || true)
  if [ -n "$CHANGED" ]; then
    if vitest run $CHANGED --silent 2>/dev/null; then
      echo -e "${GREEN}OK${NC}"
    else
      echo -e "${RED}Tests gescheitert${NC}"
      exit 1
    fi
  else
    echo -e "${YELLOW}SKIP keine Test-Dateien geaendert${NC}"
  fi
else
  echo -n "  Tests (alle)... "
  if npm run test:run --silent 2>/dev/null; then
    COUNT=$(npm run test:run 2>&1 | grep "Tests " | tail -1 | grep -o '[0-9]* passed' || echo "?")
    echo -e "${GREEN}OK $COUNT${NC}"
  else
    echo -e "${RED}Tests gescheitert${NC}"
    exit 1
  fi
fi

# 3. Neue console.log in Server-Dateien pruefen
echo -n "  Console.log Check... "
CONSOLE_HITS=$(git diff --cached -- 'src/app/api/**' 'src/lib/**' | grep '^+' | grep -v '^+++' | grep 'console\.' | grep -v '//.*console\.' || true)
if [ -n "$CONSOLE_HITS" ]; then
  echo -e "${YELLOW}WARN console.log gefunden -- besser Pino verwenden${NC}"
  echo "$CONSOLE_HITS" | head -3
else
  echo -e "${GREEN}OK${NC}"
fi

# 4. Neue Routes ohne Zod-Check
echo -n "  Zod-Validation Check... "
NEW_POST_ROUTES=$(git diff --cached --name-only | grep 'app/api.*route\.ts' || true)
if [ -n "$NEW_POST_ROUTES" ]; then
  MISSING_ZOD=""
  for f in $NEW_POST_ROUTES; do
    if grep -q "async function POST" "$f" 2>/dev/null; then
      if ! grep -q "parseBody\|safeParse\|ZodSchema" "$f" 2>/dev/null; then
        MISSING_ZOD="$MISSING_ZOD $f"
      fi
    fi
  done
  if [ -n "$MISSING_ZOD" ]; then
    echo -e "${YELLOW}WARN POST-Route ohne Zod-Validation:${NC}"
    for f in $MISSING_ZOD; do echo "     $f"; done
  else
    echo -e "${GREEN}OK${NC}"
  fi
else
  echo -e "${GREEN}OK keine neuen Routes${NC}"
fi

echo ""
echo -e "${GREEN}Pre-commit Check bestanden!${NC}"
