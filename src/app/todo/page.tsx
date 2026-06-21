'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, ListChecks, PlayCircle, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Badge, EmptyState, buttonClassName, cx } from '@/components/ui/primitives'
import {
  buildSampleTodos,
  countByFilter,
  countOpenTodos,
  createTodo,
  filterTodos,
  isSampleSet,
  PRIORITY_LABELS,
  sortTodos,
  STATUS_LABELS,
  type Todo,
  type TodoFilter,
  type TodoPriority,
  type TodoStatus,
} from '@/lib/todo/todo-store'

const PRIORITY_TONE: Record<TodoPriority, 'danger' | 'warning' | 'neutral'> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
}

const PRIORITY_BAR: Record<TodoPriority, string> = {
  high: 'bg-rose-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-600',
}

const STATUS_TONE: Record<TodoStatus, 'info' | 'warning' | 'success'> = {
  open: 'warning',
  in_progress: 'info',
  done: 'success',
}

const FILTERS: Array<{ value: TodoFilter; label: string }> = [
  { value: 'all', label: 'Alle' },
  { value: 'open', label: 'Offen' },
  { value: 'done', label: 'Erledigt' },
]

const PRIORITY_OPTIONS: TodoPriority[] = ['high', 'medium', 'low']
const STATUS_OPTIONS: TodoStatus[] = ['open', 'in_progress', 'done']
const GENERIC_STORAGE_ERROR = 'Aufgaben konnten nicht gespeichert werden. Bitte versuche es erneut.'

