import type { WorkItem } from '../models/work-item'
import type { NBAScore } from '../models/nba'
import { NBA_CONFIG } from './nba-config'

export function calculateScore(item: WorkItem): NBAScore {
  // Urgency (0-25)
  // Priority 0 = 25, 1 = 20, 2 = 15, 3 = 10, 4 = 5
  const urgencyMap: Record<number, number> = { 0: 25, 1: 20, 2: 15, 3: 10, 4: 5 }
  const urgency = urgencyMap[item.priority] ?? 0

  // Impact (0-25)
  let impact = 10
  if (item.type === 'ci-alert' || item.type === 'ticket') impact = 25
  else if (item.type === 'pr') impact = 15

  // Delegability (0-25)
  let delegability = 0
  if (item.aiDelegable && item.risk === 'A') delegability = 25
  else if (item.aiDelegable && item.risk === 'B') delegability = 15

  // Readiness (0-25)
  const readiness = item.blocked ? 0 : 25

  let baseScore = urgency + impact
  
  // Time-Decay Penalty für alte Tickets (aus Config)
  let decayPenalty = 0
  if (NBA_CONFIG.penalizeOldBacklogs && item.updatedAt) {
    const ageDays = (Date.now() - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    if (ageDays >= NBA_CONFIG.backlogPenaltyAgeDays) {
      decayPenalty = NBA_CONFIG.backlogPenaltyScore
    }
  }

  // Berechne Total-Score (Urgency + Impact + Delegability + Readiness)
  let calculatedTotal = baseScore + delegability + readiness - decayPenalty
  const total = Math.max(0, Math.min(100, calculatedTotal))

  return {
    urgency,
    impact,
    delegability,
    readiness,
    total,
  }
}
