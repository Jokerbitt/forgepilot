/**
 * GET /api/pilot/idea-history
 *
 * Returns the last N idea pipeline runs with live status from the run store.
 */

import { NextResponse } from 'next/server'
import { readIdeaHistory } from '@/lib/pilot/idea-history-store'
import { getRun } from '@/lib/agents/orchestrated-run'
import type { IdeaHistoryEntry } from '@/lib/pilot/idea-history-store'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '5', 10), 20)

  const entries = readIdeaHistory(limit)

  // Enrich with live run status
  const enriched = entries.map(entry => {
    const run = getRun(entry.runId)
    const liveStatus: IdeaHistoryEntry['status'] = run
      ? run.status === 'done'    ? 'done'
      : run.status === 'failed' || run.status === 'aborted' ? 'failed'
      : run.status === 'running' ? 'running'
      : 'building'
      : entry.status

    return { ...entry, status: liveStatus }
  })

  return NextResponse.json(enriched)
}
