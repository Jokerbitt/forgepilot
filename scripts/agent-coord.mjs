#!/usr/bin/env node
/**
 * Agent Coordination CLI
 *
 * One command for every agent lifecycle action — no HTTP server required.
 * Subcommands:
 *   preflight   Check whether the current branch + intended scope is clear.
 *   claim       Reserve scope (writes lock file).
 *   heartbeat   Renew the lease (call every ~10 min while working).
 *   release     Drop the lock when the agent finishes.
 *   status      Print all live agents.
 *
 * Examples:
 *   node scripts/agent-coord.mjs status
 *   node scripts/agent-coord.mjs preflight --files "src/lib/agents/**"
 *   node scripts/agent-coord.mjs claim --agent claude-code-1 --type claude-code \
 *                                      --milestone M130 --files "src/lib/agents/**"
 *   node scripts/agent-coord.mjs heartbeat --agent claude-code-1
 *   node scripts/agent-coord.mjs release --agent claude-code-1
 *
 * The script reads/writes config/agent-scope.json directly so it works even
 * when the Next.js dev server is offline.
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCOPE_FILE = join(ROOT, 'config', 'agent-scope.json')

// ─── Helpers ────────────────────────────────────────────────────────────────

function readRegistry() {
  if (!existsSync(SCOPE_FILE)) return { claims: [], updatedAt: new Date().toISOString() }
  try {
    return JSON.parse(readFileSync(SCOPE_FILE, 'utf-8'))
  } catch {
    return { claims: [], updatedAt: new Date().toISOString() }
  }
}

function writeRegistry(registry) {
  const dir = dirname(SCOPE_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const tmp = SCOPE_FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(registry, null, 2), 'utf-8')
  renameSync(tmp, SCOPE_FILE)
}

function isProcessAlive(pid) {
  if (!pid || pid <= 0) return true
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    if (err && err.code === 'ESRCH') return false
    return true
  }
}

function isStale(claim) {
  if (new Date(claim.expiresAt) < new Date()) return true
  if (claim.pid && !isProcessAlive(claim.pid)) return true
  return false
}

function reapStale(registry) {
  const before = registry.claims.length
  registry.claims = registry.claims.filter(c => !isStale(c))
  if (registry.claims.length !== before) {
    registry.updatedAt = new Date().toISOString()
    writeRegistry(registry)
  }
  return registry
}

function globBase(pattern) {
  const parts = pattern.split('/')
  const out = []
  for (const p of parts) {
    if (p.includes('*')) break
    out.push(p)
  }
  return out.join('/')
}

function patternsOverlap(a, b) {
  for (const pa of a) {
    for (const pb of b) {
      if (pa === pb) return true
      const aWild = pa.includes('*')
      const bWild = pb.includes('*')
      const baseA = aWild ? globBase(pa) : pa
      const baseB = bWild ? globBase(pb) : pb
      if (!baseA || !baseB) continue
      if (!aWild && !bWild) continue

      const segA = baseA.split('/')
      const segB = baseB.split('/')
      const aContainsB = aWild && segB.length >= segA.length && segA.every((s, i) => s === segB[i])
      const bContainsA = bWild && segA.length >= segB.length && segB.every((s, i) => s === segA[i])
      if (aContainsB || bContainsA) return true
    }
  }
  return false
}

function currentBranch() {
  try {
    return execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf-8' }).trim() || 'detached'
  } catch {
    return 'detached'
  }
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        out[key] = next
        i++
      } else {
        out[key] = true
      }
    } else {
      out._.push(a)
    }
  }
  return out
}

function splitPatterns(value) {
  if (!value || value === true) return []
  return String(value).split(',').map(s => s.trim()).filter(Boolean)
}

// ─── Output helpers ─────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function fmtClaim(c, indent = '  ') {
  const since = new Date(c.claimedAt).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const expires = new Date(c.expiresAt).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const pid = c.pid ? ` pid=${c.pid}` : ''
  const heart = c.lastHeartbeatAt ? ` heartbeat=${new Date(c.lastHeartbeatAt).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''
  const share = c.shareBranch ? ` ${C.yellow}[shareBranch]${C.reset}` : ''
  return [
    `${indent}${C.bold}${c.agentId}${C.reset} (${c.agentType}) — ${c.milestone}${share}`,
    `${indent}${C.dim}branch:${C.reset} ${c.branch}`,
    `${indent}${C.dim}files :${C.reset} ${c.filePatterns.join(', ')}`,
    `${indent}${C.dim}since :${C.reset} ${since}   ${C.dim}expires:${C.reset} ${expires}${pid}${heart}`,
  ].join('\n')
}

// ─── Subcommands ────────────────────────────────────────────────────────────

function cmdStatus() {
  const registry = reapStale(readRegistry())
  console.log('')
  console.log(`${C.bold}Active agent claims${C.reset}`)
  console.log(`${C.dim}Source: ${SCOPE_FILE}${C.reset}`)
  console.log('')

  if (registry.claims.length === 0) {
    console.log(`${C.green}  ✓ Free — no agents currently hold scope.${C.reset}`)
    console.log('')
    return 0
  }

  const branch = currentBranch()
  console.log(`${C.bold}Current git branch:${C.reset} ${branch}`)
  console.log('')

  const byBranch = new Map()
  for (const c of registry.claims) {
    if (!byBranch.has(c.branch)) byBranch.set(c.branch, [])
    byBranch.get(c.branch).push(c)
  }

  for (const [b, claims] of byBranch.entries()) {
    const here = b === branch ? ` ${C.yellow}(← you are here)${C.reset}` : ''
    console.log(`${C.cyan}branch ${b}${C.reset}${here}`)
    for (const c of claims) {
      console.log(fmtClaim(c))
      console.log('')
    }
  }
  return 0
}

function cmdPreflight(args) {
  const branch = args.branch || currentBranch()
  const filePatterns = splitPatterns(args.files)
  const agentId = args.agent

  if (filePatterns.length === 0) {
    console.error(`${C.red}error:${C.reset} --files required (comma-separated glob patterns)`)
    return 2
  }

  const registry = reapStale(readRegistry())
  const others = registry.claims.filter(c => c.agentId !== agentId)
  const agentsOnBranch = others.filter(c => c.branch === branch)
  const overlapping = others.filter(c => patternsOverlap(c.filePatterns, filePatterns))

  const ok = overlapping.length === 0 && agentsOnBranch.length === 0

  console.log('')
  console.log(`${C.bold}Preflight check${C.reset}`)
  console.log(`  branch: ${branch}`)
  console.log(`  files : ${filePatterns.join(', ')}`)
  console.log('')

  if (ok) {
    console.log(`${C.green}  ✓ Clear — safe to proceed.${C.reset}`)
    console.log('')
    return 0
  }

  if (overlapping.length > 0) {
    console.log(`${C.red}  ✗ File overlap${C.reset} with:`)
    for (const c of overlapping) console.log(fmtClaim(c, '    '))
    console.log('')
    console.log(`${C.yellow}  → Narrow your file scope to a different directory.${C.reset}`)
  }

  if (agentsOnBranch.length > 0) {
    console.log(`${C.red}  ✗ Branch '${branch}' is busy${C.reset}:`)
    for (const c of agentsOnBranch) console.log(fmtClaim(c, '    '))
    console.log('')
    console.log(`${C.yellow}  → Create a separate branch:`)
    console.log(`     git switch -c ${branch}__$(date +%s)${C.reset}`)
  }
  console.log('')
  return 1
}

function cmdClaim(args) {
  const agentId = args.agent
  const agentType = args.type || 'claude-code'
  const milestone = args.milestone || 'unknown'
  const branch = args.branch || currentBranch()
  const filePatterns = splitPatterns(args.files)
  const ttlMinutes = args.ttl ? Number(args.ttl) : 60
  const shareBranch = Boolean(args['share-branch'])
  // The CLI's own pid would die the moment this script exits, so don't store
  // it by default. Pass --pid <shell-pid> when wrapping in a long-lived shell.
  const pid = args.pid ? Number(args.pid) : undefined

  if (!agentId || filePatterns.length === 0) {
    console.error(`${C.red}error:${C.reset} --agent and --files required`)
    return 2
  }

  const registry = reapStale(readRegistry())

  for (const existing of registry.claims) {
    if (existing.agentId === agentId) continue
    if (patternsOverlap(existing.filePatterns, filePatterns)) {
      console.error(`${C.red}✗ File overlap conflict${C.reset} with agent ${existing.agentId}`)
      console.error(fmtClaim(existing, '   '))
      return 1
    }
    if (existing.branch === branch && !(shareBranch && existing.shareBranch)) {
      console.error(`${C.red}✗ Branch '${branch}' already held${C.reset} by agent ${existing.agentId}`)
      console.error(fmtClaim(existing, '   '))
      console.error(`${C.yellow}   → switch to a separate branch or pass --share-branch (both sides must opt in).${C.reset}`)
      return 1
    }
  }

  registry.claims = registry.claims.filter(c => c.agentId !== agentId)
  const now = new Date()
  registry.claims.push({
    agentId,
    agentType,
    milestone,
    branch,
    filePatterns,
    pid,
    lastHeartbeatAt: now.toISOString(),
    shareBranch,
    claimedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString(),
  })
  registry.updatedAt = now.toISOString()
  writeRegistry(registry)

  console.log(`${C.green}✓ Scope claimed${C.reset} for ${agentId} (${milestone}) on ${branch}`)
  console.log(`${C.dim}  files: ${filePatterns.join(', ')}${C.reset}`)
  console.log(`${C.dim}  ttl  : ${ttlMinutes}m${pid ? `   pid: ${pid}` : ''}${C.reset}`)
  return 0
}

function cmdHeartbeat(args) {
  const agentId = args.agent
  const ttlMinutes = args.ttl ? Number(args.ttl) : 30
  if (!agentId) {
    console.error(`${C.red}error:${C.reset} --agent required`)
    return 2
  }

  const registry = reapStale(readRegistry())
  const claim = registry.claims.find(c => c.agentId === agentId)
  if (!claim) {
    console.error(`${C.red}✗ No live claim for ${agentId}${C.reset}`)
    return 1
  }
  const now = new Date()
  claim.lastHeartbeatAt = now.toISOString()
  claim.expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString()
  registry.updatedAt = now.toISOString()
  writeRegistry(registry)
  console.log(`${C.green}✓ Heartbeat${C.reset} for ${agentId} — expires ${claim.expiresAt}`)
  return 0
}

function cmdRelease(args) {
  const agentId = args.agent
  if (!agentId) {
    console.error(`${C.red}error:${C.reset} --agent required`)
    return 2
  }
  const registry = readRegistry()
  const before = registry.claims.length
  registry.claims = registry.claims.filter(c => c.agentId !== agentId)
  if (registry.claims.length === before) {
    console.log(`${C.yellow}- no claim to release for ${agentId}${C.reset}`)
    return 0
  }
  registry.updatedAt = new Date().toISOString()
  writeRegistry(registry)
  console.log(`${C.green}✓ Released${C.reset} ${agentId}`)
  return 0
}

function help() {
  console.log(`Agent coordination CLI

  status                                List all live agent claims
  preflight  --files PAT[,PAT]          Check current branch + file scope
  claim      --agent ID --files PAT[,PAT] [--milestone M] [--type TYPE]
             [--branch B] [--ttl 60] [--share-branch]
  heartbeat  --agent ID [--ttl 30]      Renew lease
  release    --agent ID                 Drop the lock

Common options:
  --branch B      override current git branch
  --type TYPE     claude-code | codex | antigravity | general (default: claude-code)
  --milestone M   short label, e.g. "M130-multi-agent"

State file: config/agent-scope.json`)
}

// ─── Entry ──────────────────────────────────────────────────────────────────

const [, , sub, ...rest] = process.argv
const args = parseArgs(rest)

let code = 0
switch (sub) {
  case 'status':    code = cmdStatus(); break
  case 'preflight': code = cmdPreflight(args); break
  case 'claim':     code = cmdClaim(args); break
  case 'heartbeat': code = cmdHeartbeat(args); break
  case 'release':   code = cmdRelease(args); break
  case 'help':
  case '--help':
  case '-h':
  case undefined:   help(); break
  default:
    console.error(`Unknown subcommand: ${sub}`)
    help()
    code = 2
}
process.exit(code)
