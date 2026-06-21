import type { OrchestratedRun } from '@/lib/agents/orchestrated-run'
import type { AgentProfile } from '@/lib/models/agent-profile'
import type { Delegation } from '@/lib/models/delegation'

type LaneKey = 'plan' | 'build' | 'review' | 'ops' | 'knowledge'
type RecommendationTone = 'ready' | 'attention' | 'blocked'

export interface WorkbenchLane {
  key: LaneKey
  label: string
  description: string
  agentCount: number
  availableCount: number
  preferredCostMode: 'local-first' | 'subscription-first' | 'metered-controlled'
}

export interface WorkbenchRecommendation {
  tone: RecommendationTone
  title: string
  detail: string
  href: string
  actionLabel: string
}

export interface AgentWorkbenchSummary {
  generatedAt: string
  agents: {
    total: number
    available: number
    busy: number
    disabled: number
    local: number
    includedSubscription: number
    metered: number
    autopilot: number
    supervisedWrite: number
    proposeOnly: number
  }
  work: {
    totalDelegations: number
    activeDelegations: number
    approvedDelegations: number
    failedDelegations: number
    activeRuns: number
    recentRuns: number
  }
  lanes: WorkbenchLane[]
  recommendation: WorkbenchRecommendation
  collaborationRules: string[]
}

const LANE_COPY: Record<LaneKey, Omit<WorkbenchLane, 'agentCount' | 'availableCount'>> = {
  plan: {
    key: 'plan',
    label: 'Planung',
    description: 'Zerlegt Ideen in klare, kleine Arbeitspakete.',
    preferredCostMode: 'subscription-first',
  },
  build: {
    key: 'build',
    label: 'Umsetzung',
    description: 'Schreibt Code in engen Scopes und erzeugt pruefbare Diffs.',
    preferredCostMode: 'subscription-first',
  },
  review: {
    key: 'review',
    label: 'Kritik',
    description: 'Prueft Sicherheit, Qualitaet, Drift und naechste Risiken.',
    preferredCostMode: 'local-first',
  },
  ops: {
    key: 'ops',
    label: 'Betrieb',
    description: 'Prueft CI, Deployment, Rollback und Merge-Reife.',
    preferredCostMode: 'subscription-first',
  },
  knowledge: {
    key: 'knowledge',
    label: 'Wissen',
    description: 'Speichert Entscheidungen, Erkenntnisse und wiederverwendbaren Kontext.',
    preferredCostMode: 'local-first',
  },
}

export function buildAgentWorkbenchSummary(input: {
  agents: AgentProfile[]
  delegations: Delegation[]
  runs: OrchestratedRun[]
  now?: Date
}): AgentWorkbenchSummary {
  const { agents, delegations, runs } = input
  const now = input.now ?? new Date()
  const activeDelegations = delegations.filter(d => d.status === 'running')
  const approvedDelegations = delegations.filter(d => d.status === 'approved')
  const failedDelegations = delegations.filter(d => d.status === 'failed')
  const activeRuns = runs.filter(run => run.status === 'planning' || run.status === 'running')
  const recentRuns = runs.filter(run => now.getTime() - new Date(run.updatedAt).getTime() < 24 * 60 * 60 * 1000)

  return {
    generatedAt: now.toISOString(),
    agents: {
      total: agents.length,
      available: agents.filter(a => a.availability === 'available').length,
      busy: agents.filter(a => a.availability === 'busy').length,
      disabled: agents.filter(a => a.availability === 'disabled').length,
      local: agents.filter(a => a.costClass === 'free-local').length,
      includedSubscription: agents.filter(a => a.costClass === 'included-subscription').length,
      metered: agents.filter(a => a.costClass === 'metered-low' || a.costClass === 'metered-high').length,
      autopilot: agents.filter(a => a.autonomyLevel === 'autopilot').length,
      supervisedWrite: agents.filter(a => a.autonomyLevel === 'supervised-write').length,
      proposeOnly: agents.filter(a => a.autonomyLevel === 'propose-only').length,
    },
    work: {
      totalDelegations: delegations.length,
      activeDelegations: activeDelegations.length,
      approvedDelegations: approvedDelegations.length,
      failedDelegations: failedDelegations.length,
      activeRuns: activeRuns.length,
      recentRuns: recentRuns.length,
    },
    lanes: buildLanes(agents),
    recommendation: buildRecommendation({
      activeDelegations: activeDelegations.length,
      approvedDelegations: approvedDelegations.length,
      failedDelegations: failedDelegations.length,
      activeRuns: activeRuns.length,
    }),
    collaborationRules: [
      'Lokale Modelle und Hermes pruefen Plaene zuerst, damit teure Calls nur bei hohem Nutzen laufen.',
      'Claude/Codex arbeiten an engen Write-Scopes; PR und Merge bleiben bis zur Freigabe kontrolliert.',
      'Security, Database und Release Reviewer blockieren riskante Schritte, bevor neue Agenten starten.',
    ],
  }
}

function buildLanes(agents: AgentProfile[]): WorkbenchLane[] {
  const lanes: Record<LaneKey, AgentProfile[]> = {
    plan: [],
    build: [],
    review: [],
    ops: [],
    knowledge: [],
  }

  for (const agent of agents) {
    lanes[classifyLane(agent)].push(agent)
  }

  return (Object.keys(LANE_COPY) as LaneKey[]).map(key => ({
    ...LANE_COPY[key],
    agentCount: lanes[key].length,
    availableCount: lanes[key].filter(agent => agent.availability === 'available').length,
  }))
}

function classifyLane(agent: AgentProfile): LaneKey {
  if (agent.role === 'product-planner' || agent.role === 'architect') return 'plan'
  if (agent.role === 'backend-engineer' || agent.role === 'frontend-saas-designer' || agent.role === 'external-coding-agent') return 'build'
  if (agent.role === 'qa-reviewer' || agent.role === 'critic-reviewer') return 'review'
  if (agent.role === 'devops-automation') return 'ops'
  return 'knowledge'
}

function buildRecommendation(input: {
  activeDelegations: number
  approvedDelegations: number
  failedDelegations: number
  activeRuns: number
}): WorkbenchRecommendation {
  if (input.failedDelegations > 0) {
    return {
      tone: 'blocked',
      title: 'Fehler zuerst klaeren',
      detail: `${input.failedDelegations} Delegation(en) brauchen Diagnose, bevor mehr Autonomie sinnvoll ist.`,
      href: '/delegations?status=failed',
      actionLabel: 'Fehler ansehen',
    }
  }

  if (input.activeDelegations > 0 || input.activeRuns > 0) {
    return {
      tone: 'attention',
      title: 'Laufende Agenten beobachten',
      detail: `${input.activeDelegations + input.activeRuns} aktive Arbeitsschritte laufen oder werden gerade koordiniert.`,
      href: '/live',
      actionLabel: 'Live View verfolgen',
    }
  }

  if (input.approvedDelegations > 0) {
    return {
      tone: 'ready',
      title: 'Naechste Delegation starten',
      detail: `${input.approvedDelegations} freigegebene Aufgabe(n) koennen mit engem Scope ausgefuehrt werden.`,
      href: '/delegations?status=approved',
      actionLabel: 'Queue ansehen',
    }
  }

  return {
    tone: 'ready',
    title: 'Neue Idee planen',
    detail: 'Beschreibe dein Ziel, ForgePilot schlaegt Projekt, App-Typ, Datenbank und erste Delegationen vor.',
    href: '/idea',
    actionLabel: 'Plan Mode starten',
  }
}
