import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

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

function getFileTree(dirPath: string, depth = 2, prefix = ''): string {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== '.next' && e.name !== 'dist' && e.name !== '.git')
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })
      .slice(0, 40)

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

function detectTestCommand(scripts: Record<string, string>): string {
  if (scripts['test:run']) return 'npm run test:run'
  if (scripts['test']) return 'npm test'
  if (scripts['vitest']) return 'npx vitest run'
  if (fs.existsSync('pytest.ini') || fs.existsSync('pyproject.toml')) return 'python -m pytest'
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

export function buildCodebaseContext(repoPath: string): CodebaseContext {
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
  const testCommand = detectTestCommand(scripts)
  const lintCommand = scripts['lint'] ? 'npm run lint' : ''
  const typeCheckCommand = scripts['type-check'] ? 'npm run type-check' : hasTypeScript ? 'npx tsc --noEmit' : ''
  const buildCommand = scripts['build'] ? 'npm run build' : ''

  const fileTree = getFileTree(repoPath, 2)

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

  return `You are an autonomous software engineering agent working on **${ctx.projectName}**.

## Project
- **Name:** ${ctx.projectName}${ctx.description ? `\n- **Description:** ${ctx.description}` : ''}
- **Stack:** ${ctx.stack}
- **Working directory:** This is your root — all file paths are relative to it.
${agentInstructionsBlock}
## File Structure
\`\`\`
${ctx.fileTree.slice(0, 2000)}
\`\`\`

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
5. Verify:
${verifyBlock}
6. Commit: git commit -m "${commitPrefix}: <description>"
7. PR: gh pr create --title "${commitPrefix}: ${goal.substring(0, 60).replace(/"/g, "'")}" --body "## Summary\\n- <bullets>\\n\\n## Test plan\\n- [ ] tests pass"
8. Final output: print DONE: <one-sentence summary>
\`\`\`

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
