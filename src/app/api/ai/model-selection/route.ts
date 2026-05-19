/**
 * GET  /api/ai/model-selection  — returns current { fastProvider, fastModel, codingProvider, codingModel }
 * POST /api/ai/model-selection  — updates modelSelection in config/ai-providers.json
 *
 * Validation:
 *   - Provider must exist in BUILT_IN_PROVIDER_CONFIGS or custom providers
 *   - Model must exist in the provider's model list
 */

import { NextRequest, NextResponse } from 'next/server'
import { getModelSelection, saveModelSelection, getAllProviderConfigs } from '@/lib/ai/providers/config-store'
import type { AIModelSelection } from '@/lib/ai/providers/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const selection = getModelSelection()
  return NextResponse.json(selection)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Partial<AIModelSelection>

  const allProviders = getAllProviderConfigs()

  // Validate fast provider + model if provided
  if (body.fastProvider !== undefined || body.fastModel !== undefined) {
    const providerId = body.fastProvider
    const modelId    = body.fastModel

    if (providerId !== undefined) {
      const provider = allProviders.find(p => p.id === providerId)
      if (!provider) {
        return NextResponse.json(
          { error: `Unknown provider: ${providerId}` },
          { status: 400 }
        )
      }
      if (modelId !== undefined) {
        const model = provider.models.find(m => m.id === modelId)
        if (!model) {
          return NextResponse.json(
            { error: `Model ${modelId} not found in provider ${providerId}` },
            { status: 400 }
          )
        }
      }
    }
  }

  // Validate coding provider + model if provided
  if (body.codingProvider !== undefined || body.codingModel !== undefined) {
    const providerId = body.codingProvider
    const modelId    = body.codingModel

    if (providerId !== undefined) {
      const provider = allProviders.find(p => p.id === providerId)
      if (!provider) {
        return NextResponse.json(
          { error: `Unknown provider: ${providerId}` },
          { status: 400 }
        )
      }
      if (modelId !== undefined) {
        const model = provider.models.find(m => m.id === modelId)
        if (!model) {
          return NextResponse.json(
            { error: `Model ${modelId} not found in provider ${providerId}` },
            { status: 400 }
          )
        }
      }
    }
  }

  const current = getModelSelection()
  const updated: AIModelSelection = {
    ...current,
    ...(body.fastProvider   !== undefined ? { fastProvider:   body.fastProvider   } : {}),
    ...(body.fastModel      !== undefined ? { fastModel:      body.fastModel      } : {}),
    ...(body.codingProvider !== undefined ? { codingProvider: body.codingProvider } : {}),
    ...(body.codingModel    !== undefined ? { codingModel:    body.codingModel    } : {}),
  }

  saveModelSelection(updated)
  return NextResponse.json({ ok: true, selection: updated })
}
