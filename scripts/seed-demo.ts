#!/usr/bin/env npx tsx
/**
 * ForgePilot Demo Data Seeder
 * 
 * Creates realistic demo data in config/*.json so the UI shows
 * meaningful values immediately after a fresh clone.
 * 
 * Usage: npx tsx scripts/seed-demo.ts
 *        npm run seed
 */

import fs from 'fs'
import path from 'path'

const CONFIG = path.join(process.cwd(), 'config')

function ensure(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function write(name: string, data: unknown) {
  fs.writeFileSync(path.join(CONFIG, name), JSON.stringify(data, null, 2), 'utf-8')
  console.log(`✅  config/${name}`)
}

function dt(daysAgo = 0, hoursAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86400_000 - hoursAgo * 3600_000)
  return d.toISOString()
}

function makeContract(goal: string, riskClass = 'A', requiresApproval = false, budget = 2.0) {
  return {
    goal, riskClass, privacyMode: 'local', requiresApproval,
    maxBudgetUsd: budget,
    allowedTools: ['bash', 'read_file', 'write_file'],
    branchStrategy: 'feature', skillCategory: 'coding',
    taskType: 'feature', definitionOfDone: ['Tests pass', 'PR reviewed'],
    context: '', createdAt: dt(5),
  }
}

function makeSummary(savedUsd: number, model: string, tokens: number) {
  return {
    status: 'completed',
    completedAt: dt(1),
    costSavings: {
      cloudEquivalentUsd: savedUsd + 0.30,
      savedUsd, localModel: model,
      cloudModel: 'claude-3-5-sonnet',
      inputTokens: tokens,
      outputTokens: Math.floor(tokens * 0.4),
      durationMs: 18400,
    },
  }
}

ensure(CONFIG)

