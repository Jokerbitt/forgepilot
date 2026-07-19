import { execFileSync } from 'child_process'
import { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'

/**
 * Runtime bootstrap for a freshly built app.
 *
 * `npm run build` proves the code COMPILES, but a built app still fails at
 * runtime when its `.env` (gitignored) is missing or its database was never
 * migrated. This module closes that gap after the final writeback:
 *
 *   1. env    — create `.env` from `.env.example`, generating real values for
 *               secret-like keys that still hold placeholders.
 *   2. prisma — `prisma generate` + `migrate deploy` (fallback `db push`) + seed.
 *
 * Every step is best-effort and isolated: a failure is recorded in the result,
 * never thrown, so it can be surfaced as a warning without failing the build.
 */

export interface RuntimeBootstrapStep {
  ran: boolean
  ok: boolean
  detail: string
}

export interface RuntimeBootstrapResult {
  env: RuntimeBootstrapStep
  prismaGenerate: RuntimeBootstrapStep
  prismaMigrate: RuntimeBootstrapStep
  seed: RuntimeBootstrapStep
  previewRegistered: RuntimeBootstrapStep
}

const SKIP: RuntimeBootstrapStep = { ran: false, ok: true, detail: 'übersprungen' }

/** A key whose value should be treated as a secret and never left as a placeholder. */
export function isSecretKey(key: string): boolean {
  if (/PUBLIC|DATABASE_URL|_URL$|^URL$|HOST|PORT/i.test(key)) return false
  return /SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE.?KEY|API.?KEY|^KEY$|_KEY$|SALT|SIGNING/i.test(key)
}

/** A value that is clearly a placeholder rather than a real secret. */
export function isPlaceholderValue(value: string): boolean {
  const v = value.trim().replace(/^["']|["']$/g, '')
  if (v.length === 0) return true
  return /generate|change.?me|changeme|placeholder|your-|your_|example|replace|xxx+|todo|secret-for-production|<.*>/i.test(v)
}

/** Generate a strong random secret (64 hex chars). */
export function generateSecret(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Build a `.env` body from a `.env.example` body, replacing placeholder secrets
 * with freshly generated values and copying everything else verbatim.
 * Comments and blank lines are preserved.
 */
export function materializeEnv(exampleBody: string, secret: () => string = generateSecret): string {
  return exampleBody
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('#')) return line
      const eq = line.indexOf('=')
      if (eq === -1) return line
      const key = line.slice(0, eq).trim()
      const rawValue = line.slice(eq + 1)
      if (isSecretKey(key) && isPlaceholderValue(rawValue)) {
        const quoted = /^\s*["']/.test(rawValue)
        const value = secret()
        return `${key}=${quoted ? `"${value}"` : value}`
      }
      return line
    })
    .join('\n')
}

function runStep(
  label: string,
  cwd: string,
  cmd: string,
  args: string[],
  timeoutMs: number,
): RuntimeBootstrapStep {
  try {
    execFileSync(cmd, args, { cwd, stdio: 'ignore', timeout: timeoutMs })
    return { ran: true, ok: true, detail: label }
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 120) : 'unbekannter Fehler'
    return { ran: true, ok: false, detail: `${label} fehlgeschlagen: ${msg}` }
  }
}

/** Detect the dev-server port from package.json's dev script, defaulting to 3000. */
export function detectDevPort(targetRepo: string): number {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(targetRepo, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>
    }
    const dev = pkg.scripts?.dev ?? ''
    const flag = dev.match(/(?:-p|--port)[ =](\d{2,5})/) ?? dev.match(/PORT[ =](\d{2,5})/)
    if (flag?.[1]) return Number(flag[1])
  } catch { /* default below */ }
  return 3000
}

/** App framework hint for the preview launch config. */
function devCommand(targetRepo: string): { exe: string; args: string[] } | null {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(targetRepo, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>
    }
    if (pkg.scripts?.dev) return { exe: 'npm', args: ['run', 'dev'] }
  } catch { /* none */ }
  return null
}

/**
 * Register the freshly built app with the Preview tooling by writing a
 * `.claude/launch.json` (if absent), so it can be started + previewed by name.
 */
export function writeLaunchJson(targetRepo: string): RuntimeBootstrapStep {
  const cmd = devCommand(targetRepo)
  if (!cmd) return { ...SKIP }
  const launchPath = path.join(targetRepo, '.claude', 'launch.json')
  if (fs.existsSync(launchPath)) return { ran: false, ok: true, detail: 'launch.json existiert bereits' }
  try {
    const name = path.basename(targetRepo).replace(/[^a-zA-Z0-9._-]+/g, '-') || 'app'
    const config = {
      version: '0.0.1',
      configurations: [
        { name, runtimeExecutable: cmd.exe, runtimeArgs: cmd.args, port: detectDevPort(targetRepo) },
      ],
    }
    fs.mkdirSync(path.dirname(launchPath), { recursive: true })
    fs.writeFileSync(launchPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8')
    return { ran: true, ok: true, detail: `Preview registriert (.claude/launch.json, Port ${config.configurations[0]!.port})` }
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 120) : 'unbekannter Fehler'
    return { ran: true, ok: false, detail: `Preview-Registrierung fehlgeschlagen: ${msg}` }
  }
}

