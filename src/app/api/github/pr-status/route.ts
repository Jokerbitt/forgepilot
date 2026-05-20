export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { fetchPRStatus } from '@/lib/github/pr-status'
import { apiLogger } from '@/lib/logger'

/**
 * GET /api/github/pr-status?url=<github-pr-url>
 *
 * Returns PR metadata + CI check-run state.
 * Used by the delegation detail page (M134).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const prUrl = request.nextUrl.searchParams.get('url')
  if (!prUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  try {
    const status = await fetchPRStatus(prUrl)
    if (status.error === 'Invalid PR URL') {
      return NextResponse.json({ error: status.error }, { status: 400 })
    }
    return NextResponse.json(status)
  } catch (err) {
    apiLogger.error({ event: 'github.pr-status.error', err }, 'Failed to fetch PR status')
    return NextResponse.json({ error: 'Failed to fetch PR status' }, { status: 502 })
  }
}
