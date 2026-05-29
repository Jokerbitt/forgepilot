export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createTodoRepository, parseTodos } from '@/lib/todo/todo-repository'

const READ_ERROR = 'Aufgaben konnten nicht geladen werden. Bitte pruefe die lokale Speicherung.'
const WRITE_ERROR = 'Aufgaben konnten nicht gespeichert werden. Bitte versuche es erneut.'

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
    return NextResponse.json({ error: 'Ungueltige Aufgaben-Daten.' }, { status: 400 })
  }

  const candidate = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).todos : null
  const todos = parseTodos(candidate)
  if (!todos) {
    return NextResponse.json({ error: 'Ungueltige Aufgaben-Daten.' }, { status: 400 })
  }

  try {
    const saved = await createTodoRepository().replaceAll(todos)
    return NextResponse.json({ todos: saved })
  } catch {
    return NextResponse.json({ error: WRITE_ERROR }, { status: 500 })
  }
}
