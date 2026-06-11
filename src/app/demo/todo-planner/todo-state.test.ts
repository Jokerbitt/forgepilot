import { describe, expect, it } from 'vitest'
import {
  appendTodo,
  computeProgress,
  findNextTodo,
  freshDemoTodos,
  groupTodosByArea,
  parseStoredTodos,
  TODO_STORAGE_KEY,
  toggleTodoDone,
} from './todo-state'

describe('todo-planner demo state', () => {
  it('exposes a stable storage key so persistence is namespaced', () => {
    expect(TODO_STORAGE_KEY).toBe('forgepilot.todo-planner-demo.todos.v1')
  })

  it('freshDemoTodos returns a defensive copy every call', () => {
    const first = freshDemoTodos()
    const second = freshDemoTodos()
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    first[0].done = !first[0].done
    expect(second[0].done).not.toBe(first[0].done)
  })

  describe('parseStoredTodos', () => {
    it('returns null for null, empty or invalid JSON', () => {
      expect(parseStoredTodos(null)).toBeNull()
      expect(parseStoredTodos('')).toBeNull()
      expect(parseStoredTodos('not-json')).toBeNull()
    })

    it('returns null when the stored payload is not an array of valid todos', () => {
      expect(parseStoredTodos(JSON.stringify({ id: 'x' }))).toBeNull()
      expect(parseStoredTodos(JSON.stringify([{ id: 'x' }]))).toBeNull()
      expect(parseStoredTodos(JSON.stringify([{ id: '', title: 't', area: 'a', done: false }]))).toBeNull()
      expect(parseStoredTodos(JSON.stringify([{ id: 'x', title: 't', area: 'a', done: 'yes' }]))).toBeNull()
    })

    it('round-trips a valid stored payload as a fresh array', () => {
      const original = freshDemoTodos()
      const restored = parseStoredTodos(JSON.stringify(original))
      expect(restored).toEqual(original)
      expect(restored).not.toBe(original)
    })
  })

  describe('computeProgress', () => {
    it('reports zero progress for an empty list without dividing by zero', () => {
      expect(computeProgress([])).toEqual({ doneCount: 0, total: 0, percent: 0 })
    })

    it('reflects the share of done todos rounded to the nearest percent', () => {
      const todos = [
        { id: 'a', title: 'a', area: 'x', done: true },
        { id: 'b', title: 'b', area: 'x', done: false },
        { id: 'c', title: 'c', area: 'x', done: false },
      ]
      expect(computeProgress(todos)).toEqual({ doneCount: 1, total: 3, percent: 33 })
    })

    it('updates after toggling so the next-action area follows', () => {
      const todos = freshDemoTodos()
      const initial = computeProgress(todos)
      const toggled = toggleTodoDone(todos, 'ui')
      const afterToggle = computeProgress(toggled)
      expect(afterToggle.doneCount).toBe(initial.doneCount + 1)
      expect(findNextTodo(toggled)?.id).toBe('runner')
    })
  })

  describe('findNextTodo', () => {
    it('returns the first not-done todo or undefined when finished', () => {
      const todos = freshDemoTodos()
      expect(findNextTodo(todos)?.id).toBe('ui')
      const allDone = todos.map(todo => ({ ...todo, done: true }))
      expect(findNextTodo(allDone)).toBeUndefined()
    })
  })

  describe('toggleTodoDone', () => {
    it('flips the done flag immutably and leaves others untouched', () => {
      const todos = freshDemoTodos()
      const next = toggleTodoDone(todos, 'ui')
      expect(next).not.toBe(todos)
      expect(next.find(t => t.id === 'ui')?.done).toBe(true)
      expect(next.find(t => t.id === 'focus')?.done).toBe(todos.find(t => t.id === 'focus')?.done)
    })

    it('is a no-op for unknown ids', () => {
      const todos = freshDemoTodos()
      expect(toggleTodoDone(todos, 'missing')).toEqual(todos)
    })
  })

  describe('appendTodo', () => {
    it('adds a new not-done todo in the "Heute" area', () => {
      const todos = freshDemoTodos()
      const next = appendTodo(todos, '  Neue Aufgabe  ', 'fresh-id')
      expect(next).toHaveLength(todos.length + 1)
      expect(next[next.length - 1]).toEqual({
        id: 'fresh-id',
        title: 'Neue Aufgabe',
        area: 'Heute',
        done: false,
      })
    })

    it('ignores empty or whitespace-only titles', () => {
      const todos = freshDemoTodos()
      expect(appendTodo(todos, '', 'x')).toEqual(todos)
      expect(appendTodo(todos, '   ', 'x')).toEqual(todos)
    })
  })

  describe('groupTodosByArea', () => {
    it('groups todos by their area in encounter order', () => {
      const grouped = groupTodosByArea(freshDemoTodos())
      expect(Object.keys(grouped)).toEqual(['Planung', 'Produkt', 'ForgePilot'])
      expect(grouped.Planung.map(t => t.id)).toEqual(['focus'])
    })
  })

  it('reset-to-demo workflow restores the original list after edits', () => {
    let todos = freshDemoTodos()
    todos = appendTodo(todos, 'Custom', 'custom-1')
    todos = toggleTodoDone(todos, 'ui')
    expect(todos).not.toEqual(freshDemoTodos())

    const reset = freshDemoTodos()
    expect(reset).toEqual([
      { id: 'focus', title: 'MVP-Aufgaben fuer heute festlegen', area: 'Planung', done: true },
      { id: 'ui', title: 'Klare ToDo-Liste mit Fortschritt prüfen', area: 'Produkt', done: false },
      { id: 'runner', title: 'Echten Runner-PR aus ForgePilot starten', area: 'ForgePilot', done: false },
    ])
  })
})
