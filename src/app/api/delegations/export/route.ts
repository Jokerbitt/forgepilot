import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation, DelegationStatus } from '@/lib/models/delegation'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')

function readDelegations(): Delegation[] {
  try {
    const data = fs.readFileSync(DELEGATIONS_FILE, 'utf-8')
    return JSON.parse(data) as Delegation[]
  } catch {
    return []
  }
}

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
    'status',
    'riskClass',
    'route',
    'workItemId',
    'createdAt',
    'completedAt',
    'actualCostUsd',
    'tokenCount',
  ]

  const lines: string[] = [header.join(',')]

  for (const d of delegations) {
    const tokenCount = d.summaryReport?.costSavings?.tokensUsed?.totalTokens ?? null
    const completedAt =
      d.status === 'completed' || d.status === 'failed' ? d.updatedAt : null

    const row = [
      escapeCSVField(d.id),
      escapeCSVField(d.title),
      escapeCSVField(d.status),
      escapeCSVField(d.contract.riskClass),
      escapeCSVField(d.executionRoute),
      escapeCSVField(d.contract.workItemId),
      escapeCSVField(d.createdAt),
      escapeCSVField(completedAt),
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

  let delegations = readDelegations()

  // Status filter
  if (statusParam !== 'all') {
    if (!(VALID_STATUS_VALUES as string[]).includes(statusParam)) {
      return NextResponse.json(
        { error: `Invalid status. Use all or one of: ${VALID_STATUS_VALUES.join(', ')}` },
        { status: 400 }
      )
    }
    delegations = delegations.filter(d => d.status === statusParam)
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
