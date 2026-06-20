/**
 * Journey Companion — Phase 1.1 + 1.2: plain-language build progress & errors.
 *
 * Translates the technical delegation/plan state (status, chainPosition, retryCount,
 * budgetPaused, errorMessage) into simple German a non-techie understands — and
 * makes the existing auto-retry self-healing visible ("ForgePilot versucht Variante B")
 * instead of showing a stack trace.
 *
 * Pure: takes plain inputs (not the full Delegation), so it is trivially testable
 * and decoupled from the repository.
 */
import type { DelegationStatus } from '@/lib/models/delegation'

export type ProgressState = 'waiting' | 'running' | 'retrying' | 'paused' | 'done' | 'failed' | 'cancelled'

export interface ProgressInput {
  title: string
  status: DelegationStatus
  chainPosition?: number
  chainTotal?: number
  retryCount?: number
  budgetPaused?: boolean
  errorMessage?: string
  failureFeedback?: string
}

export interface ProgressView {
  state: ProgressState
  emoji: string
  /** Short headline in plain German. */
  headline: string
  /** Optional extra line (step counter, plain error explanation). */
  detail?: string
}

export interface PlanProgressView {
  state: ProgressState
  emoji: string
  headline: string
  /** Steps done / total. */
  done: number
  total: number
  steps: ProgressView[]
}

/** Turn a technical error into a friendly, plain-German explanation. */
export function explainError(errorMessage?: string, failureFeedback?: string): string {
  const raw = `${errorMessage ?? ''} ${failureFeedback ?? ''}`.toLowerCase()
  if (!raw.trim()) return 'Es gab ein Problem — ForgePilot bessert nach.'
  if (/\bts\d{3,}\b|type error|typecheck|tsc/.test(raw)) return 'Ein Typ-Fehler im Code — wird automatisch korrigiert.'
  if (/test|vitest|jest|assertion/.test(raw)) return 'Ein automatischer Test ist nicht durchgelaufen.'
  if (/module not found|cannot find module|enoent|npm|install/.test(raw)) return 'Eine benötigte Komponente fehlte — wird nachinstalliert.'
  if (/build|compile|next build|webpack/.test(raw)) return 'Der Build ist nicht durchgelaufen.'
  if (/timeout|etimedout|timed out/.test(raw)) return 'Ein Schritt hat zu lange gedauert.'
  if (/budget|cost cap|token/.test(raw)) return 'Das Budget war aufgebraucht.'
  if (/permission|denied|eacces|unauthorized|403|401/.test(raw)) return 'Eine Berechtigung hat gefehlt.'
  // Fallback: first line of the technical message, trimmed.
  const firstLine = (errorMessage ?? failureFeedback ?? '').split('\n')[0]!.trim()
  return firstLine ? `Es gab ein Problem: ${firstLine.slice(0, 160)}` : 'Es gab ein Problem — ForgePilot bessert nach.'
}

function stepSuffix(p: ProgressInput): string | undefined {
  if (p.chainPosition && p.chainTotal) return `Schritt ${p.chainPosition} von ${p.chainTotal}`
  return undefined
}

/** Humanize a single delegation's progress. */
export function humanizeDelegationProgress(p: ProgressInput): ProgressView {
  const step = stepSuffix(p)

  if (p.budgetPaused) {
    return { state: 'paused', emoji: '⏸️', headline: `Pausiert: „${p.title}"`, detail: 'Budget aufgebraucht — kann fortgesetzt werden.' }
  }

  switch (p.status) {
    case 'pending':
    case 'approved':
      return { state: 'waiting', emoji: '⏳', headline: `Wartet: „${p.title}"`, detail: step }
    case 'running':
      if ((p.retryCount ?? 0) > 0) {
        return { state: 'retrying', emoji: '🔄', headline: `Neuer Versuch: „${p.title}"`, detail: `Variante ${(p.retryCount ?? 0) + 1} — ForgePilot bessert automatisch nach.` }
      }
      return { state: 'running', emoji: '⚙️', headline: `Wird gebaut: „${p.title}"`, detail: step }
    case 'completed':
      return { state: 'done', emoji: '✅', headline: `Fertig: „${p.title}"`, detail: step }
    case 'failed':
      return { state: 'failed', emoji: '⚠️', headline: `Hat nicht geklappt: „${p.title}"`, detail: explainError(p.errorMessage, p.failureFeedback) }
    case 'cancelled':
    case 'rejected':
      return { state: 'cancelled', emoji: '⏹️', headline: `Abgebrochen: „${p.title}"`, detail: step }
    default:
      return { state: 'waiting', emoji: '⏳', headline: `„${p.title}"`, detail: step }
  }
}

/** Aggregate a sequential plan's delegations into one plain-German status. */
export function humanizePlanProgress(items: ProgressInput[]): PlanProgressView {
  const steps = items.map(humanizeDelegationProgress)
  const total = items.length
  const done = steps.filter(s => s.state === 'done').length

  if (total === 0) {
    return { state: 'waiting', emoji: '⏳', headline: 'Noch nichts gestartet.', done: 0, total: 0, steps }
  }

  const failedIdx = steps.findIndex(s => s.state === 'failed')
  const pausedIdx = steps.findIndex(s => s.state === 'paused')
  const retryIdx = steps.findIndex(s => s.state === 'retrying')
  const runningIdx = steps.findIndex(s => s.state === 'running')

  if (done === total) {
    return { state: 'done', emoji: '🎉', headline: 'Alles fertig — deine App ist gebaut und geprüft.', done, total, steps }
  }
  if (failedIdx !== -1) {
    return { state: 'failed', emoji: '⚠️', headline: `Bei Schritt ${failedIdx + 1} von ${total} gab es ein Problem.`, done, total, steps }
  }
  if (pausedIdx !== -1) {
    return { state: 'paused', emoji: '⏸️', headline: `Pausiert bei Schritt ${pausedIdx + 1} von ${total} (Budget) — fortsetzbar.`, done, total, steps }
  }
  if (retryIdx !== -1) {
    return { state: 'retrying', emoji: '🔄', headline: `Schritt ${retryIdx + 1} von ${total} wird neu versucht — ForgePilot bessert nach.`, done, total, steps }
  }
  if (runningIdx !== -1) {
    return { state: 'running', emoji: '⚙️', headline: `Schritt ${runningIdx + 1} von ${total} läuft: ${items[runningIdx]!.title}`, done, total, steps }
  }
  return { state: 'waiting', emoji: '⏳', headline: `${done} von ${total} Schritten fertig.`, done, total, steps }
}
