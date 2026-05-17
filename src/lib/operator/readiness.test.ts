import { describe, expect, it } from 'vitest'
import { buildOperatorReadiness, readWorkflowReadiness, type WorkflowReadiness } from './readiness'
import type { NBAConfig } from '@/lib/nba-engine/nba-config'
import type { ConnectorHealthView } from '@/lib/connectors/registry'
import type { Delegation } from '@/lib/models/delegation'
import type { ProjectBrief } from '@/lib/models/project-brief'

const config: NBAConfig = {
  ignoreStatuses: [],
  penalizeOldBacklogs: false,
  backlogPenaltyAgeDays: 90,
  backlogPenaltyScore: 20,
  showTriageJoker: false,
  maxRecommendations: 5,
  pinnedItems: [],
  customLlmModels: [],
  projects: [],
  milestones: [],
  approvalMode: 'autopilot',
  autopilotMinScore: 85,
  autopilotMaxRiskClass: 'A',
  aiProvider: 'ollama',
  localCodingModel: 'qwen2.5-coder:14b',
  localFastModel: 'llama3.2:3b',
}

const connectors: ConnectorHealthView[] = [
  {
    manifest: { id: 'linear', name: 'Linear', category: 'pm', authType: 'api-key', capabilities: [], configSchema: {} },
    health: { connectorId: 'linear', status: 'ok', lastChecked: '2026-05-17T00:00:00Z' },
  },
  {
    manifest: { id: 'github', name: 'GitHub', category: 'code', authType: 'api-key', capabilities: [], configSchema: {} },
    health: { connectorId: 'github', status: 'ok', lastChecked: '2026-05-17T00:00:00Z' },
  },
]

const workflows: WorkflowReadiness[] = [
  { id: 'linear-intake', label: 'Linear Intake', file: 'workflow-linear-intake.json', exists: true, active: true },
  { id: 'autopilot-approve', label: 'Autopilot Approve', file: 'workflow-autopilot-approve.json', exists: true, active: true },
  { id: 'telegram-approvals', label: 'Telegram Approval', file: 'workflow-telegram-approvals.json', exists: true, active: false },
]

const brief = {
  id: 'brief-1',
  title: 'Operator Cockpit',
  status: 'in_review',
  updatedAt: '2026-05-17T00:00:00Z',
  lastResearchRun: undefined,
} as ProjectBrief

const pendingDelegation = {
  id: 'del-1',
  status: 'pending',
  contract: { riskClass: 'A' },
  createdAt: '2026-05-17T00:00:00Z',
  updatedAt: '2026-05-17T00:00:00Z',
} as Delegation

describe('operator readiness', () => {
  it('surfaces next actions for missing research and queued delegations', () => {
    const readiness = buildOperatorReadiness({
      connectors,
      config,
      apiKeysSet: { OLLAMA_BASE_URL: true },
      workflows,
      briefs: [brief],
      delegations: [pendingDelegation],
      ollamaReachable: true,
    })

    expect(readiness.metrics.activeBriefs).toBe(1)
    expect(readiness.metrics.briefsNeedingResearch).toBe(1)
    expect(readiness.metrics.pendingDelegations).toBe(1)
    expect(readiness.nextActions.map(action => action.id)).toContain('briefs')
    expect(readiness.nextActions.map(action => action.id)).toContain('delegations')
    expect(readiness.score).toBeGreaterThan(70)
  })

  it('marks Ollama as blocked when selected but no URL is configured', () => {
    const readiness = buildOperatorReadiness({
      connectors,
      config,
      apiKeysSet: {},
      workflows,
      briefs: [],
      delegations: [],
      ollamaReachable: null,
    })

    const aiCheck = readiness.checks.find(check => check.id === 'ai-provider')
    expect(aiCheck?.status).toBe('blocked')
  })

  it('returns workflow status for a missing directory', () => {
    const workflowStatus = readWorkflowReadiness('Z:/path/that/does/not/exist')
    expect(workflowStatus).toHaveLength(3)
    expect(workflowStatus.every(workflow => !workflow.exists)).toBe(true)
  })
})
