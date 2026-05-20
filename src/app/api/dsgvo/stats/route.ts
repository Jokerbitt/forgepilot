export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getLedgerStats, readProcessingLedger } from '@/lib/dsgvo/processing-ledger'

export async function GET() {
  const stats   = getLedgerStats()
  const records = readProcessingLedger(50)
  return NextResponse.json({ stats, records })
}
