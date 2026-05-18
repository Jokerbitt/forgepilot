import { randomUUID } from 'crypto'
import type { ModelProfile, ModelWorkload, RoutingDecision } from '@/lib/models/model-router'
import type { ContextPrivacyMode } from '@/lib/models/context-package'
import type { RouteTaskInput } from './types'
import { getProfiles } from './store'

const PRIVACY_RANK: Record<ContextPrivacyMode, number> = {
  'local-only': 0,
  hybrid: 1,
  'cloud-approved': 2,
}

const WORKLOAD_LOCAL_PREFERENCE: Record<ModelWorkload, boolean> = {
  embedding: true,
  classification: true,
  summarization: true,
  'context-compression': true,
  planning: false,
  coding: false,
  review: false,
  'risk-analysis': false,
  'ui-design': false,
}

function profileAllowedByPrivacy(
  profile: ModelProfile,
  privacyMode: ContextPrivacyMode,
): boolean {
  return profile.privacyModes.includes(privacyMode)
}

function profileSupportsWorkload(profile: ModelProfile, workload: ModelWorkload): boolean {
  return profile.recommendedWorkloads.includes(workload)
}

function profileScore(
  profile: ModelProfile,
  workload: ModelWorkload,
  preferLocal: boolean,
): number {
  let score = 0
  if (profileSupportsWorkload(profile, workload)) score += 10
  if (profile.executionMode === 'local' && preferLocal) score += 5
  if (profile.executionMode === 'cloud' && !preferLocal) score += 3
  if (profile.costClass === 'free-local') score += 2
  if (profile.healthStatus === 'healthy') score += 4
  if (profile.healthStatus === 'offline') score -= 20
  return score
}

export function routeTask(input: RouteTaskInput): RoutingDecision {
  const { taskId, workload, privacyMode, preferLocal } = input
  const profiles = getProfiles()

  const privacyRank = PRIVACY_RANK[privacyMode]
  const forceLocal = privacyRank === 0
  const preferLocalFinal = forceLocal || preferLocal || WORKLOAD_LOCAL_PREFERENCE[workload]

  const eligible = profiles.filter(p => {
    if (!profileAllowedByPrivacy(p, privacyMode)) return false
    if (forceLocal && p.executionMode !== 'local') return false
    return true
  })

  if (eligible.length === 0) {
    return buildFallbackDecision(taskId, workload, privacyMode)
  }

  const ranked = [...eligible].sort(
    (a, b) => profileScore(b, workload, preferLocalFinal) - profileScore(a, workload, preferLocalFinal),
  )

  const selected = ranked[0]
  const fallback = ranked[1]

  const requiresApproval =
    selected.executionMode === 'cloud' && privacyMode !== 'cloud-approved'

  const reason = buildReason(selected, workload, privacyMode, forceLocal)

  return {
    id: randomUUID(),
    taskId,
    selectedModelProfileId: selected.id,
    selectedProvider: selected.provider,
    selectedModel: selected.modelName,
    workload,
    reason,
    privacyMode,
    requiresApproval,
    fallbackModelProfileId: fallback?.id,
    createdAt: new Date().toISOString(),
  }
}

function buildReason(
  profile: ModelProfile,
  workload: ModelWorkload,
  privacyMode: ContextPrivacyMode,
  forceLocal: boolean,
): string {
  const parts: string[] = []
  if (forceLocal) parts.push('Privacy mode is local-only — cloud providers excluded.')
  if (profile.executionMode === 'local') parts.push(`Selected local model (${profile.modelName}) for low cost and privacy.`)
  else parts.push(`Selected ${profile.provider} (${profile.modelName}) for workload capability.`)
  parts.push(`Workload: ${workload}.`)
  if (profile.recommendedWorkloads.includes(workload)) parts.push('Model is recommended for this workload.')
  parts.push(`Privacy mode: ${privacyMode}.`)
  return parts.join(' ')
}

function buildFallbackDecision(
  taskId: string,
  workload: ModelWorkload,
  privacyMode: ContextPrivacyMode,
): RoutingDecision {
  return {
    id: randomUUID(),
    taskId,
    selectedModelProfileId: 'anthropic-haiku',
    selectedProvider: 'anthropic',
    selectedModel: 'claude-haiku-4-5',
    workload,
    reason: `No eligible profile found for privacy mode "${privacyMode}". Falling back to Anthropic Haiku — requires cloud-approved mode.`,
    privacyMode,
    requiresApproval: privacyMode !== 'cloud-approved',
    createdAt: new Date().toISOString(),
  }
}
