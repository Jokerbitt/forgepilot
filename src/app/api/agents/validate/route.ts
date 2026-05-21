export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'
import { parseBody, isValidationError } from '@/lib/validation/api'
import { AgentValidateSchema } from '@/lib/validation/schemas'

const ROOT = path.join(process.cwd())
const NODE_PATH = '/opt/homebrew/Cellar/node@22/22.22.3/bin'

function run(cmd: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd: ROOT,
      env: { ...process.env, PATH: `${NODE_PATH}:${process.env.PATH}` },
      timeout: 120_000,
      encoding: 'utf-8',
    })
    return { ok: true, output: output.trim() }
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string }
    return { ok: false, output: (err.stdout ?? '') + '\n' + (err.stderr ?? err.message ?? '') }
  }
}

export type ValidationStep = 'type-check' | 'tests' | 'lint'

export interface ValidationResult {
  step: ValidationStep
  ok: boolean
  output: string
  durationMs: number
}

export interface AgentValidationReport {
  agentId?: string
  milestone?: string
  passed: boolean
  steps: ValidationResult[]
  summary: string
  runAt: string
}

export async function POST(req: NextRequest) {
  const body = await parseBody(req, AgentValidateSchema)
  if (isValidationError(body)) return body

  const { agentId, milestone, testPattern } = body

  const steps: ValidationResult[] = []

  // 1. TypeScript
  const tsStart = Date.now()
  const tsResult = run('npm run type-check')
  steps.push({ step: 'type-check', ok: tsResult.ok, output: tsResult.output, durationMs: Date.now() - tsStart })

  // 2. Tests
  const testStart = Date.now()
  const testCmd = testPattern ? `npm run test:run -- ${testPattern}` : 'npm run test:run'
  const testResult = run(testCmd)
  steps.push({ step: 'tests', ok: testResult.ok, output: testResult.output, durationMs: Date.now() - testStart })

  // 3. Lint (warnings ok, errors not)
  const lintStart = Date.now()
  const lintResult = run('npm run lint 2>&1 | grep -c "error" || true')
  const lintErrorCount = parseInt(lintResult.output.trim() || '0', 10)
  steps.push({
    step: 'lint',
    ok: lintErrorCount === 0,
    output: lintErrorCount === 0 ? '0 lint errors' : `${lintErrorCount} lint error(s)`,
    durationMs: Date.now() - lintStart,
  })

  const passed = steps.every(s => s.ok)

  const report: AgentValidationReport = {
    agentId,
    milestone,
    passed,
    steps,
    summary: passed
      ? `✅ All checks passed — ${milestone ?? 'work'} is PR-ready`
      : `❌ ${steps.filter(s => !s.ok).map(s => s.step).join(', ')} failed`,
    runAt: new Date().toISOString(),
  }

  return NextResponse.json(report, { status: passed ? 200 : 422 })
}
