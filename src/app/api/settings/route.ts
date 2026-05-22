export const dynamic = 'force-dynamic'
import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { getNBAConfig, saveNBAConfig } from '@/lib/nba-engine/nba-config'
import { parseBody } from '@/lib/validation/api'
import { NBAConfigUpdateSchema } from '@/lib/validation/schemas'
import { apiLogger } from '@/lib/logger'

export async function GET() {
  const authError = await requireAuth()
  if (authError) return authError

  try {
    const config = getNBAConfig()
    return NextResponse.json(config)
  } catch (error) {
    apiLogger.error({ event: 'settings.read.error', error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  const result = await parseBody(request, NBAConfigUpdateSchema)
  if (result instanceof NextResponse) return result

  try {
    const currentConfig = getNBAConfig()
    const newConfig = { ...currentConfig, ...result }
    saveNBAConfig(newConfig)
    apiLogger.info({ event: 'settings.updated', fields: Object.keys(result) })
    return NextResponse.json(newConfig)
  } catch (error) {
    apiLogger.error({ event: 'settings.save.error', error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
  }
}