// ─── Delegations ─────────────────────────────────────────────────────────────
write('delegations.json', [
  { id: 'del-demo-001', title: 'JWT Authentication Middleware', status: 'completed', executionRoute: 'ollama-agent', costEstimateUsd: 0, actualCostUsd: 0, contract: makeContract('Implement JWT-based authentication middleware for all API routes', 'B', true), summaryReport: makeSummary(0.82, 'qwen2.5-coder:14b', 2140), logs: [{ type: 'success', message: 'JWT middleware implemented and tested', timestamp: dt(1) }], createdAt: dt(3), updatedAt: dt(1) },
  { id: 'del-demo-002', title: 'Rate Limiting Middleware', status: 'completed', executionRoute: 'ollama-agent', costEstimateUsd: 0, actualCostUsd: 0, contract: makeContract('Add sliding-window rate limiting to /api routes (100 req/min per IP)'), summaryReport: makeSummary(0.68, 'llama3.2:3b', 1560), logs: [{ type: 'success', message: 'Rate limiter with tests implemented', timestamp: dt(2) }], createdAt: dt(4), updatedAt: dt(2) },
  { id: 'del-demo-003', title: 'Dashboard Stats API Endpoint', status: 'completed', executionRoute: 'ollama-agent', costEstimateUsd: 0, actualCostUsd: 0, contract: makeContract('Build /api/dashboard/stats aggregation endpoint for Command Center'), summaryReport: makeSummary(0.91, 'qwen2.5-coder:14b', 2380), logs: [{ type: 'success', message: 'Dashboard API with 7-widget aggregation complete', timestamp: dt(3) }], createdAt: dt(5), updatedAt: dt(3) },
  { id: 'del-demo-004', title: 'Zod Schema Validation Rollout', status: 'completed', executionRoute: 'ollama-agent', costEstimateUsd: 0, actualCostUsd: 0, contract: makeContract('Apply Zod parseBody() validation to all POST/PUT API routes'), summaryReport: makeSummary(1.12, 'qwen2.5-coder:14b', 2870), logs: [{ type: 'success', message: '12 routes updated with Zod validation', timestamp: dt(4) }], createdAt: dt(6), updatedAt: dt(4) },
  { id: 'del-demo-005', title: 'Pino Structured Logging Migration', status: 'completed', executionRoute: 'ollama-agent', costEstimateUsd: 0, actualCostUsd: 0, contract: makeContract('Replace 19x console.log with Pino structured logging'), summaryReport: makeSummary(0.74, 'llama3.2:3b', 1980), logs: [{ type: 'success', message: 'Pino migration complete', timestamp: dt(5) }], createdAt: dt(7), updatedAt: dt(5) },
  { id: 'del-demo-006', title: 'OpenTelemetry Tracing Integration', status: 'pending', executionRoute: 'ollama-agent', costEstimateUsd: 0, contract: makeContract('Integrate @opentelemetry packages, add spans to delegation.execute', 'B', true), logs: [], createdAt: dt(1), updatedAt: dt(1) },
  { id: 'del-demo-007', title: 'Sentry Error Monitoring Setup', status: 'pending', executionRoute: 'ollama-agent', costEstimateUsd: 0, contract: makeContract('Configure SENTRY_DSN, add performance tracing'), logs: [], createdAt: dt(1), updatedAt: dt(1) },
  { id: 'del-demo-008', title: 'Knowledge Card Auto-Tagging', status: 'approved', executionRoute: 'ollama-agent', costEstimateUsd: 0, contract: makeContract('Add AI-powered auto-tagging for knowledge cards'), logs: [], createdAt: dt(0, 4), updatedAt: dt(0, 2) },
  { id: 'del-demo-009', title: 'Lighthouse CI Performance Budget', status: 'running', executionRoute: 'ollama-agent', costEstimateUsd: 0, contract: makeContract('Add Lighthouse CI to GitHub Actions with Core Web Vitals assertions'), logs: [{ type: 'info', message: 'Analyzing bundle size...', timestamp: dt(0, 1) }, { type: 'info', message: 'Running Lighthouse audit...', timestamp: dt(0, 0) }], createdAt: dt(0, 2), updatedAt: dt(0, 0) },
  { id: 'del-demo-010', title: 'Work Item Bulk Import Validation', status: 'failed', executionRoute: 'ollama-agent', costEstimateUsd: 0, actualCostUsd: 0.12, contract: makeContract('Add validation for CSV bulk import: detect malformed rows'), logs: [{ type: 'info', message: 'Parsing CSV structure...', timestamp: dt(0, 3) }, { type: 'error', message: 'TypeScript compilation failed: missing type on CsvRow.priority', timestamp: dt(0, 2) }], createdAt: dt(0, 5), updatedAt: dt(0, 2) },
  { id: 'del-demo-011', title: 'Kanban Board Column Persistence', status: 'pending', executionRoute: 'ollama-agent', costEstimateUsd: 0, contract: makeContract('Persist collapsed/expanded kanban column state in localStorage'), logs: [], createdAt: dt(0, 1), updatedAt: dt(0, 1) },
  { id: 'del-demo-012', title: 'Search Result Relevance Scoring', status: 'pending', executionRoute: 'ollama-agent', costEstimateUsd: 0, contract: makeContract('Improve /api/search to score results by title > body > tag match'), logs: [], createdAt: dt(0, 0), updatedAt: dt(0, 0) },
])

// ─── Orchestrated Runs ────────────────────────────────────────────────────────
write('orchestrated-runs.json', {
  runs: [
    { id: 'run-demo-auth', delegationId: 'del-demo-001', delegationTitle: 'JWT Authentication Middleware', status: 'done', createdAt: dt(3), startedAt: dt(3), completedAt: dt(1), tasks: [{ id: 't1', title: 'Analyze existing routes', status: 'done', agentType: 'code-analyst', durationMs: 4200 }, { id: 't2', title: 'Implement JWT middleware', status: 'done', agentType: 'code-writer', durationMs: 12800 }, { id: 't3', title: 'Write unit tests', status: 'done', agentType: 'test-writer', durationMs: 7600 }, { id: 't4', title: 'Update API documentation', status: 'done', agentType: 'doc-writer', durationMs: 3100 }] },
    { id: 'run-demo-ratelimit', delegationId: 'del-demo-002', delegationTitle: 'Rate Limiting Middleware', status: 'done', createdAt: dt(4), startedAt: dt(4), completedAt: dt(2), tasks: [{ id: 't5', title: 'Design sliding window algorithm', status: 'done', agentType: 'architect', durationMs: 3800 }, { id: 't6', title: 'Implement RateLimiterStore', status: 'done', agentType: 'code-writer', durationMs: 9200 }, { id: 't7', title: 'Add middleware to routes', status: 'done', agentType: 'code-writer', durationMs: 5400 }, { id: 't8', title: 'Write 14 tests', status: 'done', agentType: 'test-writer', durationMs: 8100 }] },
    { id: 'run-demo-lighthouse', delegationId: 'del-demo-009', delegationTitle: 'Lighthouse CI Performance Budget', status: 'running', createdAt: dt(0, 2), startedAt: dt(0, 1), tasks: [{ id: 't9', title: 'Configure lighthouserc.js', status: 'done', agentType: 'devops', durationMs: 2100 }, { id: 't10', title: 'Create performance.yml workflow', status: 'running', agentType: 'devops' }, { id: 't11', title: 'Set bundle size thresholds', status: 'pending', agentType: 'devops' }] },
  ],
})

