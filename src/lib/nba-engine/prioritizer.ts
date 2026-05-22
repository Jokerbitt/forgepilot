import type { WorkItem } from '../models/work-item'
import type { NBARecommendation, SuggestedAction } from '../models/nba'
import type { ExecutionRoute } from '../models/delegation'
import { calculateScore, scoreWorkItem } from './scorer'
import { getNBAConfig } from './nba-config'
import type { WorkItem as JokWorkItem, ScoredItem, ScoringContext } from './types'

export function prioritizeItems(items: WorkItem[]): NBARecommendation[] {
  const config = getNBAConfig()
  
  // Filtern nach Status-Ignorier-Regeln aus Config
  const relevantItems = items.filter(
    (item) => !config.ignoreStatuses.includes(item.status.toLowerCase())
  )

  const recs: NBARecommendation[] = relevantItems.map(item => {
    const score = calculateScore(item)
    
    let suggestedAction: SuggestedAction = 'wait'
    let executionRoute: ExecutionRoute = 'manual'
    let rationale = 'Niedrige Priorität'
    const risks: string[] = []

    if (item.blocked) {
      suggestedAction = 'blocked'
      rationale = 'Ticket ist blockiert'
      if (item.blockedBy && item.blockedBy.length > 0) {
        rationale += ` durch ${item.blockedBy.join(', ')}`
      }
    } else if (score.total >= 70 && score.delegability >= 15) {
      suggestedAction = 'delegate-ai'
      executionRoute = 'local-agent'
      rationale = 'Hoher Score und KI-delegierbar'
    } else if (score.total >= 60) {
      suggestedAction = 'do-now'
      rationale = 'Hoher Impact oder Dringlichkeit'
    } else if (item.type === 'ci-alert') {
      suggestedAction = 'do-now'
      rationale = 'CI-Alert erfordert sofortige Aufmerksamkeit'
    }

    if (item.risk === 'C') {
      risks.push('High risk operation (Class C)')
      if (suggestedAction === 'delegate-ai') {
        suggestedAction = 'do-now'
        executionRoute = 'manual'
        rationale = 'Zu riskant für autonome KI-Delegation'
      }
    }

    return {
      workItem: item,
      score,
      suggestedAction,
      executionRoute,
      riskClass: item.risk,
      estimatedCostUsd: item.costEstimateUsd,
      rationale,
      risks
    }
  })

  // Sort descending by total score
  const sortedRecs = recs.sort((a, b) => b.score.total - a.score.total)

  // Triage Joker (Falls Config aktiv und genügend Items da sind)
  if (config.showTriageJoker && sortedRecs.length > config.maxRecommendations) {
    const oldItems = sortedRecs.slice(config.maxRecommendations).filter(rec => {
      if (!rec.workItem.updatedAt) return false
      const ageDays = (Date.now() - new Date(rec.workItem.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
      return ageDays >= config.backlogPenaltyAgeDays
    })
    
    if (oldItems.length > 0) {
      const joker = oldItems.sort((a, b) => {
        const aUpdatedAt = a.workItem.updatedAt ? new Date(a.workItem.updatedAt).getTime() : 0
        const bUpdatedAt = b.workItem.updatedAt ? new Date(b.workItem.updatedAt).getTime() : 0
        return aUpdatedAt - bUpdatedAt
      })[0]
      
      // Passe es für Triage an
      joker.suggestedAction = 'research'
      joker.rationale = 'Triage-Joker: Altes Ticket prüfen / aufräumen'
      joker.score.total = 1 // Ganz unten in den Top X, aber sichtbar
      
      // Ersetze das letzte angezeigte Element durch den Joker
      sortedRecs[config.maxRecommendations - 1] = joker
    }
  }

  return sortedRecs.slice(0, config.maxRecommendations)
}

// ─── JOK-31: prioritizeItems (simplified JOK WorkItem type) ──────────────────
// Scores all items, sorts descending, generates reasoning per item.
export function prioritizeJokItems(
  items: JokWorkItem[],
  context?: ScoringContext,
): ScoredItem[] {
  if (items.length === 0) return []

  return items
    .map((item) => {
      const score = scoreWorkItem(item, context)
      const reasoning = buildReasoning(item, score, context)
      return { item, score, reasoning }
    })
    .sort((a, b) => b.score - a.score)
}

function buildReasoning(
  item: JokWorkItem,
  score: number,
  context?: ScoringContext,
): string[] {
  const reasons: string[] = []
  const now = context?.currentDate ? new Date(context.currentDate) : new Date()

  // Priority
  const priorityLabels: Record<number, string> = {
    1: 'Urgent priority',
    2: 'High priority',
    3: 'Medium priority',
    4: 'Low priority',
    0: 'No priority set',
  }
  const priorityLabel = priorityLabels[item.priority] ?? `Priority ${item.priority}`
  reasons.push(priorityLabel)

  // Status
  const statusLower = item.status.toLowerCase()
  if (statusLower === 'in_progress' || statusLower === 'in-progress') {
    reasons.push('Currently in progress (+15)')
  } else if (statusLower === 'backlog') {
    reasons.push('In backlog (-10)')
  }

  // DueDate
  if (item.dueDate) {
    const due = new Date(item.dueDate)
    const msPerDay = 1000 * 60 * 60 * 24
    const daysUntilDue = (due.getTime() - now.getTime()) / msPerDay
    if (daysUntilDue < 0) {
      reasons.push('Overdue (+25)')
    } else if (daysUntilDue < 3) {
      reasons.push(`Due in ${Math.ceil(daysUntilDue)} day(s) (+20)`)
    } else if (daysUntilDue < 7) {
      reasons.push(`Due in ${Math.ceil(daysUntilDue)} day(s) (+10)`)
    }
  }

  // Risk class
  if (item.riskClass === 'critical') {
    reasons.push('Critical risk class (+15)')
  } else if (item.riskClass === 'high') {
    reasons.push('High risk class (+8)')
  }

  // Recency
  if (item.lastUpdated) {
    const diffHours =
      (now.getTime() - new Date(item.lastUpdated).getTime()) / (1000 * 60 * 60)
    if (diffHours <= 24) {
      reasons.push('Updated in the last 24h (+5)')
    }
  }

  // Score summary fallback if no reasons were added beyond priority
  if (reasons.length === 1) {
    reasons.push(`Total score: ${score}`)
  }

  // Return max 3 bullet points
  return reasons.slice(0, 3)
}
