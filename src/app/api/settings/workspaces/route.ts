export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { z } from 'zod'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { logger } from '@/lib/logger'

const CONFIG_PATH = path.join(process.cwd(), 'config', 'workspaces.json')

const WorkspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  path: z.string().min(1),
  type: z.enum(['local', 'github']),
  description: z.string().max(500).optional(),
  defaultBranch: z.string().max(100).optional(),
})

const UpsertWorkspaceSchema = WorkspaceSchema.omit({ id: true }).extend({
  id: z.string().optional(),
})

export interface Workspace {
  id: string
  name: string
  path: string
  type: 'local' | 'github'
  description?: string
  defaultBranch?: string
  detectedStack?: string
  addedAt: string
}

function loadWorkspaces(): Workspace[] {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return []
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Workspace[]
  } catch {
    return []
  }
}

function saveWorkspaces(workspaces: Workspace[]): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(workspaces, null, 2))
}

function detectStack(repoPath: string): string {
  try {
    const pkgPath = path.join(repoPath, 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
      const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) }
      const parts: string[] = []
      if (deps['next']) parts.push('Next.js')
      if (deps['react']) parts.push('React')
      if (deps['vue']) parts.push('Vue')
      if (deps['typescript'] || fs.existsSync(path.join(repoPath, 'tsconfig.json'))) parts.push('TypeScript')
      if (deps['tailwindcss']) parts.push('Tailwind')
      return parts.join(' + ') || 'Node.js'
    }
    if (fs.existsSync(path.join(repoPath, 'requirements.txt'))) return 'Python'
    if (fs.existsSync(path.join(repoPath, 'go.mod'))) return 'Go'
    if (fs.existsSync(path.join(repoPath, 'Cargo.toml'))) return 'Rust'
  } catch { /* ignore */ }
  return 'Unknown'
}

function validateLocalPath(repoPath: string): { valid: boolean; error?: string } {
  if (!path.isAbsolute(repoPath)) return { valid: false, error: 'Pfad muss absolut sein (z.B. /Users/name/dev/projekt)' }
  if (!fs.existsSync(repoPath)) return { valid: false, error: `Pfad existiert nicht: ${repoPath}` }
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd: repoPath, stdio: 'ignore', timeout: 3000 })
  } catch {
    return { valid: false, error: 'Kein Git-Repository in diesem Pfad' }
  }
  return { valid: true }
}

export async function GET() {
  const workspaces = loadWorkspaces()
  return NextResponse.json({ workspaces })
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req, UpsertWorkspaceSchema)
  if (isValidationError(body)) return body

  const workspaces = loadWorkspaces()

  // Validate local paths
  if (body.type === 'local') {
    const validation = validateLocalPath(body.path)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
  }

  const id = body.id ?? `ws-${Date.now()}`
  const existing = workspaces.findIndex(w => w.id === id)

  const detectedStack = body.type === 'local' ? detectStack(body.path) : undefined

  const workspace: Workspace = {
    id,
    name: body.name,
    path: body.path,
    type: body.type,
    description: body.description,
    defaultBranch: body.defaultBranch ?? 'main',
    detectedStack,
    addedAt: existing >= 0 ? workspaces[existing].addedAt : new Date().toISOString(),
  }

  if (existing >= 0) {
    workspaces[existing] = workspace
  } else {
    workspaces.push(workspace)
  }

  saveWorkspaces(workspaces)
  logger.info({ event: 'workspace.upsert', id, name: body.name, type: body.type }, 'Workspace saved')
  return NextResponse.json({ workspace })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const workspaces = loadWorkspaces()
  const filtered = workspaces.filter(w => w.id !== id)
  saveWorkspaces(filtered)
  return NextResponse.json({ deleted: true })
}