// ─── Attention Items ──────────────────────────────────────────────────────────
write('attention-store.json', {
  items: [
    { id: 'att-001', type: 'delegation_failed', severity: 'warning', title: 'Agent fehlgeschlagen: Work Item Bulk Import Validation', message: 'TypeScript compilation failed: missing type on CsvRow.priority', delegationId: 'del-demo-010', resolved: false, createdAt: dt(0, 2), updatedAt: dt(0, 2) },
    { id: 'att-002', type: 'approval_pending', severity: 'info', title: 'Bereit zum Start: Knowledge Card Auto-Tagging', message: 'Delegation del-demo-008 wurde auto-approved (Risk A). Bereit zur Ausführung.', delegationId: 'del-demo-008', resolved: false, createdAt: dt(0, 4), updatedAt: dt(0, 4) },
    { id: 'att-003', type: 'delegation_completed', severity: 'info', title: 'Abgeschlossen: JWT Authentication Middleware', message: 'Agent hat JWT-Middleware mit 8 Tests implementiert. Gespart: $0.82 gegenüber Cloud-LLM.', delegationId: 'del-demo-001', resolved: true, resolvedAt: dt(1), createdAt: dt(1), updatedAt: dt(1) },
    { id: 'att-004', type: 'review_passed', severity: 'info', title: 'Code Review bestanden: Rate Limiting Middleware', message: 'AI Code Reviewer hat PR geprüft: Zod ✓, Pino ✓, Rate Limiting ✓, Tests ✓', delegationId: 'del-demo-002', resolved: true, resolvedAt: dt(2), createdAt: dt(2), updatedAt: dt(2) },
  ],
})

// ─── Notifications ────────────────────────────────────────────────────────────
write('notifications.json', [
  { id: 'notif-001', type: 'delegation_completed', title: 'JWT Authentication fertig', body: 'Agent hat JWT-Middleware mit 8 Tests implementiert — bereit zum PR erstellen.', href: '/delegations/del-demo-001', read: true, createdAt: dt(1) },
  { id: 'notif-002', type: 'delegation_failed', title: 'Fehler: Work Item CSV Import', body: 'TypeScript Compilation fehler in CsvRow.priority — manuelle Prüfung erforderlich.', href: '/delegations/del-demo-010', read: false, createdAt: dt(0, 2) },
  { id: 'notif-003', type: 'approval_needed', title: 'Freigabe benötigt: Knowledge Card Auto-Tagging', body: 'Delegation del-demo-008 wartet auf Start. Risk Class A, kein Budget-Überschuss.', href: '/delegations/del-demo-008', read: false, createdAt: dt(0, 4) },
  { id: 'notif-004', type: 'delegation_completed', title: 'Rate Limiting Middleware fertig', body: 'Sliding-window Rate-Limiter mit 14 Tests implementiert. $0.68 gespart.', href: '/delegations/del-demo-002', read: true, createdAt: dt(2) },
])

// ─── Agent Runs ───────────────────────────────────────────────────────────────
write('agent-runs.json', {
  runs: [
    { id: 'run-demo-001', delegationId: 'del-demo-001', contractId: 'contract-demo-001', model: 'qwen2.5-coder:14b', status: 'completed', startedAt: dt(1, 2), completedAt: dt(1), logs: [{ type: 'info', message: 'Agent started — analyzing codebase', timestamp: dt(1, 2) }, { type: 'info', message: 'Found 12 API routes requiring auth middleware', timestamp: dt(1, 1) }, { type: 'success', message: 'JWT middleware implemented, 8 tests added', timestamp: dt(1) }], inputTokens: 2140, outputTokens: 856, costUsd: 0.0 },
  ],
})

console.log('\n🎉 Demo data seeded successfully!')
console.log('   Start the dev server: npm run dev')
console.log('   Open: http://localhost:3000')
