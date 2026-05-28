export type TodoPriority = 'low' | 'medium' | 'high'

export interface TodoItem {
  id: string
  title: string
  priority: TodoPriority
  done: boolean
  createdAt: string
}

export type TodoFilter = 'all' | 'open' | 'done'

const PRIORITY_RANK: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export function createTodo(
  title: string,
  priority: TodoPriority = 'medium',
  now: Date = new Date()
): TodoItem | null {
  const trimmed = title.trim()
  if (trimmed.length === 0) return null
  return {
    id: `todo-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    title: trimmed,
    priority,
    done: false,
    createdAt: now.toISOString(),
  }
}

export function toggleTodo(items: readonly TodoItem[], id: string): TodoItem[] {
  return items.map((item) => (item.id === id ? { ...item, done: !item.done } : item))
}

export function removeTodo(items: readonly TodoItem[], id: string): TodoItem[] {
  return items.filter((item) => item.id !== id)
}

export function filterTodos(items: readonly TodoItem[], filter: TodoFilter): TodoItem[] {
  if (filter === 'open') return items.filter((item) => !item.done)
  if (filter === 'done') return items.filter((item) => item.done)
  return [...items]
}

export function sortTodos(items: readonly TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export interface TodoStats {
  total: number
  open: number
  done: number
  highPriorityOpen: number
}

export function summarize(items: readonly TodoItem[]): TodoStats {
  let open = 0
  let done = 0
  let highPriorityOpen = 0
  for (const item of items) {
    if (item.done) done += 1
    else {
      open += 1
      if (item.priority === 'high') highPriorityOpen += 1
    }
  }
  return { total: items.length, open, done, highPriorityOpen }
}
