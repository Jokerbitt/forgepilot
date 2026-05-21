import { randomUUID } from 'crypto'
import type { Delegation } from '@/lib/models/delegation'
import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import type { CreateKnowledgeCardInput } from '@/lib/repositories/knowledgeCardRepository'
import { aiLogger } from '@/lib/logger'

export interface WritebackResult {
  saved: number
  skipped: boolean
  reason?: string
}

/**
 * Extract knowledge insights from a completed delegation and save as KnowledgeCards.
 * Called after successful execution + critic scoring.
 * Never throws — all errors are swallowed and logged.
 */
export async function writebackExecutionInsights(
  delegation: Delegation,
): Promise<WritebackResult> {
  try {
    // Only writeback for completed delegations with a critic score
    if (delegation.status !== 'completed' || !delegation.criticScore) {
      return { saved: 0, skipped: true, reason: 'no critic score or not completed' }
    }

    // Only writeback for approved/good executions (verdict !== 'rejected')
    if (delegation.criticScore.verdict === 'rejected') {
      return { saved: 0, skipped: true, reason: 'critic rejected execution' }
    }

    const repo = createKnowledgeCardRepository()
    const insights = extractInsights(delegation)

    let saved = 0
    for (const insight of insights) {
      await repo.upsert(insight)
      saved++
    }

    aiLogger.info(
      { event: 'knowledge.writeback', delegationId: delegation.id, saved },
      'Knowledge writeback complete',
    )
    return { saved, skipped: false }
  } catch (error) {
    aiLogger.error(
      {
        event: 'knowledge.writeback.error',
        delegationId: delegation.id,
        error: error instanceof Error ? error.message : String(error),
      },
      'Knowledge writeback failed',
    )
    return { saved: 0, skipped: true, reason: 'error during writeback' }
  }
}

function extractInsights(delegation: Delegation): CreateKnowledgeCardInput[] {
  const insights: CreateKnowledgeCardInput[] = []
  const score = delegation.criticScore!

  // Insight 1: Execution outcome
  insights.push({
    id: randomUUID(),
    type: 'learning',
    title: `Execution: ${delegation.title}`,
    body: `Status: ${delegation.status}. Critic verdict: ${score.verdict}. Score: correctness=${score.correctness}, efficiency=${score.efficiency}, drift=${score.drift}. Summary: ${score.summary}`,
    sourceIds: [delegation.id],
    tags: [delegation.status, score.verdict, delegation.executionRoute ?? 'unknown'],
    privacyClass: 'internal',
    confidence: score.correctness >= 80 ? 'high' : score.correctness >= 50 ? 'medium' : 'low',
  })

  // Insight 2: Summary report if available
  if (delegation.summaryReport) {
    const reportText =
      typeof delegation.summaryReport === 'object'
        ? JSON.stringify(delegation.summaryReport).slice(0, 500)
        : String(delegation.summaryReport).slice(0, 500)

    insights.push({
      id: randomUUID(),
      type: 'learning',
      title: `Report: ${delegation.title}`,
      body: reportText,
      sourceIds: [delegation.id],
      tags: ['summary', delegation.executionRoute ?? 'unknown'],
      privacyClass: 'internal',
      confidence: 'medium',
    })
  }

  return insights.slice(0, 3) // max 3 cards per execution
}
