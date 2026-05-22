import { NextResponse } from 'next/server'
import { getAuthReadiness } from '@/lib/auth/readiness'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getAuthReadiness(process.env), {
    headers: { 'cache-control': 'no-store' },
  })
}
