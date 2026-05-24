/**
 * Tests for GET /api/onboarding/status
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { OnboardingStatus } from '@/lib/onboarding/status'

const mockStatusEmpty: OnboardingStatus = {
  hasProvider: false,
  hasCLIProvider: false,
  hasIdea: false,
  hasDelegation: false,
  isComplete: false,
  completedSteps: 0,
  totalSteps: 3,
}

const mockStatusComplete: OnboardingStatus = {
  hasProvider: true,
  hasCLIProvider: false,
  hasIdea: true,
  hasDelegation: true,
  isComplete: true,
  completedSteps: 3,
  totalSteps: 3,
}

const mockStatusPartial: OnboardingStatus = {
  hasProvider: true,
  hasCLIProvider: true,
  hasIdea: true,
  hasDelegation: false,
  isComplete: false,
  completedSteps: 2,
  totalSteps: 3,
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function makeRoute(mockStatus: OnboardingStatus) {
  vi.doMock('@/lib/onboarding/status', () => ({
    getOnboardingStatus: () => mockStatus,
  }))
  const { GET } = await import('@/app/api/onboarding/status/route')
  return { GET }
}

describe('GET /api/onboarding/status', () => {
  it('returns a status object with the expected shape', async () => {
    const { GET } = await makeRoute(mockStatusEmpty)
    const res = await GET()
    const data = await res.json() as OnboardingStatus

    expect(res.status).toBe(200)
    expect(typeof data.hasProvider).toBe('boolean')
    expect(typeof data.hasIdea).toBe('boolean')
    expect(typeof data.hasDelegation).toBe('boolean')
    expect(typeof data.isComplete).toBe('boolean')
    expect(typeof data.completedSteps).toBe('number')
    expect(data.totalSteps).toBe(3)
  })

  it('isComplete is false when no providers are configured', async () => {
    const { GET } = await makeRoute(mockStatusEmpty)
    const res = await GET()
    const data = await res.json() as OnboardingStatus

    expect(data.hasProvider).toBe(false)
    expect(data.isComplete).toBe(false)
    expect(data.completedSteps).toBe(0)
  })

  it('completedSteps increments correctly — partial state returns 2', async () => {
    const { GET } = await makeRoute(mockStatusPartial)
    const res = await GET()
    const data = await res.json() as OnboardingStatus

    expect(data.hasProvider).toBe(true)
    expect(data.hasIdea).toBe(true)
    expect(data.hasDelegation).toBe(false)
    expect(data.completedSteps).toBe(2)
    expect(data.isComplete).toBe(false)
  })

  it('returns isComplete true when all 3 steps are done', async () => {
    const { GET } = await makeRoute(mockStatusComplete)
    const res = await GET()
    const data = await res.json() as OnboardingStatus

    expect(data.isComplete).toBe(true)
    expect(data.completedSteps).toBe(3)
  })
})
