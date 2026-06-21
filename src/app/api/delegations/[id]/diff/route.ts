export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

export interface DelegationDiff {
  /** Files changed (from summaryReport or git log) */
  filesAdded: string[]
  filesModified: string[]
  filesDeleted: string[]
  /** Git log entries (last 10 commits on the branch) */
  commits: Array<{ hash: string; message: string; date: string; author: string }>
  /** Raw unified diff (max 8000 chars) */
  diff: string
  /** Branch name the agent worked on */
  branch: string
  /** Whether diff was read from actual git (true) or only report data (false) */
  fromGit: boolean
}

function runGit(args: string[], cwd: string): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    timeout: 10_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) return ''
  return result.stdout?.trim() ?? ''
}

function getBranchFromDelegation(delegationId: string, targetRepo?: string): string | null {
  // Try to infer branch from delegation id (pattern: feature/slug-task)
  const slug = delegationId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return `feature/${slug}-task`
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)
  if (!delegation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const report = delegation.summaryReport

  // Build result from summaryReport data (always available)
  const result: DelegationDiff = {
    filesAdded:    report?.filesAdded    ?? [],
    filesModified: report?.filesModified ?? [],
    filesDeleted:  report?.filesDeleted  ?? [],
    commits: [],
    diff: '',
    branch: report?.branchName ?? getBranchFromDelegation(id, delegation.targetRepo) ?? '',
    fromGit: false,
  }

  // Enrich with git data if targetRepo is set and accessible
  const repoPath = delegation.targetRepo
  if (repoPath && fs.existsSync(repoPath) && path.isAbsolute(repoPath)) {
    const branch = result.branch

    // Git log — last 10 commits on the branch
    const logOutput = runGit(
      ['log', '--format=%H|%s|%ai|%an', '-n', '10', branch, '--'],
      repoPath,
    )
    if (logOutput) {
      result.commits = logOutput.split('\n').filter(Boolean).map(line => {
        const [hash, message, date, author] = line.split('|')
        return { hash: hash?.slice(0, 7) ?? '', message: message ?? '', date: date ?? '', author: author ?? '' }
      })
      result.fromGit = true
    }

    // Git diff — branch vs main/master (first 8000 chars)
    for (const base of ['main', 'master', 'origin/main', 'origin/master']) {
      const diffOutput = runGit(['diff', `${base}...${branch}`, '--', '.'], repoPath)
      if (diffOutput) {
        result.diff = diffOutput.slice(0, 8000)
        // Also extract file list from diff stat if summaryReport is empty
        if (result.filesModified.length === 0 && result.filesAdded.length === 0) {
          const statOutput = runGit(['diff', '--name-status', `${base}...${branch}`], repoPath)
          for (const line of statOutput.split('\n').filter(Boolean)) {
            const [status, ...rest] = line.split('\t')
            const file = rest.join('\t')
            if (status === 'A') result.filesAdded.push(file)
            else if (status === 'D') result.filesDeleted.push(file)
            else if (status?.startsWith('M') || status?.startsWith('R')) result.filesModified.push(file)
          }
        }
        result.fromGit = true
        break
      }
    }
  }

  // Fallback: also populate commits from commitMessages in report
  if (result.commits.length === 0 && report?.commitMessages?.length) {
    result.commits = report.commitMessages.map((msg, i) => ({
      hash: `c${i + 1}`,
      message: msg,
      date: delegation.completedAt ?? delegation.updatedAt,
      author: 'agent',
    }))
  }

  return NextResponse.json(result)
}
