export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { execFileSync } from 'child_process'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import fs from 'fs'

function hasGitHubRemote(repoPath: string): boolean {
  try {
    const remotes = execFileSync('git', ['remote', '-v'], { cwd: repoPath, encoding: 'utf-8', timeout: 5000 })
    return remotes.includes('github.com')
  } catch {
    return false
  }
}

function getDefaultBranch(repoPath: string): string {
  try {
    const result = execFileSync(
      'git', ['symbolic-ref', 'refs/remotes/origin/HEAD'],
      { cwd: repoPath, encoding: 'utf-8', timeout: 5000 }
    ).trim()
    return result.replace('refs/remotes/origin/', '')
  } catch {
    // No remote HEAD — check local branches
    try {
      const branches = execFileSync('git', ['branch'], { cwd: repoPath, encoding: 'utf-8', timeout: 5000 })
      if (branches.includes('main')) return 'main'
    } catch { /* ignore */ }
    return 'main'
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)

  if (!delegation) return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })
  if (delegation.status !== 'completed') {
    return NextResponse.json(
      { error: `Nur abgeschlossene Delegations können gemergt werden (Status: ${delegation.status})` },
      { status: 400 },
    )
  }

  const repoPath = delegation.targetRepo ?? process.cwd()
  if (!fs.existsSync(repoPath)) {
    return NextResponse.json({ error: `Repo-Pfad nicht gefunden: ${repoPath}` }, { status: 400 })
  }

  const slug = (delegation.contract.workItemId ?? id).replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const featureBranch = `${delegation.contract.branchStrategy ?? 'feature'}/${slug}-task`
  const baseBranch = getDefaultBranch(repoPath)

  // Check feature branch exists
  try {
    execFileSync('git', ['rev-parse', '--verify', featureBranch], { cwd: repoPath, encoding: 'utf-8', timeout: 5000 })
  } catch {
    return NextResponse.json({ error: `Branch nicht gefunden: ${featureBranch}` }, { status: 400 })
  }

  // Switch to base branch
  try {
    execFileSync('git', ['checkout', baseBranch], { cwd: repoPath, stdio: 'pipe', timeout: 10000 })
  } catch (err) {
    return NextResponse.json({ error: `Konnte nicht zu ${baseBranch} wechseln: ${String(err)}` }, { status: 500 })
  }

  // Merge feature branch
  const commitMessage = `feat: merge ${featureBranch} — ${delegation.title || delegation.contract.goal.slice(0, 80)}`
  try {
    execFileSync(
      'git', ['merge', featureBranch, '--no-ff', '-m', commitMessage],
      { cwd: repoPath, stdio: 'pipe', timeout: 30000 }
    )
  } catch (err) {
    return NextResponse.json({ error: `Merge fehlgeschlagen: ${String(err)}` }, { status: 500 })
  }

  // Get merge commit hash
  const mergeCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: repoPath, encoding: 'utf-8', timeout: 5000
  }).trim()

  // Check if GitHub remote exists → offer PR creation
  const githubRemote = hasGitHubRemote(repoPath)

  // Update delegation with merge info
  await repo.update(id, {
    summaryReport: {
      keyPoints: delegation.summaryReport?.keyPoints ?? [delegation.contract.goal],
      changes: delegation.summaryReport?.changes ?? [],
      timeTakenMinutes: delegation.summaryReport?.timeTakenMinutes ?? 0,
      ...delegation.summaryReport,
      branchName: featureBranch,
      commitMessages: [...(delegation.summaryReport?.commitMessages ?? []), commitMessage],
    },
  })

  return NextResponse.json({
    merged: true,
    featureBranch,
    baseBranch,
    mergeCommit,
    repoPath,
    githubRemote,
  })
}
