export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getProfiles, upsertProfile } from '@/lib/model-router/store'
import type { ModelProfile } from '@/lib/models/model-router'

export async function GET() {
  return NextResponse.json(getProfiles())
}

export async function POST(req: Request) {
  const body = await req.json() as Partial<ModelProfile>
  if (!body.id || !body.provider || !body.modelName) {
    return NextResponse.json(
      { error: 'id, provider, modelName required' },
      { status: 400 },
    )
  }
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
