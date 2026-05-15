export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type TraceEventType = 'tool_call' | 'tool_result' | 'message' | 'error' | 'cost_update' | 'status_change'

export interface TraceEvent {
  id: string
  agentRunId: string
  type: TraceEventType
  timestamp: string
  data: Record<string, unknown>
  costUsd?: number
}

export interface AgentRun {
  id: string
  delegationId: string
  contractId: string
  status: AgentRunStatus
  model: string
  startedAt: string
  completedAt?: string
  totalCostUsd: number
  tokenInput: number
  tokenOutput: number
  traceEvents: TraceEvent[]
  resultSummary?: string
  errorMessage?: string
  prUrl?: string
}
