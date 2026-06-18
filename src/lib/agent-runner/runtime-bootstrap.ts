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

export interface SmokeTestResult {
  ran: boolean
  ok: boolean
  detail: string
  /** HTTP status observed on the root route, if the server came up. */
  status?: number
}

/**
 * Best-effort live smoke test: start the app's dev server on an ephemeral port,
 * poll the root route until it responds, then shut it down. Proves the built app
 * actually BOOTS (not just compiles). Never throws; time-boxed.
 */
export async function smokeTestApp(options: {
  targetRepo: string
  port?: number
  timeoutMs?: number
}): Promise<SmokeTestResult> {
  const { targetRepo } = options
  const cmd = devCommand(targetRepo)
  if (!cmd || !fs.existsSync(path.join(targetRepo, 'node_modules'))) {
    return { ran: false, ok: true, detail: 'kein dev-Script oder node_modules — übersprungen' }
  }
  const port = options.port ?? 3987
  const timeoutMs = options.timeoutMs ?? 30_000
  const http = await import('http')
  const { spawn } = await import('child_process')

  const child = spawn(cmd.exe, cmd.args, {
    cwd: targetRepo,
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
    detached: true,
  })

  const probe = (): Promise<number | null> =>
    new Promise(resolve => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 3000 }, res => {
        res.resume()
        resolve(res.statusCode ?? null)
      })
      req.on('error', () => resolve(null))
      req.on('timeout', () => { req.destroy(); resolve(null) })
    })

  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
  const deadline = Date.now() + timeoutMs
  let status: number | null = null
  try {
    while (Date.now() < deadline) {
      status = await probe()
      if (status !== null) break
      await sleep(1500)
    }
  } finally {
    try { if (child.pid) process.kill(-child.pid, 'SIGTERM') } catch { /* already gone */ }
    try { child.kill('SIGKILL') } catch { /* noop */ }
  }

  if (status === null) {
    return { ran: true, ok: false, detail: `App kam in ${Math.round(timeoutMs / 1000)}s nicht hoch` }
  }
  // Any HTTP response (200 or a redirect to /login) means the server booted.
  const ok = status < 500
  return { ran: true, ok, detail: ok ? `App läuft (HTTP ${status} auf /)` : `App antwortet mit HTTP ${status}`, status }
}
