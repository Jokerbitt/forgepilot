#!/usr/bin/env npx tsx
/**
 * test-flow.ts — Local end-to-end flow test for ForgePilot.
 *
 * Tests the complete flow without a running dev server:
 *   Idee → Brief → KI-Struktur → Delegation → Delegation completed → Knowledge Card
 *
 * Usage:
 *   npm run test:flow                          → auto mode (best available LLM)
 *   npm run test:flow -- --provider=ollama     → force Ollama
 *   npm run test:flow -- --provider=anthropic  → force Anthropic
 *   npm run test:flow -- --verbose             → detailed output
 *   npm run test:flow -- --dry-run             → connectivity check only, no writes
 *   npm run test:flow -- --no-cleanup          → skip deletion of created test data
 */

// Register path aliases before any @/ imports
import { register } from 'tsconfig-paths'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const tsconfigPath = resolve(process.cwd(), 'tsconfig.json')
const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8')) as {
  compilerOptions: { paths: Record<string, string[]>; baseUrl?: string }
}
register({
  baseUrl: resolve(process.cwd(), tsconfig.compilerOptions.baseUrl ?? '.'),
  paths: tsconfig.compilerOptions.paths,
})

// ─── CLI argument parsing ─────────────────────────────────────────────────────

const { values: cliArgs } = parseArgs({
  options: {
    provider: { type: 'string', default: undefined },
    verbose:  { type: 'boolean', default: false },
    'dry-run':   { type: 'boolean', default: false },
    'no-cleanup': { type: 'boolean', default: false },
  },
  strict: false,
})

const PROVIDER   = cliArgs['provider'] as string | undefined
const VERBOSE    = cliArgs['verbose'] as boolean
const DRY_RUN    = cliArgs['dry-run'] as boolean
const NO_CLEANUP = cliArgs['no-cleanup'] as boolean

// Apply --provider as LLM_MODE before any imports that read it
if (PROVIDER) {
  process.env['LLM_MODE'] = PROVIDER
}

// ─── Now import lib modules (they read LLM_MODE at call time, not import time) ─

import { getProviderAvailability, resolveProvider } from '@/lib/ai/auto-router'
import { generateText }                              from '@/lib/ai/text-generation'
import { buildProjectBrief }                         from '@/lib/project-briefs'
import { createProjectBriefRepository }              from '@/lib/repositories/projectBriefRepository'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { createKnowledgeCardRepository }             from '@/lib/repositories/knowledgeCardRepository'
import { writebackDelegationKnowledge }              from '@/lib/knowledge/writeback'
import type { ProjectBrief }                         from '@/lib/models/project-brief'
import type { Delegation }                           from '@/lib/models/delegation'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'pass' | 'fail' | 'skip'

interface StepResult {
  name: string
  status: StepStatus
  detail?: string
  durationMs?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stdout.write(`${msg}\n`)
}

function verbose(msg: string): void {
  if (VERBOSE) process.stdout.write(`  ${msg}\n`)
}

function timer(): () => number {
  const t0 = Date.now()
  return () => Date.now() - t0
}

// ─── Test data ────────────────────────────────────────────────────────────────

const TEST_IDEA_INPUT = {
  title: '[E2E-Test] ForgePilot Flow Verifikation',
  rawIdea: 'Ein lokaler End-to-End-Test, der den vollständigen ForgePilot-Flow verifiziert: Brief → KI → Delegation → Knowledge-Card. Dieser Brief wird nach dem Test automatisch gelöscht.',
  problemStatement: 'Ohne automatisierten Volltest ist unklar, ob alle Komponenten korrekt zusammenarbeiten.',
  targetAudience: 'ForgePilot-Entwickler und CI-Systeme',
  desiredOutcome: 'Alle Schritte des Flows laufen durch, LLM antwortet, Daten werden korrekt gespeichert.',
  constraints: ['Kein laufender Dev-Server nötig', 'Testdaten werden nach dem Test gelöscht'],
  scope: 'minimal' as const,
  researchMode: 'quick' as const,
  privacyMode: 'local' as const,
}

// ─── Steps ───────────────────────────────────────────────────────────────────

