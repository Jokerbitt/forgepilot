import type { WorkItem } from '../models/work-item'
import type { NBARecommendation, SuggestedAction } from '../models/nba'
import type { ExecutionRoute } from '../models/delegation'
import { calculateScore } from './scorer'

export function prioritizeItems(items: WorkItem[]): NBARecommendation[] {
  const recommendations: NBARecommendation[] = items.map(item => {
    const score = calculateScore(item)
    
    let suggestedAction: SuggestedAction = 'wait'
    let executionRoute: ExecutionRoute = 'manual'
    let rationale = 'Low priority item'
    const risks: string[] = []

    if (item.blocked) {
      suggestedAction = 'blocked'
      rationale = 'Item is blocked'
      if (item.blockedBy && item.blockedBy.length > 0) {
        rationale += ` by ${item.blockedBy.join(', ')}`
      }
    } else if (score.total >= 70 && score.delegability >= 15) {
      suggestedAction = 'delegate-ai'
      executionRoute = 'local-agent'
      rationale = 'High score and delegable to AI'
    } else if (score.total >= 60) {
      suggestedAction = 'do-now'
      rationale = 'High impact or urgency'
    } else if (item.type === 'ci-alert') {
      suggestedAction = 'do-now'
      rationale = 'CI alert needs immediate attention'
    }

    if (item.risk === 'C') {
      risks.push('High risk operation (Class C)')
      if (suggestedAction === 'delegate-ai') {
        suggestedAction = 'do-now'
        executionRoute = 'manual'
        rationale = 'Too risky for autonomous AI delegation'
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
  recommendations.sort((a, b) => b.score.total - a.score.total)

  return recommendations
}
