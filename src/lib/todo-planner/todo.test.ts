import { describe, it, expect } from 'vitest'
import {
  createTodo,
  toggleTodo,
  removeTodo,
  filterTodos,
  sortTodos,
  summarize,
  type TodoItem,
} from './todo'

const FIXED_DATE = new Date('2026-05-29T10:00:00.000Z')

function makeItem(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 'todo-1',
    title: 'Sample',
    priority: 'medium',
    done: false,
    createdAt: '2026-05-29T10:00:00.000Z',
    ...overrides,
  }
}

describe('createTodo', () => {
  it('returns null for empty title', () => {
    expect(createTodo('', 'medium', FIXED_DATE)).toBeNull()
    expect(createTodo('   ', 'medium', FIXED_DATE)).toBeNull()
  })

  it('trims title whitespace', () => {
    const todo = createTodo('  Buy milk  ', 'high', FIXED_DATE)
    expect(todo?.title).toBe('Buy milk')
    expect(todo?.priority).toBe('high')
    expect(todo?.done).toBe(false)
    expect(todo?.createdAt).toBe(FIXED_DATE.toISOString())
  })

  it('defaults to medium priority', () => {
    const todo = createTodo('Walk dog', undefined, FIXED_DATE)
    expect(todo?.priority).toBe('medium')
  })
})

describe('toggleTodo', () => {
  it('flips done flag for matching item only', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b', done: true })]
    const result = toggleTodo(items, 'a')
    expect(result[0].done).toBe(true)
    expect(result[1].done).toBe(true)
  })

  it('is a no-op when id is unknown', () => {
    const items = [makeItem({ id: 'a' })]
    const result = toggleTodo(items, 'missing')
    expect(result).toEqual(items)
  })
})

describe('removeTodo', () => {
  it('removes the matching item', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' })]
    expect(removeTodo(items, 'a')).toEqual([items[1]])
  })

  it('returns same items when id is unknown', () => {
    const items = [makeItem({ id: 'a' })]
    expect(removeTodo(items, 'missing')).toEqual(items)
  })
})

describe('filterTodos', () => {
  const items = [
    makeItem({ id: 'a', done: false }),
    makeItem({ id: 'b', done: true }),
    makeItem({ id: 'c', done: false }),
  ]

  it('returns only open items', () => {
    expect(filterTodos(items, 'open').map((t) => t.id)).toEqual(['a', 'c'])
  })

  it('returns only done items', () => {
    expect(filterTodos(items, 'done').map((t) => t.id)).toEqual(['b'])
  })

  it('returns all items', () => {
    expect(filterTodos(items, 'all').map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('sortTodos', () => {
  it('places open items before done items', () => {
    const items = [
      makeItem({ id: 'done', done: true, priority: 'high' }),
      makeItem({ id: 'open', done: false, priority: 'low' }),
    ]
    expect(sortTodos(items).map((t) => t.id)).toEqual(['open', 'done'])
  })

  it('orders open items by priority high -> medium -> low', () => {
    const items = [
      makeItem({ id: 'low', priority: 'low', createdAt: '2026-05-29T10:00:00.000Z' }),
      makeItem({ id: 'high', priority: 'high', createdAt: '2026-05-29T10:00:01.000Z' }),
      makeItem({ id: 'medium', priority: 'medium', createdAt: '2026-05-29T10:00:02.000Z' }),
    ]
    expect(sortTodos(items).map((t) => t.id)).toEqual(['high', 'medium', 'low'])
  })

  it('breaks ties using createdAt ascending', () => {
    const items = [
      makeItem({ id: 'second', priority: 'high', createdAt: '2026-05-29T11:00:00.000Z' }),
      makeItem({ id: 'first', priority: 'high', createdAt: '2026-05-29T10:00:00.000Z' }),
    ]
    expect(sortTodos(items).map((t) => t.id)).toEqual(['first', 'second'])
  })
})

describe('summarize', () => {
  it('counts totals, open, done, and high priority open', () => {
    const items = [
      makeItem({ id: '1', done: false, priority: 'high' }),
      makeItem({ id: '2', done: false, priority: 'low' }),
      makeItem({ id: '3', done: true, priority: 'high' }),
    ]
    expect(summarize(items)).toEqual({
      total: 3,
      open: 2,
      done: 1,
      highPriorityOpen: 1,
    })
  })

  it('returns zeros for empty list', () => {
    expect(summarize([])).toEqual({ total: 0, open: 0, done: 0, highPriorityOpen: 0 })
  })
})
