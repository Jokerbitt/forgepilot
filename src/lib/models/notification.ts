export type NotificationType =
  | 'pm-alert'
  | 'research-complete'
  | 'delegation-blocked'
  | 'delegation_pending'
  | 'delegation_completed'
  | 'delegation_failed'
  | 'milestone-at-risk'
  | 'orchestration-complete'
  | 'orchestration-failed'
  | 'run_complete'
  | 'run_failed'
  | 'delegation_approved'
  | 'brief_ready'
  | 'system'
  | 'loop_complete'
export type NotificationSeverity = 'info' | 'warning' | 'critical'

export interface Notification {
  id: string
  type: NotificationType
  severity: NotificationSeverity
  title: string
  body: string
  link?: string
  sourceId?: string
  read: boolean
  createdAt: string
}
