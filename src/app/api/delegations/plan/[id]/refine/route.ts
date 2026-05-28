export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { z } from 'zod'
import { getPlan, updatePlan, generatePlan } from '@/lib/delegations/plan-generator'

const RefineSchema = z.object({
  feedback: z.string().min(1).max(2000),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params

  const plan = getPlan(id)
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  if (plan.status !== 'draft') return NextResponse.json({ error: 'Plan is no longer editable' }, { status: 400 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = RefineSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

  try {
    const { overview, phases } = await generatePlan(
      plan.goal,
      plan.context,
      plan.targetRepo,
      parsed.data.feedback,
    )
    const updated = updatePlan(id, { overview, phases })
    return NextResponse.json({ plan: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Plan refinement failed: ${msg}` }, { status: 500 })
  }
}
