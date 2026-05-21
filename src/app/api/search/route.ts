export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { createProjectBriefRepository } from '@/lib/repositories/projectBriefRepository'
import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'

export interface SearchResult {
  id: string
  type: 'delegation' | 'brief' | 'knowledge' | 'workitem'
  title: string
  excerpt: string
  href: string
  score: number
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
  total: number
}

function scoreText(text: string, terms: string[]): number {
  const lower = text.toLowerCase()
  return terms.reduce((score, term) => {
    const count = (lower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
    return score + count
  }, 0)
}

function excerpt(text: string, terms: string[], maxLen = 120): string {
  const lower = text.toLowerCase()
  let bestIdx = 0
  for (const term of terms) {
    const idx = lower.indexOf(term)
    if (idx > -1) { bestIdx = Math.max(0, idx - 30); break }
  }
  const snippet = text.slice(bestIdx, bestIdx + maxLen)
  return (bestIdx > 0 ? '…' : '') + snippet + (snippet.length === maxLen ? '…' : '')
}

export async function GET(request: NextRequest): Promise<Response> {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (query.length < 2) {
    return NextResponse.json({ query, results: [], total: 0 } satisfies SearchResponse)
  }

  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1)

  try {
    const [delegationRepo, briefRepo, knowledgeRepo] = [
      createDelegationRepository(SINGLE_TENANT_USER_ID),
      createProjectBriefRepository(),
      createKnowledgeCardRepository(),
    ]

    const [delegations, briefs, cards] = await Promise.all([
      delegationRepo.listByStatus(),
      briefRepo.listAll(),
      knowledgeRepo.listAll(),
    ])

    const results: SearchResult[] = []

    // Search delegations
    for (const d of delegations) {
      const searchText = `${d.title} ${d.contract?.goal ?? ''} ${d.errorMessage ?? ''}`
      const score = scoreText(searchText, terms)
      if (score > 0) {
        results.push({
          id: d.id,
          type: 'delegation',
          title: d.title,
          excerpt: excerpt(d.contract?.goal ?? d.title, terms),
          href: `/delegations`,
          score,
        })
      }
    }

    // Search project briefs
    for (const b of briefs) {
      const searchText = `${b.title} ${b.problemStatement ?? ''} ${b.rawIdea ?? ''} ${b.desiredOutcome ?? ''}`
      const score = scoreText(searchText, terms)
      if (score > 0) {
        results.push({
          id: b.id,
          type: 'brief',
          title: b.title,
          excerpt: excerpt(b.problemStatement ?? b.rawIdea ?? b.title, terms),
          href: `/project-briefs`,
          score,
        })
      }
    }

    // Search knowledge cards
    for (const k of cards) {
      const searchText = `${k.title ?? ''} ${k.body ?? ''} ${k.tags.join(' ')}`
      const score = scoreText(searchText, terms)
      if (score > 0) {
        results.push({
          id: k.id,
          type: 'knowledge',
          title: k.title ?? 'Knowledge Card',
          excerpt: excerpt(k.body ?? '', terms),
          href: `/knowledge`,
          score,
        })
      }
    }

    // Sort by score descending, limit to 20
    results.sort((a, b) => b.score - a.score)
    const top = results.slice(0, 20)

    return NextResponse.json({ query, results: top, total: results.length } satisfies SearchResponse)
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
