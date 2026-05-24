import type { DailyReportExecuteLoopEvidenceRun } from './daily-report'
import { isProvenExecuteLoopRun } from './execute-loop-evidence-summary'

export interface ExecuteLoopAcceptancePlanItem {
  id: string
  title: string
  category: 'bugfix' | 'feature' | 'api' | 'refactor' | 'test'
  goal: string
  why: string
  acceptanceCriteria: string[]
  verification: string[]
  evidenceCommand: string
  status: 'done' | 'next' | 'queued'
}

const ACCEPTANCE_PLAN_BASE: Omit<ExecuteLoopAcceptancePlanItem, 'status'>[] = [
  {
    id: 'acceptance-bugfix',
    title: 'Kleiner Bugfix: leere Zustandsmeldung verbessern',
    category: 'bugfix',
    goal: 'Ein risikoarmes UI-Problem von Idee bis PR beweisen.',
    why: 'Bugfixes sind der häufigste Alltagsfall und sollten ohne viel Nacharbeit funktionieren.',
    acceptanceCriteria: [
      'Brief und Delegation werden aus einer kurzen Idee erzeugt.',
      'Agent liefert eine kleine, nachvollziehbare Codeänderung.',
      'Tests oder Build laufen grün.',
      'PR, Critic Review und Writeback sind dokumentiert.',
    ],
    verification: ['npm run type-check', 'npm run lint', 'npm run build'],
    evidenceCommand: 'npm run evidence:record -- --title "Kleiner Bugfix: leere Zustandsmeldung verbessern" --all --pr-url "<PR_URL>" --time-saved 15 --manual-interventions 0',
  },
  {
    id: 'acceptance-feature',
    title: 'Kleines Feature: Loading Skeleton auf Projects',
    category: 'feature',
    goal: 'Ein kleines sichtbares Feature mit klarer UX-Wirkung beweisen.',
    why: 'Zeigt, ob ForgePilot UI-Arbeit sauber planen, ausführen und prüfen kann.',
    acceptanceCriteria: [
      'Feature-Scope bleibt auf eine Kernseite begrenzt.',
      'UI bleibt responsive und deutsch verständlich.',
      'Keine neuen Produktbereiche entstehen.',
      'PR enthält klare Zusammenfassung und Critic-Ergebnis.',
    ],
    verification: ['npm run type-check', 'npm run lint', 'npx vitest run <relevante-tests>'],
    evidenceCommand: 'npm run evidence:record -- --title "Kleines Feature: Loading Skeleton auf Projects" --all --pr-url "<PR_URL>" --time-saved 20 --manual-interventions 1',
  },
  {
    id: 'acceptance-api',
    title: 'API-Änderung: Delegations urgent filter',
    category: 'api',
    goal: 'Eine kleine API-Erweiterung mit Testabdeckung beweisen.',
    why: 'Der Assistent muss Backend-Änderungen kontrolliert und testbar erledigen können.',
    acceptanceCriteria: [
      'Route validiert Eingaben sauber.',
      'Bestehende API-Kontrakte bleiben kompatibel.',
      'Mindestens ein fokussierter API-Test deckt den neuen Filter ab.',
      'Writeback hält die gelernte API-Entscheidung fest.',
    ],
    verification: ['npm run type-check', 'npx vitest run src/app/api/delegations/route.test.ts'],
    evidenceCommand: 'npm run evidence:record -- --title "API-Änderung: Delegations urgent filter" --all --pr-url "<PR_URL>" --time-saved 25 --manual-interventions 1',
  },
  {
    id: 'acceptance-refactor',
    title: 'Refactor: StatusBadge-Komponente extrahieren',
    category: 'refactor',
    goal: 'Ein kleines Refactoring ohne Verhaltensänderung beweisen.',
    why: 'Refactorings zeigen, ob der Agent Struktur verbessern kann, ohne die App zu destabilisieren.',
    acceptanceCriteria: [
      'Keine funktionale Änderung außer der Extraktion.',
      'Bestehende Seiten rendern weiterhin.',
      'Komponente ist wiederverwendbar und typisiert.',
      'Critic prüft Drift und unnötige Abstraktion.',
    ],
    verification: ['npm run type-check', 'npm run lint', 'npm run build'],
    evidenceCommand: 'npm run evidence:record -- --title "Refactor: StatusBadge-Komponente extrahieren" --all --pr-url "<PR_URL>" --time-saved 20 --manual-interventions 1',
  },
  {
    id: 'acceptance-test',
    title: 'Test-Ticket: Onboarding Status API absichern',
    category: 'test',
    goal: 'Ein reines Test-Ticket mit minimalem Risiko beweisen.',
    why: 'Tests sind ideal, um den Loop häufig zu üben, ohne Produktlogik unnötig zu verändern.',
    acceptanceCriteria: [
      'Mindestens zwei relevante Testfälle werden ergänzt.',
      'Keine Produktivlogik wird ohne Grund geändert.',
      'CI-relevante Testkommandos laufen grün.',
      'Writeback dokumentiert die getestete Risikoannahme.',
    ],
    verification: ['npx vitest run src/app/api/onboarding/status/route.test.ts', 'npm run type-check'],
    evidenceCommand: 'npm run evidence:record -- --title "Test-Ticket: Onboarding Status API absichern" --all --pr-url "<PR_URL>" --time-saved 15 --manual-interventions 0',
  },
]

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function buildExecuteLoopAcceptancePlan(
  runs: DailyReportExecuteLoopEvidenceRun[],
  targetRuns = 5,
): ExecuteLoopAcceptancePlanItem[] {
  const provenTitles = new Set(
    runs
      .filter(isProvenExecuteLoopRun)
      .map(run => normalize(run.title)),
  )
  const provenRunCount = runs.filter(isProvenExecuteLoopRun).length
  let nextAssigned = false

  return ACCEPTANCE_PLAN_BASE.slice(0, targetRuns).map(item => {
    const done = [...provenTitles].some(title => title.includes(normalize(item.title)) || normalize(item.title).includes(title))
    const status: ExecuteLoopAcceptancePlanItem['status'] = done
      ? 'done'
      : !nextAssigned && provenRunCount < targetRuns
        ? 'next'
        : 'queued'
    if (status === 'next') nextAssigned = true
    return { ...item, status }
  })
}