interface TodoApiResponse {
  todos?: Todo[]
  error?: string
}

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TodoPriority>('medium')
  const [status, setStatus] = useState<TodoStatus>('open')
  const [filter, setFilter] = useState<TodoFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)

  const sorted = useMemo(() => sortTodos(todos), [todos])
  const visible = useMemo(() => filterTodos(sorted, filter), [sorted, filter])
  const counts = useMemo(() => countByFilter(todos), [todos])
  const openCount = countOpenTodos(todos)
  const sampleMode = isSampleSet(todos)
  const isEmpty = todos.length === 0

  useEffect(() => {
    let isMounted = true

    async function loadTodos() {
      try {
        const response = await fetch('/api/todo', { cache: 'no-store' })
        const payload = (await response.json()) as TodoApiResponse
        if (!response.ok) throw new Error(payload.error ?? 'Aufgaben konnten nicht geladen werden.')
        if (isMounted) {
          setTodos(payload.todos ?? [])
          setStorageError(null)
        }
      } catch (error) {
        if (isMounted) {
          setStorageError(error instanceof Error ? error.message : 'Aufgaben konnten nicht geladen werden.')
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadTodos()
    return () => {
      isMounted = false
    }
  }, [])

  async function persistTodos(nextTodos: Todo[]) {
    setIsSaving(true)
    try {
      const response = await fetch('/api/todo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todos: nextTodos }),
      })
      const payload = (await response.json()) as TodoApiResponse
      if (!response.ok) throw new Error(payload.error ?? GENERIC_STORAGE_ERROR)
      setTodos(payload.todos ?? nextTodos)
      setStorageError(null)
      return true
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : GENERIC_STORAGE_ERROR)
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAdd() {
    const created = createTodo({ title, priority, status })
    if (!created) return
    const nextTodos = [...todos.filter(todo => !todo.isSample), created]
    const saved = await persistTodos(nextTodos)
    if (saved) setTitle('')
  }

  function handleStatusChange(id: string, next: TodoStatus) {
    void persistTodos(todos.map(todo => (todo.id === id ? { ...todo, status: next } : todo)))
  }

  function handleRemove(id: string) {
    void persistTodos(todos.filter(todo => todo.id !== id))
  }

  function handleLoadSample() {
    void persistTodos(buildSampleTodos())
  }

  function handleClearSample() {
    void persistTodos([])
  }

  return (
    <main className="min-h-screen text-white">
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center gap-3">
        <Link href="/" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">← Command Center</Link>
        <span className="text-slate-700">/</span>
        <span className="text-sm text-slate-400">Todo-App</span>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <p className="page-eyebrow">Todo-App</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Deine fokussierte Aufgabenliste
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Lege Aufgaben mit Prioritaet und Status an und behalte den Ueberblick zwischen Offen, In Arbeit und Erledigt.
          </p>
        </header>

        <section
          aria-label="Produktiver Testlauf"
          className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <div>
                <p className="text-sm font-semibold text-emerald-100">Produktiver Testlauf geprueft</p>
                <p className="mt-1 text-xs leading-5 text-emerald-100/75">
                  Persistenz, API-Validierung, Reload-Verhalten und CI sind dokumentiert. Diese Seite ist der erste kleine ForgePilot-App-Run.
                </p>
              </div>
            </div>
            <Link href="/live" className={buttonClassName('secondary', 'min-h-9 shrink-0')}>
              Live View
            </Link>
          </div>
        </section>

        <section
          aria-label="Neue Aufgabe anlegen"
          className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 shadow-sm shadow-black/20 sm:p-6"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Plus className="h-3.5 w-3.5" />
            Neue Aufgabe
          </div>
          <div className="mt-4 space-y-3">
            <label htmlFor="todo-title" className="sr-only">Titel</label>
            <input
              id="todo-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleAdd()
                }
              }}
              placeholder="z.B. Projekt-Brief fuer Neuer Kunde vorbereiten"
              className="w-full rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-400/60"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                id="todo-priority"
                label="Prioritaet"
                value={priority}
                onChange={value => setPriority(value as TodoPriority)}
                options={PRIORITY_OPTIONS.map(value => ({ value, label: PRIORITY_LABELS[value] }))}
              />
              <SelectField
                id="todo-status"
                label="Status"
                value={status}
                onChange={value => setStatus(value as TodoStatus)}
                options={STATUS_OPTIONS.map(value => ({ value, label: STATUS_LABELS[value] }))}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">Enter speichert die Aufgabe sofort.</p>
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={!title.trim() || isSaving || isLoading}
                className={buttonClassName('primary', 'min-h-10 sm:w-auto')}
              >
                {isSaving ? 'Speichert...' : 'Aufgabe speichern'}
              </button>
            </div>
            {storageError && (
              <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 text-xs leading-5 text-rose-100">
                {storageError}
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6" aria-label="Aufgabenliste">
          <div className="flex flex-col gap-3 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-violet-300" />
              <h2 className="text-sm font-semibold text-white">Aufgaben</h2>
              <span className="text-xs text-slate-500">{openCount} offen / {todos.length} gesamt</span>
            </div>
            <div
              role="tablist"
              aria-label="Aufgaben filtern"
              className="inline-flex rounded-lg border border-white/[0.08] bg-black/30 p-1"
            >
              {FILTERS.map(option => {
                const isActive = filter === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setFilter(option.value)}
                    data-testid={`todo-filter-${option.value}`}
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                      isActive ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200',
                    )}
                  >
                    <span>{option.label}</span>
                    <span
                      className={cx(
                        'inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                        isActive ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-slate-400',
                      )}
                    >
                      {counts[option.value]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {sampleMode && (
            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                <div>
                  <p className="text-sm font-semibold text-sky-100">Beispielmodus</p>
                  <p className="mt-1 text-xs leading-5 text-sky-100/80">
                    Diese Aufgaben sind nur ein Beispiel. Sobald du eine eigene Aufgabe anlegst, ersetzen wir die Beispiele.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearSample}
                className={buttonClassName('secondary', 'min-h-9 shrink-0')}
              >
                Beispiele entfernen
              </button>
            </div>
          )}

          <div className="mt-4">
            {isLoading ? (
              <EmptyState
                icon={<ListChecks className="h-5 w-5" />}
                title="Aufgaben werden geladen"
                description="Die gespeicherten Aufgaben werden aus der lokalen Ablage gelesen."
              />
            ) : isEmpty ? (
              <EmptyState
                icon={<ListChecks className="h-5 w-5" />}
                title="Noch keine Aufgaben"
                description="Lege oben deine erste Aufgabe an oder starte mit ein paar Beispielen, um die Oberflaeche kennenzulernen."
                action={
                  <button type="button" onClick={handleLoadSample} className={buttonClassName('secondary', 'min-h-10')}>
                    <Sparkles className="h-4 w-4" />
                    Beispielaufgaben laden
                  </button>
                }
              />
            ) : visible.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="Keine Aufgaben in diesem Filter"
                description="Setze den Filter auf 'Alle', um wieder alles zu sehen."
              />
            ) : (
              <ul className="divide-y divide-white/[0.05]" data-testid="todo-list">
                {visible.map(todo => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onStatusChange={handleStatusChange}
                    onRemove={handleRemove}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string
  label: string
  value: string
  onChange: (next: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-violet-400/60"
      >
        {options.map(option => (
          <option key={option.value} value={option.value} className="bg-slate-900 text-white">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

const STATUS_BUTTONS: Array<{ value: TodoStatus; icon: typeof Circle; activeClass: string }> = [
  {
    value: 'open',
    icon: Circle,
    activeClass: 'border-amber-500/40 bg-amber-500/15 text-amber-200',
  },
  {
    value: 'in_progress',
    icon: PlayCircle,
    activeClass: 'border-violet-500/40 bg-violet-500/15 text-violet-200',
  },
  {
    value: 'done',
    icon: CheckCircle2,
    activeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
  },
]

function TodoRow({
  todo,
  onStatusChange,
  onRemove,
}: {
  todo: Todo
  onStatusChange: (id: string, next: TodoStatus) => void
  onRemove: (id: string) => void
}) {
  return (
    <li className="flex items-stretch gap-3 py-3" data-testid={`todo-row-${todo.id}`} data-status={todo.status}>
      <span
        aria-hidden="true"
        title={`Prioritaet: ${PRIORITY_LABELS[todo.priority]}`}
        className={cx('w-1 shrink-0 rounded-full', PRIORITY_BAR[todo.priority])}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p
            className={cx(
              'truncate text-sm font-medium',
              todo.status === 'done' ? 'text-slate-500 line-through' : 'text-white',
            )}
          >
            {todo.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={PRIORITY_TONE[todo.priority]}>Prio: {PRIORITY_LABELS[todo.priority]}</Badge>
            <Badge tone={STATUS_TONE[todo.status]}>{STATUS_LABELS[todo.status]}</Badge>
            {todo.isSample && <Badge tone="info">Beispiel</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div
            role="group"
            aria-label={`Status fuer ${todo.title}`}
            className="inline-flex overflow-hidden rounded-lg border border-white/[0.08] bg-black/30"
          >
            {STATUS_BUTTONS.map(button => {
              const Icon = button.icon
              const isActive = todo.status === button.value
              return (
                <button
                  key={button.value}
                  type="button"
                  onClick={() => onStatusChange(todo.id, button.value)}
                  aria-pressed={isActive}
                  aria-label={`Auf ${STATUS_LABELS[button.value]} setzen`}
                  title={STATUS_LABELS[button.value]}
                  data-testid={`todo-status-${todo.id}-${button.value}`}
                  className={cx(
                    'inline-flex h-8 w-8 items-center justify-center border-l border-white/[0.05] first:border-l-0 transition-colors',
                    isActive ? button.activeClass : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-200',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => onRemove(todo.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-transparent text-slate-500 transition-colors hover:border-rose-500/30 hover:text-rose-300"
            aria-label={`Aufgabe ${todo.title} entfernen`}
            title="Aufgabe entfernen"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  )
}
