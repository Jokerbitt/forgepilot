import type { Delegation, TaskContract } from '@/lib/models/delegation'
import type { UpdateDelegationInput } from '@/lib/repositories/delegationRepository'

export interface ActionabilityResult {
  ok: boolean
  reason?: string
  nextStep?: string
}

export interface RefinementResult {
  patch: UpdateDelegationInput
  reason: string
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'autonomy-task'
}

export function assessDelegationActionability(candidate: Delegation): ActionabilityResult {
  const goal = candidate.contract.goal.trim()
  const title = (candidate.title ?? '').trim()
  const definitionOfDone = candidate.contract.definitionOfDone ?? []
  const allowedFilePatterns = candidate.contract.allowedFilePatterns ?? []
  const normalizedGoal = goal.toLowerCase()
  const genericGoals = [
    'wartung des servers',
    'maintenance',
    'server maintenance',
    'todo',
    'test',
  ]
  const genericDod = definitionOfDone.every(item => {
    const normalized = item.toLowerCase()
    return normalized.includes('is implemented') || normalized === 'tests pass' || normalized === 'no typescript errors'
  })

  if (genericGoals.includes(normalizedGoal) || goal.length < 20) {
    return {
      ok: false,
      reason: `Ziel ist zu vage: "${title || goal}".`,
      nextStep: 'Erzeuge zuerst einen konkreten Brief mit Ziel, Scope, betroffenen Dateien und messbarer Definition of Done.',
    }
  }

  if (genericDod || definitionOfDone.length < 2) {
    return {
      ok: false,
      reason: 'Definition of Done ist nicht konkret genug fuer einen autonomen Run.',
      nextStep: 'Lasse den Plan-Modus die Aufgabe in klare Akzeptanzkriterien und sichere Dateigrenzen zerlegen.',
    }
  }

  if (allowedFilePatterns.length === 0 && candidate.contract.riskClass !== 'A') {
    return {
      ok: false,
      reason: 'Dateigrenzen fehlen fuer eine nicht-triviale Aufgabe.',
      nextStep: 'Lege erlaubte Dateipfade oder ein enges Arbeitspaket fest, bevor Autopilot startet.',
    }
  }

  return { ok: true }
}

function inferRefinement(candidate: Delegation): {
  title: string
  goal: string
  definitionOfDone: string[]
  allowedFilePatterns: string[]
  skillCategory: TaskContract['skillCategory']
  branchStrategy: TaskContract['branchStrategy']
  taskType: TaskContract['taskType']
} {
  const source = `${candidate.title} ${candidate.contract.goal}`.toLowerCase()

  if (source.includes('todo') || source.includes('to-do') || source.includes('task planner')) {
    return {
      title: 'ToDo WebApp: erster nutzbarer MVP-Slice',
      goal: 'Baue oder verbessere den ersten nutzbaren ToDo-WebApp-Slice: Aufgaben anlegen, abhaken, filtern und lokal speichern. Halte die Umsetzung klein, testbar und auf den Demo-App-Bereich begrenzt.',
      definitionOfDone: [
        'Nutzer koennen Aufgaben mit Titel anlegen und direkt in der UI sehen.',
        'Aufgaben koennen als erledigt markiert und wieder geoeffnet werden.',
        'Aktive, erledigte und alle Aufgaben koennen sichtbar gefiltert werden.',
        'Aufgaben bleiben nach Reload lokal erhalten.',
        'Mindestens ein passender Test oder ein dokumentierter manueller Validierungsschritt ist vorhanden.',
      ],
      allowedFilePatterns: [
        'src/app/demo/todo-planner/**',
        'src/lib/demo-runs/**',
        'src/components/live/**',
        'src/app/api/demo-runs/**',
      ],
      skillCategory: 'ui-component',
      branchStrategy: 'feature',
      taskType: 'feature',
    }
  }

  if (source.includes('server') || source.includes('wartung') || source.includes('maintenance')) {
    return {
      title: 'ForgePilot Readiness: Server- und Autonomie-Status pruefen',
      goal: 'Verbessere die lokale ForgePilot-Readiness-Anzeige fuer den produktiven Testbetrieb: Runner-Status, Storage-Modus, Dev-Server-Status und naechste sichere Aktion muessen nachvollziehbar sein. Aendere nur kleine UI/API- oder Dokumentationsstellen.',
      definitionOfDone: [
        'Readiness-Informationen zeigen klar, ob Runner, Storage und Dev-Server einsatzbereit sind.',
        'PostgreSQL/JSON-Storage-Status wird mit Risiko und naechstem Schritt sichtbar oder dokumentiert.',
        'Autonomie startet keine vagen Tasks ohne konkrete Dateigrenzen.',
        'Validierung mit TypeScript, Lint oder gezieltem Test ist dokumentiert.',
      ],
      allowedFilePatterns: [
        'src/app/api/system/**',
        'src/app/api/storage-status/**',
        'src/components/settings/**',
        'src/components/command-center/**',
        'docs/**',
      ],
      skillCategory: 'infrastructure',
      branchStrategy: 'chore',
      taskType: 'refactor',
    }
  }

  return {
    title: `Konkretes Arbeitspaket: ${candidate.title || candidate.contract.goal.slice(0, 48)}`,
    goal: `Konkretisiere und bearbeite die Aufgabe "${candidate.title || candidate.contract.goal}" als kleinen, sicheren MVP-Slice. Erzeuge nur eng begrenzte Aenderungen, dokumentiere getroffene Annahmen und liefere eine klare Validierung.`,
    definitionOfDone: [
      'Die Aufgabe ist in einen kleinen, konkret pruefbaren MVP-Slice uebersetzt.',
      'Betroffene Dateien oder Dokumentationsstellen sind eng begrenzt.',
      'Das Ergebnis enthaelt klare naechste Schritte fuer die darauffolgende Delegation.',
      'Mindestens ein sinnvoller Validierungsschritt wurde ausgefuehrt oder dokumentiert.',
    ],
    allowedFilePatterns: ['docs/autonomy/**', 'src/app/api/daily-assistant/**', 'src/lib/delegations/**'],
    skillCategory: 'documentation',
    branchStrategy: 'chore',
    taskType: 'docs',
  }
}

