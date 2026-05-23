export type PilotStepStatus = 'pending' | 'ok' | 'skipped' | 'error'

export interface PilotStep {
  step: string
  status: PilotStepStatus
  durationMs: number
  output?: unknown
  error?: string
}

export interface PilotRunResult {
  id: string
  workItemId: string
  title: string
  status: 'completed' | 'failed'
  steps: PilotStep[]
  totalDurationMs: number
  startedAt: string
  completedAt: string
  agentRunId?: string
  /** ID of the delegation created and executed by the pilot */
  delegationId?: string
  /** Whether execution was triggered (may be false in simulation/error cases) */
  executionStarted?: boolean
}
