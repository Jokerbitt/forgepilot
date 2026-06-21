export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { spawn, execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'

// Registry of running preview servers: delegationId → { port, pid, url, repoPath, appType }
const previewServers = new Map<string, {
  port: number
  pid: number
  url: string
  repoPath: string
  appType: 'static' | 'nextjs' | 'vite' | 'unknown'
}>()

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
    if (fs.existsSync(path.join(repoPath, 'index.html'))) return 'static'
    return 'unknown'
  } catch {
    return 'static'
  }
}

// Use stored worktreePath if present, otherwise fall back to git clone
function resolvePreviewDir(delegation: { id: string; worktreePath?: string; targetRepo?: string }): string {
  // Prefer the stored worktree path (most reliable — agent actually wrote code here)
  if (delegation.worktreePath && fs.existsSync(delegation.worktreePath)) {
    return delegation.worktreePath
  }

  const rawRepo = delegation.targetRepo ?? process.cwd()
  if (!fs.existsSync(rawRepo)) throw new Error(`Repo-Pfad nicht gefunden: ${rawRepo}`)

  // Try to find feature branch worktree via git worktree list
  try {
    const branchName = `feature/${delegation.id}-task`
    const worktreeList = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: rawRepo, timeout: 5_000, encoding: 'utf-8',
    })
    const lines = worktreeList.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('branch refs/heads/' + branchName)) {
        const wt = lines[i - 2]?.replace('worktree ', '').trim()
        if (wt && fs.existsSync(wt)) return wt
      }
    }
  } catch { /* worktree list failed — continue to clone fallback */ }

  // Last resort: shallow clone the feature branch into /tmp
  const branchName = `feature/${delegation.id}-task`
  const previewDir = path.join('/tmp', `forgepilot-preview-${delegation.id}`)
  if (fs.existsSync(previewDir)) fs.rmSync(previewDir, { recursive: true, force: true })
  try {
    execFileSync('git', ['clone', '--branch', branchName, '--depth', '1', rawRepo, previewDir], {
      stdio: 'ignore', timeout: 15_000,
    })
  } catch {
    execFileSync('git', ['clone', '--depth', '1', rawRepo, previewDir], {
      stdio: 'ignore', timeout: 15_000,
    })
  }
  return previewDir
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

function startDevServer(dir: string, port: number, cmd: string): number {
  const proc = spawn(
    'npm',
    ['run', cmd, '--', '--port', String(port)],
    {
      cwd: dir,
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PORT: String(port), NEXT_PUBLIC_PORT: String(port) },
    },
  )
  proc.unref()
  return proc.pid ?? 0
}

// GET: return current preview state for this delegation (no side effects)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = await requireAuth()
  if (authError) return authError

  const { id } = await params
  const existing = previewServers.get(id)
  const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const delegation = await repo.findById(id)

  return NextResponse.json({
    running: !!existing,
    url: existing?.url ?? null,
    repoPath: existing?.repoPath ?? delegation?.worktreePath ?? null,
    appType: existing?.appType ?? null,
  })
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
    return NextResponse.json({ url: existing.url, repoPath: existing.repoPath, appType: existing.appType, restarted: false })
  }

  let previewDir: string
  try {
    previewDir = resolvePreviewDir(delegation)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const appType = detectPreviewType(previewDir)
  const port = findFreePort()
  let pid = 0
  let startupMs = 800

  if (appType === 'static') {
    pid = startStaticServer(previewDir, port)
  } else if (appType === 'nextjs') {
    pid = startDevServer(previewDir, port, 'dev')
    startupMs = 4000 // Next.js needs more time to compile
  } else if (appType === 'vite') {
    pid = startDevServer(previewDir, port, 'dev')
    startupMs = 2000
  } else {
    // Unknown — return workspace info without starting a server
    return NextResponse.json({ url: null, appType, repoPath: previewDir })
  }

  // Wait for server to come up
  await new Promise(r => setTimeout(r, startupMs))

  const url = `http://localhost:${port}`
  previewServers.set(id, { port, pid, url, repoPath: previewDir, appType })

  // M120: Persist appType in delegation for future reference
  await repo.update(id, { worktreeAppType: appType }).catch(() => {})

  return NextResponse.json({ url, appType, repoPath: previewDir, pid, restarted: false })
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
