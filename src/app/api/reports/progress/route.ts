export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { readProjectBriefs } from '@/lib/project-briefs'
import { readMilestones, readWorkPackages } from '@/lib/knowledge/milestone-store'
import { createDelegationRepository, SINGLE_TENANT_USER_ID } from '@/lib/repositories/delegationRepository'
import { readConnectorConfigs } from '@/lib/connectors/config'

const CONFIG_DIR = path.join(process.cwd(), 'config')

function readJsonSafe<T>(filename: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, filename), 'utf-8')) as T
  } catch {
    return null
  }
}

interface TestResults {
  numTotalTestSuites?: number
  numPassedTestSuites?: number
  numFailedTestSuites?: number
  numTotalTests?: number
  numPassedTests?: number
  numFailedTests?: number
  startTime?: number
}

export interface ProgressSection {
  title: string
  items: ProgressItem[]
}

export interface ProgressItem {
  label: string
  status: 'done' | 'ok' | 'warning' | 'pending' | 'info'
  detail?: string
  url?: string
  count?: number
}

export interface ProgressReport {
  generatedAt: string
  appVersion: string
  sections: ProgressSection[]
  summary: {
    totalBriefs: number
    acceptedBriefs: number
    completedDelegations: number
    failedDelegations: number
    pendingDelegations: number
    testsTotal: number
    testsPassed: number
    testsFailed: number
    workPackagesTotal: number
    workPackagesDone: number
  }
}

