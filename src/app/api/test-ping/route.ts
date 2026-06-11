import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface TestPingResponse {
  ok: true
  ts: string
}

export async function GET(): Promise<NextResponse<TestPingResponse>> {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() }, { status: 200 })
}

export async function POST(): Promise<NextResponse<{ error: string }>> {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}

export async function PUT(): Promise<NextResponse<{ error: string }>> {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}

export async function DELETE(): Promise<NextResponse<{ error: string }>> {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}

export async function PATCH(): Promise<NextResponse<{ error: string }>> {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 })
}
