import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { readConnectorConfigs } from '@/lib/connectors/config'
import { fetchLinearWorkItems } from '@/lib/connectors/linear-items'
import { fetchGitHubWorkItems } from '@/lib/connectors/github-items'
import { readCachedWorkItems } from '@/lib/connectors/sync'
import type { WorkItem } from '@/lib/models/work-item'

export const dynamic = 'force-dynamic'

type Source = 'all' | 'linear' | 'github' | 'local'

const LOCAL_ITEMS_FILE = path.join(process.cwd(), 'config', 'local-items.json')
const STATUS_OVERRIDES_FILE = path.join(process.cwd(), 'config', 'work-item-status-overrides.json')
const PRIORITY_OVERRIDES_FILE = path.join(process.cwd(), 'config', 'work-item-priority-overrides.json')

interface StatusOverride {
  id: string
  status: WorkItem['status']
  updatedAt: string
}

interface PriorityOverride {
  id: string
  priority: WorkItem['priority']
  updatedAt: string
}

function readLocalWorkItems(): WorkItem[] {
  try {
    if (!fs.existsSync(LOCAL_ITEMS_FILE)) {
      return []
    }

    return JSON.parse(fs.readFileSync(LOCAL_ITEMS_FILE, 'utf-8')) as WorkItem[]
  } catch {
    return []
  }
}

function readStatusOverrides(): StatusOverride[] {
  try {
    if (!fs.existsSync(STATUS_OVERRIDES_FILE)) return []
    return JSON.parse(fs.readFileSync(STATUS_OVERRIDES_FILE, 'utf-8')) as StatusOverride[]
  } catch {
    return []
  }
}

function readPriorityOverrides(): PriorityOverride[] {
  try {
    if (!fs.existsSync(PRIORITY_OVERRIDES_FILE)) return []
    return JSON.parse(fs.readFileSync(PRIORITY_OVERRIDES_FILE, 'utf-8')) as PriorityOverride[]
  } catch {
    return []
  }
}

function applyWorkItemOverrides(items: WorkItem[]): WorkItem[] {
  const overrides = new Map(readStatusOverrides().map(override => [override.id, override]))
  const priorityOverrides = new Map(readPriorityOverrides().map(override => [override.id, override]))
  if (overrides.size === 0 && priorityOverrides.size === 0) return items

  return items.map(item => {
    const override = overrides.get(item.id)
    const priorityOverride = priorityOverrides.get(item.id)
    if (!override && !priorityOverride) return item
    return {
      ...item,
      ...(override ? { status: override.status } : {}),
      ...(priorityOverride ? { priority: priorityOverride.priority } : {}),
      updatedAt: [override?.updatedAt, priorityOverride?.updatedAt, item.updatedAt]
        .filter(Boolean)
        .sort()
        .at(-1) ?? item.updatedAt,
    }
  })
}

export async function GET(request: NextRequest) {
  const source = (request.nextUrl.searchParams.get('source') ?? 'all') as Source
  const projectId = request.nextUrl.searchParams.get('projectId') ?? null
  const cached = request.nextUrl.searchParams.get('cached') === '1'
  const configs = readConnectorConfigs()

  try {
    const items: WorkItem[] = []
    const errors: string[] = []
    let syncedAt: string | undefined
    let fromCache = false

    if (cached) {
      const cache = readCachedWorkItems()
      if (cache) {
        const cachedItems = cache.items.filter(item => {
          if (source === 'all') return true
          return item.source === source
        })
        items.push(...cachedItems)
        syncedAt = cache.syncedAt
        fromCache = true
      }
      if (source === 'all' || source === 'local') {
        items.push(...readLocalWorkItems())
      }
    } else {
      const fetchers: Promise<WorkItem[]>[] = []

      if (source === 'all' || source === 'linear') {
        fetchers.push(fetchLinearWorkItems(configs.linear ?? {}))
      }
      if (source === 'all' || source === 'github') {
        fetchers.push(fetchGitHubWorkItems(configs.github ?? {}))
      }
      if (source === 'all' || source === 'local') {
        fetchers.push(Promise.resolve(readLocalWorkItems()))
      }

      const results = await Promise.allSettled(fetchers)

      for (const result of results) {
        if (result.status === 'fulfilled') {
          items.push(...result.value)
        } else {
          errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
        }
      }
    }

    const effectiveItems = applyWorkItemOverrides(items)

    effectiveItems.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

    const filtered = projectId ? effectiveItems.filter(i => i.projectId === projectId) : effectiveItems

    return NextResponse.json({
      items: filtered,
      total: filtered.length,
      fromCache,
      ...(syncedAt ? { syncedAt } : {}),
      ...(errors.length > 0 ? { errors } : {}),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch work items',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
