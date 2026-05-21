import { computeSkillProfiles } from './skill-profiles'

export type ExecutionRoute = 'local-agent' | 'api-only' | 'human' | 'hybrid'

export interface RouteSuggestion {
  route: ExecutionRoute
  confidence: number // 0-1
  reason: string
  alternativeRoute?: ExecutionRoute
  alternativeReason?: string
}

const KNOWN_ROUTES: ExecutionRoute[] = ['local-agent', 'api-only', 'human', 'hybrid']

function toExecutionRoute(route: string): ExecutionRoute {
  if ((KNOWN_ROUTES as string[]).includes(route)) return route as ExecutionRoute
  return 'local-agent'
}

/**
 * Select the best execution route based on historical skill profile data.
 *
 * Composite score = successRate * 0.5 + (avgScore / 100) * 0.3 + (1 - costFactor) * 0.2
 * where successRate is normalised to 0-1 (skill-profiles stores it as 0-100).
 */
export async function selectBestRoute(_goal: string): Promise<RouteSuggestion> {
  try {
    const report = await computeSkillProfiles()

    const MIN_DELEGATIONS = 5

    if (report.routes.length === 0 || report.routes.reduce((s, r) => s + r.totalRuns, 0) < MIN_DELEGATIONS) {
      return {
        route: 'local-agent',
        confidence: 0.5,
        reason: 'Insufficient historical data — defaulting to local agent.',
      }
    }

    let bestRoute = 'local-agent'
    let bestScore = -1
    let bestProfile = report.routes[0]

    for (const profile of report.routes) {
      const successRateNorm = profile.successRate / 100
      const costFactor = Math.min(profile.avgCostUsd / 0.5, 1) // normalise at $0.50
      const composite =
        successRateNorm * 0.5 +
        (profile.avgScore / 100) * 0.3 +
        (1 - costFactor) * 0.2

      if (composite > bestScore) {
        bestScore = composite
        bestRoute = profile.route
        bestProfile = profile
      }
    }

    const confidence = Math.min(bestScore, 1)
    const reason = `${bestProfile.successRate.toFixed(0)}% success rate, avg score ${bestProfile.avgScore.toFixed(0)}/100, avg cost $${bestProfile.avgCostUsd.toFixed(3)}`

    // Find second-best as alternative
    let altRoute: ExecutionRoute | undefined
    let altScore = -1

    for (const profile of report.routes) {
      if (profile.route === bestRoute) continue
      const successRateNorm = profile.successRate / 100
      const costFactor = Math.min(profile.avgCostUsd / 0.5, 1)
      const composite =
        successRateNorm * 0.5 +
        (profile.avgScore / 100) * 0.3 +
        (1 - costFactor) * 0.2

      if (composite > altScore) {
        altScore = composite
        altRoute = toExecutionRoute(profile.route)
      }
    }

    return {
      route: toExecutionRoute(bestRoute),
      confidence,
      reason,
      alternativeRoute: altRoute,
      alternativeReason: altRoute
        ? `Alternative with ${(altScore * 100).toFixed(0)}% composite score`
        : undefined,
    }
  } catch {
    return {
      route: 'local-agent',
      confidence: 0.5,
      reason: 'Could not load skill profiles — defaulting to local agent.',
    }
  }
}
