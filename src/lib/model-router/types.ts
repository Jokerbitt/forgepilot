export type {
  ModelProvider,
  ModelExecutionMode,
  ModelCostClass,
  ModelHealthStatus,
  ModelWorkload,
  ModelProfile,
  RoutingDecision,
} from '@/lib/models/model-router'

export type { ContextPrivacyMode } from '@/lib/models/context-package'

export interface ProviderHealthResult {
  provider: string
  endpoint: string
  status: import('@/lib/models/model-router').ModelHealthStatus
  latencyMs?: number
  availableModels?: string[]
  checkedAt: string
  error?: string
}

export interface RouteTaskInput {
  taskId: string
  workload: import('@/lib/models/model-router').ModelWorkload
  privacyMode: import('@/lib/models/context-package').ContextPrivacyMode
  preferLocal?: boolean
  requiredModelId?: string
}
