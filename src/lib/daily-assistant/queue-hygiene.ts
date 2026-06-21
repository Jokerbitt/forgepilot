import type { DailyAssistantQueueItem } from './next-action'

export interface QueueDuplicateGroup {
  key: string
  title: string
  count: number
  representativeId: string
  hiddenCount: number
  hiddenIds: string[]
}

export interface QueueHygieneSummary {
  visibleItems: DailyAssistantQueueItem[]
  duplicateGroups: QueueDuplicateGroup[]
  totalItems: number
  visibleCount: number
  hiddenDuplicateCount: number
  noisyTestCount: number
  riskCCount: number
  recommendation: string
}

const NOISY_TITLE_PATTERNS = [
  /^m\d+\s+/i,
  /^e2e\b/i,
  /^test\b/i,
  /^new task$/i,
  /^neues feature$/i,
  /^forgepilot e2e test feature$/i,
  /^build auth module$/i,
  /^implementiere:\s*test brief$/i,
]

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b[0-9a-f]{8,}\b/g, '')
    .replace(/\b\d{8,}\b/g, '')
    .replace(/[^a-z0-9äöüß]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isNoisyTestItem(item: DailyAssistantQueueItem): boolean {
  const title = item.title.trim()
  return NOISY_TITLE_PATTERNS.some(pattern => pattern.test(title))
}

function recommendationFor(input: {
  visibleCount: number
  hiddenDuplicateCount: number
  noisyTestCount: number
  riskCCount: number
}): string {
  if (input.visibleCount === 0) {
    return 'Keine relevante Queue sichtbar. Starte im Plan Mode mit der nächsten echten Idee.'
  }

  if (input.hiddenDuplicateCount > 0 || input.noisyTestCount > 0) {
    return 'Queue wurde verdichtet: Duplikate und Test-Rauschen sind ausgeblendet, damit nur die nächsten sinnvollen Schritte sichtbar bleiben.'
  }

  if (input.riskCCount > 0) {
    return 'Risk-C-Aufgaben bleiben bewusst sichtbar als manuelle Entscheidung, werden aber nicht autonom gestartet.'
  }

  return 'Queue ist ruhig: Die sichtbaren Einträge sind gute Kandidaten für kontrollierte Autonomie.'
}

export function buildQueueHygieneSummary(
  sortedItems: DailyAssistantQueueItem[],
  options: { maxVisible?: number } = {},
): QueueHygieneSummary {
  const maxVisible = Math.max(1, Math.min(12, options.maxVisible ?? 6))
  const seen = new Map<string, QueueDuplicateGroup>()
  const visibleItems: DailyAssistantQueueItem[] = []
  let hiddenDuplicateCount = 0
  let noisyTestCount = 0

  for (const item of sortedItems) {
    const key = normalizeTitle(item.title) || item.id
    const existing = seen.get(key)
    const noisy = isNoisyTestItem(item)

    if (existing) {
      existing.count += 1
      existing.hiddenCount += 1
      if (existing.hiddenIds.length < 5) existing.hiddenIds.push(item.id)
      hiddenDuplicateCount += 1
      if (noisy) noisyTestCount += 1
      continue
    }

    seen.set(key, {
      key,
      title: item.title,
      count: 1,
      representativeId: item.id,
      hiddenCount: 0,
      hiddenIds: [],
    })

    if (noisy && visibleItems.length >= 1) {
      noisyTestCount += 1
      continue
    }

    if (visibleItems.length < maxVisible) {
      visibleItems.push(item)
    }
  }

  const duplicateGroups = [...seen.values()]
    .filter(group => group.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const riskCCount = sortedItems.filter(item => item.riskClass === 'C' && ['pending', 'approved'].includes(item.status)).length

  return {
    visibleItems,
    duplicateGroups,
    totalItems: sortedItems.length,
    visibleCount: visibleItems.length,
    hiddenDuplicateCount,
    noisyTestCount,
    riskCCount,
    recommendation: recommendationFor({
      visibleCount: visibleItems.length,
      hiddenDuplicateCount,
      noisyTestCount,
      riskCCount,
    }),
  }
}
