/**
 * Write-Scope Lock Registry — Multi-Agent Coordination
 *
 * Prevents two agents from clobbering each other when working in parallel.
 * State stored atomically in `config/agent-scope.json`.
 *
 * Three layers of protection:
 *  1. File-pattern overlap — two agents claim the same directory → conflict
 *  2. Branch isolation     — two agents on the same git branch → conflict
 *                            (unless they explicitly opt into "shared-branch" mode)
 *  3. Heartbeat / PID      — claims auto-expire when the owner stops
 *                            renewing the lease or the OS process dies.
 *
 * See `AGENTS.md` for the workflow agents must follow.
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
  /** OS process id when known — used to detect dead agents */
  pid?: number
  /** ISO timestamp of last heartbeat update */
  lastHeartbeatAt?: string
  /** Set to true when the agent explicitly accepts shared-branch operation */
  shareBranch?: boolean
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

/**
 * Check if a Unix/macOS pid is still alive. Returns false for unknown pids
 * or any error. On any non-POSIX runtime we treat the pid as alive so we
 * never falsely reap a claim.
 */
function isProcessAlive(pid: number | undefined): boolean {
  if (!pid || pid <= 0) return true
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ESRCH') return false
    if (code === 'EPERM') return true // process exists but we cannot signal
    return true
  }
}

function isStale(claim: ScopeClaim): boolean {
  if (isExpired(claim)) return true
  if (claim.pid && !isProcessAlive(claim.pid)) return true
  return false
}

/** Base directory of a glob pattern — everything up to the first segment containing `*`. */
function globBase(pattern: string): string {
  const parts = pattern.split('/')
  const out: string[] = []
  for (const p of parts) {
    if (p.includes('*')) break
    out.push(p)
  }
  return out.join('/')
}

function hasWildcard(pattern: string): boolean {
  return pattern.includes('*')
}

/**
 * Two patterns overlap if their effective base directories overlap.
 *  - `src/lib/agents/**` overlaps `src/lib/agents/foo.ts`        ✓ (foo lives under agents/)
 *  - `src/lib/agents/**` does NOT overlap `src/lib/other.ts`      ✗ (other lives above agents/)
 *  - `src/lib/**`        overlaps `src/lib/anything/anywhere.ts` ✓
 *  - `src/lib/foo.ts`    overlaps `src/lib/foo.ts`                ✓ exact
 *  - `src/lib/foo.ts`    does NOT overlap `src/lib/bar.ts`        ✗
 */
