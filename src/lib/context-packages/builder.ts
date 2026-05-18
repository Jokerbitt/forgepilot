import { randomUUID } from 'crypto'
import { getCards, getItems } from '@/lib/knowledge/store'
import type { MemoryCard, KnowledgeItem } from '@/lib/knowledge/types'
import type {
  ContextPackage,
  ContextSource,
  ContextPrivacyMode,
  BuildContextPackageInput,
  BuildContextPackageResult,
} from './types'

const DEFAULT_TOKEN_BUDGET = 8000
const TOKENS_PER_CHAR = 0.25 // rough estimate: 4 chars ≈ 1 token

function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKENS_PER_CHAR)
}

const PRIVACY_RANK: Record<string, number> = {
  'public': 0,
  'internal': 1,
  'sensitive': 2,
  'local-only': 3,
}

const MODE_MAX_RANK: Record<ContextPrivacyMode, number> = {
  'cloud-approved': 1,  // public + internal only
  'hybrid': 2,          // up to sensitive
  'local-only': 3,      // everything
}

function isAllowedByPrivacy(
  itemPrivacy: string,
  mode: ContextPrivacyMode
): boolean {
  const itemRank = PRIVACY_RANK[itemPrivacy] ?? 0
  const maxRank = MODE_MAX_RANK[mode]
  return itemRank <= maxRank
}

function blockSecrets(text: string): string {
  return text
    .replace(/\b(sk-[A-Za-z0-9]{20,})\b/g, '[REDACTED_API_KEY]')
    .replace(/\b(lin_api_[A-Za-z0-9]{20,})\b/g, '[REDACTED_LINEAR_KEY]')
    .replace(/\b(ghp_[A-Za-z0-9]{20,})\b/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/password\s*[:=]\s*\S+/gi, 'password: [REDACTED]')
    .replace(/secret\s*[:=]\s*\S+/gi, 'secret: [REDACTED]')
}

function formatCard(card: MemoryCard): string {
  return `[${card.type.toUpperCase()}] ${card.title}\n${card.body}`
}

function formatItem(item: KnowledgeItem): string {
  return `## ${item.title}\n${item.summary || item.content.slice(0, 500)}`
}

export function buildContextPackage(
  input: BuildContextPackageInput
): BuildContextPackageResult {
  const warnings: string[] = []
  const privacyMode: ContextPrivacyMode = input.privacyMode ?? 'hybrid'
  const tokenBudget = input.tokenBudget ?? DEFAULT_TOKEN_BUDGET

  // Fetch relevant memory cards
  const allCards = getCards(input.projectId)
  const relevantCards = input.tags?.length
    ? allCards.filter(c => input.tags!.some(t => c.tags.includes(t)))
    : allCards.slice(0, 20)

  // Fetch relevant knowledge items
  const allItems = getItems()
  const relevantItems = input.tags?.length
    ? allItems.filter(i => input.tags!.some(t => i.tags.includes(t)))
    : allItems.slice(0, 10)

  const sources: ContextSource[] = []
  const contentParts: string[] = []
  let usedTokens = 0

  // Add objective header (always included)
  const header = `# Context Package: ${input.title}\nObjective: ${input.objective}\n`
  const headerTokens = estimateTokens(header)
  contentParts.push(header)
  usedTokens += headerTokens

  // Add memory cards respecting privacy + budget
  const cardSection: string[] = []
  for (const card of relevantCards) {
    if (!isAllowedByPrivacy(card.privacyClass, privacyMode)) {
      sources.push({
        sourceId: card.id,
        label: card.title,
        tokenCount: 0,
        privacyClass: card.privacyClass,
        included: false,
        excludedReason: `Privacy ${card.privacyClass} not allowed in ${privacyMode} mode`,
      })
      continue
    }
    const formatted = blockSecrets(formatCard(card))
    const tokens = estimateTokens(formatted)
    if (usedTokens + tokens > tokenBudget) {
      sources.push({ sourceId: card.id, label: card.title, tokenCount: tokens, privacyClass: card.privacyClass, included: false, excludedReason: 'Token budget exceeded' })
      warnings.push(`Memory card "${card.title}" excluded: token budget`)
      continue
    }
    cardSection.push(formatted)
    sources.push({ sourceId: card.id, label: card.title, tokenCount: tokens, privacyClass: card.privacyClass, included: true })
    usedTokens += tokens
  }

  if (cardSection.length > 0) {
    contentParts.push(`\n## Memory Cards\n${cardSection.join('\n\n')}`)
  }

  // Add knowledge items respecting privacy + budget
  const itemSection: string[] = []
  for (const item of relevantItems) {
    if (!isAllowedByPrivacy(item.privacyClass, privacyMode)) {
      sources.push({ sourceId: item.id, label: item.title, tokenCount: 0, privacyClass: item.privacyClass, included: false, excludedReason: `Privacy ${item.privacyClass} not allowed` })
      continue
    }
    const formatted = blockSecrets(formatItem(item))
    const tokens = estimateTokens(formatted)
    if (usedTokens + tokens > tokenBudget) {
      sources.push({ sourceId: item.id, label: item.title, tokenCount: tokens, privacyClass: item.privacyClass, included: false, excludedReason: 'Token budget exceeded' })
      continue
    }
    itemSection.push(formatted)
    sources.push({ sourceId: item.id, label: item.title, tokenCount: tokens, privacyClass: item.privacyClass, included: true })
    usedTokens += tokens
  }

  if (itemSection.length > 0) {
    contentParts.push(`\n## Knowledge\n${itemSection.join('\n\n')}`)
  }

  // Readiness: how much of the budget is usefully filled
  const includedSources = sources.filter(s => s.included).length
  const totalSources = sources.length
  const readinessScore = totalSources === 0
    ? 40  // no sources = partial readiness (objective still present)
    : Math.min(100, Math.round(40 + (includedSources / Math.max(totalSources, 1)) * 60))

  // Blockers
  const blockers: string[] = []
  if (relevantCards.length === 0) blockers.push('No memory cards found — run knowledge writeback first')
  if (relevantItems.length === 0) blockers.push('No knowledge items indexed for this project')
  const excluded = sources.filter(s => !s.included && s.excludedReason?.includes('Privacy'))
  if (excluded.length > 0) blockers.push(`${excluded.length} source(s) excluded by privacy mode — switch to local-only to include`)

  const now = new Date()
  const expires = new Date(now.getTime() + 4 * 60 * 60 * 1000) // 4h TTL

  const pkg: ContextPackage = {
    id: randomUUID(),
    workItemId: input.workItemId,
    projectId: input.projectId,
    title: input.title,
    objective: input.objective,
    privacyMode,
    sources,
    memoryCardIds: relevantCards.filter(c => sources.find(s => s.sourceId === c.id && s.included)).map(c => c.id),
    content: contentParts.join('\n'),
    tokenCount: usedTokens,
    tokenBudget,
    readinessScore,
    blockers,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  }

  return { package: pkg, warnings }
}
