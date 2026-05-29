import fs from 'fs'
import path from 'path'
import { asc } from 'drizzle-orm'
import { getDb, isDatabaseConfigured } from '@/db/index'
import { todoItems, type DbTodoItem } from '@/db/schema'
import type { Todo, TodoPriority, TodoStatus } from './todo-store'

const TODOS_FILE = path.join(process.cwd(), 'config', 'todos.json')

export interface TodoRepository {
  listAll(): Promise<Todo[]>
  replaceAll(todos: readonly Todo[]): Promise<Todo[]>
}

function reportFallback(reason: unknown) {
  const message = reason instanceof Error ? reason.message : 'Unknown todo storage error'
  console.warn(`[todo] PostgreSQL storage unavailable, using JSON fallback: ${message}`)
}

function rowToTodo(row: DbTodoItem): Todo {
  return {
    id: row.id,
    title: row.title,
    priority: row.priority,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    ...(row.isSample ? { isSample: true } : {}),
  }
}

function isTodoPriority(value: unknown): value is TodoPriority {
  return value === 'low' || value === 'medium' || value === 'high'
}

function isTodoStatus(value: unknown): value is TodoStatus {
  return value === 'open' || value === 'in_progress' || value === 'done'
}

export function isTodo(value: unknown): value is Todo {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    isTodoPriority(candidate.priority) &&
    isTodoStatus(candidate.status) &&
    typeof candidate.createdAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.createdAt)) &&
    (candidate.isSample === undefined || typeof candidate.isSample === 'boolean')
  )
}

export function parseTodos(value: unknown): Todo[] | null {
  if (!Array.isArray(value)) return null
  return value.every(isTodo) ? value : null
}

class ResilientTodoRepository implements TodoRepository {
  constructor(
    private readonly primary: TodoRepository,
    private readonly fallback: TodoRepository,
  ) {}

  async listAll(): Promise<Todo[]> {
    try {
      return await this.primary.listAll()
    } catch (error) {
      reportFallback(error)
      return this.fallback.listAll()
    }
  }

  async replaceAll(todos: readonly Todo[]): Promise<Todo[]> {
    try {
      return await this.primary.replaceAll(todos)
    } catch (error) {
      reportFallback(error)
      return this.fallback.replaceAll(todos)
    }
  }
}

class PostgresTodoRepository implements TodoRepository {
  async listAll(): Promise<Todo[]> {
    const db = getDb()
    const rows = await db.select().from(todoItems).orderBy(asc(todoItems.createdAt))
    return rows.map(rowToTodo)
  }

  async replaceAll(todos: readonly Todo[]): Promise<Todo[]> {
    const db = getDb()
    await db.transaction(async tx => {
      await tx.delete(todoItems)
      if (todos.length === 0) return
      await tx.insert(todoItems).values(
        todos.map(todo => ({
          id: todo.id,
          title: todo.title,
          priority: todo.priority,
          status: todo.status,
          isSample: todo.isSample === true,
          createdAt: new Date(todo.createdAt),
          updatedAt: new Date(),
        })),
      )
    })
    return this.listAll()
  }
}

export class JsonTodoRepository implements TodoRepository {
  constructor(private readonly filePath = TODOS_FILE) {}

  async listAll(): Promise<Todo[]> {
    if (!fs.existsSync(this.filePath)) return []
    const raw = fs.readFileSync(this.filePath, 'utf-8')
    const parsed = parseTodos(JSON.parse(raw) as unknown)
    if (!parsed) throw new Error('Todo storage file is invalid.')
    return parsed
  }

  async replaceAll(todos: readonly Todo[]): Promise<Todo[]> {
    const dir = path.dirname(this.filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const next = [...todos]
    const tmp = `${this.filePath}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8')
    fs.renameSync(tmp, this.filePath)
    return next
  }
}

export function createTodoRepository(filePath = TODOS_FILE): TodoRepository {
  const fallback = new JsonTodoRepository(filePath)
  if (isDatabaseConfigured()) return new ResilientTodoRepository(new PostgresTodoRepository(), fallback)
  return fallback
}

export function createResilientTodoRepository(primary: TodoRepository, fallback: TodoRepository): TodoRepository {
  return new ResilientTodoRepository(primary, fallback)
}
