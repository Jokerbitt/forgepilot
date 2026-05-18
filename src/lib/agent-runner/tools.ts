import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface OllamaToolFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required: string[]
  }
}

export interface OllamaTool {
  type: 'function'
  function: OllamaToolFunction
}

export interface OllamaToolCall {
  function: {
    name: string
    arguments: Record<string, unknown>
  }
}

export interface ToolExecutionResult {
  ok: boolean
  output: string
}

export const MAX_BASH_OUTPUT = 2000
export const MAX_READ_OUTPUT = 4000

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\brm\s+-rf\s+\/(?:\s|$)/,
  /\brm\s+-rf\s+~(?:\s|$|\/)/,
  /\brm\s+-rf\s+\$HOME(?:\s|$|\/)/,
  /\brm\s+-rf\s+\*\s*$/,
  /:\(\)\s*\{\s*:\|:&\s*\}/,
  /\bmkfs(?:\.[a-z0-9]+)?\b/,
  /\bdd\s+if=.+\s+of=\/dev\//,
]

export function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  const trimmed = command.trim()
  if (!trimmed) return { safe: false, reason: 'Leerer Befehl' }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `Befehl blockiert (Pattern: ${pattern.source})` }
    }
  }
  return { safe: true }
}

export const OLLAMA_TOOLS: OllamaTool[] = [
  {
    type: 'function',
    function: {
      name: 'bash_exec',
      description:
        'Run a shell command in the project working directory. Returns stdout+stderr (truncated to 2000 chars).',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to execute' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a file from disk. Returns its content (truncated to 4000 chars).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (absolute or relative to cwd)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write content to a file. Creates parent directories as needed.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path (absolute or relative to cwd)' },
          content: { type: 'string', description: 'File content to write' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dir',
      description: 'List entries of a directory. Returns one entry per line.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
        },
        required: ['path'],
      },
    },
  },
]

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + `\n…[truncated, ${text.length - max} more chars]`
}

function resolveWithin(cwd: string, p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(cwd, p)
}

export function execBash(command: string, cwd: string, timeoutMs = 30_000): ToolExecutionResult {
  const safety = isCommandSafe(command)
  if (!safety.safe) {
    return { ok: false, output: `BLOCKED: ${safety.reason}` }
  }
  try {
    const stdout = execSync(command, {
      cwd,
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
    })
    return { ok: true, output: truncate(stdout || '(no output)', MAX_BASH_OUTPUT) }
  } catch (err) {
    const e = err as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string; status?: number }
    const stdout = typeof e.stdout === 'string' ? e.stdout : e.stdout?.toString() ?? ''
    const stderr = typeof e.stderr === 'string' ? e.stderr : e.stderr?.toString() ?? ''
    const combined = [stdout, stderr, e.message ?? ''].filter(Boolean).join('\n')
    return { ok: false, output: truncate(combined || 'Command failed', MAX_BASH_OUTPUT) }
  }
}

export function readFileTool(p: string, cwd: string): ToolExecutionResult {
  try {
    const full = resolveWithin(cwd, p)
    const content = fs.readFileSync(full, 'utf-8')
    return { ok: true, output: truncate(content, MAX_READ_OUTPUT) }
  } catch (err) {
    return { ok: false, output: `Read failed: ${(err as Error).message}` }
  }
}

export function writeFileTool(p: string, content: string, cwd: string): ToolExecutionResult {
  try {
    const full = resolveWithin(cwd, p)
    const dir = path.dirname(full)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(full, content, 'utf-8')
    return { ok: true, output: `Wrote ${content.length} chars to ${full}` }
  } catch (err) {
    return { ok: false, output: `Write failed: ${(err as Error).message}` }
  }
}

export function listDirTool(p: string, cwd: string): ToolExecutionResult {
  try {
    const full = resolveWithin(cwd, p)
    const entries = fs.readdirSync(full, { withFileTypes: true })
    const lines = entries.map(e => (e.isDirectory() ? `${e.name}/` : e.name))
    return { ok: true, output: truncate(lines.join('\n') || '(empty)', MAX_READ_OUTPUT) }
  } catch (err) {
    return { ok: false, output: `List failed: ${(err as Error).message}` }
  }
}

export function executeToolCall(call: OllamaToolCall, cwd: string): ToolExecutionResult {
  const { name, arguments: args } = call.function
  switch (name) {
    case 'bash_exec': {
      const command = typeof args.command === 'string' ? args.command : ''
      return execBash(command, cwd)
    }
    case 'read_file': {
      const p = typeof args.path === 'string' ? args.path : ''
      return readFileTool(p, cwd)
    }
    case 'write_file': {
      const p = typeof args.path === 'string' ? args.path : ''
      const content = typeof args.content === 'string' ? args.content : ''
      return writeFileTool(p, content, cwd)
    }
    case 'list_dir': {
      const p = typeof args.path === 'string' ? args.path : ''
      return listDirTool(p, cwd)
    }
    default:
      return { ok: false, output: `Unknown tool: ${name}` }
  }
}
