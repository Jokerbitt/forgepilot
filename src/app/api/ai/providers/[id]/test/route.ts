export const dynamic = 'force-dynamic'
/**
 * POST /api/ai/providers/[id]/test
 * Pings the provider to verify connectivity and API key validity.
 */

import { NextResponse } from 'next/server'
import { getAllProviderConfigs } from '@/lib/ai/providers/config-store'
import { getProviderInstance } from '@/lib/ai/providers/registry'
import { readStoredApiKeys } from '@/lib/connectors/config'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const configs  = getAllProviderConfigs()
  const config   = configs.find(c => c.id === params.id)
  if (!config)   return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

  const provider = getProviderInstance(params.id)
  if (!provider) return NextResponse.json({ error: 'Provider not registered' }, { status: 404 })

  const stored  = readStoredApiKeys() as Record<string, string | undefined>
  const apiKey  = config.apiKeyRef
    ? (process.env[config.apiKeyRef] ?? stored[config.apiKeyRef] ?? '')
    : ''

  const startMs = Date.now()
  const ok      = await provider.isAvailable(apiKey, config.baseUrl)
  const latency = Date.now() - startMs

  return NextResponse.json({
    ok,
    latencyMs: latency,
    providerId: params.id,
    providerName: config.name,
  })
}
