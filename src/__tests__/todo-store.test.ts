import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  createTodo,
  sortTodos,
  filterTodos,
  countOpenTodos,
  countByFilter,
  isSampleSet,
  buildSampleTodos,
  type Todo,
} from '@/lib/todo/todo-store'
import { createResilientTodoRepository, JsonTodoRepository, parseTodos, type TodoRepository } from '@/lib/todo/todo-repository'

const FIXED_NOW = () => new Date('2026-05-29T12:00:00.000Z')
let nextId = 0
const fixedId = () => `id-${++nextId}`

function reset() {
  nextId = 0
}

describe('createTodo', () => {
  it('creates a todo with trimmed title and ISO createdAt', () => {
    reset()
    const todo = createTodo({
      title: '   Buy milk  ',
      priority: 'medium',
      status: 'open',
      now: FIXED_NOW,
      idGenerator: fixedId,
    })

    expect(todo).not.toBeNull()
    expect(todo).toEqual({
      id: 'id-1',
      title: 'Buy milk',
      priority: 'medium',
      status: 'open',
      createdAt: '2026-05-29T12:00:00.000Z',
    })
  })

  it('returns null for empty or whitespace-only title', () => {
    expect(createTodo({ title: '', priority: 'low', status: 'open' })).toBeNull()
    expect(createTodo({ title: '   ', priority: 'low', status: 'open' })).toBeNull()
  })
})

describe('sortTodos', () => {
  it('orders in_progress before open before done', () => {
    const todos: Todo[] = [
      { id: '1', title: 'A', priority: 'medium', status: 'done', createdAt: '2026-01-01' },
      { id: '2', title: 'B', priority: 'medium', status: 'open', createdAt: '2026-01-01' },
      { id: '3', title: 'C', priority: 'medium', status: 'in_progress', createdAt: '2026-01-01' },
    ]
    expect(sortTodos(todos).map(t => t.id)).toEqual(['3', '2', '1'])
  })

  it('within same status, orders high before medium before low', () => {
    const todos: Todo[] = [
      { id: '1', title: 'low', priority: 'low', status: 'open', createdAt: '2026-01-01' },
      { id: '2', title: 'high', priority: 'high', status: 'open', createdAt: '2026-01-01' },
      { id: '3', title: 'medium', priority: 'medium', status: 'open', createdAt: '2026-01-01' },
    ]
    expect(sortTodos(todos).map(t => t.id)).toEqual(['2', '3', '1'])
  })

  it('does not mutate the input array', () => {
    const todos: Todo[] = [
      { id: '1', title: 'A', priority: 'low', status: 'done', createdAt: '2026-01-01' },
      { id: '2', title: 'B', priority: 'high', status: 'open', createdAt: '2026-01-01' },
    ]
    const before = todos.map(t => t.id).join(',')
    sortTodos(todos)
    expect(todos.map(t => t.id).join(',')).toBe(before)
  })
})

describe('filterTodos', () => {
  const sample: Todo[] = [
    { id: '1', title: 'A', priority: 'high', status: 'open', createdAt: '2026-01-01' },
    { id: '2', title: 'B', priority: 'high', status: 'in_progress', createdAt: '2026-01-01' },
    { id: '3', title: 'C', priority: 'high', status: 'done', createdAt: '2026-01-01' },
  ]

  it('returns everything for filter "all"', () => {
    expect(filterTodos(sample, 'all')).toHaveLength(3)
  })

  it('returns only non-done for filter "open"', () => {
    expect(filterTodos(sample, 'open').map(t => t.id)).toEqual(['1', '2'])
  })

  it('returns only done for filter "done"', () => {
    expect(filterTodos(sample, 'done').map(t => t.id)).toEqual(['3'])
  })
})

describe('countOpenTodos', () => {
  it('counts todos that are not done', () => {
    const todos: Todo[] = [
      { id: '1', title: 'A', priority: 'high', status: 'open', createdAt: '2026-01-01' },
      { id: '2', title: 'B', priority: 'high', status: 'in_progress', createdAt: '2026-01-01' },
      { id: '3', title: 'C', priority: 'high', status: 'done', createdAt: '2026-01-01' },
    ]
    expect(countOpenTodos(todos)).toBe(2)
  })

  it('returns 0 for empty list', () => {
    expect(countOpenTodos([])).toBe(0)
  })
})

describe('countByFilter', () => {
  it('returns zero counts for empty list', () => {
    expect(countByFilter([])).toEqual({ all: 0, open: 0, done: 0 })
  })

  it('counts open (non-done) and done separately and totals all', () => {
    const todos: Todo[] = [
      { id: '1', title: 'A', priority: 'high', status: 'open', createdAt: '2026-01-01' },
      { id: '2', title: 'B', priority: 'high', status: 'in_progress', createdAt: '2026-01-01' },
      { id: '3', title: 'C', priority: 'high', status: 'done', createdAt: '2026-01-01' },
      { id: '4', title: 'D', priority: 'low', status: 'done', createdAt: '2026-01-01' },
    ]
    expect(countByFilter(todos)).toEqual({ all: 4, open: 2, done: 2 })
  })
})

describe('isSampleSet', () => {
  it('returns false for empty list', () => {
    expect(isSampleSet([])).toBe(false)
  })

  it('returns true when all todos are samples', () => {
    expect(isSampleSet(buildSampleTodos(FIXED_NOW))).toBe(true)
  })

  it('returns false when at least one todo is user-created', () => {
    const todos: Todo[] = [
      ...buildSampleTodos(FIXED_NOW),
      { id: 'user-1', title: 'Real', priority: 'low', status: 'open', createdAt: '2026-01-01' },
    ]
    expect(isSampleSet(todos)).toBe(false)
  })
})

describe('buildSampleTodos', () => {
  it('returns three sample todos all flagged as samples', () => {
    const samples = buildSampleTodos(FIXED_NOW)
    expect(samples).toHaveLength(3)
    expect(samples.every(t => t.isSample === true)).toBe(true)
  })
})

describe('todo repository fallback', () => {
  it('persists todos across repository instances', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgepilot-todos-'))
    const filePath = path.join(dir, 'todos.json')
    const todos: Todo[] = [
      {
        id: 'persisted-1',
        title: 'Persist me',
        priority: 'high',
        status: 'open',
        createdAt: '2026-05-29T12:00:00.000Z',
      },
    ]

    const writer = new JsonTodoRepository(filePath)
    await writer.replaceAll(todos)

    const reader = new JsonTodoRepository(filePath)
    await expect(reader.listAll()).resolves.toEqual(todos)
  })

  it('rejects invalid persisted todo payloads', () => {
    expect(parseTodos([{ id: 'broken', title: 'Missing fields' }])).toBeNull()
    expect(parseTodos({ todos: [] })).toBeNull()
  })

  it('uses the fallback repository when primary storage fails', async () => {
    const todos: Todo[] = [
      {
        id: 'fallback-1',
        title: 'Fallback works',
        priority: 'medium',
        status: 'open',
        createdAt: '2026-05-29T12:00:00.000Z',
      },
    ]
    const failingPrimary: TodoRepository = {
      async listAll() {
        throw new Error('primary unavailable')
      },
      async replaceAll() {
        throw new Error('primary unavailable')
      },
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forgepilot-todos-fallback-'))
    const fallback = new JsonTodoRepository(path.join(dir, 'todos.json'))
    const repository = createResilientTodoRepository(failingPrimary, fallback)

    await expect(repository.replaceAll(todos)).resolves.toEqual(todos)
    await expect(repository.listAll()).resolves.toEqual(todos)
  })
})
