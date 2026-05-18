import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'
import type { DigestEntry } from '@/lib/models/attention'
import { getOpenAttentionItems } from '@/lib/attention/store'

export const dynamic = 'force-dynamic'

const DELEGATIONS_FILE = path.join(process.cwd(), 'config', 'delegations.json')
const KNOWLEDGE_FILE = path.join(process.cwd(), 'config', 'knowledge-store.json')

function readDelegations(): Delegation[] {
  try {
    return JSON.parse(fs.readFileSync(DELEGATIONS_FILE, 'utf-8')) as Delegation[]
  } catch {
    return []
  }
}

function countRecentKnowledgeCards(since: Date): number {
  try {
    const store = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf-8')) as {
      items?: Array<{ createdAt: string }>
    }
    return (store.items ?? []).filter(i => new Date(i.createdAt) >= since).length
  } catch {
    return 0
  }
}

/** GET /api/digest — last-24h summary */
export async function GET() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const delegations = readDelegations()
  const recent = delegations.filter(d => new Date(d.updatedAt || d.createdAt) >= since)

  const prsCreated: string[] = recent
    .filter(d => d.summaryReport?.prUrl)
    .map(d => d.summaryReport!.prUrl!)

  const totalCostUsd = recent
    .filter(d => d.actualCostUsd != null)
    .reduce((sum, d) => sum + (d.actualCostUsd ?? 0), 0)

  const digest: DigestEntry = {
    delegationsCompleted: recent.filter(d => d.status === 'completed').length,
    delegationsFailed: recent.filter(d => d.status === 'failed').length,
    delegationsCancelled: recent.filter(d => d.status === 'cancelled').length,
    prsCreated,
    totalCostUsd,
    newKnowledgeCards: countRecentKnowledgeCards(since),
    openAttentionItems: getOpenAttentionItems().length,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(digest)
}
