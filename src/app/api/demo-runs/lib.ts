import type { Delegation } from '@/lib/models/delegation'

export interface NextPrStep {
  title: string
  branch: string
  baseBranch: string
  summary: string
  definitionOfDone: string[]
  suggestedFiles: string[]
  runbook: string[]
}

export type DemoRunStageStatus = 'done' | 'active' | 'pending'

export interface DemoRunStage {
  id: 'idea' | 'plan' | 'delegation' | 'execute' | 'pr'
  label: string
  status: DemoRunStageStatus
  detail: string
}

export interface TodoPlannerDemoRun {
  id: string
  title: string
  goal: string
  generatedAt: string
  stages: DemoRunStage[]
  delegation: Delegation
  nextPrStep: NextPrStep
}

const DEMO_RUN_ID = 'demo-todo-planner-001'
const BASE_TIMESTAMP = '2026-05-29T08:00:00.000Z'

export function buildTodoPlannerDelegation(now: string = BASE_TIMESTAMP): Delegation {
  return {
    id: 'demo-deleg-todo-planner-001',
    title: 'ToDo Planner WebApp — erster nachvollziehbarer App-Run',
    status: 'approved',
    executionRoute: 'runner',
    costEstimateUsd: 0,
    createdAt: now,
    updatedAt: now,
    priority: 1,
    briefTitle: 'ToDo Planner WebApp',
    contract: {
      id: 'demo-contract-todo-planner-001',
      workItemId: 'demo-wi-todo-planner-001',
      goal: 'Erzeuge einen nachvollziehbaren ersten App-Run fuer eine ToDo Planner WebApp.',
      context:
        'Demo zeigt den Bedienfluss von der Idee bis zum ersten produktiven Pull Request, damit Sven den Wert sofort sieht.',
      taskType: 'feature',
      definitionOfDone: [
        'Delegation fuer den ToDo Planner WebApp Run ist im Code als typsichere Fixture angelegt.',
        'Naechster produktiver PR-Schritt ist mit Titel, Branch, Zusammenfassung und Dateien benannt.',
        'Demo-Seite zeigt die Stages des Runs und verlinkt zum naechsten PR-Schritt.',
        'Demo-Run ist ueber /api/demo-runs maschinenlesbar abrufbar.',
      ],
      riskClass: 'A',
      maxBudgetUsd: 0,
      allowedTools: ['fs:read', 'fs:write', 'git:branch', 'git:commit'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      llmModel: 'claude-opus-4-7',
      outputMode: 'json',
      skillCategory: 'ui-component',
      allowedFilePatterns: [
        'src/app/demo/todo-planner/**',
        'src/app/api/demo-runs/**',
        'src/components/live/**',
      ],
      outputPolicy: 'pr',
      approvalMode: 'auto',
      writeScope: ['src/app/demo/todo-planner', 'src/app/api/demo-runs'],
      createdAt: now,
    },
  }
}

export function buildTodoPlannerNextPrStep(): NextPrStep {
  return {
    title: 'feature: ToDo Planner WebApp — Tasks erfassen und priorisieren (V1)',
    branch: 'feature/todo-planner-tasks-v1',
    baseBranch: 'main',
    summary:
      'Erste produktive Iteration nach dem Demo-Run: Tasks erfassen, priorisieren und persistieren — sichtbar im Command Center.',
    definitionOfDone: [
      'Task-Erfassung mit Titel, Faelligkeit und Prio im UI moeglich.',
      'Persistenz in config/tasks.json mit migrationsfreiem Default-State.',
      'Vitest deckt Erstellen, Priorisieren und Loeschen ab.',
      'Pull Request gegen main ist gruen (lint, type-check, tests).',
    ],
    suggestedFiles: [
      'src/app/todo-planner/page.tsx',
      'src/app/api/todo-planner/tasks/route.ts',
      'src/lib/todo-planner/task-store.ts',
      'src/lib/todo-planner/task-store.test.ts',
    ],
    runbook: [
      'git checkout -b feature/todo-planner-tasks-v1',
      'Task-Model + Persistenz unter src/lib/todo-planner implementieren.',
      'API-Route fuer Create/List/Update/Delete unter /api/todo-planner/tasks bauen.',
      'UI unter /todo-planner anbinden und an Command Center verlinken.',
      'npm run test:run && npm run lint && npm run type-check',
      'gh pr create --title "feature: ToDo Planner Tasks V1" --base main',
    ],
  }
}

export function buildTodoPlannerStages(): DemoRunStage[] {
  return [
    {
      id: 'idea',
      label: 'Idee erfasst',
      status: 'done',
      detail: 'ToDo Planner WebApp als Kandidat fuer den ersten produktiven App-Run gewaehlt.',
    },
    {
      id: 'plan',
      label: 'Plan skizziert',
      status: 'done',
      detail: 'Goal, DoD und Risk Class A fuer den Demo-Run sind festgeschrieben.',
    },
    {
      id: 'delegation',
      label: 'Delegation angelegt',
      status: 'done',
      detail: 'Typsichere Delegation-Fixture liegt im Code und ist ueber die API abrufbar.',
    },
    {
      id: 'execute',
      label: 'Demo ausgefuehrt',
      status: 'done',
      detail: 'Stages, Delegation und naechster PR-Schritt sind in der Demo-Seite sichtbar.',
    },
    {
      id: 'pr',
      label: 'Naechster PR-Schritt',
      status: 'active',
      detail: 'feature/todo-planner-tasks-v1 ist klar benannt und startet den produktiven Lauf.',
    },
  ]
}

export function buildTodoPlannerDemoRun(now: string = BASE_TIMESTAMP): TodoPlannerDemoRun {
  return {
    id: DEMO_RUN_ID,
    title: 'ToDo Planner WebApp — Demo Run',
    goal: 'Erzeuge einen nachvollziehbaren ersten App-Run fuer eine ToDo Planner WebApp.',
    generatedAt: now,
    stages: buildTodoPlannerStages(),
    delegation: buildTodoPlannerDelegation(now),
    nextPrStep: buildTodoPlannerNextPrStep(),
  }
}
