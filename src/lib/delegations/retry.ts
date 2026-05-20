import type { Delegation } from '@/lib/models/delegation'

export type FailureCause =
  | 'cancelled'
  | 'max-retries'
  | 'auth'
  | 'rate-limit'
  | 'timeout'
  | 'budget'
  | 'test-failure'
  | 'type-error'
  | 'unknown'

export interface RetryPlan {
  shouldRetry: boolean
  retryCount: number
  maxRetries: number
  maxRetriesReached: boolean
  failureCause: FailureCause
  diagnosticMessage: string
  additionalContext: string
}

const MAX_RETRIES = 3

function retryCount(delegation: Delegation): number {
  return (delegation.logs ?? []).filter(log => {
    const message = log.message.toLowerCase()
    return message.includes('erneut eingereicht') || message.includes('retry #')
  }).length
}

function combinedFailureText(delegation: Delegation): string {
  return [
    delegation.errorMessage,
    ...(delegation.logs ?? []).slice(-10).map(log => log.message),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

function classifyFailure(delegation: Delegation): FailureCause {
  if (delegation.status === 'cancelled') return 'cancelled'

  const text = combinedFailureText(delegation)
  if (text.includes('authentication') || text.includes('invalid x-api-key') || text.includes('api key')) return 'auth'
  if (text.includes('rate limit') || text.includes('rate_limit')) return 'rate-limit'
  if (text.includes('timeout') || text.includes('timed out') || text.includes('zeitueberschreitung')) return 'timeout'
  if (text.includes('budget') || text.includes('kosten')) return 'budget'
  if (text.includes('test failed') || text.includes('tests failed') || text.includes('test fehl')) return 'test-failure'
  if (text.includes('type error') || text.includes('typescript') || text.includes('tsc')) return 'type-error'
  return 'unknown'
}

function guidanceFor(cause: FailureCause): string {
  switch (cause) {
    case 'cancelled':
      return 'Die Delegation wurde bewusst abgebrochen und wird nicht automatisch erneut eingereiht.'
    case 'auth':
      return 'Pruefe Auth/API-Key-Konfiguration bevor ein Retry gestartet wird.'
    case 'rate-limit':
      return 'Warte kurz oder route auf ein anderes Modell, bevor erneut gestartet wird.'
    case 'timeout':
      return 'Reduziere Scope oder Kontextpaket und starte dann erneut.'
    case 'budget':
      return 'Budget/Scope pruefen; Retry nur mit bewusster Budgetentscheidung.'
    case 'test-failure':
      return 'Retry mit Fokus auf fehlgeschlagene Tests und Root-Cause-Diagnose.'
    case 'type-error':
      return 'Retry mit Fokus auf TypeScript-Fehler und kleineren Aenderungsumfang.'
    case 'max-retries':
      return 'Maximale Retry-Anzahl erreicht; menschliches Review erforderlich.'
    case 'unknown':
      return 'Retry erlaubt, aber mit Diagnosehinweis im Kontext.'
  }
}

export function buildRetryPlan(delegation: Delegation): RetryPlan {
  const count = retryCount(delegation)
  const maxRetriesReached = count >= MAX_RETRIES
  const failureCause = maxRetriesReached ? 'max-retries' : classifyFailure(delegation)
  const shouldRetry = !maxRetriesReached && failureCause !== 'cancelled'
  const diagnosticMessage = guidanceFor(failureCause)

  return {
    shouldRetry,
    retryCount: count,
    maxRetries: MAX_RETRIES,
    maxRetriesReached,
    failureCause,
    diagnosticMessage,
    additionalContext: [
      delegation.contract.context,
      '',
      '## Retry Guidance',
      diagnosticMessage,
      delegation.errorMessage ? `Letzter Fehler: ${delegation.errorMessage}` : '',
    ].filter(Boolean).join('\n'),
  }
}
