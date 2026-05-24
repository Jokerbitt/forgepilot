/**
 * GET  /api/ai/auto-route?complexity=simple|coding|complex&preferLocal=true|false
 * POST /api/ai/auto-route  { complexity, preferLocal, allowPaidAPIs }
 *
 * Returns the recommended provider for a task, including CLI-based zero-key options.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  selectBestProvider,
  detectCLIProviders,
  DEFAULT_ROUTER_PREFS,
  type TaskComplexity,
} from '@/lib/ai/auto-router'

export const dynamic = 'force-dynamic'

function parseComplexity(raw: string | null): TaskComplexity {
  if (raw === 'simple' || raw === 'coding' || raw === 'complex') return raw
  return 'simple'
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const complexity = parseComplexity(searchParams.get('complexity'))
  const preferLocal = searchParams.get('preferLocal') !== 'false'
  const allowPaidAPIs = searchParams.get('allowPaidAPIs') !== 'false'

  const recommendation = selectBestProvider(complexity, { preferLocal, allowPaidAPIs })
  const cliStatus = detectCLIProviders()

  return NextResponse.json({ complexity, recommendation, cliStatus })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    complexity?: string
    preferLocal?: boolean
    allowPaidAPIs?: boolean
  }

  const complexity = parseComplexity(body.complexity ?? null)
  const prefs = {
    preferLocal: body.preferLocal ?? DEFAULT_ROUTER_PREFS.preferLocal,
    allowPaidAPIs: body.allowPaidAPIs ?? DEFAULT_ROUTER_PREFS.allowPaidAPIs,
  }

  const recommendation = selectBestProvider(complexity, prefs)
  const cliStatus = detectCLIProviders()

  return NextResponse.json({ complexity, recommendation, cliStatus })
}
