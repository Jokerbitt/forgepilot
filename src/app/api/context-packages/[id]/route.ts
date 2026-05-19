import { NextResponse } from 'next/server'
import { getPackage, deletePackage } from '@/lib/context-packages/store'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const pkg = getPackage(params.id)
  if (!pkg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(pkg)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return NextResponse.json({ deleted: deletePackage(params.id) })
}
