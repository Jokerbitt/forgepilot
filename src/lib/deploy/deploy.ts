/**
 * One-Click-Deploy dispatcher — turns a repo + provider into a live URL.
 *
 * Each provider is a small function over an injectable CommandRunner, so the
 * orchestration is fully testable without spawning real processes. All errors
 * are turned into a plain-language DeployResult instead of throwing, so the API
 * and UI always have something human-readable to show.
 */
import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { CommandRunner, DeployOptions, DeployProvider, DeployResult } from './types'
import { defaultRunner } from './runner'
import { detectStartPlan, findFreePort, generateDockerfile, dockerImageTag } from './helpers'

interface ProviderContext {
  repoPath: string
  port?: number
  production?: boolean
  runner: CommandRunner
  /** Injectable free-port finder (defaults to the real one). */
  freePort: (start?: number) => Promise<number>
}

/** local: install deps if needed, build, then start the app on a free port. */
async function deployLocal(ctx: ProviderContext): Promise<DeployResult> {
  const { repoPath, runner } = ctx
  const plan = detectStartPlan(repoPath)
  if (plan.steps.length === 0) {
    return { status: 'error', provider: 'local', error: 'Kein start/dev-Script in package.json gefunden.' }
  }
  const port = ctx.port ?? (await ctx.freePort(3001))

  // Install dependencies when they are missing.
  if (!existsSync(join(repoPath, 'node_modules'))) {
    runner.run('npm', ['install'], { cwd: repoPath, timeoutMs: 10 * 60 * 1000 })
  }
  // Build steps run to completion; the final step is the long-running server.
  const runSteps = [...plan.steps]
  const startScript = runSteps.pop() as string
  for (const step of runSteps) {
    runner.run('npm', ['run', step], { cwd: repoPath, timeoutMs: 10 * 60 * 1000 })
  }
  const pid = runner.spawn('npm', ['run', startScript], {
    cwd: repoPath,
    env: { ...process.env, PORT: String(port) },
  })
  return {
    status: 'ok',
    provider: 'local',
    url: `http://localhost:${port}`,
    detail: `App läuft lokal auf http://localhost:${port} (npm run ${startScript}).`,
    pid,
  }
}

/** vercel: deploy via the Vercel CLI and parse the returned URL from stdout. */
function deployVercel(ctx: ProviderContext): DeployResult {
  const { repoPath, runner, production } = ctx
  try {
    const args = ['vercel', '--yes', ...(production ? ['--prod'] : [])]
    const out = runner.run('npx', args, { cwd: repoPath, timeoutMs: 15 * 60 * 1000 })
    const url = (out.match(/https?:\/\/[^\s]+\.vercel\.app/g)?.pop()) ?? out.split('\n').map(l => l.trim()).filter(Boolean).pop() ?? ''
    if (!url.startsWith('http')) {
      return { status: 'error', provider: 'vercel', error: 'Vercel hat keine URL zurückgegeben — ist die CLI eingeloggt (vercel login)?' }
    }
    return {
      status: 'ok',
      provider: 'vercel',
      url,
      detail: `${production ? 'Production' : 'Preview'}-Deploy auf Vercel: ${url}`,
    }
  } catch (e) {
    return { status: 'error', provider: 'vercel', error: vercelHint(e) }
  }
}

function vercelHint(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (/not found|ENOENT|command not found/i.test(msg)) return 'Vercel CLI nicht verfügbar — npm i -g vercel oder npx vercel ausführen.'
  if (/credentials|login|unauthorized|token/i.test(msg)) return 'Vercel nicht eingeloggt — vercel login ausführen.'
  return `Vercel-Deploy fehlgeschlagen: ${msg.slice(0, 200)}`
}

/** docker: write a Dockerfile if missing, build the image, run a container. */
async function deployDocker(ctx: ProviderContext): Promise<DeployResult> {
  const { repoPath, runner } = ctx
  const internalPort = 3000
  const hostPort = ctx.port ?? (await ctx.freePort(8080))
  const tag = dockerImageTag(repoPath)
  try {
    const dockerfilePath = join(repoPath, 'Dockerfile')
    if (!existsSync(dockerfilePath)) {
      writeFileSync(dockerfilePath, generateDockerfile(internalPort))
    }
    runner.run('docker', ['build', '-t', tag, '.'], { cwd: repoPath, timeoutMs: 20 * 60 * 1000 })
    const containerId = runner.run(
      'docker',
      ['run', '-d', '-p', `${hostPort}:${internalPort}`, tag],
      { cwd: repoPath, timeoutMs: 60 * 1000 },
    )
    return {
      status: 'ok',
      provider: 'docker',
      url: `http://localhost:${hostPort}`,
      detail: `Docker-Container ${containerId.slice(0, 12)} läuft auf http://localhost:${hostPort} (Image ${tag}).`,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/Cannot connect to the Docker daemon|ENOENT|not found/i.test(msg)) {
      return { status: 'error', provider: 'docker', error: 'Docker nicht erreichbar — läuft Docker Desktop / der Daemon?' }
    }
    return { status: 'error', provider: 'docker', error: `Docker-Deploy fehlgeschlagen: ${msg.slice(0, 200)}` }
  }
}

export interface DeployDeps {
  runner?: CommandRunner
  freePort?: (start?: number) => Promise<number>
}

/**
 * Deploy an app to the chosen provider. Never throws — returns a DeployResult.
 * Dependencies are injectable for testing.
 */
export async function deployApp(options: DeployOptions, deps: DeployDeps = {}): Promise<DeployResult> {
  const provider: DeployProvider = options.provider
  if (!options.repoPath || !existsSync(options.repoPath)) {
    return { status: 'error', provider, error: 'Repo-Pfad nicht gefunden.' }
  }
  const ctx: ProviderContext = {
    repoPath: options.repoPath,
    port: options.port,
    production: options.production,
    runner: deps.runner ?? defaultRunner,
    freePort: deps.freePort ?? ((start?: number) => findFreePort(start)),
  }
  try {
    switch (provider) {
      case 'local': return await deployLocal(ctx)
      case 'vercel': return deployVercel(ctx)
      case 'docker': return await deployDocker(ctx)
      default: return { status: 'error', provider, error: `Unbekannter Provider: ${String(provider)}` }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { status: 'error', provider, error: `Deploy fehlgeschlagen: ${msg.slice(0, 200)}` }
  }
}