async function step0CheckProviders(): Promise<StepResult> {
  const elapsed = timer()
  try {
    const providers = await getProviderAvailability()
    const available = providers.filter(p => p.available)

    verbose(`Providers scanned: ${providers.map(p => `${p.name}=${p.available}`).join(', ')}`)

    if (PROVIDER) {
      const matched = providers.find(p => p.id === PROVIDER)
      if (!matched) {
        return {
          name: 'Step 0: Provider Check',
          status: 'fail',
          detail: `Unknown provider "${PROVIDER}". Valid: ${providers.map(p => p.id).join(', ')}`,
          durationMs: elapsed(),
        }
      }
      if (!matched.available) {
        if (DRY_RUN) {
          log(`  ⚠️  Provider "${PROVIDER}" not available (dry-run — continuing)`)
          return { name: 'Step 0: Provider Check', status: 'skip', detail: matched.reason, durationMs: elapsed() }
        }
        return {
          name: 'Step 0: Provider Check',
          status: 'fail',
          detail: matched.reason ?? `Provider "${PROVIDER}" is not available`,
          durationMs: elapsed(),
        }
      }
      log(`  ✅ Provider "${matched.name}" (${matched.model}) aktiv`)
      return { name: 'Step 0: Provider Check', status: 'pass', durationMs: elapsed() }
    }

    if (available.length === 0) {
      if (DRY_RUN) {
        log('  ⚠️  Kein Provider aktiv (dry-run — continuing)')
        return { name: 'Step 0: Provider Check', status: 'skip', detail: 'no provider available', durationMs: elapsed() }
      }
      return {
        name: 'Step 0: Provider Check',
        status: 'fail',
        detail: 'Kein LLM-Provider aktiv. API-Key setzen oder Ollama starten.',
        durationMs: elapsed(),
      }
    }

    for (const p of available) {
      log(`  ✅ ${p.name} (${p.model}) verfügbar`)
    }
    for (const p of providers.filter(p => !p.available)) {
      verbose(`❌ ${p.name} — ${p.reason}`)
    }

    return { name: 'Step 0: Provider Check', status: 'pass', durationMs: elapsed() }
  } catch (err) {
    return {
      name: 'Step 0: Provider Check',
      status: 'fail',
      detail: err instanceof Error ? err.message : String(err),
      durationMs: elapsed(),
    }
  }
}

async function step1CreateBrief(): Promise<{ result: StepResult; brief: ProjectBrief | null }> {
  const elapsed = timer()
  if (DRY_RUN) {
    log('  ⏭  Step 1 übersprungen (--dry-run)')
    return { result: { name: 'Step 1: Brief erstellen', status: 'skip', durationMs: elapsed() }, brief: null }
  }

  try {
    const brief = buildProjectBrief(TEST_IDEA_INPUT)
    const repo  = createProjectBriefRepository()
    const saved = await repo.create(brief)

    if (!saved.id) {
      return {
        result: { name: 'Step 1: Brief erstellen', status: 'fail', detail: 'Brief hat keine ID', durationMs: elapsed() },
        brief: null,
      }
    }

    verbose(`Brief: id=${saved.id}, status=${saved.status}`)
    log(`  ✅ Brief erstellt: ${saved.id}`)
    return { result: { name: 'Step 1: Brief erstellen', status: 'pass', durationMs: elapsed() }, brief: saved }
  } catch (err) {
    return {
      result: {
        name: 'Step 1: Brief erstellen',
        status: 'fail',
        detail: err instanceof Error ? err.message : String(err),
        durationMs: elapsed(),
      },
      brief: null,
    }
  }
}

