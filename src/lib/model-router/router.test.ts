import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ModelProfile } from '@/lib/models/model-router'

vi.mock('./store', () => ({
  getProfiles: vi.fn(),
  saveDecision: vi.fn((d) => d),
}))

import * as store from './store'
import { routeTask } from './router'
import { DEFAULT_PROFILES } from './profiles'

function healthyProfiles(overrides: Partial<ModelProfile>[] = []): ModelProfile[] {
  return DEFAULT_PROFILES.map(p => ({
    ...p,
    healthStatus: 'healthy' as const,
    ...overrides.find(o => o.id === p.id),
  }))
}

beforeEach(() => {
  vi.mocked(store.getProfiles).mockReturnValue(healthyProfiles())
})

describe('routeTask', () => {
  it('routes embedding workload to local ollama', () => {
    const decision = routeTask({
      taskId: 't-1',
      workload: 'embedding',
      privacyMode: 'hybrid',
    })
    expect(decision.selectedProvider).toBe('ollama')
    expect(decision.workload).toBe('embedding')
    expect(decision.requiresApproval).toBe(false)
    expect(decision.id).toBeTruthy()
    expect(decision.createdAt).toBeTruthy()
  })

  it('routes coding workload to non-local provider in cloud-approved mode', () => {
    const decision = routeTask({
      taskId: 't-2',
      workload: 'coding',
      privacyMode: 'cloud-approved',
    })
    expect(['anthropic', 'claude-code']).toContain(decision.selectedProvider)
  })

  it('forces local provider for local-only privacy mode', () => {
    const decision = routeTask({
      taskId: 't-3',
      workload: 'coding',
      privacyMode: 'local-only',
    })
    expect(decision.selectedProvider).toBe('ollama')
  })

  it('sets requiresApproval true when cloud provider selected in hybrid mode', () => {
    vi.mocked(store.getProfiles).mockReturnValue(
      healthyProfiles().filter(p => p.executionMode !== 'local'),
    )
    const decision = routeTask({
      taskId: 't-4',
      workload: 'planning',
      privacyMode: 'hybrid',
    })
    expect(decision.requiresApproval).toBe(true)
  })

  it('sets fallbackModelProfileId when multiple profiles available', () => {
    const decision = routeTask({
      taskId: 't-5',
      workload: 'summarization',
      privacyMode: 'cloud-approved',
    })
    expect(decision.fallbackModelProfileId).toBeTruthy()
  })

  it('builds fallback decision when no eligible profiles', () => {
    vi.mocked(store.getProfiles).mockReturnValue([])
    const decision = routeTask({
      taskId: 't-6',
      workload: 'coding',
      privacyMode: 'local-only',
    })
    expect(decision.reason).toContain('No eligible profile')
    expect(decision.selectedModel).toBe('claude-haiku-4-5')
  })

  it('includes reason string in decision', () => {
    const decision = routeTask({
      taskId: 't-7',
      workload: 'classification',
      privacyMode: 'hybrid',
    })
    expect(decision.reason.length).toBeGreaterThan(10)
    expect(decision.reason).toContain('classification')
  })

  it('prefers local model over cloud when preferLocal is set for a locally-supported workload', () => {
    const decision = routeTask({
      taskId: 't-8',
      workload: 'summarization',
      privacyMode: 'cloud-approved',
      preferLocal: true,
    })
    expect(decision.selectedProvider).toBe('ollama')
  })
})
