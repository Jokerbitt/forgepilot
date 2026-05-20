/**
 * M129 — Delegation Cost Tracker tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/ai/providers/config-store', () => ({
  getAllProviderConfigs: vi.fn(),
}))

import { calculateCallCost, sumCosts, checkBudget, formatCostUsd } from './cost-tracker'
import { getAllProviderConfigs } from '@/lib/ai/providers/config-store'

const mockConfigs = [
  {
    id: 'anthropic',
    models: [
      { id: 'claude-haiku-4-5',  costPer1kInput: 0.0008, costPer1kOutput: 0.004 },
      { id: 'claude-sonnet-4-5', costPer1kInput: 0.003,  costPer1kOutput: 0.015 },
    ],
  },
  {
    id: 'ollama',
    models: [
      { id: 'llama3', costPer1kInput: 0, costPer1kOutput: 0 },
    ],
  },
]

describe('calculateCallCost', () => {
  beforeEach(() => {
    vi.mocked(getAllProviderConfigs).mockReturnValue(mockConfigs as never)
  })

  it('calculates cost from token usage and model pricing', () => {
    const breakdown = calculateCallCost({
      inputTokens: 1000,
      outputTokens: 500,
      providerId: 'anthropic',
      modelId: 'claude-haiku-4-5',
    })
    // 1000 * 0.0008 / 1000 + 500 * 0.004 / 1000
    expect(breakdown.inputCostUsd).toBeCloseTo(0.0008, 6)
    expect(breakdown.outputCostUsd).toBeCloseTo(0.002, 6)
    expect(breakdown.totalCostUsd).toBeCloseTo(0.0028, 6)
    expect(breakdown.hasPricingData).toBe(true)
  })

  it('returns zero cost for Ollama (free local provider)', () => {
    const breakdown = calculateCallCost({
      inputTokens: 10000,
      outputTokens: 5000,
      providerId: 'ollama',
      modelId: 'llama3',
    })
    expect(breakdown.totalCostUsd).toBe(0)
    expect(breakdown.hasPricingData).toBe(false)
  })

  it('returns zero cost and hasPricingData=false for unknown provider', () => {
    const breakdown = calculateCallCost({
      inputTokens: 500,
      outputTokens: 200,
      providerId: 'unknown-provider',
      modelId: 'some-model',
    })
    expect(breakdown.totalCostUsd).toBe(0)
    expect(breakdown.hasPricingData).toBe(false)
  })

  it('returns zero cost and hasPricingData=false for unknown model', () => {
    const breakdown = calculateCallCost({
      inputTokens: 500,
      outputTokens: 200,
      providerId: 'anthropic',
      modelId: 'claude-4-ultra-unknown',
    })
    expect(breakdown.totalCostUsd).toBe(0)
    expect(breakdown.hasPricingData).toBe(false)
  })

  it('calculates sonnet cost correctly', () => {
    const breakdown = calculateCallCost({
      inputTokens: 2000,
      outputTokens: 800,
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-5',
    })
    // 2000 * 0.003 / 1000 + 800 * 0.015 / 1000
    expect(breakdown.inputCostUsd).toBeCloseTo(0.006, 6)
    expect(breakdown.outputCostUsd).toBeCloseTo(0.012, 6)
    expect(breakdown.totalCostUsd).toBeCloseTo(0.018, 6)
  })
})

describe('sumCosts', () => {
  it('sums total costs across multiple breakdowns', () => {
    const total = sumCosts([
      { inputCostUsd: 0.001, outputCostUsd: 0.002, totalCostUsd: 0.003, providerId: 'a', modelId: 'm', hasPricingData: true },
      { inputCostUsd: 0.005, outputCostUsd: 0.010, totalCostUsd: 0.015, providerId: 'b', modelId: 'n', hasPricingData: true },
    ])
    expect(total).toBeCloseTo(0.018, 6)
  })

  it('returns 0 for empty array', () => {
    expect(sumCosts([])).toBe(0)
  })
})

describe('checkBudget', () => {
  it('returns OK status when well under budget', () => {
    const status = checkBudget(0.10, 2.00)
    expect(status.exceeded).toBe(false)
    expect(status.warning).toBe(false)
    expect(status.usageRatio).toBeCloseTo(0.05)
    expect(status.message).toContain('5%')
  })

  it('returns warning when >= 80% of budget used', () => {
    const status = checkBudget(1.70, 2.00)
    expect(status.exceeded).toBe(false)
    expect(status.warning).toBe(true)
    expect(status.message).toContain('warning')
  })

  it('returns exceeded when over budget', () => {
    const status = checkBudget(2.50, 2.00)
    expect(status.exceeded).toBe(true)
    expect(status.warning).toBe(false)
    expect(status.message).toContain('exceeded')
  })

  it('returns "No budget set" when maxBudgetUsd is 0', () => {
    const status = checkBudget(1.00, 0)
    expect(status.exceeded).toBe(false)
    expect(status.message).toBe('No budget set')
  })

  it('usageRatio is 0 when maxBudgetUsd is 0', () => {
    const status = checkBudget(5.00, 0)
    expect(status.usageRatio).toBe(0)
  })
})

describe('formatCostUsd', () => {
  it('formats $0 correctly', () => {
    expect(formatCostUsd(0)).toBe('$0.00')
  })

  it('formats tiny amounts', () => {
    expect(formatCostUsd(0.000005)).toBe('< $0.0001')
  })

  it('formats sub-cent amounts with 4 decimals', () => {
    expect(formatCostUsd(0.0028)).toBe('$0.0028')
  })

  it('formats larger amounts with 2 decimals', () => {
    expect(formatCostUsd(1.5)).toBe('$1.50')
  })

  it('formats exactly $0.01', () => {
    expect(formatCostUsd(0.01)).toBe('$0.01')
  })
})
