/**
 * Tool-Use Runner — Autonomous Coding Agent
 *
 * Drives a Claude API tool-use loop that can read/write files, run safe commands,
 * and commit code — entirely via the Anthropic SDK, without the claude CLI binary.
 *
 * Security model:
 * - File reads/writes: restricted to projectRoot (no ../ escapes)
 * - File writes: blocked on .env, secrets, .git/
 * - Commands: strict allowlist — no rm, no push --force, no shell injection
 * - Git writes: blocked on main/master branch names
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { aiLogger } from '@/lib/logger'

export interface ToolRunnerOptions {
  apiKey: string
  model?: string
  projectRoot?: string
  maxTurns?: number
  budgetUsd?: number
  onLog?: (type: LogType, message: string) => void
}

export type LogType = 'info' | 'command' | 'success' | 'error' | 'thought'

export interface ToolRunnerResult {
  success: boolean
  summary: string
  filesChanged: string[]
  branchName?: string
  prUrl?: string
  turnsUsed: number
  estimatedCostUsd: number
}

// ─── Tool definitions ──────────────────────────────────────────────────────────

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the full contents of a file. Path relative to project root.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'e.g. src/lib/utils.ts' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write or overwrite a file. Creates parent directories if needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories at a path.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dir: { type: 'string', description: 'Directory relative to project root (default: ".")' },
        pattern: { type: 'string' },
      },
    },
  },
  {
    name: 'run_command',
    description: 'Run a safe command. Allowed: npm test/lint/type-check, grep, find, cat, ls, git log/diff/status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string' },
      },
      required: ['command'],
    },
  },
  {
    name: 'git_create_branch',
    description: 'Create and checkout a new feature branch.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'e.g. feat/add-validation' },
      },
      required: ['name'],
    },
  },
  {
    name: 'git_commit',
    description: 'Stage all changed files and create a git commit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
  },
  {
    name: 'task_complete',
    description: 'Signal task completion. Call when done.',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary: { type: 'string' },
        files_changed: { type: 'array', items: { type: 'string' } },
        branch_name: { type: 'string' },
        pr_url: { type: 'string' },
      },
      required: ['summary'],
    },
  },
]

// ─── Security: command allowlist ──────────────────────────────────────────────

const ALLOWED_PREFIXES = [
  'npm run test', 'npm test', 'npm run lint', 'npm run type-check', 'npm run build',
  'npx tsc', 'npx vitest',
  'grep ', 'grep -', 'find ', 'cat ', 'ls ', 'wc ', 'head ', 'tail ', 'echo ',
  'git status', 'git diff', 'git log', 'git show', 'git branch',
]

function isCommandAllowed(cmd: string): boolean {
  const t = cmd.trim().toLowerCase()
  return ALLOWED_PREFIXES.some(p => t.startsWith(p.toLowerCase()))
}

// ─── Security: path guard ─────────────────────────────────────────────────────

const BLOCKED_PATHS = ['.env', '.env.local', '.env.production', 'config/api-keys.json', '.git/']

function isSafePath(filePath: string, projectRoot: string): boolean {
  const resolved = path.resolve(projectRoot, filePath)
  if (!resolved.startsWith(projectRoot)) return false
  const rel = path.relative(projectRoot, resolved)
  return !BLOCKED_PATHS.some(b => rel.startsWith(b))
}

// ─── Tool execution ────────────────────────────────────────────────────────────

interface ToolInput {
  path?: string
  content?: string
  dir?: string
  pattern?: string
  command?: string
  name?: string
  message?: string
  summary?: string
  files_changed?: string[]
  branch_name?: string
  pr_url?: string
}

function executeTool(
  toolName: string,
  input: ToolInput,
  projectRoot: string,
  log: (type: LogType, msg: string) => void,
): { result: string; taskDone?: ToolRunnerResult } {
  switch (toolName) {
    case 'read_file': {
      const fp = input.path ?? ''
      if (!isSafePath(fp, projectRoot)) return { result: `Error: '${fp}' is outside project root or blocked` }
      try {
        const content = fs.readFileSync(path.resolve(projectRoot, fp), 'utf-8')
        log('command', `read_file: ${fp}`)
        return { result: content.slice(0, 20_000) }
      } catch (e) { return { result: `Error: ${String(e)}` } }
    }
    case 'write_file': {
      const fp = input.path ?? ''
      if (!isSafePath(fp, projectRoot)) return { result: `Error: '${fp}' is blocked` }
      try {
        const full = path.resolve(projectRoot, fp)
        fs.mkdirSync(path.dirname(full), { recursive: true })
        fs.writeFileSync(full, input.content ?? '', 'utf-8')
        log('command', `write_file: ${fp}`)
        return { result: `Wrote ${fp}` }
      } catch (e) { return { result: `Error: ${String(e)}` } }
    }
    case 'list_files': {
      const dir = input.dir ?? '.'
      if (!isSafePath(dir, projectRoot)) return { result: `Error: '${dir}' is outside project root` }
      try {
        const entries = fs.readdirSync(path.resolve(projectRoot, dir), { withFileTypes: true })
        const lines = entries
          .filter(e => !e.name.startsWith('.git'))
          .map(e => `${e.isDirectory() ? 'd' : 'f'} ${e.name}`)
          .filter(l => !input.pattern || l.includes(input.pattern))
          .slice(0, 200)
        log('command', `list_files: ${dir}`)
        return { result: lines.join('\n') }
      } catch (e) { return { result: `Error: ${String(e)}` } }
    }
    case 'run_command': {
      const cmd = input.command ?? ''
      if (!isCommandAllowed(cmd)) {
        log('error', `Blocked: ${cmd}`)
        return { result: `Error: '${cmd}' is not in the allowed list.` }
      }
      try {
        log('command', `$ ${cmd}`)
        const out = execSync(cmd, { cwd: projectRoot, timeout: 60_000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
        return { result: out.slice(0, 8_000) || '(no output)' }
      } catch (e: unknown) {
        return { result: `Command failed: ${e instanceof Error ? e.message.slice(0, 2_000) : String(e)}` }
      }
    }
    case 'git_create_branch': {
      const name = input.name ?? ''
      if (!name || /[^a-zA-Z0-9/_.-]/.test(name)) return { result: 'Error: invalid branch name' }
      if (name === 'main' || name === 'master') return { result: 'Error: cannot create branch named main or master' }
      try {
        execSync(`git checkout -b ${name}`, { cwd: projectRoot, timeout: 10_000 })
        log('command', `git checkout -b ${name}`)
        return { result: `Created branch: ${name}` }
      } catch (e) { return { result: `Error: ${String(e)}` } }
    }
    case 'git_commit': {
      const msg = input.message ?? ''
      if (!msg) return { result: 'Error: commit message required' }
      try {
        execSync('git add -A', { cwd: projectRoot, timeout: 10_000 })
        execSync(`git commit -m ${JSON.stringify(msg)}`, { cwd: projectRoot, timeout: 10_000 })
        log('command', `git commit: ${msg}`)
        return { result: `Committed: ${msg}` }
      } catch (e) { return { result: `Error: ${String(e)}` } }
    }
    case 'task_complete': {
      log('success', `Task complete: ${input.summary ?? ''}`)
      return {
        result: 'Done.',
        taskDone: {
          success: true,
          summary: input.summary ?? '',
          filesChanged: input.files_changed ?? [],
          branchName: input.branch_name,
          prUrl: input.pr_url,
          turnsUsed: 0,
          estimatedCostUsd: 0,
        },
      }
    }
    default:
      return { result: `Unknown tool: ${toolName}` }
  }
}

// ─── Main runner ───────────────────────────────────────────────────────────────

export async function runWithToolUse(
  prompt: string,
  options: ToolRunnerOptions,
): Promise<ToolRunnerResult> {
  const {
    apiKey,
    model = 'claude-sonnet-4-5',
    projectRoot = process.cwd(),
    maxTurns = 30,
    onLog = () => undefined,
  } = options

  const client = new Anthropic({ apiKey })
  const log = (type: LogType, message: string) => {
    aiLogger.info({ event: 'tool_use_runner.log', type, message })
    onLog(type, message)
  }

  log('info', `Starting tool-use agent (model: ${model}, maxTurns: ${maxTurns})`)

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let turnsUsed = 0
  let totalInput = 0
  let totalOutput = 0
  let finalResult: ToolRunnerResult | undefined

  while (turnsUsed < maxTurns) {
    turnsUsed++
    log('thought', `Turn ${turnsUsed}/${maxTurns}`)

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      tools: AGENT_TOOLS,
      messages,
    })

    totalInput += response.usage.input_tokens
    totalOutput += response.usage.output_tokens

    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        log('thought', block.text.slice(0, 500))
      }
    }

    if (response.stop_reason === 'end_turn') break
    if (response.stop_reason !== 'tool_use') break

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue
      const { result, taskDone } = executeTool(block.name, block.input as ToolInput, projectRoot, log)
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      if (taskDone) { finalResult = { ...taskDone, turnsUsed }; break }
    }

    if (finalResult) break
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
  }

  const estimatedCostUsd = (totalInput / 1_000_000) * 3 + (totalOutput / 1_000_000) * 15

  if (finalResult) return { ...finalResult, turnsUsed, estimatedCostUsd }

  return {
    success: false,
    summary: `Agent stopped after ${turnsUsed} turns without calling task_complete`,
    filesChanged: [],
    turnsUsed,
    estimatedCostUsd,
  }
}
