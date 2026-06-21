'use client'

/**
 * /test-runner — M4 Execute Loop Validation
 *
 * 5 real delegation tasks to prove the execute loop works reliably.
 * Each task runs via local-agent (Claude Code CLI) against this repo.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Clock,
  ExternalLink,
  BarChart3,
  AlertCircle,
} from 'lucide-react'
import { cx } from '@/components/ui/primitives'
import { RunnerReadinessBanner } from '@/components/shared/RunnerReadinessBanner'

// ─── Test task definitions ────────────────────────────────────────────────────

const TEST_TASKS = [
  {
    id: 'test-1',
    label: 'Task 1 — Add API Route',
    description: 'Einfache REST-Route hinzufügen mit Vitest Tests.',
    goal: 'Create a new Next.js 14 App Router API route at /api/test-ping that returns { ok: true, ts: string } on GET. Add at least 2 Vitest tests (happy path, wrong method returns 405).',
    context: 'Stack: Next.js 14 App Router, TypeScript strict, Vitest. Route file at src/app/api/test-ping/route.ts.',
    dodItems: [
      'GET /api/test-ping returns { ok: true, ts: string } with status 200',
      'Non-GET methods return 405',
      'At least 2 passing Vitest tests',
      'npm run type-check passes with 0 errors',
      'npm run test:run passes',
    ],
    maxBudgetUsd: 1.5,
    riskClass: 'A' as const,
    expectedOutcome: 'Neue Datei src/app/api/test-ping/route.ts + Tests',
  },
  {
    id: 'test-2',
    label: 'Task 2 — Fix Bug (detectKnownError)',
    description: 'Bekannten Fehler reparieren und Regressionstest hinzufügen.',
    goal: 'The function detectKnownError in src/lib/runner-health/error-classifier.ts should also recognize "Max turns reached" (capital M). Add a test case for it and fix the pattern if needed.',
    context: 'File: src/lib/runner-health/error-classifier.ts and its test file.',
    dodItems: [
      'detectKnownError("Max turns reached") returns a non-undefined string',
      'New test case added to src/lib/runner-health/error-classifier.test.ts',
      'All existing tests still pass',
      'npm run type-check passes',
    ],
    maxBudgetUsd: 1,
    riskClass: 'A' as const,
    expectedOutcome: 'Verbesserter Pattern + 1 neuer Test',
  },
  {
    id: 'test-3',
    label: 'Task 3 — Add Tests for budget-utils',
    description: 'Test-Coverage für bestehende Funktion verbessern.',
    goal: 'Add edge case tests to src/lib/budget-utils.test.ts for the budgetToClaudeCliMaxTurns function: test with $0, $0.5, $10, very large values. Also verify it never returns less than 40.',
    context: 'File: src/lib/budget-utils.ts and src/lib/budget-utils.test.ts.',
    dodItems: [
      'At least 5 new test cases added',
      'budgetToClaudeCliMaxTurns(0) test added',
      'budgetToClaudeCliMaxTurns returns >= 40 always',
      'All tests pass: npm run test:run',
    ],
    maxBudgetUsd: 0.75,
    riskClass: 'A' as const,
    expectedOutcome: '5+ neue Tests in budget-utils.test.ts',
  },
  {
    id: 'test-4',
    label: 'Task 4 — Add UI Component (StatusBadge)',
    description: 'Kleine UI-Komponente mit Tailwind und TypeScript.',
    goal: 'Create a reusable StatusBadge component at src/components/ui/StatusBadge.tsx. It should accept status: "ok" | "warn" | "error" | "info" and size: "sm" | "md" props. Renders a colored pill. Export it from the file. No test required.',
    context: 'Stack: React, TypeScript strict, Tailwind CSS. No "use client" needed — pure presentational.',
    dodItems: [
      'src/components/ui/StatusBadge.tsx created with proper TypeScript types',
      'Accepts status and optional size props',
      'Uses Tailwind color classes: emerald for ok, amber for warn, red for error, blue for info',
      'npm run type-check passes with 0 errors',
    ],
    maxBudgetUsd: 0.75,
    riskClass: 'A' as const,
    expectedOutcome: 'Neue Datei src/components/ui/StatusBadge.tsx',
  },
  {
    id: 'test-5',
    label: 'Task 5 — Refactor + Docs',
    description: 'Code-Kommentar verbessern und kleine Vereinfachung.',
    goal: 'Add JSDoc comments to all exported functions in src/lib/runner-health/runner-detector.ts. Comments should be in English, concise (1-2 lines each). Also add a module-level JSDoc at the top explaining the purpose.',
    context: 'File: src/lib/runner-health/runner-detector.ts',
    dodItems: [
      'Module-level JSDoc added at the top',
      'All exported functions have JSDoc comments',
      'npm run type-check passes',
      'No functionality changed — only comments added',
    ],
    maxBudgetUsd: 0.5,
    riskClass: 'A' as const,
    expectedOutcome: 'Verbesserte Dokumentation in runner-detector.ts',
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

type TaskStatus = 'idle' | 'creating' | 'running' | 'completed' | 'failed' | 'error'

interface TaskRun {
  taskId: string
  delegationId?: string
  status: TaskStatus
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  prUrl?: string
  qualityVerdict?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusIcon(s: TaskStatus) {
  if (s === 'completed') return <CheckCircle2 className="h-5 w-5 text-emerald-400" />
  if (s === 'failed') return <XCircle className="h-5 w-5 text-red-400" />
  if (s === 'running' || s === 'creating') return <Loader2 className="h-5 w-5 text-violet-400 animate-spin" />
  if (s === 'error') return <AlertCircle className="h-5 w-5 text-amber-400" />
  return <Clock className="h-5 w-5 text-slate-500" />
}

function statusLabel(s: TaskStatus) {
  if (s === 'completed') return 'Abgeschlossen ✅'
  if (s === 'failed') return 'Fehlgeschlagen ❌'
  if (s === 'running') return 'Läuft…'
  if (s === 'creating') return 'Erstelle Delegation…'
  if (s === 'error') return 'Fehler beim Erstellen'
  return 'Bereit'
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TestRunnerPage() {
  const router = useRouter()
  const [runs, setRuns] = useState<Record<string, TaskRun>>({})
  const [runningAll, setRunningAll] = useState(false)

  // Poll running delegations every 5s
  useEffect(() => {
    const poll = async () => {
      const running = Object.values(runs).filter(r => r.status === 'running' && r.delegationId)
      if (running.length === 0) return

      await Promise.all(running.map(async r => {
        try {
          const res = await fetch(`/api/delegations/${r.delegationId}`)
          if (!res.ok) return
          const d = await res.json() as {
            status: string
            errorMessage?: string
            summaryReport?: { prUrl?: string }
            qualityCheck?: { verdict?: string }
          }
          if (d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled') {
            setRuns(prev => ({
              ...prev,
              [r.taskId]: {
                ...prev[r.taskId],
                status: d.status === 'completed' ? 'completed' : 'failed',
                completedAt: new Date().toISOString(),
                errorMessage: d.errorMessage,
                prUrl: d.summaryReport?.prUrl,
                qualityVerdict: d.qualityCheck?.verdict,
              },
            }))
          }
        } catch { /* ignore */ }
      }))
    }

    const id = setInterval(() => void poll(), 5000)
    return () => clearInterval(id)
  }, [runs])

  const createAndStart = async (task: typeof TEST_TASKS[0]): Promise<void> => {
    setRuns(prev => ({ ...prev, [task.id]: { taskId: task.id, status: 'creating', startedAt: new Date().toISOString() } }))

    try {
      // 1. Create delegation
      const createRes = await fetch('/api/delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.label,
          status: 'approved',
          executionRoute: 'local-agent',
          costEstimateUsd: task.maxBudgetUsd * 0.5,
          logs: [],
          tags: ['test-run', 'M4-validation'],
          contract: {
            id: `test-${task.id}-${Date.now()}`,
            workItemId: task.id,
            goal: task.goal,
            context: task.context,
            riskClass: task.riskClass,
            maxBudgetUsd: task.maxBudgetUsd,
            allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
            branchStrategy: 'feature',
            requiresApproval: false,
            privacyMode: 'local',
            definitionOfDone: task.dodItems,
            taskType: 'feature',
          },
        }),
      })

      if (!createRes.ok) throw new Error(`Create failed: ${createRes.status}`)
      const created = await createRes.json() as { id: string }
      const delegationId = created.id

      setRuns(prev => ({ ...prev, [task.id]: { ...prev[task.id], delegationId, status: 'running' } }))

      // 2. Start execution
      const execRes = await fetch(`/api/delegations/${delegationId}/execute`, { method: 'POST' })
      if (!execRes.ok) {
        const err = await execRes.json() as { error?: string }
        throw new Error(err.error ?? `Execute failed: ${execRes.status}`)
      }

    } catch (err) {
      setRuns(prev => ({
        ...prev,
        [task.id]: {
          ...prev[task.id],
          status: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      }))
    }
  }

  const runAll = async () => {
    setRunningAll(true)
    for (const task of TEST_TASKS) {
      await createAndStart(task)
      // Stagger by 3s to avoid overwhelming the system
      await new Promise(r => setTimeout(r, 3000))
    }
    setRunningAll(false)
  }

  const completedCount = Object.values(runs).filter(r => r.status === 'completed').length
  const failedCount = Object.values(runs).filter(r => r.status === 'failed' || r.status === 'error').length
  const runningCount = Object.values(runs).filter(r => r.status === 'running' || r.status === 'creating').length

  return (
    <main className="min-h-screen bg-[#08080d] px-5 py-6 text-slate-100 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-slate-600 mb-4">
            <Link href="/" className="hover:text-slate-400 transition-colors">Command Center</Link>
            <span>›</span>
            <span className="text-slate-400">Execute Loop Validation</span>
          </nav>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">M4 Execute Loop — 5 echte Tasks</h1>
              <p className="text-sm text-slate-400">Beweist dass ForgePilot zuverlässig Code schreibt, testet und committed</p>
            </div>
          </div>
        </div>

        {/* Runner readiness */}
        <RunnerReadinessBanner detailed={false} />

        {/* Progress summary */}
        {Object.keys(runs).length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Abgeschlossen', value: completedCount, color: 'text-emerald-400' },
              { label: 'Fehlgeschlagen', value: failedCount, color: 'text-red-400' },
              { label: 'Laufen', value: runningCount, color: 'text-violet-400' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-center">
                <p className={cx('text-2xl font-bold', s.color)}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Run all button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => void runAll()}
            disabled={runningAll || runningCount > 0}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
          >
            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Alle 5 Tasks starten
          </button>
          <p className="text-xs text-slate-500">oder Tasks einzeln starten</p>
        </div>

        {/* Task cards */}
        <div className="space-y-3">
          {TEST_TASKS.map((task, idx) => {
            const run = runs[task.id]
            const status = run?.status ?? 'idle'

            return (
              <div
                key={task.id}
                className={cx(
                  'rounded-xl border p-4 transition-colors',
                  status === 'completed' ? 'border-emerald-700/40 bg-emerald-950/10' :
                  status === 'failed' || status === 'error' ? 'border-red-700/40 bg-red-950/10' :
                  status === 'running' || status === 'creating' ? 'border-violet-700/40 bg-violet-950/10' :
                  'border-white/[0.07] bg-white/[0.025]',
                )}
              >
                <div className="flex items-start gap-3">
                  {statusIcon(status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{task.label}</p>
                      <span className="text-xs text-slate-500 shrink-0">${task.maxBudgetUsd} · Risk {task.riskClass}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>

                    {/* Status */}
                    <p className="text-xs mt-1.5 font-medium">
                      {status === 'idle' ? (
                        <span className="text-slate-600">Bereit zum Starten</span>
                      ) : (
                        <span className={cx(
                          status === 'completed' ? 'text-emerald-400' :
                          status === 'failed' || status === 'error' ? 'text-red-400' :
                          'text-violet-300',
                        )}>{statusLabel(status)}</span>
                      )}
                    </p>

                    {/* Error message */}
                    {run?.errorMessage && (
                      <p className="text-xs text-red-300 mt-1 leading-4">{run.errorMessage}</p>
                    )}

                    {/* Links and result */}
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      {run?.delegationId && (
                        <Link
                          href={`/delegations/${run.delegationId}`}
                          className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Delegation ansehen
                        </Link>
                      )}
                      {run?.prUrl && (
                        <a
                          href={run.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          PR öffnen
                        </a>
                      )}
                      {run?.qualityVerdict && (
                        <span className={cx(
                          'text-xs font-medium px-2 py-0.5 rounded border',
                          run.qualityVerdict === 'passed' ? 'text-emerald-300 border-emerald-700/30 bg-emerald-950/20' :
                          'text-amber-300 border-amber-700/30 bg-amber-950/20',
                        )}>
                          QC: {run.qualityVerdict}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Individual start button */}
                  {status === 'idle' && (
                    <button
                      onClick={() => void createAndStart(task)}
                      className="shrink-0 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-violet-500/40 hover:text-violet-300"
                    >
                      <Play className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* DoD items */}
                <details className="mt-3">
                  <summary className="text-[10px] text-slate-600 cursor-pointer hover:text-slate-400">
                    Definition of Done ({task.dodItems.length} Kriterien)
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {task.dodItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                        <span className="text-slate-700 shrink-0 mt-0.5">{idx * 10 + i + 1}.</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </details>

                {/* Expected outcome */}
                <p className="mt-2 text-[10px] text-slate-600">
                  <span className="text-slate-500">Erwartet:</span> {task.expectedOutcome}
                </p>
              </div>
            )
          })}
        </div>

        {/* Results summary when all done */}
        {completedCount + failedCount === TEST_TASKS.length && Object.keys(runs).length === TEST_TASKS.length && (
          <div className={cx(
            'rounded-xl border p-5 text-center',
            completedCount === TEST_TASKS.length
              ? 'border-emerald-700/40 bg-emerald-950/10'
              : 'border-amber-700/40 bg-amber-950/10',
          )}>
            <p className="text-2xl mb-2">
              {completedCount === TEST_TASKS.length ? '🎉' : '⚠️'}
            </p>
            <p className="text-lg font-bold text-white">
              {completedCount}/{TEST_TASKS.length} Tasks erfolgreich
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {completedCount === TEST_TASKS.length
                ? 'Execute Loop validiert — ForgePilot ist produktionsbereit!'
                : `${failedCount} Tasks fehlgeschlagen — Fehler analysieren und Classifier erweitern.`}
            </p>
            <Link
              href="/delegations?status=completed"
              className="mt-3 inline-block text-sm text-violet-400 hover:underline"
            >
              Alle Ergebnisse ansehen →
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
