'use client'

import type { Delegation } from '@/lib/models/delegation'

type StepState = 'done' | 'active' | 'pending' | 'blocked'

interface ActivityStep {
  label: string
  detail: string
  state: StepState
}

interface AgentActivityState {
  eyebrow: string
  title: string
  body: string
  latestObservation: string
  nextAction: string
  tone: 'neutral' | 'info' | 'active' | 'success' | 'warning' | 'danger'
  steps: ActivityStep[]
}

const terminalStatuses = new Set(['completed', 'failed', 'cancelled', 'rejected'])

function getLatestObservation(d: Delegation): string {
  if (d.errorMessage) return d.errorMessage
  const lastLog = d.logs?.slice().reverse().find(log => log.message.trim().length > 0)
  if (lastLog?.message) return lastLog.message
  if (d.summaryReport?.keyPoints?.[0]) return d.summaryReport.keyPoints[0]
  if (d.summaryReport?.changes?.[0]) return d.summaryReport.changes[0]
  return 'Noch keine Agenten-Beobachtung vorhanden.'
}

function explainFailure(message: string): { body: string; nextAction: string } {
  const lower = message.toLowerCase()
  if (lower.includes('turn limit') || lower.includes('max_turns')) {
    return {
      body: 'Der Agent hat die Aufgabe begonnen, aber sein Arbeitsfenster war zu klein. Das passiert oft bei zu großen oder zu offenen Tasks.',
      nextAction: 'Task kleiner schneiden oder mit mehr Budget und stärkerem Modell erneut starten.',
    }
  }
  if (lower.includes('auth') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return {
      body: 'Der Agent wurde durch eine Berechtigung oder fehlende Anmeldung gestoppt.',
      nextAction: 'Settings prüfen, Verbindung testen und danach erneut ausführen.',
    }
  }
  if (lower.includes('api key') || lower.includes('provider') || lower.includes('noaiprovider')) {
    return {
      body: 'Der passende KI-Provider ist nicht erreichbar oder nicht vollständig eingerichtet.',
      nextAction: 'Provider in Settings testen oder auf Auto-Modus mit verfügbarem Modell wechseln.',
    }
  }
  if (lower.includes('conflict') || lower.includes('merge')) {
    return {
      body: 'Der Agent ist vermutlich auf Git- oder Merge-Konflikte gestoßen.',
      nextAction: 'Branch/PR prüfen, Konflikt bereinigen und danach erneut ausführen.',
    }
  }
  return {
    body: 'Der Agent wurde gestoppt, bevor ein verlässliches Ergebnis abgeschlossen werden konnte.',
    nextAction: 'Letzten Log prüfen, Ursache beheben und dann erneut ausführen oder auf bestes Modell eskalieren.',
  }
}

function buildSteps(d: Delegation): ActivityStep[] {
  const status = d.status
  const isTerminal = terminalStatuses.has(status)
  const hasPr = Boolean(d.summaryReport?.prUrl)
  const hasCritic = Boolean(d.criticScore)

  return [
    {
      label: 'Auftrag',
      detail: 'Ziel, Scope und Kriterien sind erfasst.',
      state: 'done',
    },
    {
      label: 'Freigabe',
      detail: d.contract.requiresApproval ? 'Risiko und Budget sind freigegeben.' : 'Keine manuelle Freigabe erforderlich.',
      state: status === 'pending' && d.contract.requiresApproval ? 'active' : 'done',
    },
    {
      label: 'Ausführung',
      detail: 'Der Agent arbeitet im erlaubten Scope.',
      state: status === 'running' ? 'active' : isTerminal ? (status === 'failed' ? 'blocked' : 'done') : 'pending',
    },
    {
      label: 'Ergebnis',
      detail: hasPr ? 'PR oder Ergebnislink ist vorhanden.' : 'Diff, Summary und nächste Schritte werden erzeugt.',
      state: hasPr || status === 'completed' ? 'done' : status === 'failed' ? 'blocked' : 'pending',
    },
    {
      label: 'Review',
      detail: hasCritic ? 'Critic-Bewertung wurde gespeichert.' : 'Critic und Writeback folgen nach dem Ergebnis.',
      state: hasCritic ? 'done' : status === 'completed' ? 'active' : status === 'failed' ? 'blocked' : 'pending',
    },
  ]
}

