export type TodoPriority = 'low' | 'medium' | 'high'
export type TodoStatus = 'open' | 'in_progress' | 'done'
export type TodoFilter = 'all' | 'open' | 'done'

export interface Todo {
  id: string
  title: string
  priority: TodoPriority
  status: TodoStatus
  createdAt: string
  isSample?: boolean
}

const PRIORITY_WEIGHT: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const STATUS_WEIGHT: Record<TodoStatus, number> = {
  in_progress: 0,
  open: 1,
  done: 2,
}

export const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
}

export const STATUS_LABELS: Record<TodoStatus, string> = {
  open: 'Offen',
  in_progress: 'In Arbeit',
  done: 'Erledigt',
}

export interface CreateTodoInput {
  title: string
  priority: TodoPriority
  status: TodoStatus
  now?: () => Date
  idGenerator?: () => string
}

export function createTodo(input: CreateTodoInput): Todo | null {
  const title = input.title.trim()
  if (!title) return null

  const now = (input.now ?? (() => new Date()))()
  const id = (input.idGenerator ?? defaultIdGenerator)()

  return {
    id,
    title,
    priority: input.priority,
    status: input.status,
    createdAt: now.toISOString(),
  }
}

export function sortTodos(todos: readonly Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    const statusDiff = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status]
    if (statusDiff !== 0) return statusDiff
    const priorityDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export function filterTodos(todos: readonly Todo[], filter: TodoFilter): Todo[] {
  if (filter === 'all') return [...todos]
  if (filter === 'done') return todos.filter(todo => todo.status === 'done')
  return todos.filter(todo => todo.status !== 'done')
}

export function countOpenTodos(todos: readonly Todo[]): number {
  return todos.filter(todo => todo.status !== 'done').length
}

export function isSampleSet(todos: readonly Todo[]): boolean {
  return todos.length > 0 && todos.every(todo => todo.isSample === true)
}

export function buildSampleTodos(now: () => Date = () => new Date()): Todo[] {
  const baseDate = now().toISOString()
  return [
    {
      id: 'sample-1',
      title: 'ForgePilot-Tour anschauen',
      priority: 'medium',
      status: 'open',
      createdAt: baseDate,
      isSample: true,
    },
    {
      id: 'sample-2',
      title: 'Erste eigene Aufgabe anlegen',
      priority: 'high',
      status: 'in_progress',
      createdAt: baseDate,
      isSample: true,
    },
    {
      id: 'sample-3',
      title: 'Beispielaufgaben entfernen',
      priority: 'low',
      status: 'open',
      createdAt: baseDate,
      isSample: true,
    },
  ]
}

function defaultIdGenerator(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
