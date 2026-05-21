export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { MemoryCard } from '@/lib/knowledge/types'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'

const CONFIG_DIR = join(process.cwd(), 'config')

export interface SearchResult {
  type: 'brief' | 'delegation' | 'workitem' | 'knowledge'
  id: string
  title: string
  excerpt: string
  url: string
}

interface SearchResponse {
  results: SearchResult[]
  query: string
  total: number
}

function readJson<T>(filename: string): T[] {
  const filepath = join(CONFIG_DIR, filename)
  if (!existsSync(filepath)) return []
  try {
    const raw = readFileSync(filepath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed as T[]
    return []
  } catch {
    return []
  }
}

function readJsonObject(filename: string): Record<string, unknown> {
  const filepath = join(CONFIG_DIR, filename)
  if (!existsSync(filepath)) return {}
  try {
    const raw = readFileSync(filepath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

function excerpt(text: string, query: string, maxLen = 120): string {
  const lower = text.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen).trimEnd() + (text.length > maxLen ? '…' : '')
  const start = Math.max(0, idx - 30)
  const end = Math.min(text.length, idx + query.length + 60)
  const result = (start > 0 ? '…' : '') + text.slice(start, end).trimEnd() + (end < text.length ? '…' : '')
  return result.slice(0, maxLen + 2)
}

function matches(text: string | undefined | null, query: string): boolean {
  if (!text) return false
  return text.toLowerCase().includes(query.toLowerCase())
}

export async function GET(req: NextRequest): Promise<NextResponse<SearchResponse | { error: string }>> {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''

  if (q.trim().length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  const query = q.trim()
  const results: SearchResult[] = []

  // ── Project Briefs ───────────────────────────────────────────────
  const briefRepo = createProjectBriefRepository(SINGLE_TENANT_USER_ID)
  const briefs = await briefRepo.listAll()
  for (const brief of briefs) {
    if (
      matches(brief.title, query) ||
      matches(brief.problemStatement, query) ||
      matches(brief.rawIdea, query)
    ) {
      const searchText = [brief.title, brief.problemStatement, brief.rawIdea].filter(Boolean).join(' ')
      results.push({
        type: 'brief',
        id: brief.id,
        title: brief.title ?? brief.id,
        excerpt: excerpt(searchText, query),
        url: `/project-briefs/${brief.id}`,
      })
    }
  }

  // ── Delegations ──────────────────────────────────────────────────
  const delegationRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegations = await delegationRepo.listByStatus()
  for (const del of delegations) {
    const goal = del.contract?.goal ?? ''
    const workItemId = del.contract?.workItemId ?? ''
    const agentId = del.executionRoute ?? ''
    if (
      matches(del.title, query) ||
      matches(goal, query) ||
      matches(workItemId, query) ||
      matches(agentId, query)
    ) {
      const searchText = [del.title, goal, workItemId].filter(Boolean).join(' ')
      results.push({
        type: 'delegation',
        id: del.id,
        title: del.title ?? goal ?? del.id,
        excerpt: excerpt(searchText, query),
        url: `/delegations/${del.id}`,
      })
    }
  }

  // ── Work Items ───────────────────────────────────────────────────
  interface RawWorkItem {
    id: string
    title?: string
    description?: string
    status?: string
  }
  const workItems = readJson<RawWorkItem>('local-items.json')
  for (const item of workItems) {
    if (matches(item.title, query) || matches(item.description, query)) {
      const searchText = [item.title, item.description].filter(Boolean).join(' ')
      results.push({
        type: 'workitem',
        id: item.id,
        title: item.title ?? item.id,
        excerpt: excerpt(searchText, query),
        url: `/work-items`,
      })
    }
  }

  // ── Knowledge Cards ──────────────────────────────────────────────
  const knowledgeStore = readJsonObject('knowledge-store.json')
  const rawCards = knowledgeStore['cards']
  const cards: MemoryCard[] = Array.isArray(rawCards) ? (rawCards as MemoryCard[]) : []
  for (const card of cards) {
    if (
      matches(card.title, query) ||
      matches(card.body, query) ||
      card.tags.some(tag => matches(tag, query))
    ) {
      const searchText = [card.title, card.body].filter(Boolean).join(' ')
      results.push({
        type: 'knowledge',
        id: card.id,
        title: card.title,
        excerpt: excerpt(searchText, query),
        url: `/knowledge`,
      })
    }
  }

  // Cap at 50 results
  const sliced = results.slice(0, 50)

  return NextResponse.json({
    results: sliced,
    query,
    total: sliced.length,
  })
}
