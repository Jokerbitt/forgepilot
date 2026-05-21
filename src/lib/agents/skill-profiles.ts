import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import type { Delegation } from '@/lib/models/delegation'

export interface RoutePerformance {
  route: string
  totalRuns: number
  successRate: number    // 0-100
  avgScore: number       // 0-100, avg CriticScore
  avgCostUsd: number
  failurePatterns: string[]  // Common error message patterns
  recommendedFor: string[]   // Task types this route excels at
}

export interface SkillProfileReport {
  generatedAt: string
  routes: RoutePerformance[]
  recommendation: {
    bestForQuality: string | null
    bestForCost: string | null
    bestForReliability: string | null
  }
}

/**
 * Compute skill profiles for all execution routes based on historical delegation data.
 */
export async function computeSkillProfiles(): Promise<SkillProfileReport> {
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const all = await repo.listByStatus()
  const executed = all.filter(d => d.status === 'completed' || d.status === 'failed')

  // Group by route
  const routeMap = new Map<string, Delegation[]>()
  for (const d of executed) {
    const route = d.executionRoute ?? 'unknown'
    const list = routeMap.get(route) ?? []
    list.push(d)
    routeMap.set(route, list)
  }

  const routes: RoutePerformance[] = []

  for (const [route, delegations] of routeMap) {
    const completed = delegations.filter(d => d.status === 'completed')
    const failed = delegations.filter(d => d.status === 'failed')
    const withScores = completed.filter(d => d.criticScore)

    const successRate = delegations.length > 0
      ? Math.round((completed.length / delegations.length) * 100)
      : 0

    const avgScore = withScores.length > 0
      ? Math.round(withScores.reduce((s, d) => {
          const cs = d.criticScore!
          return s + (cs.correctness + cs.efficiency + (100 - cs.drift)) / 3
        }, 0) / withScores.length)
      : 0

    const avgCostUsd = delegations.length > 0
      ? Math.round(delegations.reduce((s, d) => s + (d.actualCostUsd ?? d.costEstimateUsd ?? 0), 0) / delegations.length * 10000) / 10000
      : 0

    // Extract common failure patterns from error messages
    const errorMessages = failed
      .map(d => d.errorMessage ?? '')
      .filter(Boolean)
    const failurePatterns = extractPatterns(errorMessages)

    routes.push({
      route,
      totalRuns: delegations.length,
      successRate,
      avgScore,
      avgCostUsd,
      failurePatterns,
      recommendedFor: inferRecommendations(route, successRate, avgScore),
    })
  }

  // Sort by total runs desc
  routes.sort((a, b) => b.totalRuns - a.totalRuns)

  const recommendation = {
    bestForQuality: routes.length > 0
      ? (routes.reduce((best, r) => r.avgScore > best.avgScore ? r : best, routes[0])?.route ?? null)
      : null,
    bestForCost: routes.length > 0
      ? (routes.reduce((best, r) => r.avgCostUsd < best.avgCostUsd ? r : best, routes[0])?.route ?? null)
      : null,
    bestForReliability: routes.length > 0
      ? (routes.reduce((best, r) => r.successRate > best.successRate ? r : best, routes[0])?.route ?? null)
      : null,
  }

  return {
    generatedAt: new Date().toISOString(),
    routes,
    recommendation,
  }
}

function extractPatterns(messages: string[]): string[] {
  if (messages.length === 0) return []
  // Simple frequency-based pattern extraction
  const words = messages.join(' ').toLowerCase().split(/\W+/).filter(w => w.length > 4)
  const freq = new Map<string, number>()
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  return Array.from(freq.entries())
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word)
}

function inferRecommendations(route: string, successRate: number, avgScore: number): string[] {
  const recs: string[] = []
  if (successRate >= 80) recs.push('reliable tasks')
  if (avgScore >= 75) recs.push('quality-sensitive work')
  if (route === 'local-agent') recs.push('code generation', 'refactoring')
  if (route === 'ollama-agent') recs.push('offline work', 'cost-sensitive tasks')
  if (route === 'n8n') recs.push('automation workflows', 'integrations')
  if (route === 'direct-chat') recs.push('research', 'documentation')
  if (route === 'manual') recs.push('complex decisions', 'design tasks')
  return recs
}
