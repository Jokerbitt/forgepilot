import type { WorkItem } from '../models/work-item'
import type { NBARecommendation, SuggestedAction } from '../models/nba'
import type { ExecutionRoute } from '../models/delegation'
import { calculateScore } from './scorer'
import { getNBAConfig } from './nba-config'

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
      // Wähle ein zufälliges altes Ticket
      const randomIndex = Math.floor(Math.random() * oldItems.length)
      const joker = oldItems[randomIndex]
      
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
