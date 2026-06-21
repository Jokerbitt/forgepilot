/**
 * One-Click-Deploy — shared types for the deploy providers.
 *
 * Three providers behind one interface:
 * - local:  build + start the app on a free port → http://localhost:PORT
 * - vercel: deploy via the Vercel CLI → public *.vercel.app URL
 * - docker: generate a Dockerfile, build an image, run a container → localhost:PORT
 *
 * Every provider returns the same DeployResult discriminated union so the API
 * and UI can show one plain-language outcome regardless of target.
 */

export type DeployProvider = 'local' | 'vercel' | 'docker'

export interface DeployOptions {
  /** Absolute path to the app repo to deploy. */
  repoPath: string
  /** Which target to deploy to. */
  provider: DeployProvider
  /** Preferred port for local/docker; a free one is chosen if taken. */
  port?: number
  /** Deploy to production (vercel --prod). Default false (preview). */
  production?: boolean
}

export type DeployResult =
  | {
      status: 'ok'
      provider: DeployProvider
      /** Plain-text URL the user can open. */
      url: string
      /** One-line, human-readable summary of what happened. */
      detail: string
      /** PID of a long-running local process, when applicable. */
      pid?: number
    }
  | {
      status: 'error'
      provider: DeployProvider
      /** Human-readable error in plain language. */
      error: string
    }

/** A minimal command runner — injectable so deploy logic is testable without real processes. */
export interface CommandRunner {
  /** Run a command to completion, returning its trimmed stdout. Throws on non-zero exit. */
  run(cmd: string, args: string[], opts: { cwd: string; timeoutMs?: number }): string
  /** Spawn a detached, long-running process. Returns its PID (or undefined). */
  spawn(cmd: string, args: string[], opts: { cwd: string; env?: NodeJS.ProcessEnv }): number | undefined
}
