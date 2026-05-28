import fs from 'fs'
import path from 'path'
import { execFileSync, spawnSync } from 'child_process'

export interface CodebaseContext {
  projectName: string
  description: string
  stack: string
  fileTree: string
  agentInstructions: string
  scripts: Record<string, string>
  hasTypeScript: boolean
  hasTests: boolean
  testCommand: string
  lintCommand: string
  typeCheckCommand: string
  buildCommand: string
  /** M108: Relevant file snippets based on goal keywords */
  relevantFiles?: Array<{ path: string; snippet: string }>
  /** M108: Key config file snippets (tsconfig paths, env vars) */
  keyConfigs?: Array<{ name: string; snippet: string }>
}

function readFileSafe(filePath: string, maxLines = 150): string {
  try {
    if (!fs.existsSync(filePath)) return ''
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    return lines.slice(0, maxLines).join('\n')
  } catch {
    return ''
  }
}

function readFileChars(filePath: string, maxChars = 400): string {
  try {
    if (!fs.existsSync(filePath)) return ''
    const content = fs.readFileSync(filePath, 'utf8')
    return content.slice(0, maxChars)
  } catch {
    return ''
  }
}

/** M108: Increased depth to 3, entries to 60 per level */
function getFileTree(dirPath: string, depth = 3, prefix = ''): string {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.next' && e.name !== 'dist' && e.name !== '.git' && e.name !== 'coverage' && e.name !== '__pycache__')
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })
      .slice(0, 60) // M108: increased from 40 to 60

    return entries.map(entry => {
      const entryPath = path.join(dirPath, entry.name)
      const line = `${prefix}${entry.isDirectory() ? '📁' : '📄'} ${entry.name}`
      if (entry.isDirectory() && depth > 1) {
        const children = getFileTree(entryPath, depth - 1, prefix + '  ')
        return children ? `${line}\n${children}` : line
      }
      return line
    }).join('\n')
  } catch {
    return ''
  }
}

/** M108: Find relevant files based on goal keywords using grep */
export function findRelevantFiles(
  goal: string,
  repoPath: string,
  maxFiles = 8,
): Array<{ path: string; snippet: string }> {
  // Extract meaningful keywords (skip short/common words)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'to', 'in', 'of', 'is', 'it', 'be', 'with', 'add', 'new', 'create', 'make', 'update', 'change', 'fix'])
  const keywords = goal
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w))
    .slice(0, 5)

  if (keywords.length === 0) return []

  // Determine search directories
  const searchDirs = ['src', 'lib', 'app', 'components', 'pages', 'api'].filter(
    d => fs.existsSync(path.join(repoPath, d))
  )
  if (searchDirs.length === 0 && fs.existsSync(path.join(repoPath, 'src'))) {
    searchDirs.push('src')
  }

  const found = new Map<string, number>() // filepath → match count

  for (const keyword of keywords) {
    try {
      const result = spawnSync(
        'grep',
        ['-rl', '--include=*.ts', '--include=*.tsx', '--include=*.js', '--include=*.py',
         '--include=*.go', '--include=*.rs', '-i', keyword, ...searchDirs],
        { cwd: repoPath, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }
      )
      if (result.status === 0 && result.stdout) {
        for (const line of result.stdout.trim().split('\n')) {
          const file = line.trim()
          if (file) found.set(file, (found.get(file) ?? 0) + 1)
        }
      }
    } catch { /* grep not available or timeout */ }
  }

  // Sort by match count (most relevant first), skip test files
  const sorted = [...found.entries()]
    .filter(([f]) => !f.includes('.test.') && !f.includes('.spec.') && !f.includes('__tests__'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxFiles)
    .map(([filePath]) => filePath)

  return sorted.map(relPath => ({
    path: relPath,
    snippet: readFileChars(path.join(repoPath, relPath), 400),
  })).filter(f => f.snippet.length > 0)
}

/** M108: Read key config files that agents always need */
function readKeyConfigs(repoPath: string): Array<{ name: string; snippet: string }> {
  const configs: Array<{ name: string; snippet: string }> = []

  // TypeScript path aliases from tsconfig
  const tsconfig = readFileChars(path.join(repoPath, 'tsconfig.json'), 600)
  if (tsconfig) configs.push({ name: 'tsconfig.json (path aliases)', snippet: tsconfig })

  // .env.example — available env vars
  const envExample = readFileChars(path.join(repoPath, '.env.example'), 500)
  if (envExample) configs.push({ name: '.env.example', snippet: envExample })

  // Test config
  const vitestConfig = readFileChars(path.join(repoPath, 'vitest.config.ts'), 400) ||
                       readFileChars(path.join(repoPath, 'vitest.config.js'), 400)
  if (vitestConfig) configs.push({ name: 'vitest.config.ts', snippet: vitestConfig })

  const jestConfig = readFileChars(path.join(repoPath, 'jest.config.ts'), 400) ||
                     readFileChars(path.join(repoPath, 'jest.config.js'), 400)
  if (jestConfig && !vitestConfig) configs.push({ name: 'jest.config', snippet: jestConfig })

  return configs
}

