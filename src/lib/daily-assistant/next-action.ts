export type AssistantTone = 'ready' | 'attention' | 'blocked'

export interface DailyAssistantInput {
  pending: number
  approved: number
  running: number
  failed: number
  prOpen: number
  prMerged: number
  authDisabled: boolean
  storageMode?: string
  nextFocus?: string
  approvalMode?: string
}

export interface DailyAssistantAction {
  id: string
  title: string
  detail: string
  href: string
  primaryLabel: string
  tone: AssistantTone
}

export interface DailyAssistantQueueItem {
  id: string
  title: string
  status: 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled' | 'rejected'
  riskClass: 'A' | 'B' | 'C'
  requiresApproval?: boolean
  updatedAt: string
}

const QUEUE_STATUS_RANK: Record<DailyAssistantQueueItem['status'], number> = {
  failed: 0,
  running: 1,
  approved: 2,
  pending: 3,
  completed: 4,
  cancelled: 5,
  rejected: 6,
}

const RISK_RANK: Record<DailyAssistantQueueItem['riskClass'], number> = { A: 0, B: 1, C: 2 }

export function buildDailyAssistantAction(input: DailyAssistantInput): DailyAssistantAction {
  if (input.failed > 0) {
    return {
      id: 'fix-failed-delegations',
      title: 'Fehler zuerst verständlich auflösen',
      detail: `${input.failed} Delegation(en) brauchen eine Entscheidung, bevor Autonomie zuverlässig wirkt.`,
      href: '/delegations',
      primaryLabel: 'Fehler ansehen',
      tone: 'blocked',
    }
  }

  if (input.running > 0) {
    return {
      id: 'watch-running-agents',
      title: 'Laufende Agenten beobachten',
      detail: `${input.running} Agent(en) arbeiten gerade. Prüfe Live-Logs, Code-Evidence und nächste Aktionen.`,
      href: '/live',
      primaryLabel: 'Live verfolgen',
      tone: 'attention',
    }
  }

  if (input.prOpen > 0) {
    return {
      id: 'review-open-prs',
      title: 'Pull Requests prüfen und abschließen',
      detail: `${input.prOpen} PR(s) sind offen. Erst Diff, Checks und Secrets prüfen, dann mergen.`,
      href: '/branches',
      primaryLabel: 'PRs prüfen',
      tone: 'attention',
    }
  }

  if (input.approved > 0) {
    return {
      id: 'start-approved-work',
      title: 'Freigegebene Aufgaben automatisch starten',
      detail: `${input.approved} Delegation(en) sind bereit. Autopilot kann sichere Class-A/B-Aufgaben übernehmen.`,
      href: '/delegations',
      primaryLabel: 'Bereite Arbeit starten',
      tone: input.approvalMode === 'autopilot' ? 'ready' : 'attention',
    }
  }

  if (input.pending > 0) {
    return {
      id: 'approve-next-delegation',
      title: 'Nächste Delegation prüfen',
      detail: `${input.pending} Aufgabe(n) warten auf Scope-Check oder Freigabe.`,
      href: '/delegations',
      primaryLabel: 'Freigaben prüfen',
      tone: 'attention',
    }
  }

  return {
    id: 'plan-next-idea',
    title: 'Neue Idee in einen Plan verwandeln',
    detail: input.nextFocus || 'Beschreibe, was du bauen willst. ForgePilot macht daraus Plan, Arbeitspakete und nächste Delegationen.',
    href: '/idea',
    primaryLabel: 'Idee planen',
    tone: 'ready',
  }
}

export function describeAutonomy(input: Pick<DailyAssistantInput, 'approvalMode' | 'approved' | 'running' | 'authDisabled'>): string {
  if (input.approvalMode === 'autopilot') {
    return input.running > 0
      ? 'Autopilot ist aktiv und arbeitet bereits.'
      : 'Autopilot ist aktiv und startet passende freigegebene Aufgaben automatisch.'
  }

  if (input.approved > 0) {
    return 'Balanced Mode: ForgePilot empfiehlt und bereitet vor, du gibst den Start bewusst frei.'
  }

  if (input.authDisabled) {
    return 'Lokaler Testmodus: Login ist deaktiviert. Für Launch später wieder absichern.'
  }

  return 'Assistant Mode: ForgePilot führt dich Schritt für Schritt zur nächsten nützlichen Aktion.'
}

export function sortAssistantQueue(items: DailyAssistantQueueItem[]): DailyAssistantQueueItem[] {
  return [...items].sort((a, b) => {
    const byStatus = QUEUE_STATUS_RANK[a.status] - QUEUE_STATUS_RANK[b.status]
    if (byStatus !== 0) return byStatus
    const byRisk = RISK_RANK[a.riskClass] - RISK_RANK[b.riskClass]
    if (byRisk !== 0) return byRisk
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function canStartAutonomously(item: DailyAssistantQueueItem, approvalMode?: string): boolean {
  return (
    item.status === 'approved'
    && approvalMode === 'autopilot'
    && item.riskClass !== 'C'
    && item.requiresApproval !== true
  )
}
