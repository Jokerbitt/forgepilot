export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { readConnectorConfigs } from '@/lib/connectors/config'
import {
  applyPlanningItems,
  buildPlanningItems,
  parseGrokPlanningActionPlan,
  renderPlanningPrompt,
  type PlanningMode,
} from '@/lib/planning/grok-planning-gateway'

const MODES = new Set<PlanningMode>(['preview', 'create-linear', 'create-github', 'create-all'])
const CONFIRMATION_HEADER = 'x-forgepilot-confirm'
const CONFIRMATION_VALUE = 'create-planning-items'

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'ForgePilot Grok Planning Gateway',
    modes: Array.from(MODES),
    defaultMode: 'preview',
    confirmationHeader: CONFIRMATION_HEADER,
    confirmationValue: CONFIRMATION_VALUE,
    prompt: renderPlanningPrompt(),
  }, {
    headers: { 'cache-control': 'no-store' },
  })
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const modeParam = url.searchParams.get('mode') ?? 'preview'
  const mode = MODES.has(modeParam as PlanningMode) ? modeParam as PlanningMode : undefined

  if (!mode) {
    return NextResponse.json({ error: `Invalid mode: ${modeParam}` }, { status: 400 })
  }

  if (mode !== 'preview' && request.headers.get(CONFIRMATION_HEADER) !== CONFIRMATION_VALUE) {
    return NextResponse.json({
      error: 'Planning creation requires explicit confirmation header.',
      requiredHeader: CONFIRMATION_HEADER,
      requiredValue: CONFIRMATION_VALUE,
    }, { status: 409 })
  }

  try {
    const body = await request.json() as unknown
    const rawPlan = isObject(body) && 'actionPlan' in body ? body.actionPlan : body
    const plan = parseGrokPlanningActionPlan(rawPlan)
    const items = buildPlanningItems(plan)
    const configs = readConnectorConfigs()
    const applyResult = await applyPlanningItems(items, {
      mode,
      linearConfig: configs.linear,
      githubConfig: configs.github,
    })

    return NextResponse.json({
      ok: true,
      mode,
      plan,
      items,
      applyResult,
      warnings: buildWarnings(mode, applyResult.skipped.length),
    }, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({
        error: 'Invalid Grok planning payload',
        issues: error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }, { status: 400 })
    }

    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Planning gateway failed',
    }, { status: 500 })
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function buildWarnings(mode: PlanningMode, skipped: number): string[] {
  const warnings: string[] = []
  if (mode === 'preview') {
    warnings.push('Preview only: no GitHub or Linear issues were created.')
  }
  if (skipped > 0) {
    warnings.push('Some requested targets were skipped because connector configuration is missing.')
  }
  return warnings
}
