export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import type { Delegation, DelegationStatus } from '@/lib/models/delegation'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function buildCSV(delegations: Delegation[]): string {
  const header = [
    'id',
    'title',
    'goal',
    'status',
    'riskClass',
    'route',
    'workItemId',
    'briefTitle',
    'createdAt',
    'startedAt',
    'completedAt',
    'durationMin',
    'actualCostUsd',
    'tokenCount',
  ]

  const lines: string[] = [header.join(',')]

  for (const d of delegations) {
    const tokenCount = d.summaryReport?.costSavings?.tokensUsed?.totalTokens ?? null
    const completedAt = d.completedAt ??
      (d.status === 'completed' || d.status === 'failed' ? d.updatedAt : null)
    const durationMin = d.startedAt && completedAt
      ? Math.round((new Date(completedAt).getTime() - new Date(d.startedAt).getTime()) / 60000)
      : null

    const row = [
      escapeCSVField(d.id),
      escapeCSVField(d.title),
      escapeCSVField(d.contract.goal),
      escapeCSVField(d.status),
      escapeCSVField(d.contract.riskClass),
      escapeCSVField(d.executionRoute),
      escapeCSVField(d.contract.workItemId),
      escapeCSVField(d.briefTitle ?? null),
      escapeCSVField(d.createdAt),
      escapeCSVField(d.startedAt ?? null),
      escapeCSVField(completedAt),
      escapeCSVField(durationMin != null ? String(durationMin) : null),
      escapeCSVField(d.actualCostUsd != null ? String(d.actualCostUsd) : null),
      escapeCSVField(tokenCount != null ? String(tokenCount) : null),
    ]

    lines.push(row.join(','))
  }

  return lines.join('\n')
}

function isoDateOnly(): string {
  return new Date().toISOString().slice(0, 10)
}

const VALID_STATUS_VALUES: DelegationStatus[] = [
  'pending',
  'approved',
  'running',
  'completed',
  'failed',
  'cancelled',
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const format = searchParams.get('format') ?? 'csv'
  const statusParam = searchParams.get('status') ?? 'all'
  const fromParam = searchParams.get('from') ?? null
  const toParam = searchParams.get('to') ?? null

  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json({ error: 'Invalid format. Use csv or json.' }, { status: 400 })
  }

  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  let delegations: Delegation[]

  // Status filter
  if (statusParam !== 'all') {
    if (!(VALID_STATUS_VALUES as string[]).includes(statusParam)) {
      return NextResponse.json(
        { error: `Invalid status. Use all or one of: ${VALID_STATUS_VALUES.join(', ')}` },
        { status: 400 }
      )
    }
    delegations = await repo.listByStatus([statusParam as DelegationStatus])
  } else {
    delegations = await repo.listByStatus()
  }

  // Date range filter
  if (fromParam !== null) {
    const fromMs = new Date(fromParam).getTime()
    if (isNaN(fromMs)) {
      return NextResponse.json({ error: 'Invalid from date.' }, { status: 400 })
    }
    delegations = delegations.filter(d => new Date(d.createdAt).getTime() >= fromMs)
  }

  if (toParam !== null) {
    const toDate = new Date(toParam)
    if (isNaN(toDate.getTime())) {
      return NextResponse.json({ error: 'Invalid to date.' }, { status: 400 })
    }
    // inclusive: end of the given day
    toDate.setHours(23, 59, 59, 999)
    const toMs = toDate.getTime()
    delegations = delegations.filter(d => new Date(d.createdAt).getTime() <= toMs)
  }

  const filename = `delegations-export-${isoDateOnly()}.${format}`

  if (format === 'json') {
    const body = JSON.stringify(delegations, null, 2)
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  // CSV
  const csv = buildCSV(delegations)
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
