/**
 * Journey Companion — Phase 2.3: snapshots & safe undo for a built app.
 *
 * Lets a non-techie save a known-good state and return to it without losing
 * history. Snapshots are git tags (fp-snap-N); restore is NON-destructive: the
 * current state is auto-snapshotted first, then the target state is checked out
 * into a new commit. No `git reset --hard`, no history loss.
 *
 * The git runner is injectable so the command sequences are unit-testable
 * without a real repository.
 */
import { execFileSync } from 'child_process'

export interface GitRunner {
  /** Run `git <args>` in repoPath; return trimmed stdout. Throws on non-zero exit. */
  run(repoPath: string, args: string[]): string
}

export const defaultGitRunner: GitRunner = {
  run(repoPath, args) {
    return execFileSync('git', args, { cwd: repoPath, encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024 }).trim()
  },
}

const SNAP_PREFIX = 'fp-snap-'

// Fallback commit identity so snapshots work even in repos with no git user set.
const IDENTITY = ['-c', 'user.email=forgepilot@local', '-c', 'user.name=ForgePilot']

export interface Snapshot {
  ref: string
  label: string
  date: string
}

/** List existing snapshots (newest tag number first). */
export function listSnapshots(repoPath: string, git: GitRunner = defaultGitRunner): Snapshot[] {
  let out = ''
  try {
    out = git.run(repoPath, ['tag', '-l', `${SNAP_PREFIX}*`, '--sort=-creatordate', '--format=%(refname:short)\t%(contents:subject)\t%(creatordate:iso)'])
  } catch {
    return []
  }
  if (!out) return []
  return out.split('\n').map(line => {
    const [ref, label, date] = line.split('\t')
    return { ref: ref ?? '', label: label ?? '', date: date ?? '' }
  }).filter(s => s.ref)
}

function nextSnapNumber(repoPath: string, git: GitRunner): number {
  const existing = listSnapshots(repoPath, git)
  const nums = existing.map(s => parseInt(s.ref.slice(SNAP_PREFIX.length), 10)).filter(n => !Number.isNaN(n))
  return (nums.length ? Math.max(...nums) : 0) + 1
}

/**
 * Create a snapshot: commit any pending changes (empty-ok) and tag the commit.
 * Returns the created snapshot.
 */
export function createSnapshot(repoPath: string, label: string, git: GitRunner = defaultGitRunner): Snapshot {
  const n = nextSnapNumber(repoPath, git)
  const ref = `${SNAP_PREFIX}${n}`
  const safeLabel = label.trim() || `Snapshot ${n}`
  git.run(repoPath, ['add', '-A'])
  // Commit pending work so the tag captures it; --allow-empty keeps it simple when clean.
  git.run(repoPath, [...IDENTITY, 'commit', '--allow-empty', '-m', `snapshot: ${safeLabel}`])
  git.run(repoPath, [...IDENTITY, 'tag', '-a', ref, '-m', safeLabel])
  return { ref, label: safeLabel, date: '' }
}

/**
 * Restore a snapshot NON-destructively: first auto-snapshot the current state,
 * then check out the target tree into a new commit. History is preserved, so the
 * user can always go forward again.
 */
export function restoreSnapshot(repoPath: string, ref: string, git: GitRunner = defaultGitRunner): { restored: string; backup: Snapshot } {
  if (!ref.startsWith(SNAP_PREFIX)) throw new Error('Ungültige Snapshot-Referenz')
  // 1) safety net: snapshot the current state before changing anything
  const backup = createSnapshot(repoPath, `vor Wiederherstellung von ${ref}`, git)
  // 2) bring the target tree into the working dir and commit it (no reset --hard)
  git.run(repoPath, ['checkout', ref, '--', '.'])
  git.run(repoPath, ['add', '-A'])
  git.run(repoPath, [...IDENTITY, 'commit', '--allow-empty', '-m', `restore: ${ref}`])
  return { restored: ref, backup }
}
