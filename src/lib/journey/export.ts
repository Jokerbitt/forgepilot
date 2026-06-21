/**
 * Journey Companion — extra idea: app export / backup (no lock-in).
 *
 * Produces a ZIP of the app's committed state via `git archive` (clean: only
 * tracked files, no node_modules/.git). Runner injectable for testing.
 */
import { execFileSync } from 'child_process'

export interface ArchiveRunner {
  archive(repoPath: string): Buffer
}

export const defaultArchiveRunner: ArchiveRunner = {
  archive(repoPath) {
    return execFileSync('git', ['archive', '--format=zip', 'HEAD'], {
      cwd: repoPath,
      maxBuffer: 256 * 1024 * 1024,
    })
  },
}

/** Build a ZIP archive of the repo's committed state. Throws on git failure. */
export function buildRepoArchive(repoPath: string, runner: ArchiveRunner = defaultArchiveRunner): Buffer {
  return runner.archive(repoPath)
}

/** Safe download filename for the archive. `stamp` injected (no Date here). */
export function archiveFileName(repoPath: string, stamp: string): string {
  const base = repoPath.split('/').filter(Boolean).pop() ?? 'app'
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'app'
  return `${slug}-backup-${stamp}.zip`
}
