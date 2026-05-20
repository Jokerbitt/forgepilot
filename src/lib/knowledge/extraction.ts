import type { Delegation } from '@/lib/models/delegation'
import type { MemoryCard, MemoryCardType, ConfidenceLevel } from './types'
import { upsertCard } from './store'

// ─── helpers ──────────────────────────────────────────────────────────────────

function classifyCard(delegation: Delegation): MemoryCardType {
  const { skillCategory, riskClass } = delegation.contract
  if (skillCategory === 'test') return 'pattern'
  if (skillCategory === 'infrastructure') return 'decision'
  if (riskClass === 'C') return 'risk'
  if ((delegation.summaryReport?.warnings?.length ?? 0) > 0) return 'risk'
  return 'learning'
}

function buildBody(delegation: Delegation): string {
  const report = delegation.summaryReport
  const parts: string[] = []

  if (report?.keyPoints?.length) {
    parts.push(`**Key Points:**\n${report.keyPoints.map(p => `- ${p}`).join('\n')}`)
  }

  const filesSummary = [
    ...(report?.filesAdded?.map(f => `+ ${f}`) ?? []),
    ...(report?.filesModified?.map(f => `~ ${f}`) ?? []),
  ]
  if (filesSummary.length) {
    parts.push(`**Files (${filesSummary.length}):** ${filesSummary.slice(0, 5).join(', ')}`)
  }

  if (report?.testsPassed != null && report.testsPassed > 0) {
    parts.push(`**Tests passed:** ${report.testsPassed}`)
  }

  if (report?.prUrl) {
    parts.push(`**PR:** ${report.prUrl}`)
  }

  if (report?.warnings?.length) {
    parts.push(`**Warnings:** ${report.warnings.slice(0, 3).join('; ')}`)
  }

  if (parts.length === 0) {
    parts.push(`Delegation completed: ${delegation.contract.goal}`)
  }

  return parts.join('\n\n')
}

function buildTags(delegation: Delegation): string[] {
  const tags: string[] = [
    `delegation:${delegation.id}`,
    'auto-extracted',
    'outcome:completed',
  ]

  if (delegation.contract.skillCategory) {
    tags.push(`skill:${delegation.contract.skillCategory}`)
  }
  if (delegation.executionRoute) {
    tags.push(`route:${delegation.executionRoute}`)
  }
  if (delegation.briefId) {
    tags.push(`brief:${delegation.briefId}`)
  }
  if (delegation.contract.riskClass) {
    tags.push(`risk:${delegation.contract.riskClass}`)
  }

  return tags
}

function buildConfidence(delegation: Delegation): ConfidenceLevel {
  const report = delegation.summaryReport
  if (!report) return 'low'
  const hasTests    = (report.testsPassed ?? 0) > 0
  const hasPoints   = (report.keyPoints?.length ?? 0) > 0
  const hasWarnings = (report.warnings?.length ?? 0) > 0
  if (hasTests && hasPoints && !hasWarnings) return 'high'
  if (hasPoints) return 'medium'
  return 'low'
}

// ─── public API ───────────────────────────────────────────────────────────────

export interface ExtractedKnowledge {
  card: MemoryCard
  saved: boolean
}

/**
 * Extract a MemoryCard from a completed delegation and persist it to the
 * knowledge store.  Returns null when the delegation is not completed or when
 * the store write fails silently.
 *
 * Called fire-and-forget from the delegation execute route after the delegation
 * transitions to status === 'completed'.
 */
export function extractKnowledge(delegation: Delegation): ExtractedKnowledge | null {
  if (delegation.status !== 'completed') return null

  const now  = new Date().toISOString()
  const privacyClass =
    delegation.contract.privacyMode === 'local'
      ? 'local-only'
      : 'internal'

  const card: MemoryCard = {
    id:           `extraction:${delegation.id}`,
    type:         classifyCard(delegation),
    title:        delegation.title || delegation.contract.goal.slice(0, 80),
    body:         buildBody(delegation),
    sourceIds:    [delegation.id],
    projectId:    delegation.briefId,
    tags:         buildTags(delegation),
    privacyClass,
    confidence:   buildConfidence(delegation),
    createdAt:    now,
    updatedAt:    now,
  }

  try {
    upsertCard(card)
    return { card, saved: true }
  } catch {
    return { card, saved: false }
  }
}
