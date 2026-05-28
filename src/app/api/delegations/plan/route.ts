export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { z } from 'zod'
import { generatePlan, createPlan } from '@/lib/delegations/plan-generator'

const CreatePlanSchema = z.object({
  goal: z.string().min(5).max(2000),
  context: z.string().max(3000).default(''),
  targetRepo: z.string().default(''),
})

export async function POST(req: Request) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = CreatePlanSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  const { goal, context, targetRepo } = parsed.data

  try {
    const { overview, phases } = await generatePlan(goal, context, targetRepo)
    const plan = createPlan({ goal, context, targetRepo, overview, phases, status: 'draft' })
    return NextResponse.json({ plan })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Plan generation failed: ${msg}` }, { status: 500 })
  }
}
