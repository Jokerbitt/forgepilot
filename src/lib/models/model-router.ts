import type { ContextPrivacyMode } from './context-package'

export type ModelProvider =
  | 'ollama'
  | 'lm-studio'
  | 'codex'
  | 'claude-code'
  | 'cursor'
  | 'antigravity'
  | 'openai'
  | 'anthropic'
  | 'n8n'
  | 'local-script'
  | (string & {})

export type ModelExecutionMode = 'local' | 'desktop-agent' | 'cloud' | 'workflow'
export type ModelCostClass = 'free-local' | 'included-subscription' | 'metered-low' | 'metered-high'
export type ModelHealthStatus = 'healthy' | 'degraded' | 'offline' | 'unknown'
export type ModelWorkload =
  | 'embedding'
  | 'classification'
  | 'summarization'
  | 'context-compression'
  | 'planning'
  | 'coding'
  | 'review'
  | 'risk-analysis'
  | 'ui-design'

export interface ModelProfile {
  id: string
  provider: ModelProvider
  modelName: string
  executionMode: ModelExecutionMode
  strengths: string[]
  weaknesses: string[]
  recommendedWorkloads: ModelWorkload[]
  privacyModes: ContextPrivacyMode[]
  costClass: ModelCostClass
  healthStatus: ModelHealthStatus
  maxContextTokens?: number
  localEndpoint?: string
  updatedAt: string
}

export interface RoutingDecision {
  id: string
  taskId: string
  selectedModelProfileId: string
  selectedProvider: ModelProvider
  selectedModel: string
  workload: ModelWorkload
  reason: string
  privacyMode: ContextPrivacyMode
  estimatedCostUsd?: number
  expectedLatencyMs?: number
  requiresApproval: boolean
  fallbackModelProfileId?: string
  createdAt: string
}
