import type { Delegation, DelegationStatus } from '@/lib/models/delegation'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastPayload {
  type: ToastType
  title: string
  message: string
  delegationId?: string
}

export type DelegationStatusSnapshot = Record<string, DelegationStatus>

export function truncateToastMessage(value: string, maxLength = 90): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  if (maxLength <= 3) return '.'.repeat(Math.max(0, maxLength))
  return `${trimmed.slice(0, maxLength - 3)}...`
}

export function buildDelegationCompletionToasts(
  delegations: Delegation[],
  previousStatuses: DelegationStatusSnapshot
): { nextStatuses: DelegationStatusSnapshot; toasts: ToastPayload[] } {
  const nextStatuses: DelegationStatusSnapshot = {}
  const toasts: ToastPayload[] = []

  for (const delegation of delegations) {
    const previousStatus = previousStatuses[delegation.id]
    nextStatuses[delegation.id] = delegation.status

    if (previousStatus !== 'running') continue

    if (delegation.status === 'completed') {
      toasts.push({
        type: 'success',
        title: 'Agent fertig',
        message: truncateToastMessage(delegation.title || delegation.contract.goal),
        delegationId: delegation.id,
      })
    }

    if (delegation.status === 'failed') {
      toasts.push({
        type: 'error',
        title: 'Agent fehlgeschlagen',
        message: truncateToastMessage(delegation.title || delegation.contract.goal),
        delegationId: delegation.id,
      })
    }
  }

  return { nextStatuses, toasts }
}
