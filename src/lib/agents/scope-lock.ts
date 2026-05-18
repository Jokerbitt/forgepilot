/**
 * Write-Scope Lock Registry
 *
 * Prevents two agents from editing the same files simultaneously.
 * State stored atomically in config/agent-scope.json.
 */

import fs from 'fs'
import path from 'path'
import type { AgentType } from './agent-skills'

const SCOPE_FILE = path.join(process.cwd(), 'config', 'agent-scope.json')

export type ScopeStatus = 'free' | 'claimed'

export interface ScopeClaim {
  agentId: string
  agentType: AgentType
  milestone: string
  branch: string
  /** File glob patterns claimed */
  filePatterns: string[]
  claimedAt: string
  expiresAt: string
}

export interface ScopeRegistry {
  claims: ScopeClaim[]
  updatedAt: string
}

function readRegistry(): ScopeRegistry {
  try {
    if (!fs.existsSync(SCOPE_FILE)) return { claims: [], updatedAt: new Date().toISOString() }
    return JSON.parse(fs.readFileSync(SCOPE_FILE, 'utf-8')) as ScopeRegistry
  } catch {
    return { claims: [], updatedAt: new Date().toISOString() }
  }
}

function writeRegistry(registry: ScopeRegistry): void {
  const dir = path.dirname(SCOPE_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = SCOPE_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(registry, null, 2), 'utf-8')
  fs.renameSync(tmp, SCOPE_FILE)
}

function isExpired(claim: ScopeClaim): boolean {
  return new Date(claim.expiresAt) < new Date()
}

function patternsOverlap(a: string[], b: string[]): boolean {
  // Simple prefix overlap check — same directory claimed by two agents
  for (const pa of a) {
    for (const pb of b) {
      const dirA = pa.split('/').slice(0, -1).join('/')
      const dirB = pb.split('/').slice(0, -1).join('/')
      if (dirA && dirB && (dirA.startsWith(dirB) || dirB.startsWith(dirA))) return true
      if (pa === pb) return true
    }
  }
  return false
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ClaimResult {
  success: boolean
  claimId?: string
  conflict?: ScopeClaim
  message: string
}

/**
 * Try to claim write scope for a set of file patterns.
 * Returns success=false with conflicting claim if patterns overlap.
 */
export function claimScope(
  agentId: string,
  agentType: AgentType,
  milestone: string,
  branch: string,
  filePatterns: string[],
  ttlMinutes = 60,
): ClaimResult {
  const registry = readRegistry()

  // Expire stale claims
  registry.claims = registry.claims.filter(c => !isExpired(c))

  // Check for conflicts
  for (const existing of registry.claims) {
    if (existing.agentId === agentId) continue // same agent can re-claim
    if (patternsOverlap(existing.filePatterns, filePatterns)) {
      return {
        success: false,
        conflict: existing,
        message: `Conflict: Agent ${existing.agentId} (${existing.milestone}) already holds overlapping scope`,
      }
    }
  }

  // Remove old claim by same agent if any
  registry.claims = registry.claims.filter(c => c.agentId !== agentId)

  const claim: ScopeClaim = {
    agentId,
    agentType,
    milestone,
    branch,
    filePatterns,
    claimedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
  }

  registry.claims.push(claim)
  registry.updatedAt = new Date().toISOString()
  writeRegistry(registry)

  return { success: true, claimId: agentId, message: `Scope claimed for ${milestone}` }
}

/**
 * Release scope when an agent finishes.
 */
export function releaseScope(agentId: string): boolean {
  const registry = readRegistry()
  const before = registry.claims.length
  registry.claims = registry.claims.filter(c => c.agentId !== agentId)
  if (registry.claims.length !== before) {
    registry.updatedAt = new Date().toISOString()
    writeRegistry(registry)
    return true
  }
  return false
}

/**
 * Get all active (non-expired) claims.
 */
export function getActiveClaims(): ScopeClaim[] {
  const registry = readRegistry()
  return registry.claims.filter(c => !isExpired(c))
}

/**
 * Check if a specific file pattern is currently locked.
 */
export function isScopeLocked(filePattern: string): ScopeClaim | null {
  const active = getActiveClaims()
  return active.find(c => patternsOverlap(c.filePatterns, [filePattern])) ?? null
}
