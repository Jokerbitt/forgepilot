export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { type NextRequest, NextResponse } from 'next/server'
import { getOpenAttentionItems } from '@/lib/attention/store'
import { buildDailyReport } from '@/lib/reports/daily-report'
import { readExecuteLoopEvidence } from '@/lib/reports/execute-loop-evidence-store'
import {
  createDelegationRepository,
  getDelegationStorageMode,
  SINGLE_TENANT_USER_ID,
} from '@/lib/repositories/delegationRepository'
import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'
import { getAuthReadiness } from '@/lib/auth/readiness'
import {
  deliverDailyReport,
  readDailyReportDeliveryTargetFromEnv,
  type DailyReportDeliveryFormat,
  type DailyReportDeliveryTarget,
} from '@/lib/reports/daily-report-delivery'
import { logger } from '@/lib/logger'

const deliveryLogger = logger.child({ module: 'reports.daily.deliver' })

interface DeliverRequestBody {
  url?: string
  format?: string
  secret?: string
  headers?: Record<string, string>
  maxAttempts?: number
}

function isValidFormat(value: string | undefined): value is DailyReportDeliveryFormat {
  return value === 'json' || value === 'markdown'
}

async function readOverrideTarget(request: NextRequest): Promise<{
  override?: { target: DailyReportDeliveryTarget; maxAttempts?: number }
  error?: { status: number; message: string }
}> {
  if (request.method !== 'POST') return {}
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return {}
  }
  let body: DeliverRequestBody
  try {
    body = (await request.json()) as DeliverRequestBody
  } catch {
    return { error: { status: 400, message: 'Invalid JSON body' } }
  }
  if (!body || typeof body !== 'object') return {}
  if (!body.url) return {}

  if (body.format !== undefined && !isValidFormat(body.format)) {
    return { error: { status: 400, message: 'format must be "json" or "markdown"' } }
  }

  return {
    override: {
      target: {
        url: body.url,
        format: body.format ?? 'json',
        secret: body.secret,
        headers: body.headers,
      },
      maxAttempts: typeof body.maxAttempts === 'number' ? body.maxAttempts : undefined,
    },
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { override, error: bodyError } = await readOverrideTarget(request)
  if (bodyError) {
    return NextResponse.json({ ok: false, error: bodyError.message }, { status: bodyError.status })
  }

  const envTarget = readDailyReportDeliveryTargetFromEnv(process.env)
  const target = override?.target ?? envTarget.target

  if (!target) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'No delivery target configured. Set FORGEPILOT_DAILY_REPORT_WEBHOOK_URL or POST { "url": "..." }.',
      },
      { status: 400 },
    )
  }

  try {
    const delegationRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const projectBriefRepo = createProjectBriefRepository(SINGLE_TENANT_USER_ID)
    const knowledgeRepo = createKnowledgeCardRepository(SINGLE_TENANT_USER_ID)

    const [delegations, projectBriefs, knowledgeCards] = await Promise.all([
      delegationRepo.listByStatus(),
      projectBriefRepo.listAll(),
      knowledgeRepo.listAll(),
    ])

    const report = buildDailyReport({
      delegations,
      projectBriefs,
      knowledgeCards,
      attentionItems: getOpenAttentionItems(),
      storageMode: getDelegationStorageMode(process.env),
      authDisabled: process.env.FORGEPILOT_AUTH_DISABLED === 'true',
      authReadiness: getAuthReadiness(process.env),
      executeLoopEvidence: readExecuteLoopEvidence(),
    })

    deliveryLogger.info(
      { event: 'reports.daily.deliver.start', url: target.url, format: target.format },
      'Delivering daily report',
    )

    const result = await deliverDailyReport(report, target, {
      maxAttempts: override?.maxAttempts,
    })

    deliveryLogger.info(
      {
        event: 'reports.daily.deliver.complete',
        url: target.url,
        ok: result.ok,
        attempts: result.attempts.length,
      },
      result.ok ? 'Daily report delivered' : 'Daily report delivery failed',
    )

    return NextResponse.json(
      {
        ok: result.ok,
        url: result.url,
        format: result.format,
        attempts: result.attempts,
        deliveredAt: result.deliveredAt,
        signed: Boolean(result.signature),
      },
      {
        status: result.ok ? 200 : 502,
        headers: { 'cache-control': 'no-store' },
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    deliveryLogger.error({ event: 'reports.daily.deliver.error', error: message })
    return NextResponse.json(
      { ok: false, error: `Failed to deliver daily report: ${message}` },
      { status: 500 },
    )
  }
}
