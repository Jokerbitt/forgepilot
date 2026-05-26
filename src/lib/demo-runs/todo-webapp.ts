import { randomUUID } from 'crypto'
import type { Delegation } from '@/lib/models/delegation'
import type { ProjectBrief } from '@/lib/models/project-brief'

export interface TodoWebAppDemoRun {
  brief: ProjectBrief
  delegation: Delegation
  appPreviewHref: string
}

function at(base: Date, offsetSeconds: number): string {
  return new Date(base.getTime() + offsetSeconds * 1000).toISOString()
}

export function buildTodoWebAppDemoRun(now = new Date(), ids?: { briefId?: string; delegationId?: string }): TodoWebAppDemoRun {
  const briefId = ids?.briefId ?? randomUUID()
  const delegationId = ids?.delegationId ?? randomUUID()
  const createdAt = now.toISOString()
  const startedAt = at(now, 8)
  const completedAt = at(now, 38)
  const appPreviewHref = '/demo/todo-planner'

  const brief: ProjectBrief = {
    id: briefId,
    title: 'Demo: ToDo Planner WebApp',
    status: 'accepted',
    createdAt,
    updatedAt: completedAt,
    rawIdea: 'Ich möchte eine einfache ToDo Planner WebApp bauen, um ForgePilot Ende-zu-Ende zu testen.',
    problemStatement: 'Der Nutzer braucht einen greifbaren ersten Produktlauf, der zeigt, wie aus einer Idee ein testbarer App-Entwurf wird.',
    targetAudience: 'Solo-Entwickler und Maker, die schnell eine kleine produktive WebApp planen und validieren wollen.',
    desiredOutcome: 'Eine klare ToDo Planner Demo mit Aufgabenliste, Fokusbereich, Fortschritt und verständlicher Bedienung.',
    planningMode: 'beginner',
    targetPlatform: 'webapp',
    platformGuidance: 'Empfehlung: WebApp zuerst, weil sie am schnellsten lokal testbar und später als Desktop/Mobile erweiterbar ist.',
    persistenceStrategy: 'json_file',
    persistenceGuidance: 'Empfehlung fuer diesen Demo-Run: JSON/File-basiert reicht. Fuer echte Team- oder SaaS-Nutzung spaeter PostgreSQL.',
    constraints: [
      'Ohne API-Key testbar',
      'Einfach bedienbar',
      'Status und Agenten-Schritte muessen sichtbar sein',
      'Keine produktiven externen Schreibaktionen im Demo-Run',
    ],
    scope: 'minimal',
    researchMode: 'quick',
    privacyMode: 'local',
    requirements: [
      {
        id: `${briefId}-req-core-list`,
        briefId,
        type: 'functional',
        title: 'Aufgaben erfassen und abhaken',
        description: 'Nutzer koennen Aufgaben ansehen, neue Beispielaufgaben einfuegen und erledigte Aufgaben markieren.',
        priority: 'must',
        source: 'ai_proposed',
        findingIds: [],
        status: 'accepted',
      },
      {
        id: `${briefId}-req-progress`,
        briefId,
        type: 'functional',
        title: 'Fortschritt sichtbar machen',
        description: 'Die Demo zeigt Fortschritt, naechste Aktion und Fokusaufgaben ohne technische Begriffe.',
        priority: 'must',
        source: 'ai_proposed',
        findingIds: [],
        status: 'accepted',
      },
    ],
    useCases: [
      {
        id: `${briefId}-uc-first-plan`,
        briefId,
        title: 'Tagesplan schnell strukturieren',
        actor: 'Nutzer',
        trigger: 'Nutzer oeffnet die ToDo Planner Demo.',
        mainFlow: [
          'Nutzer sieht die wichtigsten Aufgaben.',
          'Nutzer markiert eine Aufgabe als erledigt.',
          'Die App aktualisiert Fortschritt und Fokus.',
        ],
        requirementIds: [`${briefId}-req-core-list`, `${briefId}-req-progress`],
        status: 'accepted',
      },
    ],
    nonGoals: [
      'Keine Accounts oder Team-Funktionen im Demo-Run',
      'Keine externe Datenbank fuer den ersten Testlauf',
      'Kein Billing, keine Multi-Tenancy',
    ],
    risks: [
      {
        id: `${briefId}-risk-demo-vs-prod`,
        briefId,
        title: 'Demo darf nicht als produktiver App-Build missverstanden werden',
        description: 'Der Run beweist den ForgePilot-Workflow und liefert eine testbare Demo-Seite, ersetzt aber noch keinen vollautonomen PR-basierten Produktivlauf.',
        probability: 'medium',
        impact: 'medium',
        mitigationIdea: 'Live View und Delegation Detail markieren den fehlenden PR-Schritt als naechste Aktion.',
        isOpenAssumption: false,
        findingIds: [],
      },
    ],
    researchRunIds: [],
    delegationIds: [delegationId],
    researchBriefDraft: {
      title: 'Research Brief: ToDo Planner WebApp Demo',
      mode: 'quick',
      privacyMode: 'local',
      preferredExecutor: 'agent',
      researchQuestions: [
        'Welche minimale ToDo-Erfahrung beweist den ForgePilot-Kernfluss?',
        'Welche Statusinformationen braucht ein Nutzer, um Agentenarbeit zu verstehen?',
      ],
      searchTerms: ['todo planner demo', 'local first task app', 'agent workflow visibility'],
      preferredSourceTypes: ['docs', 'nas'],
      excludeCriteria: ['Keine Enterprise-Features', 'Keine externen Schreibzugriffe'],
    },
    implementationDirection: 'Baue zuerst eine minimalistische WebApp-Demo mit Aufgabenliste, Fortschrittsanzeige und klarer naechster Aktion.',
    assumptions: [
      'Eine WebApp ist fuer den ersten Test schneller validierbar als Desktop oder Mobile.',
      'File-basierte Demo-Daten sind fuer den ersten lokalen Run ausreichend.',
    ],
  }

  const delegation: Delegation = {
    id: delegationId,
    title: 'First Real App Run: ToDo Planner WebApp',
    briefId,
    briefTitle: brief.title,
    status: 'completed',
    executionRoute: 'runner',
    costEstimateUsd: 0,
    actualCostUsd: 0,
    priority: 10,
    tags: ['demo-run', 'first-real-app-run', 'todo-webapp'],
    startedAt,
    completedAt,
    createdAt,
    updatedAt: completedAt,
    contract: {
      id: `${delegationId}-contract`,
      workItemId: 'demo-todo-webapp',
      goal: 'Erzeuge einen nachvollziehbaren ersten App-Run fuer eine ToDo Planner WebApp.',
      context: [
        'Der Run soll ohne API-Key testbar sein.',
        'Die Live View muss zeigen, was der Agent getan hat.',
        `Die testbare Demo-Seite liegt unter ${appPreviewHref}.`,
      ].join('\n'),
      taskType: 'feature',
      definitionOfDone: [
        'Projektbrief angelegt',
        'Delegation angelegt',
        'Live-Logs sichtbar',
        'Demo-App aufrufbar',
        'Naechster produktiver PR-Schritt klar benannt',
      ],
      riskClass: 'A',
      maxBudgetUsd: 0,
      allowedTools: ['local-files', 'next-route', 'browser-preview'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      llmModel: 'claude-cli / codex-cli zero-key ready',
      outputMode: 'json',
      skillCategory: 'ui-component',
      allowedFilePatterns: ['src/app/demo/todo-planner/**', 'src/app/api/demo-runs/**', 'src/components/live/**'],
      createdAt,
      llmProvider: 'auto-zero-key',
      toolPolicy: 'code-write',
      outputPolicy: 'writeback',
      approvalMode: 'auto',
      writeScope: ['src/app/demo/todo-planner', 'src/app/api/demo-runs', 'src/components/live'],
      executionRoute: 'runner',
    },
    logs: [
      { timestamp: createdAt, type: 'info', message: 'Demo-Run gestartet: Idee in Projektbrief uebersetzt.' },
      { timestamp: at(now, 4), type: 'thought', message: 'Empfehlung gewaehlt: WebApp zuerst, weil sie sofort lokal testbar ist.' },
      { timestamp: startedAt, type: 'info', message: 'Runner-Workspace vorbereitet: zero-key CLI Modus erkannt.' },
      { timestamp: at(now, 14), type: 'command', message: 'Projekt, Brief und Delegation fuer ToDo Planner WebApp angelegt.' },
      { timestamp: at(now, 22), type: 'command', message: 'Demo-Seite /demo/todo-planner als testbare App-Oberflaeche bereitgestellt.' },
      { timestamp: at(now, 31), type: 'success', message: 'Validierung abgeschlossen: Live View kann Agentenstatus, Logs und naechste Aktion anzeigen.' },
      { timestamp: completedAt, type: 'success', message: 'First Real App Run abgeschlossen. Naechster Schritt: echten Runner-PR fuer die ToDo App starten.' },
    ],
    summaryReport: {
      keyPoints: [
        'WebApp als beste erste Plattform empfohlen.',
        'File-basierte Demo-Persistenz fuer lokalen Test ausreichend.',
        'Live View zeigt Agent, Status, Logs und naechste Aktion.',
      ],
      changes: [
        'Projektbrief erstellt',
        'Delegation erstellt',
        'ToDo Planner Demo-App verlinkt',
      ],
      filesAdded: ['src/app/demo/todo-planner/page.tsx'],
      filesModified: ['src/app/live/page.tsx'],
      testsPassed: 3,
      testsAdded: 1,
      timeTakenMinutes: 1,
      warnings: [
        'Noch kein echter Agenten-PR aus der App heraus erstellt. Das bleibt der naechste Produktionsbeweis.',
      ],
      nextSuggestions: [
        'Echte Runner-Delegation fuer ToDo Planner starten.',
        'PR-Erstellung aus dem Delegation Detail pruefen.',
        'Nach erfolgreichem PR Critic Review und Writeback erfassen.',
      ],
      planOnly: false,
    },
    criticScore: {
      correctness: 86,
      efficiency: 82,
      drift: 8,
      verdict: 'approved',
      summary: 'Der Demo-Run beweist die Bedienlogik und Sichtbarkeit, aber der PR-Schritt muss als naechster realer Produktionslauf folgen.',
      runAt: completedAt,
    },
  }

  return { brief, delegation, appPreviewHref }
}

export function buildTodoWebAppRunnerPrDelegation(
  now = new Date(),
  ids?: { briefId?: string; delegationId?: string },
): Delegation {
  const delegationId = ids?.delegationId ?? randomUUID()
  const briefId = ids?.briefId
  const createdAt = now.toISOString()

  return {
    id: delegationId,
    title: 'Runner PR Proof: ToDo Planner Persistenz',
    briefId,
    briefTitle: briefId ? 'Demo: ToDo Planner WebApp' : undefined,
    status: 'approved',
    executionRoute: 'runner',
    costEstimateUsd: 0.08,
    actualCostUsd: 0,
    priority: 10,
    tags: ['runner-pr-proof', 'todo-webapp', 'first-real-app-run'],
    createdAt,
    updatedAt: createdAt,
    contract: {
      id: `${delegationId}-contract`,
      workItemId: 'todo-planner-persistence-proof',
      goal: [
        'Make the ToDo Planner demo feel like a real small app by persisting tasks in localStorage,',
        'adding a reset-to-demo action, and keeping the UI simple and understandable.',
      ].join(' '),
      context: [
        'This is the hard First Real App Run proof after the demo harness.',
        'Work only on the ToDo Planner demo surface and closely related tests.',
        'Do not redesign ForgePilot globally.',
        'Keep the experience German-first and beginner-friendly.',
        'The app must still work without API keys.',
      ].join('\n'),
      taskType: 'feature',
      definitionOfDone: [
        'Tasks persist across page reloads via localStorage.',
        'A visible reset action restores the original demo tasks.',
        'The next-action/progress area still updates when tasks are toggled or added.',
        'Add or update a focused test for the changed ToDo demo behavior where practical.',
        'Run npm run type-check and npm run lint before creating the PR.',
      ],
      riskClass: 'A',
      maxBudgetUsd: 0.25,
      maxCostUsd: 0.5,
      allowedTools: ['read', 'write', 'shell', 'git', 'gh'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      llmModel: 'claude-cli',
      outputMode: 'stream',
      skillCategory: 'ui-component',
      allowedFilePatterns: [
        'src/app/demo/todo-planner/**',
        'src/lib/demo-runs/**',
        'src/components/**/todo**',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
      createdAt,
      llmProvider: 'claude-cli',
      toolPolicy: 'code-write',
      outputPolicy: 'pr-and-writeback',
      approvalMode: 'auto',
      writeScope: ['src/app/demo/todo-planner', 'src/lib/demo-runs'],
      executionRoute: 'runner',
    },
    logs: [
      {
        timestamp: createdAt,
        type: 'info',
        message: 'Runner-PR-Beweis vorbereitet: kleiner Persistenzauftrag fuer die ToDo Planner Demo.',
      },
      {
        timestamp: createdAt,
        type: 'thought',
        message: 'Scope bewusst klein gehalten: localStorage, Reset, UX-Klarheit, PR statt grossem Produktumbau.',
      },
    ],
  }
}