/** Does package.json declare a `seed` script or a prisma seed command? */
function hasSeedCommand(targetRepo: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(targetRepo, 'package.json'), 'utf-8')) as {
      scripts?: Record<string, string>
      prisma?: { seed?: string }
    }
    return Boolean(pkg.scripts?.seed) || Boolean(pkg.prisma?.seed)
  } catch {
    return false
  }
}

/**
 * Bootstrap the runtime of a freshly written-back app at `targetRepo`.
 * Pure orchestration over the filesystem + package managers; safe to call on
 * any repo (no-ops cleanly when there is no `.env.example` / no Prisma).
 */
export function bootstrapRuntime(options: {
  targetRepo: string
  env?: Record<string, string | undefined>
}): RuntimeBootstrapResult {
  const { targetRepo } = options
  const result: RuntimeBootstrapResult = {
    env: { ...SKIP },
    prismaGenerate: { ...SKIP },
    prismaMigrate: { ...SKIP },
    seed: { ...SKIP },
    previewRegistered: { ...SKIP },
  }

  if (!fs.existsSync(targetRepo)) return result

  // 1. env — create .env from .env.example when missing
  const examplePath = path.join(targetRepo, '.env.example')
  const envPath = path.join(targetRepo, '.env')
  if (fs.existsSync(examplePath) && !fs.existsSync(envPath)) {
    try {
      const body = materializeEnv(fs.readFileSync(examplePath, 'utf-8'))
      fs.writeFileSync(envPath, body.endsWith('\n') ? body : `${body}\n`, 'utf-8')
      result.env = { ran: true, ok: true, detail: '.env aus .env.example erzeugt (Secrets generiert)' }
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : 'unbekannter Fehler'
      result.env = { ran: true, ok: false, detail: `.env-Erzeugung fehlgeschlagen: ${msg}` }
    }
  }

  // 2. prisma — generate client, apply migrations, seed
  const schemaPath = path.join(targetRepo, 'prisma', 'schema.prisma')
  if (fs.existsSync(schemaPath)) {
    result.prismaGenerate = runStep('prisma generate', targetRepo, 'npx', ['prisma', 'generate'], 120_000)

    let migrate = runStep('prisma migrate deploy', targetRepo, 'npx', ['prisma', 'migrate', 'deploy'], 120_000)
    if (!migrate.ok) {
      // No migration history yet — push the schema straight to the DB instead.
      const push = runStep('prisma db push', targetRepo, 'npx', ['prisma', 'db', 'push', '--skip-generate'], 120_000)
      migrate = push.ok
        ? { ran: true, ok: true, detail: 'prisma db push (kein Migrations-Verlauf)' }
        : migrate
    }
    result.prismaMigrate = migrate

    if (migrate.ok && hasSeedCommand(targetRepo)) {
      let seed = runStep('npm run seed', targetRepo, 'npm', ['run', 'seed'], 120_000)
      if (!seed.ok) seed = runStep('prisma db seed', targetRepo, 'npx', ['prisma', 'db', 'seed'], 120_000)
      result.seed = seed
    }
  }

  // 3. preview — register the app with the Preview tooling for one-click start
  result.previewRegistered = writeLaunchJson(targetRepo)

  return result
}

/** One-line human summary of a bootstrap result, for delegation logs. */
export function summarizeBootstrap(r: RuntimeBootstrapResult): string {
  const parts: string[] = []
  const add = (s: RuntimeBootstrapStep, okLabel: string) => {
    if (!s.ran) return
    parts.push(s.ok ? `✅ ${okLabel}` : `⚠️ ${s.detail}`)
  }
  add(r.env, '.env erzeugt')
  add(r.prismaGenerate, 'Prisma Client generiert')
  add(r.prismaMigrate, 'DB migriert')
  add(r.seed, 'Demo-Daten geseedet')
  add(r.previewRegistered, 'Preview registriert')
  return parts.length > 0 ? parts.join(' · ') : 'Kein Runtime-Bootstrap nötig'
}

// ─── Live smoke test ──────────────────────────────────────────────────────────

/**
 * Whether the live smoke test acts as a hard PRE-writeback gate (a red smoke
 * blocks the writeback and fails the delegation) instead of the default
 * post-writeback diagnostic log. Closes the verify-gate blind spot where
 * build+tests are green but the app crashes at runtime (e.g. an RSC error) —
 * without the flag, broken code reaches the target repo and the red smoke is
 * only a log line after the fact. Same arming pattern as
 * FORGEPILOT_POLICY_ENFORCE: off by default, truthy = 1/true/on/yes.
 */
