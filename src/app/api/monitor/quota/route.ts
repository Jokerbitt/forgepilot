export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getGeminiQuota } from '@/lib/quota/gemini-tracker'

export async function GET() {
  const quota = getGeminiQuota()
  return NextResponse.json(quota)
}
