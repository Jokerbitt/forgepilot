export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getLedgerStatsAsync, readProcessingLedgerAsync } from '@/lib/dsgvo/processing-ledger'

export async function GET() {
  const [stats, records] = await Promise.all([
    getLedgerStatsAsync(),
    readProcessingLedgerAsync(50),
  ])
  return NextResponse.json({ stats, records })
}
