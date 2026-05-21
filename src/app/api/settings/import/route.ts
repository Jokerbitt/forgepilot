export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { z } from 'zod'
import { importSettingsBundle, type SettingsBundle } from '@/lib/settings/settings-bundle'

const BundleSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  configs: z.record(z.string(), z.unknown()),
})

export async function POST(request: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const parsed = BundleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid bundle format.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const result = importSettingsBundle(parsed.data as SettingsBundle)

  if (result.errors.length > 0) {
    return NextResponse.json(
      { ok: false, imported: result.imported, skipped: result.skipped, errors: result.errors },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    imported: result.imported,
    skipped: result.skipped,
    errors: [],
  })
}
