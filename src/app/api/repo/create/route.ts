export const dynamic = 'force-dynamic'

/**
 * POST /api/repo/create
 * Body: { appName: string, targetPath?: string, baseDir?: string, github?: boolean }
 *
 * Creates (or reuses) a local git repo for a new app — optionally a GitHub repo
 * too — so the user never runs `git init` by hand.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { ensureTargetRepo, suggestRepoPath, defaultReposDir } from '@/lib/repo/create-repo'

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let body: { appName?: string; targetPath?: string; baseDir?: string; github?: boolean }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Ungültiger Body' }, { status: 400 })
  }
  const appName = body.appName?.trim()
  if (!appName) return NextResponse.json({ error: 'appName ist erforderlich' }, { status: 400 })

  try {
    const result = ensureTargetRepo({
      appName,
      targetPath: body.targetPath?.trim() || undefined,
      baseDir: body.baseDir?.trim() || undefined,
      github: body.github === true,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Repo-Erstellung fehlgeschlagen' },
      { status: 500 },
    )
  }
}

/** GET /api/repo/create?name=... — suggest a free path without creating anything. */
export async function GET(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError
  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json({ error: 'name ist erforderlich' }, { status: 400 })
  return NextResponse.json({ suggestedPath: suggestRepoPath(name, defaultReposDir()) })
}
