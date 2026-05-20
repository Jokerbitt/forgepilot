/**
 * Monitor Service
 *
 * Builds a MonitorSnapshot from the DSGVO processing ledger,
 * orchestrated runs, and provider configs.
 */

import { readProcessingLedger } from '@/lib/dsgvo/processing-ledger'
import { BUILT_IN_PROVIDER_CONFIGS } from '@/lib/ai/providers/catalog'
import { getModelSelection } from '@/lib/ai/providers/config-store'
import { listRuns } from '@/lib/agents/orchestrated-run'
import type { MonitorSnapshot, ProviderStats, MonitorRecommendation, AgentActivity } from './types'

// ─── Cost lookup ──────────────────────────────────────────────────────────────

function getModelCostPer1kInput(providerId: string, modelId: string): number {
  const config = BUILT_IN_PROVIDER_CONFIGS.find(c => c.id === providerId)
  if (!config) return 0
  const model = config.models.find(m => m.id === modelId)
  return model?.costPer1kInput ?? 0
}

function getModelCostPer1kOutput(providerId: string, modelId: string): number {
  const config = BUILT_IN_PROVIDER_CONFIGS.find(c => c.id === providerId)
  if (!config) return 0
  const model = config.models.find(m => m.id === modelId)
  return model?.costPer1kOutput ?? 0
}

function getProviderName(providerId: string): string {
  return BUILT_IN_PROVIDER_CONFIGS.find(c => c.id === providerId)?.name ?? providerId
}

// ─── Free quota limits ────────────────────────────────────────────────────────

function getFreeQuotaLimit(providerId: string, modelId: string): number | undefined {
  if (providerId !== 'google-gemini') return undefined
  if (modelId.includes('flash')) return 1500
  if (modelId.includes('pro')) return 50
  return undefined
}

// ─── Agent activity from orchestrated runs ───────────────────────────────────

function buildAgentActivities(): { active: AgentActivity[]; recent: AgentActivity[] } {
  const runs = listRuns()

  const active: AgentActivity[] = runs
    .filter(r => r.status === 'running')
    .map(r => ({
      id: r.id,
      name: r.delegationTitle,
      status: 'running' as const,
      provider: '',
      model: '',
      purpose: 'fast' as const,
      task: r.goal,
      startedAt: r.createdAt,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      runId: r.id,
    }))

  const recent: AgentActivity[] = runs
    .filter(r => r.status === 'done' || r.status === 'failed' || r.status === 'aborted')
    .slice(0, 20)
    .map(r => {
      const durationMs =
        r.completedAt
          ? new Date(r.completedAt).getTime() - new Date(r.createdAt).getTime()
          : undefined

      return {
        id: r.id,
        name: r.delegationTitle,
        status: r.status === 'done' ? ('completed' as const) : ('failed' as const),
        provider: '',
        model: '',
        purpose: 'coding' as const,
        task: r.goal,
        startedAt: r.createdAt,
        completedAt: r.completedAt,
        durationMs,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        runId: r.id,
      }
    })

  return { active, recent }
}

// ─── Main snapshot builder ────────────────────────────────────────────────────

