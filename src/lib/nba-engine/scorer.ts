import type { WorkItem } from '../models/work-item'
import type { NBAScore } from '../models/nba'

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

  // Calculate total, ensuring it doesn't exceed 100
  const total = Math.min(100, urgency + impact + delegability + readiness)

  return {
    urgency,
    impact,
    delegability,
    readiness,
    total
  }
}