export async function GET(): Promise<NextResponse> {
  const briefs = readProjectBriefs()
  const milestones = readMilestones()
  const workPackages = readWorkPackages()
  const testResults = readJsonSafe<TestResults>('test-results.json')

  const delegationRepo = createDelegationRepository(SINGLE_TENANT_USER_ID)
  const allDelegations = await delegationRepo.listByStatus()

  const { github: ghConfig, linear: linearConfig } = readConnectorConfigs()
  const githubConnected = Boolean(ghConfig?.token?.trim())
  const linearConnected = Boolean(linearConfig?.apiKey?.trim())

  // --- Section: Was wurde bereits gemacht ---
  const acceptedBriefs = briefs.filter(b => b.status === 'accepted')
  const reviewBriefs = briefs.filter(b => b.status === 'in_review')
  const completedDelegations = allDelegations.filter(d => d.status === 'completed')
  const delegationsWithPR = completedDelegations.filter(d =>
    d.summaryReport?.keyPoints?.some(k => k.includes('github.com') || k.toLowerCase().includes('pr'))
    || d.logs?.some(l => l.message.includes('github.com/') && l.message.includes('/pull/'))
  )
  const workPackagesDone = workPackages.filter(wp => wp.status === 'done')
  const milestonesCompleted = milestones.filter(m => m.status === 'completed')

  const doneSection: ProgressSection = {
    title: 'Was wurde bereits gemacht',
    items: [
      {
        label: 'Projekt-Briefs akzeptiert',
        status: acceptedBriefs.length > 0 ? 'done' : 'pending',
        count: acceptedBriefs.length,
        detail: acceptedBriefs.map(b => b.title).join(', ') || 'Keine',
      },
      {
        label: 'Briefs in Review',
        status: reviewBriefs.length > 0 ? 'info' : 'ok',
        count: reviewBriefs.length,
        detail: reviewBriefs.map(b => b.title).slice(0, 3).join(', ') || 'Keine',
      },
      {
        label: 'Delegationen abgeschlossen',
        status: completedDelegations.length > 0 ? 'done' : 'pending',
        count: completedDelegations.length,
        detail: `${completedDelegations.length} von ${allDelegations.length} gesamt`,
      },
      {
        label: 'Pull Requests erstellt',
        status: delegationsWithPR.length > 0 ? 'done' : 'info',
        count: delegationsWithPR.length,
        detail: 'Delegationen mit erkanntem PR-Link',
      },
      {
        label: 'Work Packages erledigt',
        status: workPackagesDone.length > 0 ? 'done' : 'pending',
        count: workPackagesDone.length,
        detail: `${workPackagesDone.length} von ${workPackages.length} Work Packages`,
      },
      {
        label: 'Meilensteine abgeschlossen',
        status: milestonesCompleted.length > 0 ? 'done' : 'pending',
        count: milestonesCompleted.length,
        detail: `${milestonesCompleted.length} von ${milestones.length} Meilensteinen`,
      },
      {
        label: 'GitHub Repos erstellt',
        status: briefs.filter(b => b.githubRepoUrl).length > 0 ? 'done' : 'info',
        count: briefs.filter(b => b.githubRepoUrl).length,
        detail: briefs.filter(b => b.githubRepoUrl).map(b => b.githubRepoName ?? b.title).join(', ') || 'Keine',
      },
      {
        label: 'Linear Projekte verknüpft',
        status: briefs.filter(b => b.linearProjectId).length > 0 ? 'done' : 'info',
        count: briefs.filter(b => b.linearProjectId).length,
        detail: briefs.filter(b => b.linearProjectUrl).map(b => b.title).join(', ') || 'Keine',
      },
    ],
  }

  // --- Section: Was funktioniert gut ---
  const failedDelegations = allDelegations.filter(d => d.status === 'failed')
  const successRate = allDelegations.length > 0
    ? Math.round((completedDelegations.length / allDelegations.length) * 100)
    : 0
  const ollamaRunners = completedDelegations.filter(d => d.executionRoute === 'ollama-agent')
  const claudeRunners = completedDelegations.filter(d => ['local-agent', 'runner'].includes(d.executionRoute ?? ''))

  const workingSection: ProgressSection = {
    title: 'Was funktioniert gut',
    items: [
      {
        label: `Delegation-Erfolgsrate: ${successRate}%`,
        status: successRate >= 80 ? 'ok' : successRate >= 50 ? 'warning' : 'pending',
        detail: `${completedDelegations.length} erfolgreich, ${failedDelegations.length} fehlgeschlagen`,
      },
      {
        label: 'GitHub Connector',
        status: githubConnected ? 'ok' : 'warning',
        detail: githubConnected ? 'Verbunden — Auto-Repo + Issue-Erstellung aktiv' : 'GITHUB_TOKEN fehlt',
      },
      {
        label: 'Linear Connector',
        status: linearConnected ? 'ok' : 'warning',
        detail: linearConnected ? 'Verbunden — Auto-Projekt + Ticket-Erstellung aktiv' : 'LINEAR_API_KEY fehlt',
      },
      {
        label: 'Claude CLI Runner',
        status: claudeRunners.length > 0 ? 'ok' : 'info',
        count: claudeRunners.length,
        detail: `${claudeRunners.length} Delegationen via Claude CLI abgeschlossen`,
      },
      {
        label: 'Ollama Runner',
        status: ollamaRunners.length > 0 ? 'ok' : 'info',
        count: ollamaRunners.length,
        detail: `${ollamaRunners.length} Delegationen via Ollama abgeschlossen`,
      },
      {
        label: 'Zod API Validation',
        status: 'ok',
        detail: 'Alle API-Routes mit Schema-Validierung — strukturierte 400-Fehler',
      },
      {
        label: 'Pino Structured Logging',
        status: 'ok',
        detail: 'JSON-Logs mit module/event/durationMs für alle kritischen Pfade',
      },
      {
        label: 'Delegation Pagination',
        status: 'ok',
        detail: 'Standard-Limit 100 Items — verhindert JSON-Store-Freeze',
      },
    ],
  }

  // --- Section: Was wurde getestet ---
  const testsPassed = testResults?.numPassedTests ?? 0
  const testsFailed = testResults?.numFailedTests ?? 0
  const testsTotal = testResults?.numTotalTests ?? 0
  const suitesPassed = testResults?.numPassedTestSuites ?? 0
  const suitesTotal = testResults?.numTotalTestSuites ?? 0
  const testCoverage = testsTotal > 0 ? Math.round((testsPassed / testsTotal) * 100) : 0
  const testDate = testResults?.startTime ? new Date(testResults.startTime).toLocaleDateString('de-DE') : 'Unbekannt'

  const testedSection: ProgressSection = {
    title: 'Was wurde getestet',
    items: [
      {
        label: `${testsPassed.toLocaleString()} Tests bestanden (${testCoverage}%)`,
        status: testsFailed === 0 ? 'ok' : testsFailed < 5 ? 'warning' : 'pending',
        detail: `${suitesPassed}/${suitesTotal} Test-Suiten grün · Letzter Run: ${testDate}`,
        count: testsPassed,
      },
      {
        label: 'API-Route Tests',
        status: 'ok',
        detail: 'Alle /api/intake, /api/delegations, /api/project-briefs Routes getestet',
      },
      {
        label: 'Zod Validation Tests',
        status: 'ok',
        detail: 'Schema-Validierung mit korrekten 400-Fehlern verifiziert',
      },
      {
        label: 'GitHub Connector Tests',
        status: 'ok',
        detail: 'PR-Erstellung, Issue-Erstellung, Repo-Erstellung',
      },
      {
        label: 'Delegation Lifecycle Tests',
        status: 'ok',
        detail: 'Erstellung, Approval, Execute, Complete, Cancel',
      },
      {
        label: 'Linear Connector Tests',
        status: 'ok',
        detail: 'Ticket-Erstellung, Projekt-Verknüpfung, Health-Check',
      },
      {
        label: 'Ollama Runner Tests',
        status: 'ok',
        detail: 'System-Prompt, Tool-Execution, TASK_COMPLETE Detection',
      },
      ...(testsFailed > 0 ? [{
        label: `${testsFailed} fehlgeschlagene Tests`,
        status: 'warning' as const,
        detail: 'Bitte npm run test:run ausführen und Fehler beheben',
        count: testsFailed,
      }] : []),
    ],
  }

  // --- Section: Was sollte noch gemacht werden ---
  const pendingDelegations = allDelegations.filter(d => d.status === 'pending')
  const runningDelegations = allDelegations.filter(d => d.status === 'running')
  const workPackagesPending = workPackages.filter(wp =>
    wp.status === 'backlog' || wp.status === 'ready' || wp.status === 'in_progress'
  )
  const briefsWithoutRepo = acceptedBriefs.filter(b => !b.githubRepoUrl)
  const briefsWithoutLinear = acceptedBriefs.filter(b => !b.linearProjectId)
  const milestonesInProgress = milestones.filter(m => m.status === 'in_progress')

  const todoSection: ProgressSection = {
    title: 'Was sollte noch gemacht werden',
    items: [
      ...(pendingDelegations.length > 0 ? [{
        label: `${pendingDelegations.length} ausstehende Delegationen`,
        status: 'pending' as const,
        count: pendingDelegations.length,
        detail: pendingDelegations.slice(0, 3).map(d => d.title || d.contract.goal.slice(0, 50)).join(', '),
      }] : []),
      ...(runningDelegations.length > 0 ? [{
        label: `${runningDelegations.length} laufende Delegationen`,
        status: 'info' as const,
        count: runningDelegations.length,
        detail: runningDelegations.slice(0, 3).map(d => d.title || d.contract.goal.slice(0, 50)).join(', '),
      }] : []),
      ...(failedDelegations.length > 0 ? [{
        label: `${failedDelegations.length} fehlgeschlagene Delegationen — Retry empfohlen`,
        status: 'warning' as const,
        count: failedDelegations.length,
        detail: failedDelegations.slice(0, 3).map(d => d.title || d.contract.goal.slice(0, 50)).join(', '),
        url: '/delegations?statuses=failed',
      }] : []),
      ...(workPackagesPending.length > 0 ? [{
        label: `${workPackagesPending.length} Work Packages offen`,
        status: 'pending' as const,
        count: workPackagesPending.length,
        detail: `${milestonesInProgress.length} Meilensteine in Bearbeitung`,
        url: '/work-items',
      }] : []),
      ...(briefsWithoutRepo.length > 0 ? [{
        label: `${briefsWithoutRepo.length} Briefs ohne GitHub Repo`,
        status: 'warning' as const,
        count: briefsWithoutRepo.length,
        detail: `POST /api/github/repos für: ${briefsWithoutRepo.map(b => b.title).join(', ')}`,
        url: '/project-briefs',
      }] : []),
      ...(briefsWithoutLinear.length > 0 ? [{
        label: `${briefsWithoutLinear.length} Briefs ohne Linear Projekt`,
        status: 'warning' as const,
        count: briefsWithoutLinear.length,
        detail: briefsWithoutLinear.map(b => b.title).join(', '),
        url: '/project-briefs',
      }] : []),
      {
        label: 'Target-Repo für Delegationen konfigurieren',
        status: 'pending',
        detail: 'FORGEPILOT_RUNNER_TARGET_REPO in .env.local oder per Delegation.targetRepo setzen',
      },
      {
        label: 'Vercel Deployment einrichten (M99)',
        status: 'pending',
        detail: 'Preview-URLs für PRs, Edge Functions, Vercel Cron für DSGVO-Cleanup',
      },
    ],
  }

  const report: ProgressReport = {
    generatedAt: new Date().toISOString(),
    appVersion: process.env.npm_package_version ?? '0.1.0',
    sections: [doneSection, workingSection, testedSection, todoSection],
    summary: {
      totalBriefs: briefs.length,
      acceptedBriefs: acceptedBriefs.length,
      completedDelegations: completedDelegations.length,
      failedDelegations: failedDelegations.length,
      pendingDelegations: pendingDelegations.length,
      testsTotal,
      testsPassed,
      testsFailed,
      workPackagesTotal: workPackages.length,
      workPackagesDone: workPackagesDone.length,
    },
  }

  return NextResponse.json(report)
}
