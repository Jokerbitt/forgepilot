import fs from 'fs'
import path from 'path'
import type { Delegation } from '@/lib/models/delegation'
import type { ProjectBrief } from '@/lib/models/project-brief'
import type { ConnectorHealthView } from '@/lib/connectors/registry'
import type { NBAConfig } from '@/lib/nba-engine/nba-config'

export type ReadinessStatus = 'ready' | 'attention' | 'blocked'

export interface WorkflowReadiness {
  id: 'linear-intake' | 'autopilot-approve' | 'telegram-approvals'
  label: string
  file: string
  exists: boolean
  active: boolean | null
}

export interface ReadinessCheck {
  id: string
  label: string
  status: ReadinessStatus
  detail: string
  actionLabel?: string
  actionHref?: string
}

export interface OperatorReadiness {
  generatedAt: string
  status: ReadinessStatus
  score: number
  checks: ReadinessCheck[]
  nextActions: ReadinessCheck[]
  metrics: {
    activeBriefs: number
    briefsNeedingResearch: number
    pendingDelegations: number
    approvedDelegations: number
    runningDelegations: number
    failedDelegations: number
  }
  workflows: WorkflowReadiness[]
}

interface BuildReadinessInput {
  connectors: ConnectorHealthView[]
  config: NBAConfig
  apiKeysSet: Record<string, boolean>
  workflows: WorkflowReadiness[]
  briefs: ProjectBrief[]
  delegations: Delegation[]
  ollamaReachable: boolean | null
}

const WORKFLOW_FILES: WorkflowReadiness[] = [
  {
    id: 'linear-intake',
    label: 'Linear Intake',
    file: 'workflow-linear-intake.json',
    exists: false,
    active: null,
  },
  {
    id: 'autopilot-approve',
    label: 'Autopilot Approve',
    file: 'workflow-autopilot-approve.json',
    exists: false,
    active: null,
  },
  {
    id: 'telegram-approvals',
    label: 'Telegram Approval',
    file: 'workflow-telegram-approvals.json',
    exists: false,
    active: null,
  },
]

export function readWorkflowReadiness(n8nDir = path.join(process.cwd(), 'n8n')): WorkflowReadiness[] {
  return WORKFLOW_FILES.map(workflow => {
    const filePath = path.join(n8nDir, workflow.file)
    if (!fs.existsSync(filePath)) {
      return { ...workflow, exists: false, active: null }
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { active?: unknown }
      return {
        ...workflow,
        exists: true,
        active: typeof parsed.active === 'boolean' ? parsed.active : null,
      }
    } catch {
      return { ...workflow, exists: true, active: null }
    }
  })
}

export function buildOperatorReadiness(input: BuildReadinessInput): OperatorReadiness {
  const activeBriefs = input.briefs.filter(brief => brief.status !== 'archived')
  const briefsNeedingResearch = activeBriefs.filter(brief => !brief.lastResearchRun || brief.lastResearchRun.status === 'failed')
  const pendingDelegations = input.delegations.filter(delegation => delegation.status === 'pending')
  const approvedDelegations = input.delegations.filter(delegation => delegation.status === 'approved')
  const runningDelegations = input.delegations.filter(delegation => delegation.status === 'running')
  const failedDelegations = input.delegations.filter(delegation => delegation.status === 'failed')

  const checks: ReadinessCheck[] = [
    connectorCheck(input.connectors, 'linear', 'Linear'),
    connectorCheck(input.connectors, 'github', 'GitHub'),
    aiProviderCheck(input.config, input.apiKeysSet, input.ollamaReachable),
    workflowCheck(input.workflows.find(workflow => workflow.id === 'linear-intake'), 'Linear Intake Workflow'),
    workflowCheck(input.workflows.find(workflow => workflow.id === 'autopilot-approve'), 'Autopilot Workflow'),
    {
      id: 'briefs',
      label: 'Project Briefs',
      status: activeBriefs.length === 0 || briefsNeedingResearch.length > 0 ? 'attention' : 'ready',
      detail: activeBriefs.length > 0
        ? `${activeBriefs.length} aktive Briefs, ${briefsNeedingResearch.length} brauchen Research.`
        : 'Noch kein aktiver Project Brief vorhanden.',
      actionLabel: activeBriefs.length > 0 ? 'Research pruefen' : 'Neue Idee anlegen',
      actionHref: activeBriefs.length > 0 ? '/project-briefs' : '/project-briefs/new',
    },
    {
      id: 'delegations',
      label: 'Delegation Queue',
      status: failedDelegations.length > 0 ? 'blocked' : pendingDelegations.length + approvedDelegations.length > 0 ? 'attention' : 'ready',
      detail: `${pendingDelegations.length} pending, ${approvedDelegations.length} approved, ${runningDelegations.length} running, ${failedDelegations.length} failed.`,
      actionLabel: failedDelegations.length > 0 ? 'Fehler pruefen' : 'Queue ansehen',
      actionHref: '/delegations',
    },
  ]

  const weightedScore = Math.round(
    checks.reduce((sum, check) => sum + scoreForStatus(check.status), 0) / checks.length,
  )
  const status = weightedScore >= 85 ? 'ready' : weightedScore >= 55 ? 'attention' : 'blocked'

  return {
    generatedAt: new Date().toISOString(),
    status,
    score: weightedScore,
    checks,
    nextActions: checks.filter(check => check.status !== 'ready').slice(0, 3),
    metrics: {
      activeBriefs: activeBriefs.length,
      briefsNeedingResearch: briefsNeedingResearch.length,
      pendingDelegations: pendingDelegations.length,
      approvedDelegations: approvedDelegations.length,
      runningDelegations: runningDelegations.length,
      failedDelegations: failedDelegations.length,
    },
    workflows: input.workflows,
  }
}

