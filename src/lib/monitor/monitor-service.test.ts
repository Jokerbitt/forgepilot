/**
 * Monitor Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMonitorSnapshot, getModelCostPer1kInput } from './monitor-service'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/lib/dsgvo/processing-ledger', () => ({
  readProcessingLedger: vi.fn(),
}))

vi.mock('@/lib/ai/providers/config-store', () => ({
  getModelSelection: vi.fn(),
}))

vi.mock('@/lib/agents/orchestrated-run', () => ({
  listRuns: vi.fn(),
}))

import { readProcessingLedger } from '@/lib/dsgvo/processing-ledger'
import { getModelSelection } from '@/lib/ai/providers/config-store'
import { listRuns } from '@/lib/agents/orchestrated-run'

const mockReadLedger = vi.mocked(readProcessingLedger)
const mockGetModelSelection = vi.mocked(getModelSelection)
const mockListRuns = vi.mocked(listRuns)

const DEFAULT_SELECTION = {
  fastProvider: 'anthropic',
  fastModel: 'claude-haiku-4-5',
  codingProvider: 'anthropic',
  codingModel: 'claude-sonnet-4-5',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockReadLedger.mockReturnValue([])
  mockGetModelSelection.mockReturnValue(DEFAULT_SELECTION)
  mockListRuns.mockReturnValue([])
})

// ─── Test 1: buildMonitorSnapshot returns object with all required fields ─────

describe('buildMonitorSnapshot()', () => {
  it('returns an object with all required fields', () => {
    const snapshot = buildMonitorSnapshot()

    expect(snapshot).toHaveProperty('timestamp')
    expect(snapshot).toHaveProperty('activeAgents')
    expect(snapshot).toHaveProperty('recentAgents')
    expect(snapshot).toHaveProperty('providerStats')
    expect(snapshot).toHaveProperty('recommendations')
    expect(snapshot).toHaveProperty('totals')
    expect(snapshot.totals).toHaveProperty('tokensToday')
    expect(snapshot.totals).toHaveProperty('costTodayUsd')
    expect(snapshot.totals).toHaveProperty('costThisMonthUsd')
    expect(snapshot.totals).toHaveProperty('callsToday')
    expect(snapshot.totals).toHaveProperty('avgResponseMs')
    expect(snapshot.totals).toHaveProperty('successRate')

    expect(Array.isArray(snapshot.activeAgents)).toBe(true)
    expect(Array.isArray(snapshot.recentAgents)).toBe(true)
    expect(Array.isArray(snapshot.providerStats)).toBe(true)
    expect(Array.isArray(snapshot.recommendations)).toBe(true)
  })

  // ─── Test 2: Cost calculation for Gemini Flash ──────────────────────────────

  it('calculates cost correctly: 1000 inputTokens at google-gemini flash → $0.0001', () => {
    // costPer1kInput for gemini-2.0-flash = 0.0001
    // 1000 tokens × 0.0001 / 1000 = 0.0001 USD
    const today = new Date().toISOString()
    mockReadLedger.mockReturnValue([
      {
        id: 'rec-1',
        purpose: 'test',
        dataTypes: ['code'],
        processor: 'google-gemini',
        legalBasis: 'legitimate-interest' as const,
        piiDetected: false,
        piiCategories: [],
        piiRedacted: false,
        piiCount: 0,
        dataResidency: 'us' as const,
        providerId: 'google-gemini',
        modelId: 'gemini-2.0-flash',
        inputTokens: 1000,
        retentionDays: 1825,
        processedAt: today,
      },
    ])

    const snapshot = buildMonitorSnapshot()
    const geminiStats = snapshot.providerStats.find(p => p.providerId === 'google-gemini')

    expect(geminiStats).toBeDefined()
    // 1000 tokens × 0.0001 / 1000 = 0.0001
    expect(geminiStats!.costTodayUsd).toBeCloseTo(0.0001, 7)
  })

  // ─── Test 3: Recommendation triggered when callsToday > 1200 ────────────────

  it('generates WARNING recommendation when gemini-flash calls today > 1200', () => {
    const today = new Date()
    today.setHours(12, 0, 0, 0)

    // Generate 1201 ledger records for gemini flash today
    const records = Array.from({ length: 1201 }, (_, i) => ({
      id: `rec-${i}`,
      purpose: 'test',
      dataTypes: ['code'],
      processor: 'google-gemini',
      legalBasis: 'legitimate-interest' as const,
      piiDetected: false,
      piiCategories: [],
      piiRedacted: false,
      piiCount: 0,
      dataResidency: 'us' as const,
      providerId: 'google-gemini',
      modelId: 'gemini-2.0-flash',
      inputTokens: 100,
      retentionDays: 1825,
      processedAt: today.toISOString(),
    }))

    mockReadLedger.mockReturnValue(records)

    const snapshot = buildMonitorSnapshot()
    const warningRec = snapshot.recommendations.find(
      r => r.severity === 'warning' && r.type === 'quota',
    )

    expect(warningRec).toBeDefined()
    expect(warningRec!.title).toContain('Gemini Flash')
  })

  // ─── Test 4: Empty ledger → no critical recommendations ──────────────────────

  it('returns no critical recommendations for empty ledger', () => {
    mockReadLedger.mockReturnValue([])

    const snapshot = buildMonitorSnapshot()
    const critical = snapshot.recommendations.filter(r => r.severity === 'critical')

    expect(critical).toHaveLength(0)
  })

  // ─── Test 5: providerStats has correct providerId ────────────────────────────

  it('providerStats includes correct providerId for each provider', () => {
    const today = new Date().toISOString()
    mockReadLedger.mockReturnValue([
      {
        id: 'rec-a',
        purpose: 'test',
        dataTypes: [],
        processor: 'anthropic',
        legalBasis: 'legitimate-interest' as const,
        piiDetected: false,
        piiCategories: [],
        piiRedacted: false,
        piiCount: 0,
        dataResidency: 'us' as const,
        providerId: 'anthropic',
        modelId: 'claude-haiku-4-5',
        inputTokens: 500,
        retentionDays: 1825,
        processedAt: today,
      },
      {
        id: 'rec-b',
        purpose: 'test',
        dataTypes: [],
        processor: 'groq',
        legalBasis: 'legitimate-interest' as const,
        piiDetected: false,
        piiCategories: [],
        piiRedacted: false,
        piiCount: 0,
        dataResidency: 'us' as const,
        providerId: 'groq',
        modelId: 'llama-3.1-8b-instant',
        inputTokens: 200,
        retentionDays: 1825,
        processedAt: today,
      },
    ])

    const snapshot = buildMonitorSnapshot()
    const providerIds = snapshot.providerStats.map(p => p.providerId)

    expect(providerIds).toContain('anthropic')
    expect(providerIds).toContain('groq')

    const anthropicStats = snapshot.providerStats.find(p => p.providerId === 'anthropic')
    expect(anthropicStats!.providerId).toBe('anthropic')
    expect(anthropicStats!.providerName).toBe('Anthropic (Claude)')
  })

  // ─── Test 6: totals.callsToday equals sum of all provider callsToday ─────────

  it('totals.callsToday equals sum of all provider callsToday', () => {
    const today = new Date().toISOString()
    mockReadLedger.mockReturnValue([
      {
        id: 'rec-1',
        purpose: 'test',
        dataTypes: [],
        processor: 'anthropic',
        legalBasis: 'legitimate-interest' as const,
        piiDetected: false,
        piiCategories: [],
        piiRedacted: false,
        piiCount: 0,
        dataResidency: 'us' as const,
        providerId: 'anthropic',
        modelId: 'claude-haiku-4-5',
        inputTokens: 100,
        retentionDays: 1825,
        processedAt: today,
      },
      {
        id: 'rec-2',
        purpose: 'test',
        dataTypes: [],
        processor: 'anthropic',
        legalBasis: 'legitimate-interest' as const,
        piiDetected: false,
        piiCategories: [],
        piiRedacted: false,
        piiCount: 0,
        dataResidency: 'us' as const,
        providerId: 'anthropic',
        modelId: 'claude-haiku-4-5',
        inputTokens: 100,
        retentionDays: 1825,
        processedAt: today,
      },
      {
        id: 'rec-3',
        purpose: 'test',
        dataTypes: [],
        processor: 'groq',
        legalBasis: 'legitimate-interest' as const,
        piiDetected: false,
        piiCategories: [],
        piiRedacted: false,
        piiCount: 0,
        dataResidency: 'us' as const,
        providerId: 'groq',
        modelId: 'llama-3.1-8b-instant',
        inputTokens: 50,
        retentionDays: 1825,
        processedAt: today,
      },
    ])

    const snapshot = buildMonitorSnapshot()

    const sumFromProviders = snapshot.providerStats.reduce(
      (sum, p) => sum + p.callsToday,
      0,
    )
    expect(snapshot.totals.callsToday).toBe(3)
    expect(snapshot.totals.callsToday).toBe(sumFromProviders)
  })
})
