/**
 * Auto-Fetch Connector Scheduler — M8 AP8.2
 *
 * Periodically pulls work items from Linear + GitHub and persists a snapshot
 * to `config/work-items-cache.json`. The UI and `/api/work-items` can read
 * the cache for sub-second responses without hammering remote APIs.
 *
 * Triggered by `/api/cron/connector-sync` (Vercel Cron) or by a manual sync.
 */

import fs from 'fs'
import path from 'path'
import { getDataDir } from '@/lib/config/paths'
import type { WorkItem } from '@/lib/models/work-item'
import { readConnectorConfigs } from './config'
import { fetchLinearWorkItems } from './linear-items'
import { fetchGitHubWorkItems } from './github-items'
import type { ConnectorId } from './registry'

export interface ConnectorSyncResult {
  connector: ConnectorId
  ok: boolean
  count: number
  durationMs: number
  error?: string
}

export interface WorkItemsCache {
  syncedAt: string
  durationMs: number
  results: ConnectorSyncResult[]
  items: WorkItem[]
}

interface SyncOptions {
  fetchLinear?: typeof fetchLinearWorkItems
  fetchGitHub?: typeof fetchGitHubWorkItems
  cacheFile?: string
  configs?: ReturnType<typeof readConnectorConfigs>
}

function getCacheFile(override?: string): string {
  return override ?? path.join(getDataDir(), 'work-items-cache.json')
}

export function readCachedWorkItems(cacheFile?: string): WorkItemsCache | null {
  const file = getCacheFile(cacheFile)
  try {
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as WorkItemsCache
  } catch {
    return null
  }
}

export function writeCachedWorkItems(cache: WorkItemsCache, cacheFile?: string): void {
  const file = getCacheFile(cacheFile)
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf-8')
}

async function fetchWithMetrics<T>(
  connector: ConnectorId,
  fetcher: () => Promise<T[]>,
): Promise<{ result: ConnectorSyncResult; items: T[] }> {
  const start = Date.now()
  try {
    const items = await fetcher()
    return {
      items,
      result: {
        connector,
        ok: true,
        count: items.length,
        durationMs: Date.now() - start,
      },
    }
  } catch (err) {
    return {
      items: [],
      result: {
        connector,
        ok: false,
        count: 0,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      },
    }
  }
}

export async function syncAllConnectors(options: SyncOptions = {}): Promise<WorkItemsCache> {
  const fetchLinear = options.fetchLinear ?? fetchLinearWorkItems
  const fetchGitHub = options.fetchGitHub ?? fetchGitHubWorkItems
  const configs = options.configs ?? readConnectorConfigs()

  const totalStart = Date.now()

  const [linear, github] = await Promise.all([
    fetchWithMetrics<WorkItem>('linear', () => fetchLinear(configs.linear ?? {})),
    fetchWithMetrics<WorkItem>('github', () => fetchGitHub(configs.github ?? {})),
  ])

  const items = [...linear.items, ...github.items].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  const cache: WorkItemsCache = {
    syncedAt: new Date().toISOString(),
    durationMs: Date.now() - totalStart,
    results: [linear.result, github.result],
    items,
  }

  writeCachedWorkItems(cache, options.cacheFile)
  return cache
}
