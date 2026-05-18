import { NextResponse } from 'next/server'
import { computeResearchStats } from '@/lib/knowledge/research-stats'

export async function GET() {
  return NextResponse.json(computeResearchStats())
}
