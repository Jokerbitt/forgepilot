import type { AutopilotReadinessResponse } from '@/lib/autopilot/readiness'
import type { DailyAssistantInput, DailyAssistantQueueItem } from './next-action'
import type { ProjectPipelineSummary } from './project-pipeline'

export type AppBuilderLevel = 'blocked' | 'small-app' | 'multi-slice-mvp' | 'large-app-assisted'

export interface AppBuilderStep {
  id: string
  title: string
  detail: string
  state: 'now' | 'next' | 'later' | 'blocked'
}

export interface AppBuilderCapability {
  level: AppBuilderLevel
  score: number
  title: string
  summary: string
  canBuildSmallApp: boolean
  canBuildMultiSliceMvp: boolean
  canRunFullyAutonomous: boolean
  projectPipeline?: ProjectPipelineSummary
  safeNextAction: {
    label: string
    href: string
    mode: 'plan' | 'execute' | 'review' | 'repair'
  }
  gates: Array<{
    id: string
    label: string
    ready: boolean
    detail: string
  }>
  workflow: AppBuilderStep[]
}

interface BuildAppBuilderCapabilityInput {
  assistant: DailyAssistantInput
  queue: DailyAssistantQueueItem[]
  autopilot: AutopilotReadinessResponse
  projectPipeline?: ProjectPipelineSummary
}

