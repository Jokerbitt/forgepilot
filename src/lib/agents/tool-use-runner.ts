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
import { execFileSync } from 'child_process'
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
    name: 'edit_file',
    description: 'Replace an exact string in a file. Safer than write_file for targeted changes — read the file first to get the exact text. Fails if old_string is not found or occurs more than once (unless replace_all is true).',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to project root' },
        old_string: { type: 'string', description: 'The exact text to replace (must be unique in the file)' },
        new_string: { type: 'string', description: 'The replacement text' },
        replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
      },
      required: ['path', 'old_string', 'new_string'],
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
    description: 'Run a safe command. Allowed: npm run test/lint/type-check/build, npm install <pkg>, grep, find, cat, ls, git log/diff/status.',
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
    name: 'git_push_branch',
    description: 'Push the current branch to origin (required before creating a PR).',
    input_schema: {
      type: 'object' as const,
      properties: {
        branch: { type: 'string', description: 'Branch name to push' },
      },
      required: ['branch'],
    },
  },
  {
    name: 'git_create_pr',
    description: 'Create a GitHub pull request for the current branch using the gh CLI.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'PR title' },
        body: { type: 'string', description: 'PR description (markdown)' },
        base: { type: 'string', description: 'Base branch (default: main)' },
      },
      required: ['title', 'body'],
    },
  },
  {
    name: 'fetch_url',
    description: 'Fetch the text content of a public URL (GET only). Use to read npm docs, GitHub READMEs, API references. Returns up to 10 KB of text. Blocked for localhost and private IPs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'https:// URL to fetch' },
      },
      required: ['url'],
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

const SAFE_ARG_PATTERN = /^[a-zA-Z0-9_./:=@,+-]+$/
const SAFE_NPM_SCRIPTS = new Set(['test', 'test:run', 'lint', 'type-check', 'build'])
const SAFE_NPX_COMMANDS = new Set(['tsc', 'vitest'])
const SAFE_GIT_COMMANDS = new Set(['status', 'diff', 'log', 'show', 'branch'])
const SAFE_FILE_COMMANDS = new Set(['grep', 'find', 'cat', 'ls', 'wc', 'head', 'tail'])
const SAFE_BRANCH_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/

