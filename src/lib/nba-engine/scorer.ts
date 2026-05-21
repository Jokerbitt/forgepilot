import type { WorkItem } from '../models/work-item'
import type { NBAScore } from '../models/nba'
import { getNBAConfig } from './nba-config'
import type { WorkItem as JokWorkItem, ScoringContext } from './types'

// ─── JOK-31: scoreWorkItem ────────────────────────────────────────────────────
// Pure scoring function for the simplified JOK WorkItem type.
// Returns a score 0–100 based on priority, status, dueDate, riskClass, recency.
export function scoreWorkItem(item: JokWorkItem, context?: ScoringContext): number {
  const now = context?.currentDate ? new Date(context.currentDate) : new Date()
  let score = 0

  // Priority: 0=None(0), 4=Low(10), 3=Medium(20), 2=High(35), 1=Urgent(50)
  const priorityPoints: Record<number, number> = { 0: 0, 4: 10, 3: 20, 2: 35, 1: 50 }
  score += priorityPoints[item.priority] ?? 0

  // Status bonuses/penalties
  const statusLower = item.status.toLowerCase()
  if (statusLower === 'in_progress' || statusLower === 'in-progress') {
    score += 15
  } else if (statusLower === 'backlog') {
    score -= 10
  }

  // DueDate proximity
  if (item.dueDate) {
    const due = new Date(item.dueDate)
    const msPerDay = 1000 * 60 * 60 * 24
    const daysUntilDue = (due.getTime() - now.getTime()) / msPerDay

    if (daysUntilDue < 0) {
      score += 25 // overdue
    } else if (daysUntilDue < 3) {
      score += 20 // due in < 3 days
    } else if (daysUntilDue < 7) {
      score += 10 // due in < 7 days
    }
  }

  // Risk class bonus
  const riskPoints: Record<string, number> = {
    critical: 15,
    high: 8,
    medium: 3,
    low: 0,
  }
  if (item.riskClass) {
    score += riskPoints[item.riskClass] ?? 0
  }

  // Recency: updated in last 24h +5
  if (item.lastUpdated) {
    const updatedMs = new Date(item.lastUpdated).getTime()
    const diffHours = (now.getTime() - updatedMs) / (1000 * 60 * 60)
    if (diffHours <= 24) {
      score += 5
    }
  }

  return Math.max(0, Math.min(100, score))
}

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
  const config = getNBAConfig()
  
  if (config.penalizeOldBacklogs && item.updatedAt) {
    const ageDays = (Date.now() - new Date(item.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
    if (ageDays >= config.backlogPenaltyAgeDays) {
      decayPenalty = config.backlogPenaltyScore
    }
  }

  // Pinned Items boost
  const isPinned = config.pinnedItems.includes(item.id)
  if (isPinned) {
    baseScore += 1000 // Boost pinned items to the very top
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