function countSafeQueue(queue: DailyAssistantQueueItem[]): number {
  return queue.filter(item => item.status === 'approved' && item.riskClass !== 'C' && item.requiresApproval !== true).length
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function buildAppBuilderCapability(input: BuildAppBuilderCapabilityInput): AppBuilderCapability {
  const safeQueue = countSafeQueue(input.queue)
  const failedQueueItem = input.queue.find(item => item.status === 'failed')
  const projectPipeline = input.projectPipeline
  const safeProjectSlices = projectPipeline?.safeSliceCount ?? 0
  const hasPlanableWork = input.assistant.pending > 0
    || input.assistant.approved > 0
    || input.queue.length > 0
    || safeProjectSlices > 0
    || (projectPipeline?.workPackageCount ?? 0) > 0
  const gates = [
    {
      id: 'runner',
      label: 'Echter Runner',
      ready: input.autopilot.canExecuteCode,
      detail: input.autopilot.canExecuteCode
        ? `Ausführung über ${input.autopilot.mode}.`
        : 'Claude/Codex CLI oder API-Fallback ist noch nicht ausführungsbereit.',
    },
    {
      id: 'pr-flow',
      label: 'PR-Flow',
      ready: input.autopilot.canCreatePr,
      detail: input.autopilot.canCreatePr
        ? 'GitHub-PR-Erstellung ist möglich.'
        : 'GitHub Token oder gh auth fehlt für echte PRs.',
    },
    {
      id: 'validation',
      label: 'Validierung',
      ready: input.autopilot.checks.some(check => check.id === 'validation-scripts' && check.status === 'ready'),
      detail: 'Typecheck, Lint, Build und Tests müssen als reproduzierbare Gates vorhanden sein.',
    },
    {
      id: 'queue',
      label: 'Arbeitsqueue',
      ready: hasPlanableWork,
      detail: hasPlanableWork
        ? `${input.assistant.pending + input.assistant.approved} Delegation(en), ${safeProjectSlices} sichere Projekt-Slice(s) startbereit.`
        : 'Noch keine Arbeitspakete. Starte im Plan Mode mit einer Produktidee.',
    },
    {
      id: 'project-pipeline',
      label: 'Projekt-Slices',
      ready: safeProjectSlices > 0 || (projectPipeline?.completedSliceCount ?? 0) > 0,
      detail: projectPipeline?.recommendation ?? 'Noch kein Multi-Slice-Projektplan vorhanden.',
    },
    {
      id: 'no-critical-failures',
      label: 'Keine kritischen Fehler',
      ready: input.assistant.failed === 0,
      detail: input.assistant.failed === 0
        ? 'Keine fehlgeschlagenen Delegationen blockieren den nächsten Lauf.'
        : `${input.assistant.failed} fehlgeschlagene Delegation(en) müssen zuerst triagiert werden.`,
    },
  ]

  let score = input.autopilot.score * 0.55
  score += gates.filter(gate => gate.ready).length * 8
  score += Math.min(safeQueue * 4, 12)
  score += Math.min(safeProjectSlices * 5, 15)
  score -= Math.min(input.assistant.failed * 18, 36)
  score -= Math.min(input.assistant.running * 4, 8)
  const normalizedScore = clampScore(score)

  const blocked = gates.some(gate => !gate.ready && ['runner', 'pr-flow', 'validation', 'no-critical-failures'].includes(gate.id))
  const canBuildSmallApp = !blocked && input.autopilot.canExecuteCode && input.autopilot.canCreatePr
  const hasMultiSlicePlan = (projectPipeline?.workPackageCount ?? 0) >= 3 || safeProjectSlices >= 2
  const canBuildMultiSliceMvp = canBuildSmallApp
    && normalizedScore >= 85
    && (safeQueue >= 1 || safeProjectSlices >= 1 || input.assistant.pending >= 2 || input.assistant.approved >= 1)
    && hasMultiSlicePlan
  const canRunFullyAutonomous = canBuildMultiSliceMvp
    && input.autopilot.canAutoMerge
    && input.assistant.failed === 0
    && (safeQueue >= 1 || safeProjectSlices >= 1)
  const level: AppBuilderLevel = blocked
    ? 'blocked'
    : canRunFullyAutonomous
      ? 'large-app-assisted'
      : canBuildMultiSliceMvp
        ? 'multi-slice-mvp'
        : 'small-app'

  const safeNextAction = input.assistant.failed > 0
    ? {
        label: failedQueueItem ? 'Blocker prüfen' : 'Fehler triagieren',
        href: failedQueueItem ? `/delegations/${failedQueueItem.id}` : '/delegations?urgent=true',
        mode: 'repair' as const,
      }
    : input.assistant.running > 0
      ? { label: 'Agenten live beobachten', href: '/live', mode: 'review' as const }
      : safeQueue > 0
        ? { label: 'Nächsten sicheren Slice starten', href: '/delegations', mode: 'execute' as const }
        : projectPipeline?.nextCandidate
          ? { label: 'Projekt-Slice vorbereiten', href: projectPipeline.nextCandidate.href, mode: 'execute' as const }
        : hasPlanableWork
          ? { label: 'Projektplan prüfen', href: projectPipeline?.nextCandidate?.href ?? '/projects', mode: 'review' as const }
          : { label: 'App-Idee planen', href: '/idea', mode: 'plan' as const }

  return {
    level,
    score: normalizedScore,
    title: level === 'blocked'
      ? 'Noch nicht bereit für große autonome App-Builds'
      : level === 'small-app'
        ? 'Bereit für kleine autonome App-Slices'
        : level === 'multi-slice-mvp'
          ? 'Bereit für Multi-Slice-MVPs'
          : 'Bereit für größere Apps mit kontrollierter Autonomie',
    summary: level === 'blocked'
      ? 'ForgePilot kann planen, aber echte größere Builds brauchen zuerst Runner, PR-Flow, Validierung und fehlerfreie Queue.'
      : level === 'small-app'
        ? 'Starte mit einem vertikalen Slice: UI, Datenhaltung, Tests und PR in kleinem Scope.'
        : level === 'multi-slice-mvp'
          ? 'ForgePilot kann mehrere kleine Slices nacheinander planen, starten und über PRs absichern.'
          : 'ForgePilot kann größere Apps in kontrollierte Slices zerlegen, autonom ausführen und über Review-Gates absichern.',
    canBuildSmallApp,
    canBuildMultiSliceMvp,
    canRunFullyAutonomous,
    projectPipeline,
    safeNextAction,
    gates,
    workflow: [
      {
        id: 'plan-product',
        title: 'Produkt in Slices schneiden',
        detail: 'Aus der Idee werden Plattform, Datenhaltung, MVP-Schnitt und kleine Arbeitspakete.',
        state: safeNextAction.mode === 'plan' ? 'now' : 'next',
      },
      {
        id: 'execute-next-slice',
        title: 'Nächsten sicheren Slice bauen',
        detail: 'Nur Risk-A/B-Slices mit klarer Definition of Done werden autonom gestartet.',
        state: safeNextAction.mode === 'execute' ? 'now' : canBuildSmallApp ? 'next' : 'blocked',
      },
      {
        id: 'verify-pr',
        title: 'PR, Tests und Critic prüfen',
        detail: 'Jeder Slice muss Diff, Tests, Critic Review und Writeback liefern.',
        state: input.assistant.prOpen > 0 || input.assistant.running > 0 ? 'now' : 'later',
      },
      {
        id: 'repeat-safely',
        title: 'Nächsten Slice automatisch wählen',
        detail: 'Nach grünem Ergebnis entscheidet der Assistant den nächsten kleinsten sinnvollen Schritt.',
        state: canBuildMultiSliceMvp ? 'later' : 'blocked',
      },
    ],
  }
}
