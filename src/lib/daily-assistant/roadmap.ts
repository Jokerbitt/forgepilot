import type { AutopilotReadinessResponse } from '@/lib/autopilot/readiness'
import type { AppBuilderCapability } from './app-builder'
import type { DailyAssistantInput, DailyAssistantQueueItem } from './next-action'

export type AssistantMilestoneStatus = 'done' | 'active' | 'blocked' | 'next'

export interface AssistantMilestone {
  id: string
  title: string
  goal: string
  status: AssistantMilestoneStatus
  progress: number
  whyItMatters: string
  acceptanceCriteria: string[]
  nextAction: {
    label: string
    href: string
    mode: 'plan' | 'execute' | 'validate' | 'review' | 'configure'
  }
}

export interface AssistantRoadmap {
  title: string
  summary: string
  focusMilestoneId: string
  nextAutonomousStep: {
    label: string
    detail: string
    href: string
    mode: 'plan' | 'execute' | 'validate' | 'review' | 'configure'
  }
  milestones: AssistantMilestone[]
}

interface BuildAssistantRoadmapInput {
  assistant: DailyAssistantInput
  queue: DailyAssistantQueueItem[]
  autopilot: AutopilotReadinessResponse
  appBuilder: AppBuilderCapability
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function hasSafeExecutableQueue(queue: DailyAssistantQueueItem[]): boolean {
  return queue.some(item => item.status === 'approved' && item.riskClass !== 'C' && item.requiresApproval !== true)
}

function statusFor(progress: number, blocked: boolean, active: boolean): AssistantMilestoneStatus {
  if (progress >= 100) return 'done'
  if (blocked) return 'blocked'
  if (active) return 'active'
  return 'next'
}

export function buildAssistantRoadmap(input: BuildAssistantRoadmapInput): AssistantRoadmap {
  const safeQueue = hasSafeExecutableQueue(input.queue)
  const noFailures = input.assistant.failed === 0
  const hasWork = input.assistant.pending > 0 || input.assistant.approved > 0 || input.queue.length > 0

  const runnerProgress = clampProgress(
    (input.autopilot.canExecuteCode ? 35 : 0)
    + (input.autopilot.canCreatePr ? 25 : 0)
    + (input.autopilot.checks.some(check => check.id === 'validation-scripts' && check.status === 'ready') ? 20 : 0)
    + (noFailures ? 20 : 0),
  )

  const liveProgress = clampProgress(
    45
    + (input.assistant.running > 0 ? 25 : 0)
    + (input.autopilot.score >= 70 ? 15 : 0)
    + (input.assistant.prOpen > 0 || input.assistant.prMerged > 0 ? 15 : 0),
  )

  const zeroKeyProgress = clampProgress(
    (input.autopilot.canExecuteCode ? 45 : 0)
    + (input.autopilot.mode === 'claude-cli' || input.autopilot.mode === 'codex-cli' ? 35 : 0)
    + (input.autopilot.score >= 80 ? 20 : 0),
  )

  const autonomyProgress = clampProgress(
    (input.appBuilder.canBuildSmallApp ? 30 : 0)
    + (input.appBuilder.canBuildMultiSliceMvp ? 25 : 0)
    + (input.appBuilder.canRunFullyAutonomous ? 25 : 0)
    + (safeQueue ? 10 : 0)
    + (noFailures ? 10 : 0),
  )

  const selfOptimizationProgress = clampProgress(
    35
    + (input.assistant.prMerged > 0 ? 20 : 0)
    + (input.appBuilder.canBuildMultiSliceMvp ? 20 : 0)
    + (input.autopilot.canAutoMerge ? 15 : 0)
    + (noFailures ? 10 : 0),
  )

  const milestones: AssistantMilestone[] = [
    {
      id: 'm4-reliable-execute-loop',
      title: 'M4 Reliable Execute Loop',
      goal: 'Fünf echte Slices reproduzierbar von Plan bis PR validieren.',
      status: statusFor(runnerProgress, !input.autopilot.canExecuteCode || input.assistant.failed > 0, true),
      progress: runnerProgress,
      whyItMatters: 'Das ist der Beweis, dass ForgePilot nicht nur plant, sondern echten Code zuverlässig liefert.',
      acceptanceCriteria: [
        'Echter Runner ist headless bereit',
        'Validation-Gates laufen reproduzierbar',
        'PR-Flow ist verfügbar',
        'Keine fehlgeschlagenen Delegationen blockieren den Autopilot',
      ],
      nextAction: input.assistant.failed > 0
        ? { label: 'Fehler triagieren', href: '/delegations?urgent=true', mode: 'validate' }
        : input.autopilot.canExecuteCode
          ? { label: 'Nächsten sicheren Slice starten', href: '/delegations', mode: 'execute' }
          : { label: 'Runner einrichten', href: '/live', mode: 'configure' },
    },
    {
      id: 'm5-live-agent-timeline',
      title: 'M5 Live Agent Timeline',
      goal: 'Jeder Nutzer sieht verständlich, was Agenten gerade tun und was als nächstes passiert.',
      status: statusFor(liveProgress, false, runnerProgress >= 60),
      progress: liveProgress,
      whyItMatters: 'Autonomie fühlt sich nur vertrauenswürdig an, wenn Fortschritt, Dateien, Tests und Blocker sichtbar sind.',
      acceptanceCriteria: [
        'Live View zeigt laufende Agenten',
        'Delegation Detail zeigt Status, Logs, Fehler und nächste Aktion',
        'Fehler werden menschlich erklärt',
      ],
      nextAction: { label: 'Live View prüfen', href: '/live', mode: 'validate' },
    },
    {
      id: 'm6-zero-key-runner-mode',
      title: 'M6 Zero-Key Runner Mode',
      goal: 'Claude Max/Claude Code und Codex CLI als bevorzugte Runner ohne API-Key nutzen.',
      status: statusFor(zeroKeyProgress, !input.autopilot.canExecuteCode, runnerProgress >= 50),
      progress: zeroKeyProgress,
      whyItMatters: 'Der Alltag soll über vorhandene Subscriptions und lokale Tools funktionieren, API-Keys bleiben optional.',
      acceptanceCriteria: [
        'Claude CLI oder Codex CLI wird erkannt',
        'Deep Readiness kann den Runner validieren',
        'API-Fallback ist optional und klar markiert',
      ],
      nextAction: { label: 'Deep Readiness prüfen', href: '/live', mode: 'configure' },
    },
    {
      id: 'm7-autonomy-gates-pr-control',
      title: 'M7 Autonomy Gates + PR Control',
      goal: 'Autonom starten, PRs erstellen und nur sichere Änderungen mit Gates abschließen.',
      status: statusFor(autonomyProgress, !input.appBuilder.canBuildSmallApp || !noFailures, runnerProgress >= 75),
      progress: autonomyProgress,
      whyItMatters: 'Mehr Autonomie braucht harte Sicherheitsgrenzen: Risk Class, Tests, Critic Score, Diff und Merge-Regeln.',
      acceptanceCriteria: [
        'Safe Queue wählt nur passende A/B-Slices',
        'PR-Erstellung ist automatisierbar',
        'Auto-Merge bleibt an Score, Tests und Risiko gebunden',
      ],
      nextAction: input.appBuilder.safeNextAction.mode === 'execute'
        ? { label: input.appBuilder.safeNextAction.label, href: input.appBuilder.safeNextAction.href, mode: 'execute' }
        : { label: 'Autonomie-Gates ansehen', href: '/live', mode: 'review' },
    },
    {
      id: 'm8-first-app-builder-flow',
      title: 'M8 First App Builder Flow',
      goal: 'Aus einer Idee automatisch eine kleine echte App in Slices bauen.',
      status: statusFor(input.appBuilder.score, !input.appBuilder.canBuildSmallApp, autonomyProgress >= 70),
      progress: input.appBuilder.score,
      whyItMatters: 'Das ist der Game-Changer-Moment: Aufgabe rein, kontrollierter Fortschritt raus.',
      acceptanceCriteria: [
        'Plan Mode erzeugt App-Typ, Stack, Datenhaltung und MVP-Schnitt',
        'Assistant startet den nächsten sicheren Slice',
        'PR, Critic und Writeback entstehen nach jedem Slice',
      ],
      nextAction: hasWork
        ? { label: 'Assistant übernehmen lassen', href: '/live', mode: 'execute' }
        : { label: 'Neue App-Idee planen', href: '/idea', mode: 'plan' },
    },
    {
      id: 'm9-self-optimizing-assistant',
      title: 'M9 Self-Optimizing Assistant',
      goal: 'ForgePilot lernt aus Runs, verbessert Agentenregeln und empfiehlt den nächsten kleinsten Schritt.',
      status: statusFor(selfOptimizationProgress, false, autonomyProgress >= 80),
      progress: selfOptimizationProgress,
      whyItMatters: 'Der Assistant wird wertvoller, wenn er aus Erfolgen, Fehlern und Review-Ergebnissen bessere Defaults ableitet.',
      acceptanceCriteria: [
        'Knowledge Writeback speichert brauchbare Erkenntnisse',
        'Agentenprofile werden anhand echter Runs bewertet',
        'Daily Report priorisiert Reparatur, nächsten Slice und Optimierung',
      ],
      nextAction: { label: 'Wissen und Agenten prüfen', href: '/tools', mode: 'review' },
    },
  ]

  const focus = milestones.find(m => m.status === 'blocked')
    ?? milestones.find(m => m.status === 'active')
    ?? milestones.find(m => m.status === 'next')
    ?? milestones[milestones.length - 1]

  return {
    title: 'Roadmap zum echten Entwicklungs-Assistenten',
    summary: 'ForgePilot wird in kleinen Gates zu einem täglichen Assistant ausgebaut: erst stabil ausführen, dann sichtbar machen, danach kontrolliert autonom skalieren.',
    focusMilestoneId: focus.id,
    nextAutonomousStep: {
      label: focus.nextAction.label,
      detail: `${focus.title}: ${focus.goal}`,
      href: focus.nextAction.href,
      mode: focus.nextAction.mode,
    },
    milestones,
  }
}
