export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/webhooks/hmac'
import { createLinearClient, extractLinearIssueIds } from '@/lib/linear/client'
import { apiLogger } from '@/lib/logger'

interface GitHubPREvent {
  action: string
  pull_request: {
    merged: boolean
    title: string
    body: string | null
    merge_commit_sha: string | null
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const payload = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  const event = request.headers.get('x-github-event')

  if (!verifyWebhookSignature(payload, signature, process.env.GITHUB_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  if (event !== 'pull_request') {
    return NextResponse.json({ ok: true, message: 'Ignored non-PR event' })
  }

  let body: GitHubPREvent
  try {
    body = JSON.parse(payload) as GitHubPREvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only process merged PRs
  if (body.action !== 'closed' || !body.pull_request.merged) {
    return NextResponse.json({ ok: true, message: 'PR not merged — skipped' })
  }

  const pr = body.pull_request
  const searchText = `${pr.title} ${pr.body ?? ''}`
  const issueIds = extractLinearIssueIds(searchText)

  if (issueIds.length === 0) {
    return NextResponse.json({ ok: true, message: 'No Linear issue IDs found in PR' })
  }

  const linear = createLinearClient()
  if (!linear) {
    apiLogger.warn({ event: 'linear.sync.skipped', reason: 'no-api-key' }, 'LINEAR_API_KEY not set')
    return NextResponse.json({ ok: true, message: 'LINEAR_API_KEY not configured' })
  }

  const results: Array<{ id: string; closed: boolean }> = []
  for (const id of issueIds) {
    const closed = await linear.closeIssue(id)
    results.push({ id, closed })
    apiLogger.info({ event: 'linear.issue.closed', issueId: id, closed }, 'Linear issue sync')
  }

  return NextResponse.json({ ok: true, results })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: 'ForgePilot GitHub Webhook' })
}
