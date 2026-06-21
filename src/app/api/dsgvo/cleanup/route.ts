export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { runRetentionCleanup } from '@/lib/dsgvo/processing-ledger'

export async function POST() {
  const result = await runRetentionCleanup()
  return NextResponse.json(result)
}