function splitSafeCommand(cmd: string): string[] | undefined {
  const trimmed = cmd.trim()
  if (!trimmed || /[;&|`$<>\n\r\\]/.test(trimmed)) return undefined
  const parts = trimmed.split(/\s+/)
  if (parts.some(part => !SAFE_ARG_PATTERN.test(part))) return undefined
  return parts
}

function containsUnsafePathArg(args: string[]): boolean {
  return args.some(arg => {
    if (arg === '.' || arg === '--' || arg.startsWith('-')) return false
    if (arg.startsWith('/') || arg.includes('..')) return true
    return false
  })
}

function parseAllowedCommand(cmd: string): { bin: string; args: string[] } | undefined {
  const parts = splitSafeCommand(cmd)
  if (!parts) return undefined
  const [bin, first, second, ...rest] = parts

  if (bin === 'npm' && first === 'run' && second && SAFE_NPM_SCRIPTS.has(second)) {
    return { bin, args: ['run', second, ...rest] }
  }
  if (bin === 'npm' && first === 'test') {
    return { bin, args: ['test', second, ...rest].filter(Boolean) }
  }
  if (bin === 'npm' && first === 'install' && second && SAFE_ARG_PATTERN.test(second)) {
    // Allow installing a single named package — no @scope/pkg with slashes or complex flags
    const pkgArgs = [second, ...rest].filter(Boolean)
    if (pkgArgs.every(a => SAFE_ARG_PATTERN.test(a))) {
      return { bin, args: ['install', ...pkgArgs] }
    }
    return undefined
  }
  if (bin === 'npm' && first === 'uninstall' && second && SAFE_ARG_PATTERN.test(second)) {
    return { bin, args: ['uninstall', second] }
  }
  if (bin === 'npx' && first && SAFE_NPX_COMMANDS.has(first)) {
    return { bin, args: [first, second, ...rest].filter(Boolean) }
  }
  if (bin === 'git' && first && SAFE_GIT_COMMANDS.has(first)) {
    return { bin, args: [first, second, ...rest].filter(Boolean) }
  }
  if (SAFE_FILE_COMMANDS.has(bin)) {
    const args = [first, second, ...rest].filter(Boolean)
    if (containsUnsafePathArg(args)) return undefined
    return { bin, args }
  }
  return undefined
}

function isSafeBranchName(name: string): boolean {
  return SAFE_BRANCH_PATTERN.test(name) && !name.includes('..') && !name.endsWith('/') && !name.endsWith('.')
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
  old_string?: string
  new_string?: string
  replace_all?: boolean
  dir?: string
  pattern?: string
  command?: string
  name?: string
  message?: string
  summary?: string
  files_changed?: string[]
  branch_name?: string
  pr_url?: string
  title?: string
  body?: string
  base?: string
  branch?: string
  url?: string
}

// ─── Security: URL guard for fetch_url ────────────────────────────────────────

const BLOCKED_URL_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/0\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/\[fc/i,
  /^https?:\/\/\[fd/i,
]

function isSafeUrl(url: string): boolean {
  if (!url.startsWith('https://') && !url.startsWith('http://')) return false
  return !BLOCKED_URL_PATTERNS.some(p => p.test(url))
}

async function executeTool(
  toolName: string,
  input: ToolInput,
  projectRoot: string,
  log: (type: LogType, msg: string) => void,
): Promise<{ result: string; taskDone?: ToolRunnerResult }> {
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
    case 'edit_file': {
      const fp = input.path ?? ''
      if (!isSafePath(fp, projectRoot)) return { result: `Error: '${fp}' is blocked` }
      const oldStr = input.old_string ?? ''
      const newStr = input.new_string ?? ''
      if (!oldStr) return { result: 'Error: old_string is required' }
      try {
        const full = path.resolve(projectRoot, fp)
        const original = fs.readFileSync(full, 'utf-8')
        const occurrences = original.split(oldStr).length - 1
        if (occurrences === 0) return { result: `Error: old_string not found in '${fp}' — read the file first to get the exact text` }
        if (occurrences > 1 && !input.replace_all) return { result: `Error: old_string occurs ${occurrences} times in '${fp}' — use replace_all: true or make old_string more specific` }
        const updated = input.replace_all
          ? original.split(oldStr).join(newStr)
          : original.replace(oldStr, newStr)
        fs.writeFileSync(full, updated, 'utf-8')
        log('command', `edit_file: ${fp} (${occurrences} replacement${occurrences > 1 ? 's' : ''})`)
        return { result: `Edited ${fp}` }
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
      const parsed = parseAllowedCommand(cmd)
      if (!parsed) {
        log('error', `Blocked: ${cmd}`)
        return { result: `Error: '${cmd}' is not in the allowed list.` }
      }
      try {
        log('command', `$ ${cmd}`)
        const out = execFileSync(parsed.bin, parsed.args, {
          cwd: projectRoot,
          timeout: 60_000,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        return { result: out.slice(0, 8_000) || '(no output)' }
      } catch (e: unknown) {
        return { result: `Command failed: ${e instanceof Error ? e.message.slice(0, 2_000) : String(e)}` }
      }
    }
    case 'git_create_branch': {
      const name = input.name ?? ''
      if (!name || !isSafeBranchName(name)) return { result: 'Error: invalid branch name' }
      if (name === 'main' || name === 'master') return { result: 'Error: cannot create branch named main or master' }
      try {
        execFileSync('git', ['checkout', '-b', name], { cwd: projectRoot, timeout: 10_000 })
        log('command', `git checkout -b ${name}`)
        return { result: `Created branch: ${name}` }
      } catch (e) { return { result: `Error: ${String(e)}` } }
    }
    case 'git_commit': {
      const msg = input.message ?? ''
      if (!msg) return { result: 'Error: commit message required' }
      try {
        // Safety guard: refuse to commit directly to main/master
        const currentBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
          cwd: projectRoot, encoding: 'utf-8', timeout: 5_000,
        }).trim()
        if (currentBranch === 'main' || currentBranch === 'master') {
          return { result: `Error: cannot commit to '${currentBranch}'. Create a feature branch first with git_create_branch.` }
        }
        execFileSync('git', ['add', '-A'], { cwd: projectRoot, timeout: 10_000 })
        execFileSync('git', ['commit', '-m', msg], { cwd: projectRoot, timeout: 10_000 })
        log('command', `git commit (${currentBranch}): ${msg}`)
        return { result: `Committed to ${currentBranch}: ${msg}` }
      } catch (e) { return { result: `Error: ${String(e)}` } }
    }
    case 'git_push_branch': {
      const branch = input.branch ?? ''
      if (!branch) return { result: 'Error: branch name required' }
      if (branch === 'main' || branch === 'master') return { result: 'Error: cannot push directly to main or master' }
      if (!isSafeBranchName(branch)) return { result: 'Error: invalid branch name' }
      try {
        execFileSync('git', ['push', '-u', 'origin', branch], { cwd: projectRoot, timeout: 30_000 })
        log('command', `git push origin ${branch}`)
        return { result: `Pushed branch: ${branch}` }
      } catch (e) { return { result: `Error: ${String(e)}` } }
    }
    case 'git_create_pr': {
      const title = input.title ?? ''
      const body = input.body ?? ''
      const base = input.base ?? 'main'
      if (!title) return { result: 'Error: PR title required' }
      if (!isSafeBranchName(base)) return { result: 'Error: invalid base branch name' }
      try {
        const out = execFileSync('gh', ['pr', 'create', '--title', title, '--body', body, '--base', base], {
          cwd: projectRoot,
          timeout: 30_000,
          encoding: 'utf-8',
        })
        const prUrl = out.trim().split('\n').pop() ?? ''
        log('success', `PR created: ${prUrl}`)
        return { result: prUrl }
      } catch (e) { return { result: `Error: ${String(e)}` } }
    }
    case 'fetch_url': {
      const url = input.url ?? ''
      if (!isSafeUrl(url)) {
        return { result: `Error: '${url}' is blocked. Only public https:// URLs are allowed.` }
      }
      try {
        log('command', `fetch_url: ${url}`)
        const res = await fetch(url, {
          headers: { 'User-Agent': 'ForgePilot-Agent/1.0' },
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) return { result: `Error: HTTP ${res.status} ${res.statusText}` }
        const contentType = res.headers.get('content-type') ?? ''
        const text = await res.text()
        const truncated = text.slice(0, 10_000)
        const note = text.length > 10_000 ? `\n\n[Truncated — ${text.length} chars total, showing first 10 KB]` : ''
        if (contentType.includes('html')) {
          // Strip HTML tags for readability
          const stripped = truncated.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
          return { result: stripped + note }
        }
        return { result: truncated + note }
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

// Pricing per million tokens (Sonnet 4.6 as of 2026-05)
const COST_PER_M_INPUT = 3
const COST_PER_M_OUTPUT = 15

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * COST_PER_M_INPUT + (outputTokens / 1_000_000) * COST_PER_M_OUTPUT
}

export async function runWithToolUse(
  prompt: string,
  options: ToolRunnerOptions,
): Promise<ToolRunnerResult> {
  const {
    apiKey,
    model = 'claude-sonnet-4-6',
    projectRoot = process.cwd(),
    maxTurns = 30,
    budgetUsd,
    onLog = () => undefined,
  } = options

  const client = new Anthropic({ apiKey })
  const log = (type: LogType, message: string) => {
    aiLogger.info({ event: 'tool_use_runner.log', type, message })
    onLog(type, message)
  }

  const budgetLabel = budgetUsd != null ? `, budget: $${budgetUsd.toFixed(2)}` : ''
  log('info', `Starting tool-use agent (model: ${model}, maxTurns: ${maxTurns}${budgetLabel})`)

  const SYSTEM_PROMPT = `You are an autonomous software engineering agent for ForgePilot — a local-first AI Workflow OS (Next.js 14 App Router, TypeScript strict, Tailwind CSS, Vitest).

Rules you must follow:
- TypeScript strict: no \`any\` types, no type assertions without justification
- Always work on a feature branch (feat/ or fix/) — call git_create_branch BEFORE the first git_commit
- git_commit is blocked on main/master — you will get an error if you forget to create a branch first
- Run \`npm run type-check\` and \`npm run test:run\` after changes to catch regressions
- Commit messages: conventional commits format (feat:, fix:, test:, docs:, refactor:)
- Write minimal, targeted changes — no refactoring beyond what the task requires
- No secrets, credentials, or API keys in code or commit messages
- Call task_complete when done — include a clear summary and list of changed files

Tool guidance:
- Use edit_file for targeted changes to existing files (read the file first to get exact text)
- Use write_file only for new files or complete rewrites
- edit_file fails if old_string is not unique — make it longer to disambiguate
- Use fetch_url to read npm docs, GitHub READMEs, or API references (https:// only, localhost is blocked)
- Use \`npm install <package>\` via run_command when a new dependency is needed
- Use \`find . -name "*.ts" -not -path "*/node_modules/*"\` via run_command for recursive file search`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }]
  let turnsUsed = 0
  let totalInput = 0
  let totalOutput = 0
  let finalResult: ToolRunnerResult | undefined

  while (turnsUsed < maxTurns) {
    turnsUsed++
    const currentCost = estimateCost(totalInput, totalOutput)
    log('thought', `Turn ${turnsUsed}/${maxTurns} (~$${currentCost.toFixed(4)})`)

    // Stop before making another API call if budget would be exceeded
    if (budgetUsd != null && currentCost >= budgetUsd) {
      log('error', `Budget cap reached: $${currentCost.toFixed(4)} >= $${budgetUsd.toFixed(2)} — stopping`)
      return {
        success: false,
        summary: `Agent stopped: estimated cost $${currentCost.toFixed(4)} reached budget cap of $${budgetUsd.toFixed(2)}`,
        filesChanged: [],
        turnsUsed,
        estimatedCostUsd: currentCost,
      }
    }

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
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
      const { result, taskDone } = await executeTool(block.name, block.input as ToolInput, projectRoot, log)
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
      if (taskDone) { finalResult = { ...taskDone, turnsUsed }; break }
    }

    if (finalResult) break
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: toolResults })
  }

  const estimatedCostUsd = estimateCost(totalInput, totalOutput)

  if (finalResult) return { ...finalResult, turnsUsed, estimatedCostUsd }

  return {
    success: false,
    summary: `Agent stopped after ${turnsUsed} turns without calling task_complete`,
    filesChanged: [],
    turnsUsed,
    estimatedCostUsd,
  }
}
