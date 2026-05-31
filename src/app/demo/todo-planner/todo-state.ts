export interface TodoItem {
  id: string
  title: string
  area: string
  done: boolean
}

export const TODO_STORAGE_KEY = 'forgepilot.todo-planner-demo.todos.v1'

const DEMO_TODOS: ReadonlyArray<TodoItem> = [
  { id: 'focus', title: 'MVP-Aufgaben fuer heute festlegen', area: 'Planung', done: true },
  { id: 'ui', title: 'Klare ToDo-Liste mit Fortschritt pruefen', area: 'Produkt', done: false },
  { id: 'runner', title: 'Echten Runner-PR aus ForgePilot starten', area: 'ForgePilot', done: false },
]

export function freshDemoTodos(): TodoItem[] {
  return DEMO_TODOS.map(todo => ({ ...todo }))
}

function isValidTodo(value: unknown): value is TodoItem {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' && candidate.id.length > 0 &&
    typeof candidate.title === 'string' && candidate.title.length > 0 &&
    typeof candidate.area === 'string' && candidate.area.length > 0 &&
    typeof candidate.done === 'boolean'
  )
}

export function parseStoredTodos(raw: string | null): TodoItem[] | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    if (!parsed.every(isValidTodo)) return null
    return parsed.map(item => ({ ...item }))
  } catch {
    return null
  }
}

export interface TodoProgress {
  doneCount: number
  total: number
  percent: number
}

export function computeProgress(todos: ReadonlyArray<TodoItem>): TodoProgress {
  const total = todos.length
  const doneCount = todos.filter(todo => todo.done).length
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100)
  return { doneCount, total, percent }
}

export function findNextTodo(todos: ReadonlyArray<TodoItem>): TodoItem | undefined {
  return todos.find(todo => !todo.done)
}

export function toggleTodoDone(todos: ReadonlyArray<TodoItem>, id: string): TodoItem[] {
  return todos.map(todo => (todo.id === id ? { ...todo, done: !todo.done } : todo))
}

export function appendTodo(
  todos: ReadonlyArray<TodoItem>,
  title: string,
  id: string,
  area = 'Heute',
): TodoItem[] {
  const trimmed = title.trim()
  if (!trimmed) return todos.map(todo => ({ ...todo }))
  return [...todos.map(todo => ({ ...todo })), { id, title: trimmed, area, done: false }]
}

export function groupTodosByArea(todos: ReadonlyArray<TodoItem>): Record<string, TodoItem[]> {
  return todos.reduce<Record<string, TodoItem[]>>((groups, todo) => {
    groups[todo.area] = [...(groups[todo.area] ?? []), { ...todo }]
    return groups
  }, {})
}
