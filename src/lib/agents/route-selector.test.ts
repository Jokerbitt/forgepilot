import { describe, it, expect, vi } from 'vitest'
import { selectBestRoute } from './route-selector'

vi.mock('./skill-profiles', () => ({
  computeSkillProfiles: vi.fn(async () => ({
    generatedAt: new Date().toISOString(),
    routes: [
      {
        route: 'local-agent',
        totalRuns: 15,
        successRate: 87,
        avgScore: 78,
        avgCostUsd: 0.05,
        failurePatterns: [],
        recommendedFor: [],
      },
      {
        route: 'api-only',
        totalRuns: 5,
        successRate: 60,
        avgScore: 65,
        avgCostUsd: 0.12,
        failurePatterns: [],
        recommendedFor: [],
      },
    ],
    recommendation: {
      bestForQuality: 'local-agent',
      bestForCost: 'local-agent',
      bestForReliability: 'local-agent',
    },
  })),
}))

describe('selectBestRoute', () => {
  it('returns a RouteSuggestion with required fields', async () => {
    const suggestion = await selectBestRoute('Build a new feature')
    expect(suggestion).toHaveProperty('route')
    expect(suggestion).toHaveProperty('confidence')
    expect(suggestion).toHaveProperty('reason')
    expect(['local-agent', 'api-only', 'human', 'hybrid']).toContain(suggestion.route)
  })

  it('prefers local-agent when it has higher success rate', async () => {
    const suggestion = await selectBestRoute('Refactor code')
    expect(suggestion.route).toBe('local-agent')
  })

  it('confidence is between 0 and 1', async () => {
    const suggestion = await selectBestRoute('Refactor code')
    expect(suggestion.confidence).toBeGreaterThanOrEqual(0)
    expect(suggestion.confidence).toBeLessThanOrEqual(1)
  })

  it('provides an alternative route', async () => {
    const suggestion = await selectBestRoute('Build a new feature')
    expect(suggestion.alternativeRoute).toBe('api-only')
    expect(suggestion.alternativeReason).toBeDefined()
  })

  it('returns default when insufficient data', async () => {
    const { computeSkillProfiles } = await import('./skill-profiles')
    vi.mocked(computeSkillProfiles).mockResolvedValueOnce({
      generatedAt: new Date().toISOString(),
      routes: [],
      recommendation: {
        bestForQuality: null,
        bestForCost: null,
        bestForReliability: null,
      },
    })
    const suggestion = await selectBestRoute('Goal')
    expect(suggestion.route).toBe('local-agent')
    expect(suggestion.confidence).toBe(0.5)
  })

  it('falls back gracefully when computeSkillProfiles throws', async () => {
    const { computeSkillProfiles } = await import('./skill-profiles')
    vi.mocked(computeSkillProfiles).mockRejectedValueOnce(new Error('DB error'))
    const suggestion = await selectBestRoute('Goal')
    expect(suggestion.route).toBe('local-agent')
    expect(suggestion.confidence).toBe(0.5)
  })
})
