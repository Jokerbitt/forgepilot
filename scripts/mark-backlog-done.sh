#!/usr/bin/env bash
# mark-backlog-done.sh — marks BACKLOG.md items as [x] after a PR merge.
# Usage: ./scripts/mark-backlog-done.sh "Keyboard shortcuts"
# Never run inside an agent branch — avoids BACKLOG.md merge conflicts.

set -euo pipefail

BACKLOG="$(git rev-parse --show-toplevel)/BACKLOG.md"
[ ! -f "$BACKLOG" ] && echo "❌ BACKLOG.md not found" && exit 1
[ $# -eq 0 ] && echo "Usage: $0 <pattern> [<pattern2> ...]" && exit 1

changed=0
for pattern in "$@"; do
  python3 - "$BACKLOG" "$pattern" <<'PYEOF'
import sys
path, pattern = sys.argv[1], sys.argv[2].lower()
lines = open(path).readlines()
new_lines, count = [], 0
for line in lines:
    if line.startswith('- [ ]') and pattern in line.lower():
        new_lines.append(line.replace('- [ ]', '- [x]', 1))
        count += 1
    else:
        new_lines.append(line)
open(path, 'w').writelines(new_lines)
print(f"✅ Marked {count} item(s) done for: {pattern}")
PYEOF
  changed=$((changed + 1))
done
echo "Done. $changed pattern(s) processed."
