import type { Delegation, AgentLog } from './delegation'
import type { DriftAnalysis } from '@/lib/drift-detector'

/** Runtime state for an agent that is (or was recently) live in Mission Control */
export interface LiveAgentState {
  delegation: Delegation
  logs: AgentLog[]
  status: Delegation['status']
  actualCostUsd?: number
  drift?: DriftAnalysis
  streaming: boolean
}
