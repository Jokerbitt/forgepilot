export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { buildContextPackage } from '@/lib/context-packages/builder'
import { savePackage, getPackages } from '@/lib/context-packages/store'
import type { BuildContextPackageInput } from '@/lib/context-packages/types'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { BuildContextPackageSchema } from '@/lib/validation/schemas'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workItemId = searchParams.get('workItemId') ?? undefined
  return NextResponse.json(getPackages(workItemId))
}

export async function POST(req: Request) {
  const result = await parseBody(req, BuildContextPackageSchema)
  if (isValidationError(result)) return result

  const pkg = buildContextPackage(result as BuildContextPackageInput)
  savePackage(pkg.package)
  return NextResponse.json(pkg, { status: 201 })
}
