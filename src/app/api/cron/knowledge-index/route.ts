export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { indexNasFiles } from '@/lib/knowledge/nas-indexer'
import { logger } from '@/lib/logger'
import { isCronAuthorized } from '@/lib/cron/auth'

/**
 * GET/POST /api/cron/knowledge-index
 *
 * Vercel Cron + manual trigger for NAS knowledge base indexing.
 * Reads Markdown files from FORGEPILOT_DOCS_DIR, extracts sections as
 * MemoryCards, and writes them to the knowledge store.
 *
 * Auth: Bearer CRON_SECRET, using the central cron guard.
 *
 * Scheduled: daily at 4:00 UTC (configured in vercel.json).
 */
async function runIndex(request: NextRequest) {
  if (!isCronAuthorized(request, 'knowledge-index')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startMs = Date.now()
  logger.info({ event: 'cron.knowledge-index.start' }, 'Knowledge index cron started')

  try {
    const result = await indexNasFiles()
    const durationMs = Date.now() - startMs

    logger.info(
      { event: 'cron.knowledge-index.done', ...result, durationMs },
      'Knowledge index cron completed',
    )

    return NextResponse.json({ ok: true, durationMs, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    logger.error({ event: 'cron.knowledge-index.error', error: msg }, 'Knowledge index cron failed')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return runIndex(request)
}

export async function POST(request: NextRequest) {
  return runIndex(request)
}