/** Exported so execute route can detect the test command for post-execution verification */
export function detectTestCommand(scripts: Record<string, string>, repoPath?: string): string {
  if (scripts['test:run']) return 'npm run test:run'
  if (scripts['test']) return 'npm test'
  if (scripts['vitest']) return 'npx vitest run'
  if (repoPath) {
    if (fs.existsSync(path.join(repoPath, 'pytest.ini')) || fs.existsSync(path.join(repoPath, 'pyproject.toml'))) return 'python -m pytest'
    if (fs.existsSync(path.join(repoPath, 'go.mod'))) return 'go test ./...'
    if (fs.existsSync(path.join(repoPath, 'Cargo.toml'))) return 'cargo test'
  }
  return 'npm test'
}

function detectStack(pkgJson: Record<string, unknown>, repoPath: string): string {
  const deps = {
    ...(pkgJson.dependencies as Record<string, string> ?? {}),
    ...(pkgJson.devDependencies as Record<string, string> ?? {}),
  }

  const parts: string[] = []

  if (deps['next']) parts.push(`Next.js ${deps['next'].replace(/[\^~]/, '')}`)
  if (deps['react']) parts.push(`React ${deps['react'].replace(/[\^~]/, '')}`)
  if (deps['vue']) parts.push(`Vue ${deps['vue'].replace(/[\^~]/, '')}`)
  if (deps['svelte']) parts.push('Svelte')
  if (deps['express']) parts.push('Express')
  if (deps['fastify']) parts.push('Fastify')
  if (deps['typescript'] || fs.existsSync(path.join(repoPath, 'tsconfig.json'))) parts.push('TypeScript')
  if (deps['tailwindcss']) parts.push('Tailwind CSS')
  if (deps['prisma']) parts.push('Prisma')
  if (deps['drizzle-orm']) parts.push('Drizzle ORM')
  if (deps['vitest']) parts.push('Vitest')
  if (deps['jest']) parts.push('Jest')
  if (deps['zod']) parts.push('Zod')

  if (fs.existsSync(path.join(repoPath, 'requirements.txt')) || fs.existsSync(path.join(repoPath, 'pyproject.toml'))) {
    parts.push('Python')
  }
  if (fs.existsSync(path.join(repoPath, 'go.mod'))) parts.push('Go')
  if (fs.existsSync(path.join(repoPath, 'Cargo.toml'))) parts.push('Rust')

  return parts.join(', ') || 'Unknown stack'
}

export function buildCodebaseContext(repoPath: string, goal?: string): CodebaseContext {
  // Read package.json
  let pkgJson: Record<string, unknown> = {}
  try {
    const raw = fs.readFileSync(path.join(repoPath, 'package.json'), 'utf8')
    pkgJson = JSON.parse(raw) as Record<string, unknown>
  } catch { /* not a Node project */ }

  const scripts = (pkgJson.scripts as Record<string, string>) ?? {}
  const projectName = (pkgJson.name as string) ?? path.basename(repoPath)
  const description = (pkgJson.description as string) ?? ''

  // Read agent instructions — priority order
  const agentInstructions =
    readFileSafe(path.join(repoPath, 'CLAUDE.md'), 200) ||
    readFileSafe(path.join(repoPath, 'AGENTS.md'), 200) ||
    readFileSafe(path.join(repoPath, '.cursorrules'), 100) ||
    readFileSafe(path.join(repoPath, 'README.md'), 100)

  const stack = detectStack(pkgJson, repoPath)
  const hasTypeScript = fs.existsSync(path.join(repoPath, 'tsconfig.json'))
  const hasTests = !!(scripts['test'] || scripts['test:run'] || scripts['vitest'])
  const testCommand = detectTestCommand(scripts, repoPath)
  const lintCommand = scripts['lint'] ? 'npm run lint' : ''
  const typeCheckCommand = scripts['type-check'] ? 'npm run type-check' : hasTypeScript ? 'npx tsc --noEmit' : ''
  const buildCommand = scripts['build'] ? 'npm run build' : ''

  const fileTree = getFileTree(repoPath, 3) // M108: depth 3

  // M108: Relevant files + key configs (only when goal is provided)
  const relevantFiles = goal ? findRelevantFiles(goal, repoPath) : undefined
  const keyConfigs = readKeyConfigs(repoPath)

  return {
    projectName,
    description,
    stack,
    fileTree,
    agentInstructions,
    scripts,
    hasTypeScript,
    hasTests,
    testCommand,
    lintCommand,
    typeCheckCommand,
    buildCommand,
    relevantFiles,
    keyConfigs: keyConfigs.length > 0 ? keyConfigs : undefined,
  }
}

