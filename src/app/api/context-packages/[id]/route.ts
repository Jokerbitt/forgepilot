export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getPackage, deletePackage } from '@/lib/context-packages/store'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const pkg = getPackage(id)
  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(pkg)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return NextResponse.json({ deleted: deletePackage(id) })
}