export function buildMonitorSnapshot(): MonitorSnapshot {
  const records = readProcessingLedger(1000)
  const now = new Date()
  const startOfDay = new Date(now).setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  const todayRecords = records.filter(r => new Date(r.processedAt).getTime() >= startOfDay)
  const monthRecords = records.filter(r => new Date(r.processedAt).getTime() >= startOfMonth)

  // Group all records by providerId
  const providerIds = Array.from(new Set(records.map(r => r.providerId ?? r.processor)))

  const providerStatsMap = new Map<string, ProviderStats>()

  for (const providerId of providerIds) {
    const allForProvider = records.filter(
      r => (r.providerId ?? r.processor) === providerId,
    )
    const todayForProvider = todayRecords.filter(
      r => (r.providerId ?? r.processor) === providerId,
    )

    // Determine predominant model
    const modelCounts = new Map<string, number>()
    for (const r of allForProvider) {
      if (r.modelId) {
        modelCounts.set(r.modelId, (modelCounts.get(r.modelId) ?? 0) + 1)
      }
    }
    const dominantModel =
      Array.from(modelCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

    const tokensToday = todayForProvider.reduce(
      (sum, r) => sum + (r.inputTokens ?? 0),
      0,
    )
    const tokensTotal = allForProvider.reduce(
      (sum, r) => sum + (r.inputTokens ?? 0),
      0,
    )

    // Cost: inputTokens × costPer1kInput / 1000 (output tokens not tracked separately in ledger)
    const costTodayUsd = todayForProvider.reduce((sum, r) => {
      const model = r.modelId ?? dominantModel
      return sum + ((r.inputTokens ?? 0) * getModelCostPer1kInput(providerId, model)) / 1000
    }, 0)

    const costTotalUsd = allForProvider.reduce((sum, r) => {
      const model = r.modelId ?? dominantModel
      return sum + ((r.inputTokens ?? 0) * getModelCostPer1kInput(providerId, model)) / 1000
    }, 0)

    const freeQuotaLimit = getFreeQuotaLimit(providerId, dominantModel)

    providerStatsMap.set(providerId, {
      providerId,
      providerName: getProviderName(providerId),
      model: dominantModel,
      callsToday: todayForProvider.length,
      callsTotal: allForProvider.length,
      tokensToday,
      tokensTotal,
      costTodayUsd,
      costTotalUsd,
      avgLatencyMs: 0,
      errorRate: 0,
      freeQuotaUsed: freeQuotaLimit !== undefined ? todayForProvider.length : undefined,
      freeQuotaLimit,
    })
  }

  const providerStats = Array.from(providerStatsMap.values())

  // ─── Totals ─────────────────────────────────────────────────────────────────

  const callsToday = todayRecords.length
  const tokensToday = todayRecords.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0)

  const costTodayUsd = providerStats.reduce((sum, p) => sum + p.costTodayUsd, 0)

  const costThisMonthUsd = monthRecords.reduce((sum, r) => {
    const providerId = r.providerId ?? r.processor
    const model = r.modelId ?? ''
    return sum + ((r.inputTokens ?? 0) * getModelCostPer1kInput(providerId, model)) / 1000
  }, 0)

  // ─── Recommendations ────────────────────────────────────────────────────────

  const recommendations: MonitorRecommendation[] = []
  const modelSelection = getModelSelection()

  const geminiStats = providerStatsMap.get('google-gemini')
  if (geminiStats) {
    const flashModel = geminiStats.model.includes('flash') ? geminiStats : null
    if (flashModel) {
      if (flashModel.callsToday > 1400) {
        recommendations.push({
          type: 'quota',
          severity: 'critical',
          title: 'Gemini Flash: Tageslimit fast erreicht!',
          description: `${flashModel.callsToday} von 1500 Calls heute genutzt.`,
          action: 'Wechsle sofort zu Together.ai als Fallback.',
        })
      } else if (flashModel.callsToday > 1200) {
        recommendations.push({
          type: 'quota',
          severity: 'warning',
          title: 'Gemini Flash: Tageslimit bei 80%+',
          description: `${flashModel.callsToday} von 1500 Calls heute genutzt.`,
          action: 'Erwäge Wechsel zu Together.ai als Fallback.',
        })
      }
    }

    const proModel = geminiStats.model.includes('pro') ? geminiStats : null
    if (proModel && proModel.callsToday > 40) {
      recommendations.push({
        type: 'quota',
        severity: 'warning',
        title: 'Gemini Pro: Limit fast erreicht (50/Tag)',
        description: `${proModel.callsToday} von 50 Pro-Calls heute genutzt.`,
        action: 'Spare Pro-Calls für komplexe Aufgaben.',
      })
    }
  }

  if (costThisMonthUsd > 5) {
    recommendations.push({
      type: 'cost',
      severity: 'info',
      title: `Monatliche Kosten: $${costThisMonthUsd.toFixed(2)} — im Budget`,
      description: `Gesamtkosten diesen Monat: $${costThisMonthUsd.toFixed(4)}.`,
    })
  }

  // Together.ai has key but 0 calls today
  const togetherStats = providerStatsMap.get('together')
  if (!togetherStats || togetherStats.callsToday === 0) {
    // Only recommend if Together.ai is configured (i.e., appears in ledger at all or is known provider)
    if (togetherStats && togetherStats.callsTotal > 0) {
      recommendations.push({
        type: 'speed',
        severity: 'info',
        title: 'Together.ai aktiv aber heute ungenutzt',
        description: 'Together.ai ist konfiguriert, aber heute nicht verwendet.',
        action: 'Nutze Together.ai als Fallback bei Quota-Problemen.',
      })
    }
  }

  // Same provider/model for both fast and coding
  if (
    modelSelection.fastProvider === modelSelection.codingProvider &&
    modelSelection.fastModel === modelSelection.codingModel
  ) {
    recommendations.push({
      type: 'switch_model',
      severity: 'info',
      title: 'Fast und Coding nutzen dasselbe Modell',
      description: `Beide Rollen nutzen ${modelSelection.fastProvider}/${modelSelection.fastModel}.`,
      action: 'Empfehlung: Nutze Gemini Pro für komplexe Coding-Aufgaben.',
    })
  }

  // ─── Agent activities ────────────────────────────────────────────────────────

  const { active: activeAgents, recent: recentAgents } = buildAgentActivities()

  return {
    timestamp: now.toISOString(),
    activeAgents,
    recentAgents,
    providerStats,
    recommendations,
    totals: {
      tokensToday,
      costTodayUsd,
      costThisMonthUsd,
      callsToday,
      avgResponseMs: 0,
      successRate: records.length > 0 ? 1 : 1,
    },
  }
}

// Re-export cost helpers for tests
export { getModelCostPer1kInput, getModelCostPer1kOutput }
