/**
 * Default CommandRunner backed by child_process. Kept separate from the deploy
 * logic so tests can inject a fake runner and never touch real processes.
 */
import { execFileSync, spawn } from 'child_process'
import { openSync } from 'fs'
import { join } from 'path'
import type { CommandRunner } from './types'

export const defaultRunner: CommandRunner = {
  run(cmd, args, opts) {
    return execFileSync(cmd, args, {
      cwd: opts.cwd,
      encoding: 'utf8',
      timeout: opts.timeoutMs ?? 10 * 60 * 1000,
      maxBuffer: 16 * 1024 * 1024,
    }).trim()
  },
  spawn(cmd, args, opts) {
    // Detach the long-running server and redirect its output to a log file so it
    // survives the request lifecycle without keeping pipes open.
    const logFd = openSync(join(opts.cwd, '.forgepilot-deploy.log'), 'a')
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      detached: true,
      stdio: ['ignore', logFd, logFd],
    })
    child.unref()
    return child.pid
  },
}
