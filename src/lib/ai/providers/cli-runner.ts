/**
 * CLI-based providers — no API key required.
 *
 * ClaudeCLIProvider: wraps `claude -p "<prompt>"` (Claude Code Max subscription)
 * CodexCLIProvider: wraps `codex exec "<prompt>"` (Codex Pro subscription)
 *
 * Both are detected via `which` and run as child processes.
 * Useful for zero-key local workflows using existing subscription plans.
 */

import { execFile, execFileSync } from 'child_process'
import { promisify } from 'util'
import type {
  AIProvider,
  ProviderGenerateOptions,
  ProviderGenerateResult,
} from './types'

const execFileAsync = promisify(execFile)

// ─── Detection ────────────────────────────────────────────────────────────────

/** Returns the absolute path of a CLI binary, or null if not found. */
export function whichSync(binary: string): string | null {
  try {
    return execFileSync('which', [binary], { encoding: 'utf8' }).trim() || null
  } catch {
    return null
  }
}

/** Cached availability checks so we don't shell out on every request. */
const availabilityCache = new Map<string, { result: boolean; at: number }>()
const CACHE_TTL_MS = 60_000

function cachedAvailable(binary: string): boolean {
  const entry = availabilityCache.get(binary)
  if (entry && Date.now() - entry.at < CACHE_TTL_MS) return entry.result
  const result = whichSync(binary) !== null
  availabilityCache.set(binary, { result, at: Date.now() })
  return result
}

// ─── ClaudeCLIProvider ────────────────────────────────────────────────────────

export class ClaudeCLIProvider implements AIProvider {
  readonly id = 'claude-cli'
  readonly name = 'Claude CLI (Max Abo)'
  readonly type = 'anthropic' as const
  readonly supportsEmbeddings = false

  async generateText(options: ProviderGenerateOptions): Promise<ProviderGenerateResult> {
    if (!cachedAvailable('claude')) {
      throw new Error('claude CLI not found — install Claude Code or add it to PATH')
    }

    // Build a combined prompt including the system message
    const combinedPrompt = options.system
      ? `${options.system}\n\n${options.prompt}`
      : options.prompt

    const args = ['-p', combinedPrompt, '--output-format', 'text']

    const { stdout, stderr } = await execFileAsync('claude', args, {
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    })

    const text = stdout.trim()
    if (!text && stderr) throw new Error(`claude CLI stderr: ${stderr.trim()}`)

    return {
      text,
      providerId: this.id,
      model: options.model || 'claude-cli',
    }
  }

  async isAvailable(): Promise<boolean> {
    return cachedAvailable('claude')
  }
}

// ─── CodexCLIProvider ─────────────────────────────────────────────────────────

export class CodexCLIProvider implements AIProvider {
  readonly id = 'codex-cli'
  readonly name = 'Codex CLI (Pro Abo)'
  readonly type = 'openai-compatible' as const
  readonly supportsEmbeddings = false

  async generateText(options: ProviderGenerateOptions): Promise<ProviderGenerateResult> {
    if (!cachedAvailable('codex')) {
      throw new Error('codex CLI not found — install Codex CLI or add it to PATH')
    }

    const combinedPrompt = options.system
      ? `${options.system}\n\n${options.prompt}`
      : options.prompt

    const { stdout, stderr } = await execFileAsync('codex', [
      'exec',
      '-C',
      process.cwd(),
      '--sandbox',
      'read-only',
      combinedPrompt,
    ], {
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    })

    const text = stdout.trim()
    if (!text && stderr) throw new Error(`codex CLI stderr: ${stderr.trim()}`)

    return {
      text,
      providerId: this.id,
      model: options.model || 'codex-cli',
    }
  }

  async isAvailable(): Promise<boolean> {
    return cachedAvailable('codex')
  }
}
