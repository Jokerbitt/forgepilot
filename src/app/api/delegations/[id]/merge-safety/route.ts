export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { readConnectorConfigs } from '@/lib/connectors/config'
import { getGitHubPullRequestPreview, mergeGitHubPullRequest } from '@/lib/connectors/github'
import { evaluateMergeSafety } from '@/lib/github/merge-safety'
import {
  createDelegationRepository,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'

interface Params {
  params: Promise<{ id: string }>
}

function pullRequestNumberFromUrl(url?: string): number | null {
  const match = /\/pull\/(\d+)/.exec(url ?? '')
  if (!match) return null
  const number = Number(match[1])
  return Number.isInteger(number) && number > 0 ? number : null
}

async function loadMergeSafety(id: string) {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)
  if (!delegation) {
    return { status: 404, body: { error: 'Delegation nicht gefunden' } }
  }

  const prNumber = pullRequestNumberFromUrl(delegation.summaryReport?.prUrl)
  if (!prNumber) {
    return {
      status: 200,
      body: {
        ok: true,
        available: false,
        reason: 'Noch kein GitHub PR mit Pull-Request-Nummer vorhanden.',
      },
      delegation,
      repo,
    }
  }

  const configs = readConnectorConfigs()
  const config = configs.github ?? {}
  const preview = await getGitHubPullRequestPreview(config, prNumber)
  const manualSafety = evaluateMergeSafety(preview, { delegation, mode: 'manual' })
  const autoSafety = evaluateMergeSafety(preview, { delegation, mode: 'auto' })

  return {
    status: 200,
    body: {
      ok: true,
      available: true,
      prNumber,
      preview: {
        number: preview.number,
        title: preview.title,
        url: preview.url,
        state: preview.state,
        draft: preview.draft,
        headSha: preview.headSha,
        mergeable: preview.mergeable,
        changedFiles: preview.changedFiles,
        additions: preview.additions,
        deletions: preview.deletions,
        checks: preview.checks,
        mergeRecommendation: preview.mergeRecommendation,
        files: preview.files.map(file => ({
          filename: file.filename,
          status: file.status,
          changes: file.changes,
          additions: file.additions,
          deletions: file.deletions,
        })),
      },
      manualSafety,
      autoSafety,
    },
    delegation,
    repo,
    preview,
    autoSafety,
  }
}

export async function GET(_request: Request, { params }: Params) {
  const authError = await requireAuth()
  if (authError) return authError

  try {
    const { id } = await params
    const result = await loadMergeSafety(id)
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Merge Safety konnte nicht geladen werden',
    }, { status: 500 })
  }
}

export async function POST(_request: Request, { params }: Params) {
  const authError = await requireAuth()
  if (authError) return authError

  try {
    const { id } = await params
    const result = await loadMergeSafety(id)
    if (result.status !== 200 || !result.body.available || !result.delegation || !result.repo || !result.preview || !result.autoSafety) {
      return NextResponse.json(result.body, { status: result.status })
    }

    if (result.autoSafety.status !== 'ready') {
      return NextResponse.json({
        error: 'Auto-Merge ist nicht freigegeben',
        safety: result.autoSafety,
      }, { status: 409 })
    }

    const configs = readConnectorConfigs()
    const config = configs.github ?? {}
    const mergeResult = await mergeGitHubPullRequest(config, {
      number: result.preview.number,
      sha: result.preview.headSha,
      title: result.preview.title,
      message: 'Auto-merged by ForgePilot after delegation safety gate passed.',
    })

    const updated = await result.repo.update(id, {
      summaryReport: {
        ...(result.delegation.summaryReport ?? { keyPoints: [], changes: [], timeTakenMinutes: 0 }),
        prUrl: result.delegation.summaryReport?.prUrl,
        prState: mergeResult.merged ? 'merged' : result.delegation.summaryReport?.prState,
        prMergedAt: mergeResult.merged ? new Date().toISOString() : result.delegation.summaryReport?.prMergedAt,
      },
    })

    return NextResponse.json({
      ok: true,
      merged: mergeResult.merged,
      result: mergeResult,
      safety: result.autoSafety,
      delegation: updated,
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Auto-Merge konnte nicht ausgeführt werden',
    }, { status: 500 })
  }
}