export function buildDynamicSystemPrompt(ctx: CodebaseContext, goal: string, options: {
  riskClass: string
  branch: string
  maxTurns: number
  checkpointTurn: number
  dod: string
  context: string
  workItemId: string
  taskType?: string
  skillBlock?: string
  retryContext?: string
}): string {
  const { riskClass, branch, maxTurns, checkpointTurn, dod, context, workItemId, taskType, skillBlock, retryContext } = options
  const commitPrefix = taskType || 'feat'

  const verifySteps: string[] = []
  if (options.context || ctx.testCommand) {
    if (ctx.testCommand) verifySteps.push(ctx.testCommand)
    if (ctx.lintCommand) verifySteps.push(ctx.lintCommand)
    if (ctx.typeCheckCommand) verifySteps.push(`${ctx.typeCheckCommand} (run BEFORE build, never in parallel)`)
    if (ctx.buildCommand) verifySteps.push(ctx.buildCommand)
  }
  const verifyBlock = verifySteps.length > 0
    ? verifySteps.map(s => `   - ${s}`).join('\n')
    : '   - Run appropriate tests/checks for this project'

  const agentInstructionsBlock = ctx.agentInstructions
    ? `\n## Project Instructions\n${ctx.agentInstructions.slice(0, 3000)}\n`
    : ''

  // M108: Relevant files block
  const relevantFilesBlock = ctx.relevantFiles && ctx.relevantFiles.length > 0
    ? `\n## Relevant Files (read these before writing code)\n${
        ctx.relevantFiles.map(f =>
          `### ${f.path}\n\`\`\`\n${f.snippet.slice(0, 400)}\n\`\`\``
        ).join('\n\n')
      }\n`
    : ''

  // M108: Key config block
  const keyConfigBlock = ctx.keyConfigs && ctx.keyConfigs.length > 0
    ? `\n## Key Config Files\n${
        ctx.keyConfigs.map(c =>
          `### ${c.name}\n\`\`\`\n${c.snippet.slice(0, 400)}\n\`\`\``
        ).join('\n\n')
      }\n`
    : ''

  return `You are an autonomous software engineering agent working on **${ctx.projectName}**.

## Project
- **Name:** ${ctx.projectName}${ctx.description ? `\n- **Description:** ${ctx.description}` : ''}
- **Stack:** ${ctx.stack}
- **Working directory:** This is your root — all file paths are relative to it.
${agentInstructionsBlock}
## File Structure
\`\`\`
${ctx.fileTree.slice(0, 3000)}
\`\`\`
${relevantFilesBlock}${keyConfigBlock}
## Task
${goal}
${context ? `\n## Context\n${context}\n` : ''}
## Definition of Done (verify each before creating PR)
${dod}

## Constraints
- Risk class: **${riskClass}** (A = safe/additive, B = modifies existing, C = needs human review)
- Branch: \`${branch}\`
- Max budget: ~${maxTurns} turns
- Work item: ${workItemId}

## Execution Protocol (follow in order)
\`\`\`
1. Read CLAUDE.md / AGENTS.md if present → understand conventions
2. git checkout -b ${branch}
3. Explore: read relevant source files before writing any code
4. Implement: small, focused changes — one concern per commit
5. After each major phase, print: CHECKPOINT: <phase-name>
6. Verify:
${verifyBlock}
7. Commit: git commit -m "${commitPrefix}: <description>"
8. PR: gh pr create --title "${commitPrefix}: ${goal.substring(0, 60).replace(/"/g, "'")}" --body "## Summary\\n- <bullets>\\n\\n## Test plan\\n- [ ] tests pass"
9. Final output: print DONE: <one-sentence summary>
\`\`\`

## Checkpoint Protocol
After completing each major phase (data model, API routes, UI, tests):
1. Run: ${ctx.testCommand || 'npm test'}
2. Print: \`CHECKPOINT: <phase-name> PASSED\` (if tests pass) or \`CHECKPOINT: <phase-name> FAILED\` (if tests fail)
If FAILED: fix the failures before proceeding to the next phase.

## Escalation Protocol
If you are blocked or uncertain, print exactly:
\`ESCALATION: <reason> | OPTIONS: <option A> | <option B> | RECOMMEND: <A or B>\`
Then stop and wait. A human will respond with "RESUME: <choice>".

## Anti-Drift Rules (read before each major action)
- Only modify files directly needed for this task
- Implement exactly what the DoD requires — nothing more
- Turn checkpoint: at turn ${checkpointTurn}, re-read "## Task" and "## Definition of Done"
- Print "PROGRESS: <done> | <next> | <turns used>/${maxTurns}" every 10 turns
- Abort conditions — print "ESCALATION: <reason>" if:
  - 60% of turns used without a commit
  - Same step fails 3 times
  - Task requires touching Risk-C files at risk class A/B
  - Two+ valid approaches exist and you cannot decide
${retryContext ? `\n## Retry Context\n${retryContext}\n` : ''}${skillBlock ? `\n${skillBlock}` : ''}
Start now.`
}

export function getRepoDisplayName(repoPath: string): string {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: repoPath, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
    // Extract "owner/repo" from git URL
    const match = remote.match(/[:/]([^/]+\/[^/]+?)(?:\.git)?$/)
    if (match) return match[1]
  } catch { /* no remote */ }
  return path.basename(repoPath)
}
