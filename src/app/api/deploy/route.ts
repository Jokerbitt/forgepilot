export const dynamic = 'force-dynamic'

/**
 * POST /api/deploy
 * Body: { repoPath: string, provider: 'local'|'vercel'|'docker', port?: number, production?: boolean }
 * Returns: DeployResult (status ok → { url, detail, pid? } | status error → { error })
 *
 * One-click deploy of a built app to a live URL. Reuses the deploy dispatcher,
 * which never throws — the route just maps ok→200 and error→502 so the UI can
 * always show a plain-language outcome.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { deployApp } from '@/lib/deploy/deploy'
import type { DeployProvider } from '@/lib/deploy/types'

const PROVIDERS: DeployProvider[] = ['local', 'vercel', 'docker']

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { repoPath?: string; provider?: string; port?: number; production?: boolean }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }

  const repoPath = body.repoPath?.trim()
  if (!repoPath) return NextResponse.json({ error: 'repoPath ist erforderlich' }, { status: 400 })

  const provider = body.provider as DeployProvider | undefined
  if (!provider || !PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: `provider muss eines sein: ${PROVIDERS.join(', ')}` }, { status: 400 })
  }

  const port = typeof body.port === 'number' && body.port > 0 ? Math.floor(body.port) : undefined
  const result = await deployApp({ repoPath, provider, port, production: body.production })
  return NextResponse.json(result, { status: result.status === 'ok' ? 200 : 502 })
}
