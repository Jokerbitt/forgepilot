export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { readStoredApiKeys } from '@/lib/connectors/config'
import { runPRReview } from '@/lib/agent-runner/pr-reviewer'

export interface PRReviewRequest {
  prNumber: number
  delegationId?: string
  expectedScope?: string[]
}

export async function POST(req: Request) {
  let body: PRReviewRequest
  try {
    body = await req.json() as PRReviewRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { prNumber, delegationId, expectedScope } = body

  if (!prNumber || typeof prNumber !== 'number' || prNumber < 1) {
    return NextResponse.json({ error: 'prNumber is required and must be a positive integer' }, { status: 400 })
  }

  const storedKeys = readStoredApiKeys()
  const ghToken =
    storedKeys.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim()

  if (!ghToken) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN not configured. Bitte in den Einstellungen hinterlegen.' },
      { status: 422 }
    )
  }

  try {
    const result = await runPRReview({ prNumber, ghToken, delegationId, expectedScope })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Review fehlgeschlagen: ${message}` }, { status: 500 })
  }
}
