/**
 * slash-command-manager.ts — Manages Claude Code slash command skills.
 *
 * Tracks which slash commands exist, records usage, and enables
 * creating new commands from delegation patterns.
 */

import fs from 'fs'
import path from 'path'
import os from 'os'

const GLOBAL_COMMANDS_DIR = path.join(os.homedir(), '.claude', 'commands')
function projectCommandsDir(): string { return path.join(process.cwd(), '.claude', 'commands') }
function usageFile(): string { return path.join(process.cwd(), 'config', 'skill-usage.json') }

export interface SlashCommand {
  id: string
  name: string                // filename without .md
  scope: 'global' | 'project'
  description: string         // first line of the file
  filePath: string
  usageCount: number
  lastUsedAt?: string
  createdAt: string
}

interface UsageStore {
  usages: Array<{ name: string; usedAt: string }>
}

function readUsage(): UsageStore {
  try {
    if (!fs.existsSync(usageFile())) return { usages: [] }
    return JSON.parse(fs.readFileSync(usageFile(), 'utf-8')) as UsageStore
  } catch {
    return { usages: [] }
  }
}

function writeUsage(store: UsageStore): void {
  const tmp = `${usageFile()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2))
  fs.renameSync(tmp, usageFile())
}

/** List all installed slash commands (global + project) */
export function listSlashCommands(): SlashCommand[] {
  const usage = readUsage()
  const commands: SlashCommand[] = []

  const scan = (dir: string, scope: 'global' | 'project') => {
    if (!fs.existsSync(dir)) return
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      const name = file.replace('.md', '')
      const filePath = path.join(dir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      const firstLine = content.split('\n').find(l => l.trim()) ?? ''
      const stat = fs.statSync(filePath)
      const uses = usage.usages.filter(u => u.name === name)
      commands.push({
        id: `${scope}:${name}`,
        name,
        scope,
        description: firstLine.slice(0, 100),
        filePath,
        usageCount: uses.length,
        lastUsedAt: uses.at(-1)?.usedAt,
        createdAt: stat.birthtime.toISOString(),
      })
    }
  }

  scan(GLOBAL_COMMANDS_DIR, 'global')
  scan(projectCommandsDir(), 'project')
  return commands.sort((a, b) => b.usageCount - a.usageCount)
}

/** Record that a slash command was used */
export function recordCommandUsage(name: string): void {
  const store = readUsage()
  store.usages.push({ name, usedAt: new Date().toISOString() })
  // Keep last 1000 usages
  if (store.usages.length > 1000) store.usages = store.usages.slice(-1000)
  writeUsage(store)
}

/** Create a new slash command from content */
export function createSlashCommand(opts: {
  name: string
  content: string
  scope: 'global' | 'project'
}): SlashCommand {
  const dir = opts.scope === 'global' ? GLOBAL_COMMANDS_DIR : projectCommandsDir()
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  // Security: sanitize name to prevent path traversal — only allow alphanum, dash, underscore
  const safeName = opts.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
  if (!safeName) throw new Error('Command name must contain at least one valid character')

  // Resolve and verify the final path stays strictly within the target directory
  const resolvedDir = path.resolve(dir)
  const filePath = path.resolve(resolvedDir, `${safeName}.md`)
  if (!filePath.startsWith(resolvedDir + path.sep)) {
    throw new Error(`Invalid command name: path escapes target directory`)
  }
  fs.writeFileSync(filePath, opts.content)

  const firstLine = opts.content.split('\n').find(l => l.trim()) ?? ''
  return {
    id: `${opts.scope}:${opts.name}`,
    name: opts.name,
    scope: opts.scope,
    description: firstLine.slice(0, 100),
    filePath,
    usageCount: 0,
    createdAt: new Date().toISOString(),
  }
}

/** Update an existing slash command's content */
export function updateSlashCommand(name: string, scope: 'global' | 'project', content: string): boolean {
  const dir = scope === 'global' ? GLOBAL_COMMANDS_DIR : projectCommandsDir()
  const filePath = path.join(dir, `${name}.md`)
  if (!fs.existsSync(filePath)) return false
  fs.writeFileSync(filePath, content)
  return true
}

/** Read the content of a slash command */
export function readSlashCommand(name: string, scope: 'global' | 'project'): string | null {
  const dir = scope === 'global' ? GLOBAL_COMMANDS_DIR : projectCommandsDir()
  const filePath = path.join(dir, `${name}.md`)
  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath, 'utf-8')
}

/** Export a skill as a shareable object (name + content + metadata) */
export function exportSlashCommand(name: string, scope: 'global' | 'project'): {
  name: string
  content: string
  exportedAt: string
  source: string
} | null {
  const content = readSlashCommand(name, scope)
  if (!content) return null
  return {
    name,
    content,
    exportedAt: new Date().toISOString(),
    source: 'forgepilot',
  }
}