export function buildAutonomyRefinementPatch(candidate: Delegation): RefinementResult {
  const inferred = inferRefinement(candidate)
  const now = new Date().toISOString()
  const originalGoal = candidate.contract.goal
  const originalContext = candidate.contract.context?.trim()
  const refinedContext = [
    originalContext,
    '',
    '[ForgePilot autonomy-refined]',
    `Original title: ${candidate.title}`,
    `Original goal: ${originalGoal}`,
    'This task was tightened automatically because the previous version was too vague for safe autonomous execution.',
  ].filter(Boolean).join('\n')

  return {
    reason: 'Vage Delegation wurde automatisch in ein konkret pruefbares Arbeitspaket umgewandelt.',
    patch: {
      title: inferred.title,
      status: candidate.status === 'pending' ? 'approved' : candidate.status,
      priority: Math.max(candidate.priority ?? 0, 6),
      executionRoute: candidate.executionRoute === 'manual' ? 'runner' : candidate.executionRoute,
      logs: [
        ...(candidate.logs ?? []),
        {
          timestamp: now,
          type: 'info',
          message: 'Assistant hat diese Aufgabe automatisch konkretisiert, damit sie sicher autonom ausgefuehrt werden kann.',
        },
      ],
      contract: {
        ...candidate.contract,
        goal: inferred.goal,
        context: refinedContext,
        taskType: inferred.taskType,
        definitionOfDone: inferred.definitionOfDone,
        riskClass: candidate.contract.riskClass === 'C' ? 'B' : candidate.contract.riskClass,
        maxBudgetUsd: Math.max(candidate.contract.maxBudgetUsd ?? 0, 0.2),
        allowedTools: candidate.contract.allowedTools?.length
          ? candidate.contract.allowedTools
          : ['Read', 'Edit', 'Write', 'Bash'],
        branchStrategy: inferred.branchStrategy,
        requiresApproval: false,
        privacyMode: candidate.contract.privacyMode ?? 'local',
        skillCategory: inferred.skillCategory,
        allowedFilePatterns: inferred.allowedFilePatterns,
        writeScope: inferred.allowedFilePatterns,
        approvalMode: 'auto',
        outputPolicy: 'pr-and-writeback',
      },
    },
  }
}

export function isAutonomyRefined(candidate: Delegation): boolean {
  return candidate.contract.context?.includes('[ForgePilot autonomy-refined]') ?? false
}
