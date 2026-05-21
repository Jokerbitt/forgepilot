import { describe, it, expect, vi } from 'vitest'
import { notifyExecutionResult } from './index'
import type { Delegation } from '@/lib/models/delegation'

const mockDelegation: Delegation = {
  id: 'del-1',
  title: 'Test',
  status: 'completed',
  executionRoute: 'local-agent',
  costEstimateUsd: 0,
  autoOrchestrate: false,
  contract: { riskClass: 'B', goal: 'test', acceptanceCriteria: [] } as never,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('notifyExecutionResult', () => {
  it('does nothing when no channels configured', async () => {
    // No env vars set — should not throw
    await expect(notifyExecutionResult({ delegation: mockDelegation, event: 'completed' }))
      .resolves.toBeUndefined()
  })

  it('handles telegram API error gracefully', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'token')
    vi.stubEnv('TELEGRAM_CHAT_ID', '123')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    // Should not throw even when API fails
    await expect(notifyExecutionResult({ delegation: mockDelegation, event: 'failed' }))
      .resolves.toBeUndefined()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
})
