export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { buildContextPackage } from '@/lib/context-packages/builder'
import { savePackage, getPackages } from '@/lib/context-packages/store'
import type { BuildContextPackageInput } from '@/lib/context-packages/types'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workItemId = searchParams.get('workItemId') ?? undefined
  return NextResponse.json(getPackages(workItemId))
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<BuildContextPackageInput>
  if (!body.workItemId || !body.title || !body.objective) {
    return NextResponse.json(
      { error: 'workItemId, title, objective required' },
      { status: 400 }
    )
  }
  const result = buildContextPackage(body as BuildContextPackageInput)
  savePackage(result.package)
  return NextResponse.json(result, { status: 201 })
}
