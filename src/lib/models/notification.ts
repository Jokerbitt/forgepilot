export type NotificationType = 'pm-alert' | 'research-complete' | 'delegation-blocked' | 'milestone-at-risk'
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
