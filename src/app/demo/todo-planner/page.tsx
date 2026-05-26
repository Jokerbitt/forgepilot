'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, Plus, Rocket, Target } from 'lucide-react'
import { Badge, buttonClassName, cx } from '@/components/ui/primitives'

interface TodoItem {
  id: string
  title: string
  area: string
  done: boolean
}

const initialTodos: TodoItem[] = [
  { id: 'focus', title: 'MVP-Aufgaben fuer heute festlegen', area: 'Planung', done: true },
  { id: 'ui', title: 'Klare ToDo-Liste mit Fortschritt pruefen', area: 'Produkt', done: false },
  { id: 'runner', title: 'Echten Runner-PR aus ForgePilot starten', area: 'ForgePilot', done: false },
]

export default function TodoPlannerDemoPage() {
  const [todos, setTodos] = useState(initialTodos)
  const [newTitle, setNewTitle] = useState('')

  const doneCount = todos.filter(todo => todo.done).length
  const progress = Math.round((doneCount / todos.length) * 100)
  const nextTodo = todos.find(todo => !todo.done)

  const grouped = useMemo(() => {
    return todos.reduce<Record<string, TodoItem[]>>((groups, todo) => {
      groups[todo.area] = [...(groups[todo.area] ?? []), todo]
      return groups
    }, {})
  }, [todos])

  function toggleTodo(id: string) {
    setTodos(current => current.map(todo => todo.id === id ? { ...todo, done: !todo.done } : todo))
  }

  function addTodo() {
    const title = newTitle.trim()
    if (!title) return
    setTodos(current => [
      ...current,
      { id: crypto.randomUUID(), title, area: 'Heute', done: false },
    ])
    setNewTitle('')
  }

  return (
    <main className="min-h-screen bg-[#08080d] px-5 py-6 text-slate-100 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge tone="success">First Real App Run Demo</Badge>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                ToDo Planner WebApp
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Eine kleine, greifbare Test-App aus ForgePilot: Aufgaben erfassen, Fokus erkennen,
                Fortschritt sehen und den naechsten produktiven PR-Schritt ausloesen.
              </p>
            </div>
            <Link href="/live" className={buttonClassName('secondary', 'shrink-0')}>
              Live View ansehen
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-emerald-200/80">Fortschritt</p>
            <p className="mt-1 text-3xl font-bold text-white">{progress}%</p>
            <p className="mt-1 text-sm text-emerald-100/70">{doneCount} von {todos.length} erledigt</p>
          </div>
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.08] p-4 md:col-span-2">
            <Target className="h-5 w-5 text-violet-300" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-violet-200/80">Naechste sinnvolle Aktion</p>
            <p className="mt-1 text-xl font-semibold text-white">{nextTodo?.title ?? 'Alles erledigt'}</p>
            <p className="mt-2 text-sm leading-6 text-violet-100/70">
              ForgePilot soll genau diese Art von Klarheit liefern: Was ist als naechstes sinnvoll,
              warum, und welcher Agent arbeitet daran?
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Aufgaben</h2>
              <p className="mt-1 text-sm text-slate-500">Kompakt, bedienbar, ohne Technik-Overload.</p>
            </div>
            <div className="flex gap-2">
              <input
                value={newTitle}
                onChange={event => setNewTitle(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') addTodo()
                }}
                placeholder="Neue Aufgabe..."
                className="min-h-10 w-56 rounded-lg border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500/50"
              />
              <button type="button" onClick={addTodo} className={buttonClassName('primary')}>
                <Plus className="h-4 w-4" />
                Hinzufuegen
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-5">
            {Object.entries(grouped).map(([area, items]) => (
              <div key={area}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">{area}</p>
                <div className="space-y-2">
                  {items.map(todo => (
                    <button
                      key={todo.id}
                      type="button"
                      onClick={() => toggleTodo(todo.id)}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition',
                        todo.done
                          ? 'border-emerald-500/20 bg-emerald-500/[0.07] text-slate-300'
                          : 'border-white/[0.07] bg-black/15 text-white hover:border-violet-500/30 hover:bg-violet-500/[0.08]',
                      )}
                    >
                      {todo.done ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Circle className="h-5 w-5 text-slate-500" />}
                      <span className={cx('text-sm font-medium', todo.done && 'line-through decoration-emerald-300/60')}>
                        {todo.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-amber-200">
                <Rocket className="h-4 w-4" />
                <p className="text-sm font-semibold">Naechster Produktionsbeweis</p>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-100/70">
                Diese Demo beweist die Bedienung und Sichtbarkeit. Als naechstes sollte ForgePilot denselben
                ToDo-App-Auftrag mit einem echten Runner-PR erzeugen und durch Critic + Writeback abschliessen.
              </p>
            </div>
            <Link href="/delegations" className={buttonClassName('secondary', 'shrink-0')}>
              Delegations pruefen
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
