#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# ForgePilot Agent Work Validator
#
# Runs ALL quality gates in the correct order.
# Must pass 100% before creating a PR.
#
# Usage:
#   ./scripts/validate-agent-work.sh                    # full check
#   ./scripts/validate-agent-work.sh --test=MyFeature   # filter tests
#   ./scripts/validate-agent-work.sh --quick             # skip build
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

export PATH="/opt/homebrew/Cellar/node@22/22.22.3/bin:/opt/homebrew/bin:$PATH"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

QUICK=false
TEST_PATTERN=""
FAIL=0

# Parse args
for arg in "$@"; do
  case $arg in
    --quick) QUICK=true ;;
    --test=*) TEST_PATTERN="${arg#*=}" ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║    ForgePilot Agent Work Validator           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── Check 1: Branch safety ───────────────────────────────────────────────────
BRANCH=$(git branch --show-current 2>/dev/null || echo "detached")
echo "📌 Branch: $BRANCH"
if [ "$BRANCH" = "main" ]; then
  echo "❌ ERROR: You are on main! Create a feature branch first."
  exit 1
fi
if [[ "$BRANCH" != feature/* ]] && [[ "$BRANCH" != fix/* ]]; then
  echo "⚠️  WARNING: Branch '$BRANCH' is not a feature/* or fix/* branch"
fi
echo "✅ Branch check passed"
echo ""

# ─── Check 2: No stale .next/types ───────────────────────────────────────────
if [ -d ".next/types" ]; then
  echo "🧹 Clearing stale .next/types cache..."
  python3 -c "import shutil; shutil.rmtree('.next/types', ignore_errors=True)"
fi

# ─── Check 3: TypeScript ──────────────────────────────────────────────────────
echo "🔷 TypeScript type-check..."
TS_START=$(date +%s%3N)
if npm run type-check 2>&1; then
  TS_MS=$(( $(date +%s%3N) - TS_START ))
  echo "✅ TypeScript: 0 errors (${TS_MS}ms)"
else
  TS_MS=$(( $(date +%s%3N) - TS_START ))
  echo "❌ TypeScript: FAILED (${TS_MS}ms)"
  FAIL=1
fi
echo ""

# ─── Check 4: Tests ───────────────────────────────────────────────────────────
echo "🧪 Vitest tests..."
TEST_START=$(date +%s%3N)
if [ -n "$TEST_PATTERN" ]; then
  echo "   Filter: $TEST_PATTERN"
  TEST_CMD="npm run test:run -- $TEST_PATTERN"
else
  TEST_CMD="npm run test:run"
fi

if $TEST_CMD 2>&1; then
  TEST_MS=$(( $(date +%s%3N) - TEST_START ))
  echo "✅ Tests: passed (${TEST_MS}ms)"
else
  TEST_MS=$(( $(date +%s%3N) - TEST_START ))
  echo "❌ Tests: FAILED (${TEST_MS}ms)"
  FAIL=1
fi
echo ""

# ─── Check 5: Lint ────────────────────────────────────────────────────────────
echo "🔍 ESLint..."
LINT_START=$(date +%s%3N)
LINT_ERRORS=$(npm run lint 2>&1 | grep -c "^.*error\b" || true)
LINT_MS=$(( $(date +%s%3N) - LINT_START ))
if [ "$LINT_ERRORS" -eq 0 ]; then
  echo "✅ Lint: 0 errors (${LINT_MS}ms)"
else
  echo "❌ Lint: $LINT_ERRORS error(s) (${LINT_MS}ms)"
  FAIL=1
fi
echo ""

# ─── Check 6: Build (skip if --quick) ────────────────────────────────────────
if [ "$QUICK" = false ]; then
  echo "🏗️  Production build..."
  BUILD_START=$(date +%s%3N)
  if npm run build 2>&1; then
    BUILD_MS=$(( $(date +%s%3N) - BUILD_START ))
    echo "✅ Build: successful (${BUILD_MS}ms)"
  else
    BUILD_MS=$(( $(date +%s%3N) - BUILD_START ))
    echo "❌ Build: FAILED (${BUILD_MS}ms)"
    FAIL=1
  fi
  echo ""
fi

# ─── Check 7: No route non-exports ───────────────────────────────────────────
echo "🔒 Route export audit..."
ROUTE_ISSUES=$(grep -rn "^export \(interface\|function\|const\|type\|class\)" \
  src/app/api/ --include="*.ts" \
  | grep -v "export async function\|export function GET\|export function POST\|export function PUT\|export function PATCH\|export function DELETE\|export function HEAD\|export function OPTIONS\|export const dynamic\|export const runtime\|export const revalidate\|export const maxDuration" \
  || true)

if [ -z "$ROUTE_ISSUES" ]; then
  echo "✅ Route audit: no non-HTTP exports found"
else
  echo "❌ Route audit: non-route exports found (move to lib/):"
  echo "$ROUTE_ISSUES"
  FAIL=1
fi
echo ""

# ─── Summary ──────────────────────────────────────────────────────────────────
echo "══════════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
  echo "🎉 ALL CHECKS PASSED — ready for PR"
  echo ""
  echo "Next steps:"
  echo "  git push origin $BRANCH"
  echo "  gh pr create --base main --head $BRANCH --title '...'"
else
  echo "💥 VALIDATION FAILED — fix errors before creating PR"
  exit 1
fi
echo ""
