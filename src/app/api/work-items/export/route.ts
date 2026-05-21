export const dynamic = 'force-dynamic'

import fs from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { readConnectorConfigs } from '@/lib/connectors/config'
import { fetchGitHubWorkItems } from '@/lib/connectors/github-items'
import { fetchLinearWorkItems } from '@/lib/connectors/linear-items'
import { readCachedWorkItems } from '@/lib/connectors/sync'
import type { WorkItem, WorkItemSource, WorkItemStatus } from '@/lib/models/work-item'

type SourceFilter = 'all' | WorkItemSource

const LOCAL_ITEMS_FILE = path.join(process.cwd(), 'config', 'local-items.json')
const VALID_SOURCES: SourceFilter[] = ['all', 'linear', 'github', 'local']
const VALID_STATUSES: Array<'all' | WorkItemStatus> = ['all', 'backlog', 'todo', 'in-progress', 'in-review', 'done', 'cancelled']

function readLocalWorkItems(): WorkItem[] {
  try {
    if (!fs.existsSync(LOCAL_ITEMS_FILE)) return []
    return JSON.parse(fs.readFileSync(LOCAL_ITEMS_FILE, 'utf-8')) as WorkItem[]
  } catch {
    return []
  }
}

function escapeCSVField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCSV(items: WorkItem[]): string {
  const header = [
    'id',
    'source',
    'type',
    'title',
    'status',
    'priority',
    'risk',
    'blocked',
    'projectId',
    'milestone',
    'assigneeName',
    'url',
    'updatedAt',
    'createdAt',
  ]

  const rows = items.map(item => [
    item.id,
    item.source,
    item.type,
    item.title,
    item.status,
    item.priority,
    item.risk,
    item.blocked,
    item.projectId,
    item.milestone,
    item.assigneeName,
    item.url,
    item.updatedAt,
    item.createdAt,
  ].map(escapeCSVField).join(','))

  return [header.join(','), ...rows].join('\n')
}

function isoDateOnly(): string {
  return new Date().toISOString().slice(0, 10)
}

async function loadWorkItems(source: SourceFilter, cached: boolean): Promise<{ items: WorkItem[]; errors: string[] }> {
  const items: WorkItem[] = []
  const errors: string[] = []

  if (cached) {
    const cache = readCachedWorkItems()
    if (cache) {
      items.push(...cache.items.filter(item => source === 'all' || item.source === source))
    }
    if (source === 'all' || source === 'local') {
      items.push(...readLocalWorkItems())
    }
    return { items, errors }
  }

  const configs = readConnectorConfigs()
  const fetchers: Array<Promise<WorkItem[]>> = []

  if (source === 'all' || source === 'linear') fetchers.push(fetchLinearWorkItems(configs.linear ?? {}))
  if (source === 'all' || source === 'github') fetchers.push(fetchGitHubWorkItems(configs.github ?? {}))
  if (source === 'all' || source === 'local') fetchers.push(Promise.resolve(readLocalWorkItems()))

  const results = await Promise.allSettled(fetchers)
  for (const result of results) {
    if (result.status === 'fulfilled') {
      items.push(...result.value)
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
    }
  }

  return { items, errors }
}

export async function GET(request: NextRequest) {
  const source = (request.nextUrl.searchParams.get('source') ?? 'all') as SourceFilter
  const status = (request.nextUrl.searchParams.get('status') ?? 'all') as 'all' | WorkItemStatus
  const projectId = request.nextUrl.searchParams.get('projectId')
  const cached = request.nextUrl.searchParams.get('cached') === '1'

  if (!VALID_SOURCES.includes(source)) {
    return NextResponse.json({ error: `Invalid source. Use one of: ${VALID_SOURCES.join(', ')}` }, { status: 400 })
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Use one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  const { items, errors } = await loadWorkItems(source, cached)
  const filtered = items
    .filter(item => status === 'all' || item.status === status)
    .filter(item => !projectId || item.projectId === projectId)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

  const csv = buildCSV(filtered)
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="work-items-export-${isoDateOnly()}.csv"`,
      ...(errors.length > 0 ? { 'X-ForgePilot-Export-Warnings': errors.slice(0, 3).join(' | ') } : {}),
    },
  })
}
