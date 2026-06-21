export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { generatePlan, listPlans } from '@/lib/delegations/plan-generator'

export async function GET() {
  return NextResponse.json(listPlans())
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 })
  }

  const { goal, context, targetRepo, maxPhases } = body as Record<string, unknown>

  if (typeof goal !== 'string' || goal.trim().length === 0) {
    return NextResponse.json({ error: 'goal is required' }, { status: 400 })
  }

  try {
    const plan = await generatePlan({
      goal: goal.trim(),
      context: typeof context === 'string' ? context.trim() : undefined,
      targetRepo: typeof targetRepo === 'string' ? targetRepo.trim() : undefined,
      maxPhases: typeof maxPhases === 'number' ? maxPhases : undefined,
    })
    return NextResponse.json(plan, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Plan generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
