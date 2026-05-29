export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createTodoRepository, validateIncomingTodos } from '@/lib/todo/todo-repository'

const READ_ERROR = 'Aufgaben konnten nicht geladen werden. Bitte pruefe die lokale Speicherung.'
const WRITE_ERROR = 'Aufgaben konnten nicht gespeichert werden. Bitte versuche es erneut.'
const JSON_ERROR = 'Anfrage enthaelt kein gueltiges JSON.'
const MISSING_FIELD_ERROR = 'Feld "todos" fehlt im Request-Body.'

export async function GET() {
  try {
    const todos = await createTodoRepository().listAll()
    return NextResponse.json({ todos })
  } catch {
    return NextResponse.json({ error: READ_ERROR }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: JSON_ERROR }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null || !('todos' in body)) {
    return NextResponse.json({ error: MISSING_FIELD_ERROR }, { status: 400 })
  }

  const validation = validateIncomingTodos((body as Record<string, unknown>).todos)
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 400 })
  }

  try {
    const saved = await createTodoRepository().replaceAll(validation.todos)
    return NextResponse.json({ todos: saved })
  } catch {
    return NextResponse.json({ error: WRITE_ERROR }, { status: 500 })
  }
}