export function getAgentActivityState(d: Delegation): AgentActivityState {
  const latestObservation = getLatestObservation(d)
  const steps = buildSteps(d)

  if (d.status === 'running') {
    return {
      eyebrow: 'Live-Ausführung',
      title: 'Der Agent arbeitet gerade an dieser Delegation.',
      body: 'ForgePilot beobachtet den Lauf, sammelt Logs und aktualisiert Kosten, Status und Ergebnis. Unten siehst du den technischen Live-Stream.',
      latestObservation,
      nextAction: 'Warte auf Abschluss oder Fehlermeldung. Wenn sich lange nichts bewegt, Live-Logs prüfen.',
      tone: 'active',
      steps,
    }
  }

  if (d.status === 'failed') {
    const failure = explainFailure(latestObservation)
    return {
      eyebrow: 'Agent gestoppt',
      title: 'Die Ausführung braucht deine Entscheidung.',
      body: failure.body,
      latestObservation,
      nextAction: failure.nextAction,
      tone: 'danger',
      steps,
    }
  }

  if (d.status === 'completed') {
    if (d.summaryReport?.prUrl && d.criticScore) {
      return {
        eyebrow: 'Ergebnis geprüft',
        title: 'Der Agentenlauf ist abgeschlossen und bewertet.',
        body: 'Codeänderung, PR und Critic-Ergebnis liegen vor. Jetzt geht es um Review, Merge oder gezielte Nacharbeit.',
        latestObservation,
        nextAction: d.criticScore.verdict === 'approved'
          ? 'PR prüfen und mergen, wenn die Änderungen fachlich passen.'
          : 'Critic-Hinweise prüfen und eine kleine Follow-up-Delegation starten.',
        tone: d.criticScore.verdict === 'approved' ? 'success' : 'warning',
        steps,
      }
    }
    if (d.summaryReport?.prUrl) {
      return {
        eyebrow: 'PR erstellt',
        title: 'Der Agent hat ein Ergebnis geliefert.',
        body: 'Der Pull Request ist da. Vor dem Merge sollte noch eine unabhängige Critic-Prüfung laufen.',
        latestObservation,
        nextAction: 'Critic-Review starten und danach PR prüfen.',
        tone: 'success',
        steps,
      }
    }
    return {
      eyebrow: 'Ausführung fertig',
      title: 'Der Agent hat die Delegation abgeschlossen.',
      body: 'Jetzt sollte das Ergebnis geprüft, bewertet und in einen PR oder Writeback überführt werden.',
      latestObservation,
      nextAction: 'Summary prüfen, Critic starten und danach PR erstellen.',
      tone: 'success',
      steps,
    }
  }

  if (d.status === 'approved') {
    return {
      eyebrow: 'Startbereit',
      title: 'Der Auftrag ist freigegeben und kann ausgeführt werden.',
      body: 'Preflight, Scope und Budget sind der nächste Sicherheitscheck, bevor der Agent losläuft.',
      latestObservation,
      nextAction: 'Ausführung starten und danach den Live-Fortschritt beobachten.',
      tone: 'info',
      steps,
    }
  }

  if (d.status === 'pending') {
    return {
      eyebrow: 'Wartet',
      title: d.contract.requiresApproval ? 'Der Agent wartet auf Freigabe.' : 'Die Delegation ist vorbereitet.',
      body: 'Noch wurde keine Ausführung gestartet. Prüfe kurz Ziel, Scope, Risiko und Budget.',
      latestObservation,
      nextAction: d.contract.requiresApproval ? 'Freigeben, wenn Scope und Kriterien passen.' : 'Starten, wenn die Aufgabe klar genug ist.',
      tone: 'neutral',
      steps,
    }
  }

  return {
    eyebrow: 'Status',
    title: 'Diese Delegation ist nicht aktiv.',
    body: 'ForgePilot hält den aktuellen Stand fest, damit du entscheiden kannst, ob du weitermachst, wiederholst oder abschließt.',
    latestObservation,
    nextAction: 'Status prüfen und bei Bedarf eine neue Delegation starten.',
    tone: 'neutral',
    steps,
  }
}

const toneClasses: Record<AgentActivityState['tone'], string> = {
  neutral: 'border-slate-800 bg-slate-950/70',
  info: 'border-blue-900/50 bg-blue-950/20',
  active: 'border-violet-800/60 bg-violet-950/20',
  success: 'border-emerald-900/50 bg-emerald-950/20',
  warning: 'border-amber-900/50 bg-amber-950/20',
  danger: 'border-red-900/50 bg-red-950/20',
}

const stepClasses: Record<StepState, string> = {
  done: 'border-emerald-800/50 bg-emerald-950/30 text-emerald-300',
  active: 'border-violet-700/60 bg-violet-950/40 text-violet-200',
  pending: 'border-slate-800 bg-slate-950 text-slate-500',
  blocked: 'border-red-800/60 bg-red-950/30 text-red-300',
}

const stepSymbol: Record<StepState, string> = {
  done: '✓',
  active: '●',
  pending: '○',
  blocked: '!',
}

export function AgentActivityExplainer({ delegation }: { delegation: Delegation }) {
  const state = getAgentActivityState(delegation)

  return (
    <section className={`rounded-xl border p-5 ${toneClasses[state.tone]}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Was passiert gerade?
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
              {state.eyebrow}
            </span>
            {delegation.executionRoute && (
              <span className="rounded-full border border-slate-800 bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-500">
                Route: {delegation.executionRoute}
              </span>
            )}
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">{state.title}</h2>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400">{state.body}</p>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3 lg:w-80">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nächster sinnvoller Schritt</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{state.nextAction}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 md:grid-cols-5">
        {state.steps.map((step, index) => (
          <div key={step.label} className={`rounded-lg border px-3 py-3 ${stepClasses[step.state]}`}>
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-current/30 text-[11px] font-bold">
                {stepSymbol[step.state]}
              </span>
              <p className="text-xs font-semibold">{index + 1}. {step.label}</p>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed opacity-80">{step.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Letzte Beobachtung des Agenten</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{state.latestObservation}</p>
      </div>
    </section>
  )
}
