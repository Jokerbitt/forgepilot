import type { AIModelDef, AIProviderConfig, ModelPurpose } from '@/lib/ai/providers/types'
import type {
  ModelCostClass,
  ModelExecutionMode,
  ModelProfile,
  ModelWorkload,
} from '@/lib/models/model-router'
import type { ContextPrivacyMode } from '@/lib/models/context-package'

const CLOUD_PRIVACY_MODES: ContextPrivacyMode[] = ['hybrid', 'cloud-approved']
const LOCAL_PRIVACY_MODES: ContextPrivacyMode[] = ['local-only', 'hybrid', 'cloud-approved']

const PURPOSE_WORKLOADS: Record<ModelPurpose, ModelWorkload[]> = {
  fast: ['classification', 'summarization'],
  coding: ['coding', 'review', 'risk-analysis', 'planning'],
  embedding: ['embedding'],
  both: ['classification', 'summarization', 'context-compression', 'coding', 'review'],
}

function workloadsFor(config: AIProviderConfig, model: AIModelDef): ModelWorkload[] {
  if (config.id === 'lm-studio' && model.id === 'local-model') {
    return ['classification', 'summarization', 'context-compression']
  }
  return PURPOSE_WORKLOADS[model.purpose]
}

function executionModeForProvider(config: AIProviderConfig): ModelExecutionMode {
  return config.dataResidency === 'local' ? 'local' : 'cloud'
}

function privacyModesForProvider(config: AIProviderConfig): ContextPrivacyMode[] {
  return config.dataResidency === 'local' ? LOCAL_PRIVACY_MODES : CLOUD_PRIVACY_MODES
}

function costClassForModel(config: AIProviderConfig, model: AIModelDef): ModelCostClass {
  if (config.dataResidency === 'local') return 'free-local'

  const input = model.costPer1kInput ?? 0
  const output = model.costPer1kOutput ?? 0
  if (input >= 0.003 || output >= 0.01) return 'metered-high'
  return 'metered-low'
}

function strengthsFor(config: AIProviderConfig, model: AIModelDef): string[] {
  const strengths = new Set<string>()
  if (config.dataResidency === 'local') {
    strengths.add('local-first')
    strengths.add('private')
    strengths.add('no-api-key')
  }
  if (model.purpose === 'embedding') strengths.add('embeddings')
  if (model.purpose === 'coding') strengths.add('coding')
  if (model.purpose === 'fast') strengths.add('fast')
  if (model.purpose === 'both') strengths.add('general-purpose')
  if (model.isFree || config.freeTier) strengths.add('low-cost')
  return Array.from(strengths)
}

function weaknessesFor(config: AIProviderConfig, model: AIModelDef): string[] {
  const weaknesses = new Set<string>()
  if (config.dataResidency !== 'local') weaknesses.add('cloud-only')
  if (config.freeTier?.verification?.status === 'unverified') weaknesses.add('volatile-free-tier')
  if (model.contextWindow && model.contextWindow < 16000) weaknesses.add('short-context')
  return Array.from(weaknesses)
}

function profileId(providerId: string, modelId: string): string {
  return `${providerId}-${modelId}`.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

export function buildModelProfileFromProviderModel(
  config: AIProviderConfig,
  model: AIModelDef,
  now = new Date().toISOString(),
): ModelProfile {
  const localEndpoint = config.dataResidency === 'local' ? config.baseUrl : undefined

  return {
    id: profileId(config.id, model.id),
    provider: config.id,
    modelName: model.id,
    executionMode: executionModeForProvider(config),
    strengths: strengthsFor(config, model),
    weaknesses: weaknessesFor(config, model),
    recommendedWorkloads: workloadsFor(config, model),
    privacyModes: privacyModesForProvider(config),
    costClass: costClassForModel(config, model),
    healthStatus: 'unknown',
    maxContextTokens: model.contextWindow,
    localEndpoint,
    updatedAt: now,
  }
}

export function buildModelProfilesFromProviderConfigs(
  configs: AIProviderConfig[],
  now = new Date().toISOString(),
): ModelProfile[] {
  return configs.flatMap(config =>
    config.models.map(model => buildModelProfileFromProviderModel(config, model, now)),
  )
}

export const DESKTOP_AGENT_PROFILES: ModelProfile[] = [
  {
    id: 'claude-code-agent',
    provider: 'claude-code',
    modelName: 'claude-code',
    executionMode: 'desktop-agent',
    strengths: ['coding', 'refactoring', 'tests', 'file-editing'],
    weaknesses: ['subscription-based', 'interactive'],
    recommendedWorkloads: ['coding', 'review'],
    privacyModes: ['hybrid', 'cloud-approved'],
    costClass: 'included-subscription',
    healthStatus: 'healthy',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'codex-agent',
    provider: 'codex',
    modelName: 'codex',
    executionMode: 'desktop-agent',
    strengths: ['architecture', 'implementation', 'tests', 'repo-navigation'],
    weaknesses: ['subscription-based', 'interactive'],
    recommendedWorkloads: ['coding', 'review', 'planning'],
    privacyModes: ['hybrid', 'cloud-approved'],
    costClass: 'included-subscription',
    healthStatus: 'healthy',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ollama-hermes-local',
    provider: 'ollama',
    modelName: process.env.FORGEPILOT_HERMES_MODEL || 'nous-hermes2:latest',
    executionMode: 'local',
    strengths: ['local-first', 'private', 'no-api-key', 'critique', 'planning'],
    weaknesses: ['requires-local-model-availability', 'not-a-writer-by-default'],
    recommendedWorkloads: ['review', 'risk-analysis', 'planning', 'summarization'],
    privacyModes: ['local-only', 'hybrid', 'cloud-approved'],
    costClass: 'free-local',
    healthStatus: 'unknown',
    localEndpoint: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'openclaw-agent',
    provider: 'openclaw',
    modelName: 'openclaw',
    executionMode: 'desktop-agent',
    strengths: ['external-coding-agent', 'implementation-drafts', 'repo-navigation'],
    weaknesses: ['disabled-until-configured', 'requires-review-before-merge'],
    recommendedWorkloads: ['coding', 'review'],
    privacyModes: ['hybrid', 'cloud-approved'],
    costClass: 'included-subscription',
    healthStatus: process.env.OPENCLAW_ENDPOINT || process.env.OPENCLAW_CLI ? 'unknown' : 'offline',
    updatedAt: new Date().toISOString(),
  },
]
