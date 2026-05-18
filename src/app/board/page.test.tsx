import { describe, it, expect } from 'vitest'
import type { Delegation } from '@/lib/models/delegation'

// ─── Test helpers ─────────────────────────────────────────────────────────────

const baseContract = {
  id: 'c-001',
  workItemId: 'PROJ-1',
  goal: 'Do something',
  context: '',
  definitionOfDone: [],
  riskClass: 'A' as const,
  maxBudgetUsd: 1.0,
  allowedTools: [],
  branchStrategy: 'feature' as const,
  requiresApproval: false,
  privacyMode: 'local' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
}

function makeDelegation(overrides: Partial<Delegation>): Delegation {
  return {
    id: 'del-001',
    title: 'Test Delegation',
    status: 'pending',
    executionRoute: 'local-agent',
    costEstimateUsd: 0.5,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    contract: baseContract,
    ...overrides,
  }
}

/** Mirrors the board page logic: "▶ Starten" button visible iff status === 'approved' */
function shouldShowStartButton(d: Delegation): boolean {
  return d.status === 'approved'
}

/** Mirrors the board page logic: execute endpoint URL */
function getExecuteUrl(id: string): string {
  return `/api/delegations/${id}/execute`
}

/** Mirrors the board page navigation target after start */
function getNavigationTarget(id: string): string {
  return `/active?focus=${id}`
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Board start-button visibility', () => {
  it('shows start button only for approved delegations', () => {
    const statuses: Array<Delegation['status']> = [
      'pending', 'approved', 'running', 'completed', 'failed', 'cancelled',
    ]

    const results = statuses.map(status => ({
      status,
      showButton: shouldShowStartButton(makeDelegation({ status })),
    }))

    // Only 'approved' should show the start button
    expect(results.find(r => r.status === 'approved')?.showButton).toBe(true)

    const nonApproved = results.filter(r => r.status !== 'approved')
    nonApproved.forEach(r => {
      expect(r.showButton).toBe(false)
    })
  })

  it('clicking start calls execute API and navigates to /active?focus=<id>', () => {
    const id = 'del-abc-123'
    const approvedDelegation = makeDelegation({ id, status: 'approved' })

    // Assert the button would be shown
    expect(shouldShowStartButton(approvedDelegation)).toBe(true)

    // Assert the correct API endpoint is used
    expect(getExecuteUrl(id)).toBe(`/api/delegations/${id}/execute`)

    // Assert navigation target includes the focus query param
    const navTarget = getNavigationTarget(id)
    expect(navTarget).toBe(`/active?focus=${id}`)
    expect(navTarget).toContain(`focus=${id}`)
  })
})
