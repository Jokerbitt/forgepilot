import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs before imports
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => { throw new Error('ENOENT') }),
  },
}))

// Mock health route
vi.mock('@/app/api/dev/health/route', () => ({
  GET: vi.fn(async () => ({
    json: async () => ({
      overall: 'ok',
      checks: [
        { name: 'Claude CLI', status: 'ok', detail: 'claude 1.0' },
        { name: 'Anthropic API Key', status: 'warn', detail: 'nicht gesetzt' },
      ],
    }),
  })),
}))

import fs from 'fs'
import {
  handleSprintCommand,
  handleTicketCommand,
  handleCiCommand,
  handleIssuesCommand,
  handleHealthCommand,
} from './sprint-commands'

const mockFs = fs as unknown as {
  existsSync: ReturnType<typeof vi.fn>
  readFileSync: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFs.existsSync.mockReturnValue(false)
  mockFs.readFileSync.mockImplementation(() => { throw new Error('ENOENT') })
})

// ── handleSprintCommand ───────────────────────────────────────────────────────

describe('handleSprintCommand', () => {
  it('returns a string and never throws', async () => {
    const result = await handleSprintCommand()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns fallback text when config files are missing', async () => {
    const result = await handleSprintCommand()
    expect(result).toContain('Sprint')
  })

  it('shows sprint info when delegations.json exists', async () => {
    const delegations = [
      { id: 'd1', title: 'Task A', status: 'completed', executionRoute: 'manual', costEstimateUsd: 0, contract: { goal: '', riskClass: 'A', privacyMode: 'local', requiresApproval: false, maxBudgetUsd: 0, allowedTools: [], branchStrategy: 'feature', skillCategory: 'coding', taskType: 'feature', definitionOfDone: [], context: '', createdAt: '' }, logs: [], createdAt: '', updatedAt: '' },
      { id: 'd2', title: 'Task B', status: 'running', executionRoute: 'manual', costEstimateUsd: 0, contract: { goal: '', riskClass: 'A', privacyMode: 'local', requiresApproval: false, maxBudgetUsd: 0, allowedTools: [], branchStrategy: 'feature', skillCategory: 'coding', taskType: 'feature', definitionOfDone: [], context: '', createdAt: '' }, logs: [], createdAt: '', updatedAt: '' },
    ]
    mockFs.readFileSync.mockImplementation((file: string) => {
      if (String(file).includes('delegations')) return JSON.stringify(delegations)
      throw new Error('ENOENT')
    })

    const result = await handleSprintCommand()
    expect(result).toContain('Done')
  })
})

// ── handleTicketCommand ───────────────────────────────────────────────────────

describe('handleTicketCommand', () => {
  it('returns a string and never throws', async () => {
    const result = await handleTicketCommand(['JOK-99'])
    expect(typeof result).toBe('string')
  })

  it('returns "nicht gefunden" for unknown ticket IDs', async () => {
    const result = await handleTicketCommand(['JOK-99999'])
    expect(result.toLowerCase()).toContain('nicht gefunden')
  })

  it('returns warning when no args given', async () => {
    const result = await handleTicketCommand([])
    expect(result).toContain('⚠️')
  })

  it('returns ticket info when linear-issues.json exists', async () => {
    const issues = [
      { id: 'JOK-23', title: 'Sprint Widget UI', status: 'In Progress', description: 'Build the widget' },
    ]
    mockFs.readFileSync.mockImplementation((file: string) => {
      if (String(file).includes('linear-issues')) return JSON.stringify(issues)
      throw new Error('ENOENT')
    })

    const result = await handleTicketCommand(['JOK-23'])
    expect(result).toContain('JOK-23')
    expect(result).toContain('Sprint Widget UI')
  })

  it('is case-insensitive for ticket IDs', async () => {
    const issues = [{ id: 'JOK-23', title: 'Sprint Widget UI', status: 'In Progress' }]
    mockFs.readFileSync.mockImplementation((file: string) => {
      if (String(file).includes('linear-issues')) return JSON.stringify(issues)
      throw new Error('ENOENT')
    })

    const result = await handleTicketCommand(['jok-23'])
    expect(result).toContain('JOK-23')
  })
})

