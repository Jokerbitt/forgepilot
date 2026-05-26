export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { spawn, execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

// Registry of running preview servers: delegationId → { port, pid, url }
const previewServers = new Map<string, { port: number; pid: number; url: string; repoPath: string }>()

let nextPort = 4200

function findFreePort(): number {
  return nextPort++
}

function detectPreviewType(repoPath: string): 'static' | 'nextjs' | 'vite' | 'unknown' {
  const pkgPath = path.join(repoPath, 'package.json')
  if (!fs.existsSync(pkgPath)) return 'static'
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      scripts?: Record<string, string>
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if ('next' in deps) return 'nextjs'
    if ('vite' in deps) return 'vite'
    return 'static'
  } catch {
    return 'static'
  }
}

// Get the feature branch path from the local origin
function getFeatureBranchPath(repoPath: string, delegationId: string): string {
  const branchName = `feature/${delegationId}-task`
  const previewDir = path.join('/tmp', `forgepilot-preview-${delegationId}`)

  // Re-clone the feature branch into a temp dir for preview
  if (fs.existsSync(previewDir)) fs.rmSync(previewDir, { recursive: true, force: true })
  try {
    execFileSync('git', ['clone', '--branch', branchName, '--depth', '1', repoPath, previewDir], {
      stdio: 'ignore',
      timeout: 15_000,
    })
    return previewDir
  } catch {
    // Fall back to main branch
    execFileSync('git', ['clone', '--depth', '1', repoPath, previewDir], {
      stdio: 'ignore',
      timeout: 15_000,
    })
    return previewDir
  }
}

function startStaticServer(dir: string, port: number): number {
  const proc = spawn(
    'python3',
    ['-m', 'http.server', String(port), '--directory', dir],
    { detached: true, stdio: 'ignore' },
  )
  proc.unref()
  return proc.pid ?? 0
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)
  if (!delegation) return NextResponse.json({ error: 'Delegation nicht gefunden' }, { status: 404 })

  // Already running?
  const existing = previewServers.get(id)
  if (existing) {
    return NextResponse.json({ url: existing.url, restarted: false })
  }

  const rawRepo = delegation.targetRepo ?? process.cwd()
  if (!fs.existsSync(rawRepo)) {
    return NextResponse.json({ error: `Repo-Pfad nicht gefunden: ${rawRepo}` }, { status: 400 })
  }

  // Get the feature branch version (agent's result)
  let previewDir: string
  try {
    previewDir = getFeatureBranchPath(rawRepo, id)
  } catch {
    previewDir = rawRepo
  }

  const appType = detectPreviewType(previewDir)
  const port = findFreePort()
  let pid = 0

  if (appType === 'static') {
    pid = startStaticServer(previewDir, port)
  } else {
    // For Next.js / Vite we just open the source directory — not auto-started here
    return NextResponse.json({
      url: null,
      appType,
      message: `${appType === 'nextjs' ? 'Next.js' : 'Vite'} App erkannt — bitte manuell mit \`npm run dev\` starten`,
      repoPath: previewDir,
    })
  }

  // Wait briefly for server to come up
  await new Promise(r => setTimeout(r, 800))

  const url = `http://localhost:${port}`
  previewServers.set(id, { port, pid, url, repoPath: previewDir })

  return NextResponse.json({ url, appType, pid, restarted: false })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const server = previewServers.get(id)
  if (!server) return NextResponse.json({ stopped: false })

  try {
    process.kill(server.pid, 'SIGTERM')
  } catch { /* already gone */ }

  previewServers.delete(id)
  return NextResponse.json({ stopped: true })
}
