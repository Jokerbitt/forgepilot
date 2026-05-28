import { NextResponse } from 'next/server'
import { readConnectorConfigs } from '@/lib/connectors/config'
import { getGitHubPullRequestPreview, mergeGitHubPullRequest } from '@/lib/connectors/github'
import { evaluateMergeSafety } from '@/lib/github/merge-safety'

export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ number: string }>
}

interface MergeRequestBody {
  confirm?: boolean
  auto?: boolean
  sha?: string
  review?: {
    filesReviewed?: boolean
    checksReviewed?: boolean
    noSecrets?: boolean
  }
}

export async function POST(request: Request, { params }: Params) {
  const { number: rawNumber } = await params
  const number = Number(rawNumber)
  if (!Number.isInteger(number) || number <= 0) {
    return NextResponse.json({ error: 'Invalid pull request number' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({})) as MergeRequestBody
  const isAutoMerge = body.auto === true

  if (!isAutoMerge && body.confirm !== true) {
    return NextResponse.json({ error: 'Merge confirmation is required' }, { status: 400 })
  }

  if (!isAutoMerge && (!body.review?.filesReviewed || !body.review?.checksReviewed || !body.review?.noSecrets)) {
    return NextResponse.json({
      error: 'Review checklist is required before merging',
    }, { status: 400 })
  }

  try {
    const configs = readConnectorConfigs()
    const config = configs.github ?? {}
    const preview = await getGitHubPullRequestPreview(config, number)
    const safety = evaluateMergeSafety(preview, { mode: isAutoMerge ? 'auto' : 'manual' })

    if (preview.draft || preview.state !== 'open' || preview.mergeable === false) {
      return NextResponse.json({
        error: 'Pull request is not merge-ready',
        recommendation: preview.mergeRecommendation,
      }, { status: 409 })
    }

    if (body.sha && body.sha !== preview.headSha) {
      return NextResponse.json({
        error: 'Pull request changed after preview. Reload before merging.',
      }, { status: 409 })
    }

    if (safety.status !== 'ready') {
      return NextResponse.json({
        error: 'Pull request is not merge-ready',
        recommendation: preview.mergeRecommendation,
        safety,
      }, { status: 409 })
    }

    const result = await mergeGitHubPullRequest(config, {
      number,
      sha: preview.headSha,
      title: preview.title,
      message: 'Merged from ForgePilot Branch Review after user confirmation.',
    })

    return NextResponse.json({ ok: true, result, safety })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'GitHub pull request could not be merged'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