// ── handleCiCommand ───────────────────────────────────────────────────────────

describe('handleCiCommand', () => {
  it('returns a string and never throws', async () => {
    const result = await handleCiCommand()
    expect(typeof result).toBe('string')
  })

  it('returns placeholder when connectors.json is missing', async () => {
    const result = await handleCiCommand()
    expect(result).toContain('kein Connector')
  })

  it('returns connector info when connectors.json exists', async () => {
    const connectors = [
      { id: 'gh1', name: 'GitHub Actions', type: 'github', enabled: true },
    ]
    mockFs.existsSync.mockReturnValue(true)
    mockFs.readFileSync.mockReturnValue(JSON.stringify(connectors))

    const result = await handleCiCommand()
    expect(result).toContain('GitHub Actions')
  })
})

// ── handleIssuesCommand ───────────────────────────────────────────────────────

describe('handleIssuesCommand', () => {
  it('returns a string and never throws', async () => {
    const result = await handleIssuesCommand()
    expect(typeof result).toBe('string')
  })

  it('returns info message when no open delegations', async () => {
    mockFs.readFileSync.mockReturnValue('[]')
    const result = await handleIssuesCommand()
    expect(result.toLowerCase()).toContain('keine')
  })

  it('lists pending delegations', async () => {
    const delegations = [
      { id: 'del-1', title: 'Fix auth bug', status: 'pending', executionRoute: 'manual', costEstimateUsd: 0, contract: { riskClass: 'B', goal: '', privacyMode: 'local', requiresApproval: false, maxBudgetUsd: 0, allowedTools: [], branchStrategy: 'feature', skillCategory: 'coding', taskType: 'feature', definitionOfDone: [], context: '', createdAt: '' }, logs: [], createdAt: '', updatedAt: '' },
    ]
    mockFs.readFileSync.mockImplementation((file: string) => {
      if (String(file).includes('delegations')) return JSON.stringify(delegations)
      throw new Error('ENOENT')
    })

    const result = await handleIssuesCommand()
    expect(result).toContain('Fix auth bug')
    expect(result).toContain('[B]')
  })

  it('caps list at 10 entries', async () => {
    const delegations = Array.from({ length: 15 }, (_, i) => ({
      id: `del-${i}`,
      title: `Task ${i}`,
      status: 'pending',
      executionRoute: 'manual',
      costEstimateUsd: 0,
      contract: { riskClass: 'A', goal: '', privacyMode: 'local', requiresApproval: false, maxBudgetUsd: 0, allowedTools: [], branchStrategy: 'feature', skillCategory: 'coding', taskType: 'feature', definitionOfDone: [], context: '', createdAt: '' },
      logs: [],
      createdAt: '',
      updatedAt: '',
    }))
    mockFs.readFileSync.mockImplementation((file: string) => {
      if (String(file).includes('delegations')) return JSON.stringify(delegations)
      throw new Error('ENOENT')
    })

    const result = await handleIssuesCommand()
    // Should have max 10 lines with numbers
    const numbered = result.match(/^\d+\./gm) ?? []
    expect(numbered.length).toBeLessThanOrEqual(10)
  })
})

// ── handleHealthCommand ───────────────────────────────────────────────────────

describe('handleHealthCommand', () => {
  it('returns a string and never throws', async () => {
    const result = await handleHealthCommand()
    expect(typeof result).toBe('string')
  })

  it('returns health info with overall status', async () => {
    const result = await handleHealthCommand()
    expect(result).toContain('Health')
  })

  it('returns safe fallback when health route errors', async () => {
    const { GET } = await import('@/app/api/dev/health/route')
    ;(GET as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'))

    const result = await handleHealthCommand()
    expect(typeof result).toBe('string')
    expect(result).not.toThrow
  })
})
