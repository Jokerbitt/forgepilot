'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Circle, ListChecks, Trash2 } from 'lucide-react'
import {
  createTodo,
  filterTodos,
  removeTodo,
  sortTodos,
  summarize,
  toggleTodo,
  type TodoFilter,
  type TodoItem,
  type TodoPriority,
} from '@/lib/todo-planner/todo'
import { Badge, Panel, buttonClassName, cx } from '@/components/ui/primitives'

const STORAGE_KEY = 'forgepilot:todo-planner:v1'

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
}

const PRIORITY_TONE: Record<TodoPriority, 'danger' | 'warning' | 'info'> = {
  high: 'danger',
  medium: 'warning',
  low: 'info',
}

const FILTER_LABEL: Record<TodoFilter, string> = {
  all: 'Alle',
  open: 'Offen',
  done: 'Erledigt',
}

function loadFromStorage(): TodoItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is TodoItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as TodoItem).id === 'string' &&
        typeof (item as TodoItem).title === 'string',
    )
  } catch {
    return []
  }
}

function persistToStorage(items: TodoItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // Ignore quota / privacy errors — UI keeps in-memory state.
  }
}

export default function TodoPlannerPage() {
  const [items, setItems] = useState<TodoItem[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TodoPriority>('medium')
  const [filter, setFilter] = useState<TodoFilter>('open')

  useEffect(() => {
    setItems(loadFromStorage())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) persistToStorage(items)
  }, [items, hydrated])

  const stats = useMemo(() => summarize(items), [items])
  const visible = useMemo(() => sortTodos(filterTodos(items, filter)), [items, filter])

  function handleAdd(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const todo = createTodo(title, priority)
    if (!todo) return
    setItems((prev) => [...prev, todo])
    setTitle('')
    setPriority('medium')
  }

  function handleToggle(id: string): void {
    setItems((prev) => toggleTodo(prev, id))
  }

  function handleRemove(id: string): void {
    setItems((prev) => removeTodo(prev, id))
  }

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-300/80">
            Todo Planner
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Aufgaben &amp; Prioritäten
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Einfache, lokale Tagesplanung. Was muss erledigt werden — und was zuerst?
          </p>
        </header>

        <section
          aria-label="Übersicht"
          className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <SummaryTile label="Gesamt" value={stats.total} />
          <SummaryTile label="Offen" value={stats.open} tone="info" />
          <SummaryTile label="Hoch (offen)" value={stats.highPriorityOpen} tone="danger" />
          <SummaryTile label="Erledigt" value={stats.done} tone="success" />
        </section>

        <Panel className="mb-6 p-5">
          <form onSubmit={handleAdd} className="space-y-3" aria-label="Neue Aufgabe">
            <label
              htmlFor="todo-title"
              className="text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Neue Aufgabe
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="todo-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Was steht an?"
                className="min-h-11 flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-400/60"
                autoComplete="off"
                maxLength={200}
              />
              <label htmlFor="todo-priority" className="sr-only">
                Priorität
              </label>
              <select
                id="todo-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as TodoPriority)}
                className="min-h-11 rounded-lg border border-white/[0.08] bg-black/30 px-3 text-sm text-white outline-none transition-colors focus:border-violet-400/60"
              >
                <option value="high">Hoch</option>
                <option value="medium">Mittel</option>
                <option value="low">Niedrig</option>
              </select>
              <button
                type="submit"
                disabled={title.trim().length === 0}
                className={buttonClassName('primary', 'min-h-11 sm:w-32')}
              >
                Hinzufügen
              </button>
            </div>
          </form>
        </Panel>

        <div
          role="tablist"
          aria-label="Filter"
          className="mb-4 flex flex-wrap gap-2"
        >
          {(Object.keys(FILTER_LABEL) as TodoFilter[]).map((key) => {
            const active = key === filter
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(key)}
                className={cx(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'border-violet-400/60 bg-violet-500/20 text-white'
                    : 'border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-white/[0.07] hover:text-slate-200',
                )}
              >
                {FILTER_LABEL[key]}
              </button>
            )
          })}
        </div>

        {visible.length === 0 ? (
          <EmptyHint hasItems={items.length > 0} filter={filter} />
        ) : (
          <ul className="space-y-2" aria-label="Aufgabenliste">
            {visible.map((item) => (
              <li key={item.id}>
                <TodoRow
                  item={item}
                  onToggle={() => handleToggle(item.id)}
                  onRemove={() => handleRemove(item.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

function SummaryTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'info' | 'success' | 'danger'
}) {
  const valueClass =
    tone === 'success'
      ? 'text-emerald-300'
      : tone === 'danger'
        ? 'text-rose-300'
        : tone === 'info'
          ? 'text-violet-300'
          : 'text-white'
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className={cx('mt-1.5 text-2xl font-bold tracking-tight', valueClass)}>{value}</p>
    </div>
  )
}

function TodoRow({
  item,
  onToggle,
  onRemove,
}: {
  item: TodoItem
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-xl border bg-white/[0.03] p-3 transition-colors',
        item.done
          ? 'border-white/[0.05] opacity-60'
          : 'border-white/[0.08] hover:border-white/[0.15]',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={item.done ? 'Als offen markieren' : 'Als erledigt markieren'}
        aria-pressed={item.done}
        className="text-slate-400 transition-colors hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] rounded"
      >
        {item.done ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-400" aria-hidden="true" />
        ) : (
          <Circle className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
      <p
        className={cx(
          'min-w-0 flex-1 text-sm',
          item.done ? 'text-slate-500 line-through' : 'text-white',
        )}
      >
        {item.title}
      </p>
      <Badge tone={PRIORITY_TONE[item.priority]}>{PRIORITY_LABEL[item.priority]}</Badge>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Aufgabe löschen"
        className="rounded p-1.5 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

function EmptyHint({ hasItems, filter }: { hasItems: boolean; filter: TodoFilter }) {
  const title = !hasItems
    ? 'Noch keine Aufgaben'
    : filter === 'open'
      ? 'Alles erledigt'
      : filter === 'done'
        ? 'Noch nichts erledigt'
        : 'Keine Aufgaben sichtbar'
  const description = !hasItems
    ? 'Lege oben deine erste Aufgabe an und wähle eine Priorität.'
    : filter === 'open'
      ? 'Glückwunsch — keine offenen Aufgaben in dieser Ansicht.'
      : filter === 'done'
        ? 'Schließe eine Aufgabe ab, um sie hier zu sehen.'
        : 'Wechsle den Filter, um Aufgaben zu sehen.'
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.07] bg-white/[0.02] px-6 py-10 text-center">
      <ListChecks className="mb-3 h-8 w-8 text-slate-500" aria-hidden="true" />
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}
