import { randomUUID } from 'crypto'
import type { Delegation } from '@/lib/models/delegation'
import { createKnowledgeCardRepository } from '@/lib/repositories/knowledgeCardRepository'
import type { CreateKnowledgeCardInput } from '@/lib/repositories/knowledgeCardRepository'
import { aiLogger } from '@/lib/logger'
import { generateText } from '@/lib/ai/text-generation'
import { writeKnowledgeCard, findKnowledgeCardsBySource } from '@/lib/knowledge/knowledge-card'
import { writeKnowledgeCardToNas } from '@/lib/knowledge/nas-writeback'
import { shouldWriteCard } from '@/lib/knowledge/quality-gate'

// ─── M220: Delegation Knowledge Writeback ────────────────────────────────────

export interface WritebackDelegationResult {
  written: boolean
  cardId?: string
  reason?: string
}

/**
 * After a successful delegation execution, generate a lesson-summary via LLM and
 * persist a KnowledgeCard to config/knowledge-cards.json.
 *
 * Fail-open: if the LLM call fails the card is still written with the raw output.
 * Never throws — always returns WritebackDelegationResult.
 */
export async function writebackDelegationKnowledge(
  delegation: Delegation,
  executionOutput: string,
): Promise<WritebackDelegationResult> {
  try {
    const riskClass = delegation.contract.riskClass ?? 'B'
    const mode = delegation.executionRoute ?? 'unknown'
    const truncatedOutput = executionOutput.slice(0, 500)
    const cardTitle = delegation.title || delegation.contract.goal.slice(0, 80)

    // Deduplication: skip if a card already exists for this delegation
    const existing = findKnowledgeCardsBySource(delegation.id)
    if (existing.length > 0) {
      aiLogger.info(
        { event: 'knowledge.writeback.skipped', delegationId: delegation.id, reason: 'duplicate' },
        'Knowledge writeback skipped — card already exists for this delegation',
      )
      return { written: false, reason: 'Card already exists for this delegation' }
    }

    let content: string

    // Try LLM summary — fall back to raw output on any error
    try {
      const result = await generateText({
        system: 'You are a knowledge extraction assistant. Respond ONLY with Markdown bullet points.',
        prompt: `Fasse in 3-5 Stichpunkten zusammen, was bei dieser Delegation gelernt wurde.\nTitel: ${cardTitle}\nOutput (max 500 Zeichen): ${truncatedOutput}\nAntworte NUR mit Markdown-Bullet-Points.`,
        maxTokens: 300,
        purpose: 'fast',
      })
      content = result.text.trim()
    } catch {
      content = `**Raw execution output (LLM summary unavailable):**\n\n${truncatedOutput}`
    }

    // Quality gate: only persist if content meets minimum standards
    const gate = shouldWriteCard(cardTitle, content, [], delegation.id)
    if (!gate.allow) {
      aiLogger.warn(
        { event: 'knowledge.writeback.rejected', delegationId: delegation.id, reason: gate.reason, qualityScore: gate.qualityScore },
        'Knowledge writeback rejected by quality gate',
      )
      return { written: false, reason: gate.reason }
    }

    const card = writeKnowledgeCard({
      title: cardTitle,
      content,
      source: 'delegation',
      sourceId: delegation.id,
      briefId: delegation.briefId,
      prUrl: delegation.summaryReport?.prUrl,
      tags: ['delegation', riskClass, mode],
      qualityScore: gate.qualityScore,
    })

    aiLogger.info(
      { event: 'knowledge.writeback.delegation', delegationId: delegation.id, cardId: card.id, qualityScore: gate.qualityScore },
      'Delegation knowledge card written',
    )

    // M306: mirror card to SecondBrain on NAS (non-blocking, fail-safe)
    writeKnowledgeCardToNas(card)

    return { written: true, cardId: card.id }
  } catch (error) {
    aiLogger.error(
      {
        event: 'knowledge.writeback.delegation.error',
        delegationId: delegation.id,
        error: error instanceof Error ? error.message : String(error),
      },
      'Delegation knowledge writeback failed',
    )
    return { written: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

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

/**
 * After a FAILED delegation execution, store a failure lesson as a KnowledgeCard.
 * These cards feed back into the Scout (codebase-scout.ts) for future agent runs —
 * closing the memory component of the Scout→Execute→Critic→Memory loop.
 *
 * Never throws. Called fire-and-forget after failed execution.
 */
export async function writeFailureLessonCard(
  delegation: Delegation,
): Promise<WritebackDelegationResult> {
  try {
    // Dedup: skip if a failure-lesson card already exists for this delegation
    const existing = findKnowledgeCardsBySource(delegation.id)
    if (existing.some(c => c.tags.includes('failure-lesson'))) {
      return { written: false, reason: 'Failure card already exists for this delegation' }
    }

    const riskClass = delegation.contract.riskClass ?? 'B'
    const mode = delegation.executionRoute ?? 'unknown'
    const targetRepo = delegation.targetRepo ?? 'unknown'
    const cardTitle = `[FAILED] ${delegation.title || delegation.contract.goal.slice(0, 80)}`

    const errorLogs = (delegation.logs ?? [])
      .filter(l => l.type === 'error')
      .slice(-3)
      .map(l => `- ${l.message.slice(0, 200)}`)
      .join('\n')

    const errorSummary = delegation.errorMessage?.slice(0, 300) ?? 'Unknown error'
    const rawContent = `**Goal:** ${delegation.contract.goal.slice(0, 200)}\n**Error:** ${errorSummary}\n**Last error logs:**\n${errorLogs || '(none)'}`

    let content: string
    try {
      const result = await generateText({
        system: 'You are a failure analysis assistant. Respond ONLY with Markdown bullet points.',
        prompt: `Analysiere diesen fehlgeschlagenen Agent-Run in 3-5 Bullet Points:\nTitel: ${cardTitle}\nFehler: ${errorSummary}\nLog-Auszug:\n${errorLogs || '(keine Fehler-Logs)'}\n\nAntworte NUR mit Markdown-Bullet-Points: Was ist schiefgelaufen? Was sollte beim nächsten Versuch vermieden werden?`,
        maxTokens: 300,
        purpose: 'fast',
      })
      content = result.text.trim()
    } catch {
      content = rawContent
    }

    const card = writeKnowledgeCard({
      title: cardTitle,
      content,
      source: 'delegation',
      sourceId: delegation.id,
      briefId: delegation.briefId,
      tags: ['failure-lesson', targetRepo, riskClass, mode],
      qualityScore: 60,
    })

    aiLogger.info(
      { event: 'knowledge.writeback.failure', delegationId: delegation.id, cardId: card.id, targetRepo },
      'Failure lesson card written',
    )

    writeKnowledgeCardToNas(card)
    return { written: true, cardId: card.id }
  } catch (error) {
    aiLogger.error(
      {
        event: 'knowledge.writeback.failure.error',
        delegationId: delegation.id,
        error: error instanceof Error ? error.message : String(error),
      },
      'Failure lesson card write failed',
    )
    return { written: false, reason: error instanceof Error ? error.message : String(error) }
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
