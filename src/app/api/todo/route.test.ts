import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Todo } from '@/lib/todo/todo-store'

const todoRepositoryMock = vi.hoisted(() => ({
  replaceAll: vi.fn(),
  listAll: vi.fn(),
}))

vi.mock('@/lib/todo/todo-repository', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/todo/todo-repository')>()
  return {
    ...actual,
    createTodoRepository: () => todoRepositoryMock,
  }
})

import { PUT } from './route'

function putRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/todo', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/todo', () => {
  beforeEach(() => {
    todoRepositoryMock.replaceAll.mockReset()
    todoRepositoryMock.listAll.mockReset()
  })

  it('validates, trims, persists and returns todos for the happy path', async () => {
    const todo: Todo = {
      id: 'todo-1',
      title: '  API Happy Path  ',
      priority: 'high',
      status: 'open',
      createdAt: '2026-05-29T19:48:00.000Z',
    }
    todoRepositoryMock.replaceAll.mockImplementation(async (todos: Todo[]) => todos)

    const response = await PUT(putRequest({ todos: [todo] }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(todoRepositoryMock.replaceAll).toHaveBeenCalledWith([
      {
        ...todo,
        title: 'API Happy Path',
      },
    ])
    expect(payload).toEqual({
      todos: [
        {
          ...todo,
          title: 'API Happy Path',
        },
      ],
    })
  })

  it('returns a clear validation error for an empty title', async () => {
    const response = await PUT(putRequest({
      todos: [
        {
          id: 'todo-1',
          title: '   ',
          priority: 'high',
          status: 'open',
          createdAt: '2026-05-29T19:48:00.000Z',
        },
      ],
    }))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('Aufgabe 1: Titel darf nicht leer sein.')
    expect(todoRepositoryMock.replaceAll).not.toHaveBeenCalled()
  })
})
