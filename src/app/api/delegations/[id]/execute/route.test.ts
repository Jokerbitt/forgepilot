import { describe, it, expect } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'
import {
  buildExecutionStartLog,
  buildSimulationBudgetLog,
  getExecutionStartBlocker,
} from '@/lib/delegation-execution'

// Test the prompt builder logic (pure function)
function buildPromptForTest(delegation: Delegation): string {
  const c = delegation.contract
  const dod = (c.definitionOfDone ?? [])
    .filter(Boolean)
    .map(d => `- ${d}`)
    .join('\n') || '- Task erfolgreich abgeschlossen'
  const tools = (c.allowedTools ?? []).join(', ') || 'read_file, write_file, run_command'

  return `Du bist ein Software-Engineering-Agent für das ForgePilot AI Workflow OS Projekt (Next.js 14, TypeScript strict, Tailwind CSS).

## Aufgabe
${c.goal}

## Kontext
${c.context || 'Kein zusätzlicher Kontext angegeben.'}

## Definition of Done
${dod}

## Konfiguration
- Task-Typ: ${c.taskType || 'feature'}
- Risiko-Klasse: ${c.riskClass} (A=sicher/additiv, B=moderat/ändert Bestehendes, C=kritisch/benötigt Review)
- Branch-Strategie: ${c.branchStrategy}
- Max Budget: $${c.maxBudgetUsd}
- Erlaubte Tools: ${tools}

## Vorgehensweise
1. Lies CLAUDE.md und verstehe die Projektstruktur
2. Erstelle einen Git-Branch: ${c.branchStrategy}/${c.workItemId.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}-task
3. Implementiere die Aufgabe gemäß Definition of Done
4. Führe Tests aus: npm test -- --run
5. Führe Lint aus: npm run lint
6. Committe Änderungen: git commit -m "${c.taskType || 'feat'}: ${c.goal.substring(0, 60).replace(/"/g, "'")}"
7. Erstelle einen PR: gh pr create --title "..." --body "..."
8. Fasse am Ende zusammen, was du getan hast

Arbeite sorgfältig und melde Fortschritt.`
}

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: 'del-test-1',
    status: 'approved',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.5,
    contract: {
      id: 'con-test-1',
      workItemId: 'JOK-99',
      goal: 'Add dark mode toggle to settings page',
      context: 'User wants a dark/light mode switch',
      definitionOfDone: ['Toggle visible in settings', 'Mode persists on reload'],
      riskClass: 'A',
      maxBudgetUsd: 1.0,
      allowedTools: ['read_file', 'write_file'],
      branchStrategy: 'feature',
      requiresApproval: false,
      privacyMode: 'local',
      taskType: 'feature',
      createdAt: '2026-01-01T00:00:00Z',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('Execute route — prompt builder', () => {
  it('includes goal in prompt', () => {
    const d = makeDelegation()
    const prompt = buildPromptForTest(d)
    expect(prompt).toContain('Add dark mode toggle to settings page')
  })

  it('includes definition of done items', () => {
    const d = makeDelegation()
    const prompt = buildPromptForTest(d)
    expect(prompt).toContain('- Toggle visible in settings')
    expect(prompt).toContain('- Mode persists on reload')
  })

  it('uses sanitized workItemId in branch name', () => {
    const d = makeDelegation()
    const prompt = buildPromptForTest(d)
    expect(prompt).toContain('feature/jok-99-task')
  })

  it('falls back to default message when no DoD', () => {
    const d = makeDelegation()
    d.contract.definitionOfDone = []
    const prompt = buildPromptForTest(d)
    expect(prompt).toContain('- Task erfolgreich abgeschlossen')
  })

  it('includes risk class', () => {
    const d = makeDelegation()
    const prompt = buildPromptForTest(d)
    expect(prompt).toContain('Risiko-Klasse: A')
  })

  it('falls back to feature task type when not set', () => {
    const d = makeDelegation()
    d.contract.taskType = undefined
    const prompt = buildPromptForTest(d)
    expect(prompt).toContain('Task-Typ: feature')
  })

  it('includes context in prompt', () => {
    const d = makeDelegation()
    const prompt = buildPromptForTest(d)
    expect(prompt).toContain('User wants a dark/light mode switch')
  })

  it('falls back to default context message when context empty', () => {
    const d = makeDelegation()
    d.contract.context = ''
    const prompt = buildPromptForTest(d)
    expect(prompt).toContain('Kein zusätzlicher Kontext angegeben.')
  })

  it('sanitizes special chars in workItemId for branch name', () => {
    const d = makeDelegation()
    d.contract.workItemId = 'JOK 99/special'
    const prompt = buildPromptForTest(d)
    expect(prompt).toContain('feature/jok-99-special-task')
  })
})

describe('Execute route start guards', () => {
  it('blocks delegations that are not approved', () => {
    const d = makeDelegation({ status: 'pending' })

    expect(getExecutionStartBlocker(d)).toEqual({
      status: 400,
      error: "Delegation kann nicht gestartet werden — Status ist 'pending', muss 'approved' sein.",
    })
  })

  it('blocks RiskClass C when approval is still required', () => {
    const d = makeDelegation({
      status: 'approved',
      contract: {
        ...makeDelegation().contract,
        riskClass: 'C',
        requiresApproval: true,
      },
    })

    expect(getExecutionStartBlocker(d)).toEqual({
      status: 403,
      error: 'RiskClass C: Manuelle Freigabe erforderlich. Setze requiresApproval=false nach bewusstem Review.',
    })
  })

  it('allows RiskClass C after explicit manual override', () => {
    const d = makeDelegation({
      status: 'approved',
      contract: {
        ...makeDelegation().contract,
        riskClass: 'C',
        requiresApproval: false,
      },
    })

    expect(getExecutionStartBlocker(d)).toBeUndefined()
  })
})

describe('Execute route budget logs', () => {
  it('adds max budget to the start log', () => {
    const d = makeDelegation()

    expect(buildExecutionStartLog(d)).toMatchObject({
      type: 'info',
      message: 'Ausfuehrung gestartet | Budget: $1.00',
    })
  })

  it('marks simulation budget overrun as error', () => {
    const d = makeDelegation({
      costEstimateUsd: 1.5,
      contract: {
        ...makeDelegation().contract,
        maxBudgetUsd: 1,
      },
    })

    expect(buildSimulationBudgetLog(d)).toEqual({
      type: 'error',
      message: 'Kosten-Schaetzung ($1.50) ueberschreitet Budget ($1.00)',
    })
  })

  it('marks simulation budget within limit as info', () => {
    const d = makeDelegation({
      costEstimateUsd: 0.25,
      contract: {
        ...makeDelegation().contract,
        maxBudgetUsd: 1,
      },
    })

    expect(buildSimulationBudgetLog(d)).toEqual({
      type: 'info',
      message: 'Budget: $1.00 | Schaetzung: $0.25',
    })
  })
})
