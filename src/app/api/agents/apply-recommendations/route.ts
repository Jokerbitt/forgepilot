import { NextResponse } from 'next/server'
import { applyRecommendations, getConfidenceOverrides } from '@/lib/agents/skill-evolver'

/** Apply skill-evolver recommendations to learned confidence store */
export async function POST() {
  const result = applyRecommendations()
  const overrides = getConfidenceOverrides()
  return NextResponse.json({ ...result, overrides })
}

/** Get current learned confidence overrides */
export async function GET() {
  const overrides = getConfidenceOverrides()
  return NextResponse.json({ overrides, count: overrides.length })
}
