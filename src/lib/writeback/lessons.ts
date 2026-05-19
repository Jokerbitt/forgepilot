import { randomUUID } from 'crypto'
import { upsertCard } from '@/lib/knowledge/store'
import type { AgentRun } from '@/lib/models/agent-run'
import type { MemoryCard } from '@/lib/knowledge/types'

export interface WriteLessonsResult {
  cards: MemoryCard[]
}

export function writeRunLessons(run: AgentRun): WriteLessonsResult {
  if (run.status !== 'completed' && run.status !== 'failed') {
    return { cards: [] }
  }

  const now = new Date().toISOString()
  const cards: MemoryCard[] = []

  // Learning card from result summary (only for completed runs with a summary)
  if (run.status === 'completed' && run.resultSummary) {
    const card: MemoryCard = {
      id: `run-lesson-${run.id}`,
      type: 'learning',
      title: `Run ${run.id.slice(0, 8)}: ${run.resultSummary.slice(0, 80)}`,
      body: run.resultSummary.slice(0, 500),
      sourceIds: [run.id],
      tags: ['agent-run', 'learning', run.model],
      privacyClass: 'internal',
      confidence: 'high',
      createdAt: now,
      updatedAt: now,
    }
    upsertCard(card)
    cards.push(card)
  }

  // Risk card when run failed or had errors
  const errorEvents = run.traceEvents.filter(e => e.type === 'error')
  if (run.status === 'failed' || errorEvents.length > 0) {
    const errorMsg = run.errorMessage
      ?? (errorEvents[0] ? String(errorEvents[0].data.message ?? 'Unknown error') : 'Run failed without error message')
    const card: MemoryCard = {
      id: `run-risk-${run.id}`,
      type: 'risk',
      title: `Failed run ${run.id.slice(0, 8)}: ${errorMsg.slice(0, 80)}`,
      body: `Model: ${run.model}. Error: ${errorMsg.slice(0, 300)}`,
      sourceIds: [run.id],
      tags: ['agent-run', 'risk', 'failure', run.model],
      privacyClass: 'internal',
      confidence: 'medium',
      createdAt: now,
      updatedAt: now,
    }
    upsertCard(card)
    cards.push(card)
  }

  return { cards }
}
