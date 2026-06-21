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
  /** Number of successfully completed delegations (proxy for earned trust) */
  completedCount?: number
  /** true when Claude CLI or Codex CLI is available for zero-key execution */
  cliReady?: boolean
}

// ─── App Builder Capability ───────────────────────────────────────────────────

export type AppBuildLevel = 'single-task' | 'multi-slice-mvp' | 'large-feature' | 'full-app'

export interface AppBuilderCapability {
  level: AppBuildLevel
  label: string
  detail: string
  maxPhases: number
  recommendedAction: 'fix-blockers' | 'earn-more-runs' | 'start-single' | 'plan-multi-phase'
  planModeReady: boolean
}

export function buildAppBuilderCapability(input: DailyAssistantInput): AppBuilderCapability {
  const completed = input.completedCount ?? 0

  if (input.failed > 0) {
    return {
      level: 'single-task',
      label: 'Einzelner Fix',
      detail: `${input.failed} fehlgeschlagene Delegation(en) müssen erst behoben werden, bevor größere Builds möglich sind.`,
      maxPhases: 1,
      recommendedAction: 'fix-blockers',
      planModeReady: false,
    }
  }

  if (completed < 3) {
    return {
      level: 'single-task',
      label: 'Einzelner Task',
      detail: `Erst ${completed} erfolgreiche Run(s). Starte einige kleinere Delegationen, um Systemvertrauen aufzubauen.`,
      maxPhases: 1,
      recommendedAction: 'earn-more-runs',
      planModeReady: false,
    }
  }

  if (completed < 8) {
    return {
      level: 'multi-slice-mvp',
      label: 'Multi-Slice MVP',
      detail: `${completed} Runs bewiesen. Bis zu 3 Phasen können autonom hintereinander laufen.`,
      maxPhases: 3,
      recommendedAction: 'plan-multi-phase',
      planModeReady: true,
    }
  }

  if (input.approvalMode === 'autopilot') {
    return {
      level: 'large-feature',
      label: 'Large Feature',
      detail: `${completed} Runs + Autopilot aktiv. Bis zu 6 Phasen vollständig autonom — Antigravity-Level.`,
      maxPhases: 6,
      recommendedAction: 'plan-multi-phase',
      planModeReady: true,
    }
  }

  return {
    level: 'multi-slice-mvp',
    label: 'Multi-Slice MVP',
    detail: `${completed} Runs bewiesen. Autopilot aktivieren in Settings für Large-Feature-Modus (bis zu 6 Phasen).`,
    maxPhases: 3,
    recommendedAction: 'plan-multi-phase',
    planModeReady: true,
  }
}

export interface DailyAssistantAction {
  id: string
  title: string
  detail: string
  href: string
  primaryLabel: string
  tone: AssistantTone
}

export type DailyAssistantStepState = 'now' | 'next' | 'later' | 'blocked'

export interface DailyAssistantStep {
  id: string
  title: string
  detail: string
  href: string
  label: string
  state: DailyAssistantStepState
}