function patternsOverlap(a: string[], b: string[]): boolean {
  for (const pa of a) {
    for (const pb of b) {
      if (pa === pb) return true

      const aWild = hasWildcard(pa)
      const bWild = hasWildcard(pb)
      const baseA = aWild ? globBase(pa) : pa
      const baseB = bWild ? globBase(pb) : pb

      if (!baseA || !baseB) continue

      // Concrete files only overlap when identical (already handled above).
      if (!aWild && !bWild) continue

      // One side is a wildcard — it claims everything below its base directory.
      // The other side overlaps iff it lives inside that directory.
      const segmentsA = baseA.split('/')
      const segmentsB = baseB.split('/')

      const aContainsB = aWild &&
        segmentsB.length >= segmentsA.length &&
        segmentsA.every((seg, i) => seg === segmentsB[i])
      const bContainsA = bWild &&
        segmentsA.length >= segmentsB.length &&
        segmentsB.every((seg, i) => seg === segmentsA[i])

      if (aContainsB || bContainsA) return true
    }
  }
  return false
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ClaimOptions {
  ttlMinutes?: number
  pid?: number
  /** Set to true if you knowingly accept another agent on the same branch. */
  shareBranch?: boolean
}

export interface ClaimResult {
  success: boolean
  claimId?: string
  conflict?: ScopeClaim
  conflictReason?: 'file-overlap' | 'branch-occupied'
  message: string
}

/**
 * Try to claim write scope for a set of file patterns on a branch.
 * Fails if (a) another live agent overlaps file patterns, or
 * (b) another live agent is already on the same branch and shareBranch is false.
 */
export function claimScope(
  agentId: string,
  agentType: AgentType,
  milestone: string,
  branch: string,
  filePatterns: string[],
  optionsOrTtl: ClaimOptions | number = {},
): ClaimResult {
  const options: ClaimOptions = typeof optionsOrTtl === 'number'
    ? { ttlMinutes: optionsOrTtl }
    : optionsOrTtl
  const ttlMinutes = options.ttlMinutes ?? 60

  const registry = readRegistry()
  registry.claims = registry.claims.filter(c => !isStale(c))

  for (const existing of registry.claims) {
    if (existing.agentId === agentId) continue // same agent re-claiming

    if (patternsOverlap(existing.filePatterns, filePatterns)) {
      return {
        success: false,
        conflict: existing,
        conflictReason: 'file-overlap',
        message: `Conflict: Agent ${existing.agentId} (${existing.milestone}) already holds overlapping file scope`,
      }
    }

    // Branch sharing requires explicit consent from BOTH sides. Default deny.
    if (existing.branch === branch && !(options.shareBranch && existing.shareBranch)) {
      return {
        success: false,
        conflict: existing,
        conflictReason: 'branch-occupied',
        message: `Conflict: Agent ${existing.agentId} is already on branch '${branch}'. Use a separate branch (both agents must set shareBranch=true to share).`,
      }
    }
  }

  registry.claims = registry.claims.filter(c => c.agentId !== agentId)

  const now = new Date()
  const claim: ScopeClaim = {
    agentId,
    agentType,
    milestone,
    branch,
    filePatterns,
    pid: options.pid,
    lastHeartbeatAt: now.toISOString(),
    shareBranch: options.shareBranch ?? false,
    claimedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString(),
  }

  registry.claims.push(claim)
  registry.updatedAt = now.toISOString()
  writeRegistry(registry)

  return { success: true, claimId: agentId, message: `Scope claimed for ${milestone}` }
}

/**
 * Refresh the lease on an existing claim. Returns false if no live claim found.
 * Extends `expiresAt` by ttlMinutes (default 30).
 */
export function heartbeatScope(agentId: string, ttlMinutes = 30): boolean {
  const registry = readRegistry()
  const claim = registry.claims.find(c => c.agentId === agentId)
  if (!claim || isStale(claim)) return false

  const now = new Date()
  claim.lastHeartbeatAt = now.toISOString()
  claim.expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString()
  registry.updatedAt = now.toISOString()
  writeRegistry(registry)
  return true
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
 * Get all active (non-stale) claims. Reaps stale claims on the fly.
 */
export function getActiveClaims(): ScopeClaim[] {
  const registry = readRegistry()
  const active = registry.claims.filter(c => !isStale(c))
  if (active.length !== registry.claims.length) {
    registry.claims = active
    registry.updatedAt = new Date().toISOString()
    writeRegistry(registry)
  }
  return active
}

/**
 * Check if a specific file pattern is currently locked by any other agent.
 */
export function isScopeLocked(filePattern: string): ScopeClaim | null {
  const active = getActiveClaims()
  return active.find(c => patternsOverlap(c.filePatterns, [filePattern])) ?? null
}

/**
 * Return all live agents currently on a given branch (excluding the caller).
 */
export function getAgentsOnBranch(branch: string, excludeAgentId?: string): ScopeClaim[] {
  return getActiveClaims().filter(c => c.branch === branch && c.agentId !== excludeAgentId)
}

export interface PreflightSummary {
  ok: boolean
  branch: string
  agentsOnBranch: ScopeClaim[]
  overlappingClaims: ScopeClaim[]
  recommendation: string
}

/**
 * Read-only check that an agent can run before claiming. Tells the caller
 * whether the branch is busy and which file scopes overlap with their plan.
 */
export function preflight(branch: string, filePatterns: string[], agentId?: string): PreflightSummary {
  const active = getActiveClaims().filter(c => c.agentId !== agentId)
  const agentsOnBranch = active.filter(c => c.branch === branch)
  const overlappingClaims = active.filter(c => patternsOverlap(c.filePatterns, filePatterns))

  let recommendation: string
  if (overlappingClaims.length > 0) {
    recommendation = `Adjust file scope — overlapping with ${overlappingClaims.map(c => c.agentId).join(', ')}`
  } else if (agentsOnBranch.length > 0) {
    recommendation = `Create a separate branch — '${branch}' is already used by ${agentsOnBranch.map(c => c.agentId).join(', ')}`
  } else {
    recommendation = 'Clear — proceed with claim'
  }

  return {
    ok: overlappingClaims.length === 0 && agentsOnBranch.length === 0,
    branch,
    agentsOnBranch,
    overlappingClaims,
    recommendation,
  }
}