export function isSmokeGateEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.FORGEPILOT_SMOKE_GATE?.trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes'
}

/**
 * Ephemeral port for a gate smoke run. Randomized per call so two delegations
 * smoking concurrently in the same server process don't collide on the fixed
 * default port (which would probe the WRONG app and yield a false verdict).
 */
export function pickSmokePort(): number {
  return 3900 + Math.floor(Math.random() * 500)
}

export interface ProbeResult {
  path: string
  status: number | null
}

export interface SmokeTestResult {
  ran: boolean
  ok: boolean
  detail: string
  /** Per-route HTTP statuses observed once the server came up. */
  probes?: ProbeResult[]
}

/** Routes probed by default — root, the common auth + data pages, and a health endpoint. */
export const DEFAULT_SMOKE_PATHS = ['/', '/login', '/dashboard', '/api/health']

/** Server-log signatures that indicate a runtime crash even behind an HTTP redirect. */
export function hasCrashSignature(text: string): boolean {
  return /TypeError|ReferenceError|Cannot read propert(?:y|ies)|is not a function|is not defined|PrismaClient(?:KnownRequest|Initialization|Validation)?Error|Unhandled(?:Promise)?Rejection|ECONNREFUSED|MODULE_NOT_FOUND|Invalid `prisma\./.test(text)
}

/**
 * Decide overall smoke result from per-route statuses + captured server log.
 * Pure — unit-tested. Fails on any 5xx OR a crash signature in the log.
 */
export function evaluateSmoke(probes: ProbeResult[], serverLog: string): { ok: boolean; detail: string } {
  const reachable = probes.filter(p => p.status !== null)
  if (reachable.length === 0) {
    return { ok: false, detail: 'App kam nicht hoch (keine Route antwortete)' }
  }
  const server5xx = reachable.find(p => (p.status ?? 0) >= 500)
  if (server5xx) {
    return { ok: false, detail: `Server-Fehler ${server5xx.status} auf ${server5xx.path}` }
  }
  if (hasCrashSignature(serverLog)) {
    return { ok: false, detail: 'Laufzeitfehler im Server-Log (z.B. Prisma/TypeError) trotz HTTP-Antwort' }
  }
  const summary = reachable.map(p => `${p.path} ${p.status}`).join(', ')
  return { ok: true, detail: `App läuft — ${summary}` }
}

/**
 * Best-effort live smoke test: start the app's dev server on an ephemeral port,
 * probe several routes (root + auth/data pages), scan the server log for runtime
 * crashes, then shut it down. Proves the built app actually BOOTS and serves —
 * not just compiles. Never throws; time-boxed.
 */
export async function smokeTestApp(options: {
  targetRepo: string
  port?: number
  timeoutMs?: number
  paths?: string[]
}): Promise<SmokeTestResult> {
  const { targetRepo } = options
  const cmd = devCommand(targetRepo)
  if (!cmd || !fs.existsSync(path.join(targetRepo, 'node_modules'))) {
    return { ran: false, ok: true, detail: 'kein dev-Script oder node_modules — übersprungen' }
  }
  const port = options.port ?? 3987
  const timeoutMs = options.timeoutMs ?? 35_000
  const paths = options.paths ?? DEFAULT_SMOKE_PATHS
  const http = await import('http')
  const { spawn } = await import('child_process')

  const child = spawn(cmd.exe, cmd.args, {
    cwd: targetRepo,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })

  // Capture a bounded tail of the server output to scan for runtime crashes.
  let serverLog = ''
  const capture = (buf: Buffer) => { serverLog = (serverLog + buf.toString()).slice(-8000) }
  child.stdout?.on('data', capture)
  child.stderr?.on('data', capture)

  const probe = (p: string): Promise<number | null> =>
    new Promise(resolve => {
      const req = http.get({ host: '127.0.0.1', port, path: p, timeout: 4000 }, res => {
        res.resume()
        resolve(res.statusCode ?? null)
      })
      req.on('error', () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
    })

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
  const deadline = Date.now() + timeoutMs
  const probes: ProbeResult[] = []
  try {
    // Wait for the server to answer the root route at all.
    let up: number | null = null
    while (Date.now() < deadline) {
      up = await probe('/')
      if (up !== null) break
      await sleep(1500)
    }
    if (up === null) {
      return { ran: true, ok: false, detail: `App kam in ${Math.round(timeoutMs / 1000)}s nicht hoch` }
    }
    // Probe the full route set (first-hit dev compile can be slow → one retry).
    for (const p of paths) {
      let status = await probe(p)
      if (status === null) { await sleep(1200); status = await probe(p) }
      probes.push({ path: p, status })
    }
  } finally {
    try { if (child.pid) process.kill(-child.pid, 'SIGTERM') } catch { /* already gone */ }
    try { child.kill('SIGKILL') } catch { /* noop */ }
  }

  const verdict = evaluateSmoke(probes, serverLog)
  return { ran: true, ok: verdict.ok, detail: verdict.detail, probes }
}
