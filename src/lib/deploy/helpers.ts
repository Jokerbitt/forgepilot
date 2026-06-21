/**
 * Pure helpers for the deploy providers — no process side effects, fully unit
 * testable. Port probing, Dockerfile generation and start-command detection.
 */
import { createServer } from 'net'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/** Resolve the first free TCP port at/after `start`, probing up to `tries` ports. */
export function findFreePort(start = 3001, tries = 50): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number, left: number) => {
      if (left <= 0) { reject(new Error('No free port found')); return }
      const srv = createServer()
      srv.once('error', () => { srv.close(); tryPort(port + 1, left - 1) })
      srv.once('listening', () => {
        srv.close(() => resolve(port))
      })
      srv.listen(port, '127.0.0.1')
    }
    tryPort(start, tries)
  })
}

interface PackageScripts {
  scripts?: Record<string, string>
}

/** Read package.json scripts (best-effort). */
function readScripts(repoPath: string): Record<string, string> {
  const pkgPath = join(repoPath, 'package.json')
  if (!existsSync(pkgPath)) return {}
  try {
    return (JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageScripts).scripts ?? {}
  } catch {
    return {}
  }
}

export interface StartPlan {
  /** Whether a build step is needed before starting. */
  needsBuild: boolean
  /** npm script names to run, in order. */
  steps: string[]
}

/**
 * Decide how to start an app from its package.json scripts.
 * Prefers `build` + `start` (production), falls back to `dev`, then a bare node start.
 */
export function detectStartPlan(repoPath: string): StartPlan {
  const scripts = readScripts(repoPath)
  if (scripts['build'] && scripts['start']) return { needsBuild: true, steps: ['build', 'start'] }
  if (scripts['start']) return { needsBuild: false, steps: ['start'] }
  if (scripts['dev']) return { needsBuild: false, steps: ['dev'] }
  return { needsBuild: false, steps: [] }
}

/**
 * Generate a generic multi-stage Node Dockerfile for a Next.js / Node app.
 * Honors the given internal port via the PORT env var.
 */
export function generateDockerfile(port = 3000): string {
  return [
    '# syntax=docker/dockerfile:1',
    'FROM node:20-alpine AS deps',
    'WORKDIR /app',
    'COPY package*.json ./',
    'RUN npm ci --omit=dev || npm install --omit=dev',
    '',
    'FROM node:20-alpine AS build',
    'WORKDIR /app',
    'COPY package*.json ./',
    'RUN npm ci || npm install',
    'COPY . .',
    'RUN npm run build --if-present',
    '',
    'FROM node:20-alpine AS run',
    'WORKDIR /app',
    'ENV NODE_ENV=production',
    `ENV PORT=${port}`,
    'COPY --from=build /app ./',
    `EXPOSE ${port}`,
    'CMD ["npm", "run", "start"]',
    '',
  ].join('\n')
}

/** Turn a repo path / app name into a safe docker image tag. */
export function dockerImageTag(repoPath: string): string {
  const base = repoPath.split('/').filter(Boolean).pop() ?? 'app'
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'app'
  return `forgepilot/${slug}`
}
