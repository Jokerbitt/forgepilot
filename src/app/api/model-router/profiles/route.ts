export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getProfiles, upsertProfile } from '@/lib/model-router/store'
import type { ModelProfile } from '@/lib/models/model-router'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ModelProfileSchema } from '@/lib/validation/schemas'

export async function GET() {
  return NextResponse.json(getProfiles())
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req, ModelProfileSchema)
  if (isValidationError(body)) return body

  const now = new Date().toISOString()
  const profile: ModelProfile = {
    executionMode: 'cloud',
    strengths: [],
    weaknesses: [],
    recommendedWorkloads: [],
    privacyModes: ['cloud-approved'],
    costClass: 'metered-low',
    healthStatus: 'unknown',
    updatedAt: now,
    ...body,
    id: body.id,
    provider: body.provider,
    modelName: body.modelName,
  }
  return NextResponse.json(upsertProfile(profile), { status: 201 })
}