async function step2GenerateStructure(): Promise<{ result: StepResult; providerUsed: string }> {
  const elapsed = timer()

  // If provider check was skipped (dry-run + no provider), skip KI step too
  const resolved = await resolveProvider('fast')
  if (resolved.providerId === 'placeholder') {
    log('  ⚠️  KI-Generierung übersprungen (kein Provider verfügbar)')
    return {
      result: { name: 'Step 2: KI-Struktur generieren', status: 'skip', detail: resolved.reason, durationMs: elapsed() },
      providerUsed: 'none',
    }
  }

  try {
    const result = await generateText({
      system: 'Du bist ein strukturierter Produktmanager. Antworte immer in 3 Bullet-Points.',
      prompt: `Erstelle eine kurze Projektstruktur für folgende Idee:\n\n"${TEST_IDEA_INPUT.title}"\n\nProblem: ${TEST_IDEA_INPUT.problemStatement}\n\nAntworte mit 3 Bullet-Points: Ziele, Risiken, nächste Schritte.`,
      maxTokens: 200,
      purpose: 'fast',
    })

    if (!result.text || result.text.trim().length === 0) {
      return {
        result: {
          name: 'Step 2: KI-Struktur generieren',
          status: 'fail',
          detail: 'Leere Antwort vom LLM',
          durationMs: elapsed(),
        },
        providerUsed: result.provider,
      }
    }

    verbose(`LLM output (${result.text.length} chars): ${result.text.slice(0, 120)}…`)
    log(`  ✅ KI-Generierung OK via ${result.provider} / ${result.model} (${elapsed()}ms)`)
    return {
      result: { name: 'Step 2: KI-Struktur generieren', status: 'pass', durationMs: elapsed() },
      providerUsed: result.provider,
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    log(`  ❌ KI-Generierung fehlgeschlagen: ${reason}`)
    return {
      result: {
        name: 'Step 2: KI-Struktur generieren',
        status: 'fail',
        detail: reason,
        durationMs: elapsed(),
      },
      providerUsed: 'unknown',
    }
  }
}

async function step3CreateDelegation(brief: ProjectBrief | null): Promise<{ result: StepResult; delegation: Delegation | null }> {
  const elapsed = timer()

  if (DRY_RUN || !brief) {
    log(`  ⏭  Step 3 übersprungen (${DRY_RUN ? '--dry-run' : 'kein Brief'})`)
    return {
      result: { name: 'Step 3: Delegation erstellen', status: 'skip', durationMs: elapsed() },
      delegation: null,
    }
  }

  try {
    const now  = new Date().toISOString()
    const repo = createDelegationRepository(SINGLE_TENANT_USER_ID)

    const delegation = await repo.create({
      title: `[E2E-Test] ${brief.title}`.slice(0, 80),
      briefId: brief.id,
      briefTitle: brief.title,
      status: 'pending',
      executionRoute: 'local-agent',
      costEstimateUsd: 0,
      contract: {
        id: crypto.randomUUID(),
        workItemId: 'E2E-TEST-001',
        goal: brief.title,
        context: `E2E-Testlauf für Brief ${brief.id}`,
        definitionOfDone: ['E2E-Test bestanden'],
        riskClass: 'A',
        maxBudgetUsd: 0,
        allowedTools: ['Read'],
        branchStrategy: 'feature',
        requiresApproval: false,
        privacyMode: 'local',
        createdAt: now,
      },
      logs: [],
      createdAt: now,
      updatedAt: now,
    })

    verbose(`Delegation: id=${delegation.id}, status=${delegation.status}`)
    log(`  ✅ Delegation erstellt: ${delegation.id}`)
    return { result: { name: 'Step 3: Delegation erstellen', status: 'pass', durationMs: elapsed() }, delegation }
  } catch (err) {
    return {
      result: {
        name: 'Step 3: Delegation erstellen',
        status: 'fail',
        detail: err instanceof Error ? err.message : String(err),
        durationMs: elapsed(),
      },
      delegation: null,
    }
  }
}

async function step4CompleteDelegation(delegation: Delegation | null): Promise<{ result: StepResult; delegation: Delegation | null }> {
  const elapsed = timer()

  if (DRY_RUN || !delegation) {
    log(`  ⏭  Step 4 übersprungen (${DRY_RUN ? '--dry-run' : 'keine Delegation'})`)
    return {
      result: { name: 'Step 4: Delegation abschließen', status: 'skip', durationMs: elapsed() },
      delegation: null,
    }
  }

  try {
    const repo    = createDelegationRepository(SINGLE_TENANT_USER_ID)
    const updated = await repo.update(delegation.id, {
      status: 'completed',
      summaryReport: {
        keyPoints: ['E2E-Test erfolgreich abgeschlossen'],
        changes:   ['Keine echten Änderungen — Testlauf'],
        timeTakenMinutes: 0,
      },
    })

    if (!updated || updated.status !== 'completed') {
      return {
        result: { name: 'Step 4: Delegation abschließen', status: 'fail', detail: 'Status nicht auf completed gesetzt', durationMs: elapsed() },
        delegation: null,
      }
    }

    verbose(`Delegation status=${updated.status}`)
    log('  ✅ Delegation abgeschlossen')
    return { result: { name: 'Step 4: Delegation abschließen', status: 'pass', durationMs: elapsed() }, delegation: updated }
  } catch (err) {
    return {
      result: {
        name: 'Step 4: Delegation abschließen',
        status: 'fail',
        detail: err instanceof Error ? err.message : String(err),
        durationMs: elapsed(),
      },
      delegation: null,
    }
  }
}

async function step5KnowledgeWriteback(delegation: Delegation | null): Promise<{ result: StepResult; cardId: string | null }> {
  const elapsed = timer()

  if (DRY_RUN || !delegation) {
    log(`  ⏭  Step 5 übersprungen (${DRY_RUN ? '--dry-run' : 'keine Delegation'})`)
    return { result: { name: 'Step 5: Knowledge Writeback', status: 'skip', durationMs: elapsed() }, cardId: null }
  }

  try {
    const result = await writebackDelegationKnowledge(
      delegation,
      'E2E-Test: vollständiger Flow erfolgreich durchgelaufen. Alle Schritte bestanden.',
    )

    if (result.written) {
      verbose(`Knowledge Card id=${result.cardId}`)
      log(`  ✅ Knowledge Writeback OK (card: ${result.cardId})`)
    } else {
      log(`  ⚠️  Knowledge Writeback übersprungen (kein LLM): ${result.reason ?? 'unbekannt'}`)
    }

    // Fail-open: skipped is OK too
    return {
      result: { name: 'Step 5: Knowledge Writeback', status: 'pass', durationMs: elapsed() },
      cardId: result.written ? (result.cardId ?? null) : null,
    }
  } catch (err) {
    return {
      result: {
        name: 'Step 5: Knowledge Writeback',
        status: 'fail',
        detail: err instanceof Error ? err.message : String(err),
        durationMs: elapsed(),
      },
      cardId: null,
    }
  }
}

async function cleanup(briefId: string | null, delegationId: string | null, cardId: string | null): Promise<void> {
  if (NO_CLEANUP || DRY_RUN) {
    verbose('Cleanup übersprungen')
    return
  }

  try {
    if (cardId) {
      const repo    = createKnowledgeCardRepository(SINGLE_TENANT_USER_ID)
      const deleted = await repo.delete?.(cardId)
      verbose(`Knowledge Card ${cardId} gelöscht: ${deleted}`)
    }
    if (delegationId) {
      const repo    = createDelegationRepository(SINGLE_TENANT_USER_ID)
      const deleted = await repo.delete(delegationId)
      verbose(`Delegation ${delegationId} gelöscht: ${deleted}`)
    }
    if (briefId) {
      const repo    = createProjectBriefRepository()
      const deleted = await repo.delete(briefId)
      verbose(`Brief ${briefId} gelöscht: ${deleted}`)
    }
    log('  🧹 Testdaten bereinigt')
  } catch (err) {
    log(`  ⚠️  Cleanup-Fehler: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function printSummary(results: StepResult[]): void {
  const width = 60
  log('')
  log('─'.repeat(width))
  log('  ForgePilot E2E Flow — Zusammenfassung')
  log('─'.repeat(width))

  for (const r of results) {
    const icon   = r.status === 'pass' ? '✅' : r.status === 'skip' ? '⏭ ' : '❌'
    const timing = r.durationMs !== undefined ? ` (${r.durationMs}ms)` : ''
    log(`  ${icon}  ${r.name}${timing}`)
    if (r.detail && (VERBOSE || r.status === 'fail')) {
      log(`       → ${r.detail}`)
    }
  }

  log('─'.repeat(width))

  const failed  = results.filter(r => r.status === 'fail').length
  const skipped = results.filter(r => r.status === 'skip').length
  const passed  = results.filter(r => r.status === 'pass').length

  if (failed === 0) {
    log(`  🎉 Vollständiger Flow funktioniert! (${passed} pass, ${skipped} skip)`)
  } else {
    log(`  ❌ ${failed} Schritte fehlgeschlagen (${passed} pass, ${skipped} skip)`)
  }

  if (DRY_RUN) {
    log('  ℹ️  Dry-run: Keine Daten geschrieben')
  }

  log('─'.repeat(width))
  log('')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log('')
  log('🚀 ForgePilot — Lokaler E2E Flow Test')
  if (PROVIDER) log(`   Provider: ${PROVIDER} (LLM_MODE=${process.env['LLM_MODE']})`)
  if (DRY_RUN)   log('   Modus: --dry-run (kein Schreiben)')
  if (VERBOSE)   log('   Modus: --verbose')
  log('')

  const results: StepResult[] = []

  // Step 0 — Provider Check
  const step0 = await step0CheckProviders()
  results.push(step0)
  if (step0.status === 'fail') {
    printSummary(results)
    process.exit(1)
  }

  // Step 1 — Brief erstellen
  const { result: r1, brief } = await step1CreateBrief()
  results.push(r1)

  // Step 2 — KI-Struktur generieren
  const { result: r2 } = await step2GenerateStructure()
  results.push(r2)

  // Step 3 — Delegation erstellen
  const { result: r3, delegation: d3 } = await step3CreateDelegation(brief)
  results.push(r3)

  // Step 4 — Delegation abschließen
  const { result: r4, delegation: d4 } = await step4CompleteDelegation(d3)
  results.push(r4)

  // Step 5 — Knowledge Writeback
  const { result: r5, cardId } = await step5KnowledgeWriteback(d4)
  results.push(r5)

  // Cleanup
  await cleanup(brief?.id ?? null, d3?.id ?? null, cardId)

  // Summary + exit code
  printSummary(results)

  const failed = results.filter(r => r.status === 'fail').length
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err: unknown) => {
  log(`\n💥 Unerwarteter Fehler: ${err instanceof Error ? err.message : String(err)}`)
  if (VERBOSE && err instanceof Error && err.stack) log(err.stack)
  process.exit(1)
})
