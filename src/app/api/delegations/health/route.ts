/**
 * GET /api/delegations/health — fleet-wide delegation health snapshot.
 *
 * Detects stuck / silent / over-budget / forgotten delegations and
 * recommends a concrete next step. Drives the UI Health Monitor (M133)
 * and can be polled by an autonomy loop for self-healing.
 */

export const dynamic = 'force-dynamic'

import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import type { Delegation } from '@/lib/models/delegation'
import { analyzeFleetHealth } from '@/lib/delegations/health'
import { logger } from '@/lib/logger'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    if (!fs.existsSync(DELEGATIONS_FILE)) return []
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch (err) {
    logger.warn({
      event: 'delegations.health.read_failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

export function GET(): NextResponse {
  const delegations = readDelegations()
  const snapshot = analyzeFleetHealth(delegations, new Date())
  return NextResponse.json(snapshot)
}
