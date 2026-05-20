import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { readCachedWorkItems, syncAllConnectors, writeCachedWorkItems } from './sync'
import type { WorkItem } from '@/lib/models/work-item'
import type { WorkItemsCache } from './sync'

function makeItem(id: string, source: 'linear' | 'github', priority: WorkItem['priority']): WorkItem {
  return {
    id,
    source,
    type: source === 'linear' ? 'ticket' : 'issue',
    title: `Item ${id}`,
    url: `https://example.com/${id}`,
    projectId: 'PROJ',
    status: 'todo',
    priority,
    blocked: false,
    risk: 'A',
    aiDelegable: true,
    updatedAt: '2026-05-20T10:00:00.000Z',
    createdAt: '2026-05-19T08:00:00.000Z',
  }
}

describe('syncAllConnectors', () => {
  let cacheFile: string

  beforeEach(() => {
    cacheFile = path.join(os.tmpdir(), `wic-${Date.now()}-${Math.random()}.json`)
  })

  afterEach(() => {
    if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile)
  })

  it('merges results from both connectors and sorts by priority', async () => {
    const linearItem = makeItem('LIN-1', 'linear', 2)
    const githubItem = makeItem('GH-1', 'github', 0)

    const cache = await syncAllConnectors({
      cacheFile,
      configs: { linear: {}, github: {} },
      fetchLinear: async () => [linearItem],
      fetchGitHub: async () => [githubItem],
    })

    expect(cache.items.map(i => i.id)).toEqual(['GH-1', 'LIN-1'])
    expect(cache.results).toHaveLength(2)
    expect(cache.results.every(r => r.ok)).toBe(true)
    expect(cache.syncedAt).toMatch(/T/)
  })

  it('records errors per connector without failing the whole sync', async () => {
    const cache = await syncAllConnectors({
      cacheFile,
      configs: { linear: {}, github: {} },
      fetchLinear: async () => {
        throw new Error('Linear API down')
      },
      fetchGitHub: async () => [makeItem('GH-1', 'github', 1)],
    })

    expect(cache.items).toHaveLength(1)
    expect(cache.items[0].id).toBe('GH-1')

    const linearResult = cache.results.find(r => r.connector === 'linear')
    const githubResult = cache.results.find(r => r.connector === 'github')

    expect(linearResult?.ok).toBe(false)
    expect(linearResult?.error).toBe('Linear API down')
    expect(linearResult?.count).toBe(0)
    expect(githubResult?.ok).toBe(true)
    expect(githubResult?.count).toBe(1)
  })

  it('persists the cache to disk and reads it back', async () => {
    const item = makeItem('LIN-1', 'linear', 1)

    const written = await syncAllConnectors({
      cacheFile,
      configs: { linear: {}, github: {} },
      fetchLinear: async () => [item],
      fetchGitHub: async () => [],
    })

    const onDisk = readCachedWorkItems(cacheFile)
    expect(onDisk).not.toBeNull()
    expect(onDisk?.items.map(i => i.id)).toEqual(['LIN-1'])
    expect(onDisk?.syncedAt).toBe(written.syncedAt)
  })

  it('records a duration for each connector independently', async () => {
    const cache = await syncAllConnectors({
      cacheFile,
      configs: { linear: {}, github: {} },
      fetchLinear: async () => [],
      fetchGitHub: async () => [],
    })

    expect(cache.results[0].durationMs).toBeGreaterThanOrEqual(0)
    expect(cache.results[1].durationMs).toBeGreaterThanOrEqual(0)
    expect(cache.durationMs).toBeGreaterThanOrEqual(0)
  })
})

describe('readCachedWorkItems', () => {
  let cacheFile: string

  beforeEach(() => {
    cacheFile = path.join(os.tmpdir(), `wic-r-${Date.now()}-${Math.random()}.json`)
  })

  afterEach(() => {
    if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile)
  })

  it('returns null when no cache file exists', () => {
    expect(readCachedWorkItems(cacheFile)).toBeNull()
  })

  it('returns null when the cache file is malformed', () => {
    fs.writeFileSync(cacheFile, '{not valid json', 'utf-8')
    expect(readCachedWorkItems(cacheFile)).toBeNull()
  })

  it('writes and reads a cache round-trip', () => {
    const cache: WorkItemsCache = {
      syncedAt: '2026-05-20T10:00:00.000Z',
      durationMs: 42,
      results: [],
      items: [],
    }
    writeCachedWorkItems(cache, cacheFile)
    expect(readCachedWorkItems(cacheFile)).toEqual(cache)
  })
})
