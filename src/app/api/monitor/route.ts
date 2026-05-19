import { NextResponse } from 'next/server'
import { buildMonitorSnapshot } from '@/lib/monitor/monitor-service'

export async function GET() {
  const snapshot = buildMonitorSnapshot()
  return NextResponse.json(snapshot)
}
