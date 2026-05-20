/**
 * GET  /api/ai/providers        — list all provider configs (built-in + custom)
 * POST /api/ai/providers        — upsert a provider config (enable/disable/custom)
 * DELETE /api/ai/providers?id=  — remove a custom provider
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAllProviderConfigs,
  getModelSelection,
  saveModelSelection,
  upsertProviderConfig,
  deleteCustomProvider,
} from '@/lib/ai/providers/config-store'
import { getProviderInstance } from '@/lib/ai/providers/registry'
import { readStoredApiKeys } from '@/lib/connectors/config'
import type { AIProviderConfig, AIModelSelection } from '@/lib/ai/providers/types'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { ProviderConfigSchema, ModelSelectionSchema } from '@/lib/validation/schemas'
import { z } from 'zod'

const ProvidersPostSchema = z.object({
  provider:  ProviderConfigSchema.partial().extend({ id: z.string() }).optional(),
  selection: ModelSelectionSchema.optional(),
})

export const dynamic = 'force-dynamic'

export async function GET() {
  const configs   = getAllProviderConfigs()
  const selection = getModelSelection()
  const apiKeys   = readStoredApiKeys() as Record<string, string | undefined>

  // Annotate each provider with whether it has an API key configured
  const annotated = configs.map(c => ({
    ...c,
    hasApiKey: !c.apiKeyRef || !!(
      process.env[c.apiKeyRef] ?? apiKeys[c.apiKeyRef]
    ),
  }))

  return NextResponse.json({ providers: annotated, selection })
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req, ProvidersPostSchema)
  if (isValidationError(body)) return body

  if (body.provider) {
    upsertProviderConfig(body.provider as Partial<AIProviderConfig> & { id: string })
  }

  if (body.selection) {
    saveModelSelection(body.selection as AIModelSelection)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  deleteCustomProvider(id)
  return NextResponse.json({ ok: true })
}

/** POST /api/ai/providers/test  — ping a provider to check availability */
// handled in [id]/test/route.ts
