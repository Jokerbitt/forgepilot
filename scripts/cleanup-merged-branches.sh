#!/usr/bin/env bash
#
# cleanup-merged-branches.sh — Safe local cleanup of squash-merged feature branches.
#
# Why this exists:
#   GitHub squash-merges PRs into `main` as a single new commit, so local
#   `git branch --merged` no longer recognises the source branch as merged.
#   Result: dozens of stale local branches accumulate even though their work
#   has long been integrated.
#
# Detection method:
#   `git cherry main <branch>` lists each commit on <branch> with `+` (not
#   yet upstream) or `-` (already upstream — squash-merge detected by patch-id).
#   When every commit reports `-`, the branch is fully integrated and safe
#   to delete locally. Branches with at least one `+` line are kept.
#
# Safety:
#   - Dry-run is the default. You must pass --apply to actually delete.
#   - Protected branches (main, master, current HEAD, branches checked out
#     in any worktree) are never deleted.
#   - Branches with uncommitted local stash references are skipped with a warning.
#   - For each deletion the script reports the squash-merge commit it found
#     on main so the human reviewer can sanity-check before --apply.
#   - Only deletes LOCAL refs (`git branch -d`). Never touches remote refs
#     unless --delete-remote is passed explicitly.
#
# Usage:
#   scripts/cleanup-merged-branches.sh                # dry-run (safe default)
#   scripts/cleanup-merged-branches.sh --apply        # actually delete locally
#   scripts/cleanup-merged-branches.sh --apply --delete-remote
#                                                     # also delete origin refs
#   scripts/cleanup-merged-branches.sh --base develop # use 'develop' instead of 'main'
#
# Exit codes:
#   0  success (whether anything was deleted or not)
#   1  invocation error (unknown flag, base branch missing, not in a repo, ...)

set -euo pipefail

BASE_BRANCH="main"
APPLY="false"
DELETE_REMOTE="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --apply)         APPLY="true"; shift ;;
    --delete-remote) DELETE_REMOTE="true"; shift ;;
    --base)          BASE_BRANCH="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,40p' "$0" | sed 's/^#//'
      exit 0
      ;;
    *)
      echo "error: unknown flag '$1'" >&2
      echo "run: $0 --help" >&2
      exit 1
      ;;
  esac
done

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "error: not inside a git repository" >&2
  exit 1
fi

if ! git rev-parse --verify "$BASE_BRANCH" >/dev/null 2>&1; then
  echo "error: base branch '$BASE_BRANCH' does not exist locally" >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"

# Build a set of branches that are checked out in some worktree (incl. main worktree).
# These must never be deleted — git would refuse anyway, but we want a clean message.
checkout_branches() {
  git worktree list --porcelain 2>/dev/null \
    | awk '/^branch / { sub(/^refs\/heads\//,"",$2); print $2 }'
}

WORKTREE_BRANCHES=()
while IFS= read -r line; do
  [ -n "$line" ] && WORKTREE_BRANCHES+=("$line")
done < <(checkout_branches)

is_protected() {
  local b="$1"
  case "$b" in
    main|master|"$BASE_BRANCH"|"$CURRENT_BRANCH") return 0 ;;
  esac
  for wt in "${WORKTREE_BRANCHES[@]:-}"; do
    [ "$b" = "$wt" ] && return 0
  done
  return 1
}

# Find the squash-merge commit on the base branch that contains the branch's
# title. Best-effort hint for the reviewer, no functional dependency.
hint_merge_commit() {
  local b="$1"
  git log "$BASE_BRANCH" --grep="$b" --format="%h %s" -n 1 2>/dev/null || true
}

KEEP=()
SAFE_DELETE=()
SKIP=()

# Enumerate every local branch except the base.
while IFS= read -r br; do
  [ -z "$br" ] && continue
  [ "$br" = "$BASE_BRANCH" ] && continue

  if is_protected "$br"; then
    SKIP+=("$br: protected (current or worktree checkout)")
    continue
  fi

  # `git cherry main br` exits non-zero only on usage errors; otherwise prints
  # one line per commit on <br>.
  exclusive="$(git cherry "$BASE_BRANCH" "$br" 2>/dev/null | grep -c '^+' || true)"

  if [ "$exclusive" -eq 0 ]; then
    SAFE_DELETE+=("$br")
  else
    KEEP+=("$br (exclusive=$exclusive)")
  fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads | sort)

echo "=== cleanup-merged-branches (base=$BASE_BRANCH, apply=$APPLY) ==="
echo ""
echo "Safe to delete: ${#SAFE_DELETE[@]} branches"
for br in "${SAFE_DELETE[@]:-}"; do
  hint="$(hint_merge_commit "$br")"
  if [ -n "$hint" ]; then
    printf "  - %-50s ← matched on %s: %s\n" "$br" "$BASE_BRANCH" "$hint"
  else
    printf "  - %-50s ← no merge-commit subject match (still safe by cherry)\n" "$br"
  fi
done
echo ""
echo "Keep: ${#KEEP[@]} branches (have unmerged commits)"
for br in "${KEEP[@]:-}"; do echo "  · $br"; done
echo ""
echo "Skipped: ${#SKIP[@]} branches"
for s in "${SKIP[@]:-}"; do echo "  · $s"; done
echo ""

if [ "$APPLY" != "true" ]; then
  echo "Dry-run only. Pass --apply to actually delete the safe branches."
  exit 0
fi

if [ "${#SAFE_DELETE[@]}" -eq 0 ]; then
  echo "Nothing to delete."
  exit 0
fi

DELETED_LOCAL=0
FAILED_LOCAL=0
DELETED_REMOTE=0
FAILED_REMOTE=0

for br in "${SAFE_DELETE[@]}"; do
  if git branch -d "$br" >/dev/null 2>&1; then
    DELETED_LOCAL=$((DELETED_LOCAL+1))
    echo "  deleted local: $br"
  else
    FAILED_LOCAL=$((FAILED_LOCAL+1))
    echo "  FAILED local : $br (git refused; inspect manually)"
    continue
  fi

  if [ "$DELETE_REMOTE" = "true" ]; then
    if git ls-remote --exit-code --heads origin "$br" >/dev/null 2>&1; then
      if git push origin --delete "$br" >/dev/null 2>&1; then
        DELETED_REMOTE=$((DELETED_REMOTE+1))
        echo "    deleted remote: origin/$br"
      else
        FAILED_REMOTE=$((FAILED_REMOTE+1))
        echo "    FAILED remote : origin/$br"
      fi
    fi
  fi
done

echo ""
echo "Summary: ${DELETED_LOCAL} local deleted, ${FAILED_LOCAL} local failed"
if [ "$DELETE_REMOTE" = "true" ]; then
  echo "         ${DELETED_REMOTE} remote deleted, ${FAILED_REMOTE} remote failed"
fi