function connectorCheck(connectors: ConnectorHealthView[], id: string, label: string): ReadinessCheck {
  const connector = connectors.find(item => item.manifest.id === id)
  const status = connector?.health.status
  if (status === 'ok') {
    return {
      id: `connector-${id}`,
      label,
      status: 'ready',
      detail: 'Connector ist erreichbar.',
    }
  }

  return {
    id: `connector-${id}`,
    label,
    status: status === 'error' ? 'blocked' : 'attention',
    detail: connector?.health.errorMessage ?? 'Connector ist noch nicht vollstaendig konfiguriert.',
    actionLabel: 'Settings oeffnen',
    actionHref: '/settings',
  }
}

function aiProviderCheck(
  config: NBAConfig,
  apiKeysSet: Record<string, boolean>,
  ollamaReachable: boolean | null,
): ReadinessCheck {
  if (config.aiProvider === 'anthropic') {
    return {
      id: 'ai-provider',
      label: 'AI Provider',
      status: apiKeysSet['ANTHROPIC_API_KEY'] ? 'ready' : 'blocked',
      detail: apiKeysSet['ANTHROPIC_API_KEY']
        ? 'Anthropic ist als Provider konfiguriert.'
        : 'Anthropic ist aktiv, aber kein API Key ist gesetzt.',
      actionLabel: 'Provider konfigurieren',
      actionHref: '/settings',
    }
  }

  return {
    id: 'ai-provider',
    label: 'AI Provider',
    status: ollamaReachable === true ? 'ready' : apiKeysSet['OLLAMA_BASE_URL'] ? 'attention' : 'blocked',
    detail: ollamaReachable === true
      ? `Ollama ist erreichbar (${config.localCodingModel}).`
      : apiKeysSet['OLLAMA_BASE_URL']
        ? 'Ollama URL ist gesetzt, aber noch nicht erreichbar.'
        : 'Ollama ist aktiv, aber keine Base URL ist gesetzt.',
    actionLabel: 'Provider konfigurieren',
    actionHref: '/settings',
  }
}

function workflowCheck(workflow: WorkflowReadiness | undefined, label: string): ReadinessCheck {
  if (!workflow?.exists) {
    return {
      id: `workflow-${label.toLowerCase().replace(/\s+/g, '-')}`,
      label,
      status: 'blocked',
      detail: 'Workflow-Datei fehlt im Repo.',
    }
  }

  return {
    id: `workflow-${workflow.id}`,
    label,
    status: workflow.active === false ? 'attention' : 'ready',
    detail: workflow.active === false
      ? 'Workflow ist vorhanden, aber im Export deaktiviert.'
      : 'Workflow ist im Repo vorhanden.',
    actionLabel: workflow.active === false ? 'n8n oeffnen' : undefined,
    actionHref: workflow.active === false ? 'http://192.168.0.136:5678' : undefined,
  }
}

function scoreForStatus(status: ReadinessStatus): number {
  if (status === 'ready') return 100
  if (status === 'attention') return 60
  return 0
}