export interface DailyAssistantBlocker {
  id: string
  title: string
  detail: string
  href: string
  severity: 'critical' | 'warning'
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

export function buildDailyAssistantSteps(input: DailyAssistantInput): DailyAssistantStep[] {
  const action = buildDailyAssistantAction(input)

  if (action.id === 'fix-failed-delegations') {
    return [
      {
        id: 'inspect-failures',
        title: 'Fehler verstehen',
        detail: 'Öffne die fehlgeschlagenen Delegationen und lies Fehler, letzte Logs und Retry-Hinweise.',
        href: '/delegations?urgent=true',
        label: 'Fehler öffnen',
        state: 'now',
      },
      {
        id: 'retry-or-scope-down',
        title: 'Retry oder Scope verkleinern',
        detail: 'Starte nur neu, wenn Ursache und nächster Versuch klar sind. Bei Unsicherheit erst Plan Mode nutzen.',
        href: '/delegations',
        label: 'Retry prüfen',
        state: 'next',
      },
      {
        id: 'resume-autonomy',
        title: 'Autonomie danach wieder freigeben',
        detail: 'Neue automatische Runs erst starten, wenn keine kritischen Fehler offen sind.',
        href: '/live',
        label: 'Live prüfen',
        state: 'later',
      },
    ]
  }

  if (action.id === 'watch-running-agents') {
    return [
      {
        id: 'watch-live',
        title: 'Live verfolgen',
        detail: 'Prüfe, ob Agenten Code ändern, Tests ausführen und einen PR vorbereiten.',
        href: '/live',
        label: 'Live View',
        state: 'now',
      },
      {
        id: 'verify-evidence',
        title: 'Evidence prüfen',
        detail: 'Achte auf geänderte Dateien, Testresultate, Critic-Ergebnis und PR-Link.',
        href: '/delegations',
        label: 'Delegationen',
        state: 'next',
      },
      {
        id: 'review-pr',
        title: 'PR abschließen',
        detail: 'Wenn CI grün ist: Diff, Checks und Secrets prüfen, dann mergen.',
        href: '/branches',
        label: 'PRs prüfen',
        state: 'later',
      },
    ]
  }

  if (action.id === 'review-open-prs') {
    return [
      {
        id: 'review-diff',
        title: 'Änderungen ansehen',
        detail: 'Öffne Branches, prüfe Diff, Tests und ob keine Secrets enthalten sind.',
        href: '/branches',
        label: 'Branches',
        state: 'now',
      },
      {
        id: 'merge-safe-prs',
        title: 'Sichere PRs mergen',
        detail: 'Nur mergen, wenn Review-Checkliste und CI grün sind.',
        href: '/branches',
        label: 'Merge prüfen',
        state: 'next',
      },
      {
        id: 'writeback-after-merge',
        title: 'Wissen sichern',
        detail: 'Nach dem Merge sollte die Erkenntnis als wiederverwendbares Projektwissen sichtbar sein.',
        href: '/knowledge',
        label: 'Knowledge',
        state: 'later',
      },
    ]
  }

  if (action.id === 'start-approved-work') {
    return [
      {
        id: 'start-safe-work',
        title: input.approvalMode === 'autopilot' ? 'Autopilot starten lassen' : 'Start bewusst freigeben',
        detail: 'Beginne mit sicheren Risk-A/B-Delegationen und beobachte danach die Live View.',
        href: '/delegations',
        label: 'Start prüfen',
        state: 'now',
      },
      {
        id: 'watch-execution',
        title: 'Ausführung beobachten',
        detail: 'Kontrolliere Logs, geänderte Dateien, Tests und ob ein PR entsteht.',
        href: '/live',
        label: 'Live View',
        state: 'next',
      },
      {
        id: 'review-result',
        title: 'Ergebnis bewerten',
        detail: 'Critic Review, Writeback und PR erst akzeptieren, wenn der Nutzen klar ist.',
        href: '/branches',
        label: 'Review',
        state: 'later',
      },
    ]
  }

  if (action.id === 'approve-next-delegation') {
    return [
      {
        id: 'scope-check',
        title: 'Scope prüfen',
        detail: 'Ist Ziel, Datei-Scope, Risiko und Definition of Done klar genug?',
        href: '/delegations',
        label: 'Freigaben',
        state: 'now',
      },
      {
        id: 'approve-low-risk',
        title: 'Niedriges Risiko freigeben',
        detail: 'Risk A/B kann vorbereitet werden. Risk C bleibt manuell und braucht bewusste Kontrolle.',
        href: '/delegations',
        label: 'Freigeben',
        state: 'next',
      },
      {
        id: 'start-after-approval',
        title: 'Danach ausführen',
        detail: 'Nach der Freigabe startet der Agent kontrolliert oder im Autopilot.',
        href: '/live',
        label: 'Live',
        state: 'later',
      },
    ]
  }

  return [
    {
      id: 'describe-idea',
      title: 'Idee beschreiben',
      detail: 'Schreibe Ziel, Nutzer, Nutzen und was als erstes funktionieren soll in normaler Sprache.',
      href: '/idea',
      label: 'Plan Mode',
      state: 'now',
    },
    {
      id: 'accept-plan',
      title: 'Plan prüfen',
      detail: 'ForgePilot empfiehlt App-Typ, Datenhaltung, MVP-Schnitt, Risiken und erste Arbeitspakete.',
      href: '/idea',
      label: 'Plan prüfen',
      state: 'next',
    },
    {
      id: 'delegate-first-slice',
      title: 'Erste kleine Delegation starten',
      detail: 'Starte nicht das ganze Produkt, sondern den kleinsten nützlichen vertikalen Schnitt.',
      href: '/projects',
      label: 'Projekt öffnen',
      state: 'later',
    },
  ]
}

export function buildDailyAssistantBlockers(input: DailyAssistantInput, queue: DailyAssistantQueueItem[] = []): DailyAssistantBlocker[] {
  const blockers: DailyAssistantBlocker[] = []
  const failedItems = queue.filter(item => item.status === 'failed')

  if (input.failed > 0) {
    const singleFailure = input.failed === 1 ? failedItems[0] : undefined
    blockers.push({
      id: 'failed-delegations',
      title: singleFailure ? 'Eine Delegation blockiert Autonomie' : 'Fehlgeschlagene Delegationen blockieren Autonomie',
      detail: singleFailure
        ? `"${singleFailure.title}" braucht Review, bevor neue Arbeit automatisch starten sollte.`
        : `${input.failed} Fehler müssen verstanden werden, bevor neue Arbeit automatisch starten sollte.`,
      href: singleFailure ? `/delegations/${singleFailure.id}` : '/delegations?urgent=true',
      severity: 'critical',
    })
  }

  const riskC = queue.filter(item => item.riskClass === 'C' && ['pending', 'approved'].includes(item.status)).length
  if (riskC > 0) {
    blockers.push({
      id: 'risk-c-work',
      title: 'Risk-C-Arbeit bleibt manuell',
      detail: `${riskC} riskante Aufgabe(n) brauchen bewusste Freigabe und sollten nicht autonom laufen.`,
      href: '/delegations',
      severity: 'warning',
    })
  }

  if (input.authDisabled) {
    blockers.push({
      id: 'auth-disabled',
      title: 'Login ist deaktiviert',
      detail: 'Für lokale Tests okay. Vor Launch muss Auth wieder aktiv sein.',
      href: '/settings',
      severity: 'warning',
    })
  }

  if (input.storageMode === 'json') {
    blockers.push({
      id: 'json-storage',
      title: 'JSON ist noch primärer Speicher',
      detail: 'Für echte Produktion sollte PostgreSQL der verlässliche Read/Write-Pfad sein.',
      href: '/settings/deployment',
      severity: 'warning',
    })
  }

  return blockers
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
