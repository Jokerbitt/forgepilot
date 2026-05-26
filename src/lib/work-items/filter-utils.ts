import type { WorkItem, WorkItemStatus } from '@/lib/models/work-item'

export type StatusGroup = 'all' | 'open' | 'in_progress' | 'done'

const STATUS_TO_GROUP: Record<Exclude<StatusGroup, 'all'>, WorkItemStatus[]> = {
  open: ['backlog', 'todo'],
  in_progress: ['in-progress', 'in-review'],
  done: ['done', 'cancelled'],
}

export const STATUS_GROUP_TO_DEFAULT_STATUS: Record<Exclude<StatusGroup, 'all'>, WorkItemStatus> = {
  open: 'todo',
  in_progress: 'in-progress',
  done: 'done',
}

export function getStatusGroup(status: WorkItemStatus): Exclude<StatusGroup, 'all'> {
  if (STATUS_TO_GROUP.open.includes(status)) return 'open'
  if (STATUS_TO_GROUP.in_progress.includes(status)) return 'in_progress'
  return 'done'
}

export function filterByStatusGroup(items: WorkItem[], group: StatusGroup): WorkItem[] {
  if (group === 'all') return items
  const allowed = STATUS_TO_GROUP[group]
  return items.filter(item => allowed.includes(item.status))
}

export function countByStatusGroup(items: WorkItem[]): Record<Exclude<StatusGroup, 'all'>, number> {
  const counts = { open: 0, in_progress: 0, done: 0 }
  for (const item of items) {
    counts[getStatusGroup(item.status)] += 1
  }
  return counts
}
