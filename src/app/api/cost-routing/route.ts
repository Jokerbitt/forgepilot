export const dynamic = 'force-dynamic'

/**
 * POST /api/cost-routing
 * Body: { steps: { title: string, description?: string }[], preferLocal?: boolean, allowPaidAPIs?: boolean }
 * Returns: PlanCostEstimate (per-step routing + plain-German cost summary)
 *
 * Plain-language cost & routing preview shown BEFORE a build starts: which steps
 * run locally for free vs. in the cloud, and roughly what it costs. Reuses the
 * local-first selectBestProvider() router.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { estimatePlanCost, type PlanStep } from '@/lib/cost-routing/plan-cost'
import { DEFAULT_ROUTER_PREFS } from '@/lib/ai/auto-router'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { steps?: PlanStep[]; preferLocal?: boolean; allowPaidAPIs?: boolean }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const steps = Array.isArray(body.steps)
    ? body.steps.filter(s => s && typeof s.title === 'string' && s.title.trim()).map(s => ({ title: s.title.trim(), description: s.description }))
    : []
  if (steps.length === 0) return NextResponse.json({ error: 'Mindestens ein Schritt erforderlich' }, { status: 400 })

  const prefs = {
    preferLocal: typeof body.preferLocal === 'boolean' ? body.preferLocal : DEFAULT_ROUTER_PREFS.preferLocal,
    allowPaidAPIs: typeof body.allowPaidAPIs === 'boolean' ? body.allowPaidAPIs : DEFAULT_ROUTER_PREFS.allowPaidAPIs,
  }

  const estimate = estimatePlanCost(steps, prefs)
  return NextResponse.json(estimate)
}
