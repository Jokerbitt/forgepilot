import { NextResponse } from 'next/server'
import { runRetentionCleanup } from '@/lib/dsgvo/processing-ledger'

export async function POST() {
  const result = runRetentionCleanup()
  return NextResponse.json(result)
}
