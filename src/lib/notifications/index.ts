import { randomUUID } from 'crypto'
import type { Delegation } from '@/lib/models/delegation'
import { saveNotification } from './notification-store'

export { saveNotification, readNotifications, markAsRead, markAllAsRead, getUnreadCount } from './notification-store'
export { readNotificationPreferences, updateNotificationPreferences } from './preferences-store'

export interface NotifyExecutionResultParams {
  delegation: Delegation
  event: 'completed' | 'failed'
}

/**
 * Persist an in-app notification when a delegation run completes or fails.
 * Used by the budget guard and other execution-result reporters.
 */
export async function notifyExecutionResult({ delegation, event }: NotifyExecutionResultParams): Promise<void> {
  const isFailure = event === 'failed'
  const label = delegation.title || delegation.contract?.goal?.slice(0, 60) || delegation.id

  saveNotification({
    id: randomUUID(),
    type: isFailure ? 'run_failed' : 'run_complete',
    severity: isFailure ? 'critical' : 'info',
    title: isFailure ? `Delegation failed: ${label}` : `Delegation completed: ${label}`,
    body: delegation.errorMessage ?? (isFailure ? 'Execution stopped.' : 'Execution finished successfully.'),
    link: `/delegations/${delegation.id}`,
    sourceId: delegation.id,
    read: false,
    createdAt: new Date().toISOString(),
  })
}
