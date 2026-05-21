import type { WorkItem } from '@/lib/models/work-item'

export type WorkItemSortKey = 'priority' | 'title' | 'updatedAt'
export type SortDirection = 'asc' | 'desc'

export function sortWorkItems(
  items: WorkItem[],
  sortKey: WorkItemSortKey,
  sortDir: SortDirection,
): WorkItem[] {
  return [...items].sort((a, b) => {
    let cmp = 0
    if (sortKey === 'priority') {
      cmp = a.priority - b.priority
    } else if (sortKey === 'title') {
      cmp = a.title.localeCompare(b.title)
    } else if (sortKey === 'updatedAt') {
      cmp = a.updatedAt.localeCompare(b.updatedAt)
    }
    return sortDir === 'asc' ? cmp : -cmp
  })
}
