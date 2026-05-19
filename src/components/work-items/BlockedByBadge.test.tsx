import { describe, it, expect } from 'vitest'

// ─── Helper functions mirroring BlockedByBadge logic ─────────────────────────────

interface BlockedByLogic {
  itemId: string
  blockedBy?: string[]
}

function shouldRenderBadge(data: BlockedByLogic): boolean {
  return data.blockedBy !== undefined && data.blockedBy.length > 0
}

function getBlockerLabel(count: number): string {
  return `Blocked by ${count}`
}

function formatBlockerTitle(count: number): string {
  const plural = count !== 1 ? 's' : ''
  return `Blocked by ${count} item${plural}`
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BlockedByBadge logic', () => {
  it('should not render when blockedBy is empty', () => {
    const data: BlockedByLogic = { itemId: 'item-1', blockedBy: [] }
    expect(shouldRenderBadge(data)).toBe(false)
  })

  it('should not render when blockedBy is undefined', () => {
    const data: BlockedByLogic = { itemId: 'item-1' }
    expect(shouldRenderBadge(data)).toBe(false)
  })

  it('should render when blockedBy has items', () => {
    const data: BlockedByLogic = { itemId: 'item-1', blockedBy: ['blocker-1'] }
    expect(shouldRenderBadge(data)).toBe(true)
  })

  it('should display correct label for single blocker', () => {
    expect(getBlockerLabel(1)).toBe('Blocked by 1')
  })

  it('should display correct label for multiple blockers', () => {
    expect(getBlockerLabel(2)).toBe('Blocked by 2')
    expect(getBlockerLabel(5)).toBe('Blocked by 5')
  })

  it('should format title correctly with singular', () => {
    expect(formatBlockerTitle(1)).toBe('Blocked by 1 item')
  })

  it('should format title correctly with plural', () => {
    expect(formatBlockerTitle(2)).toBe('Blocked by 2 items')
    expect(formatBlockerTitle(5)).toBe('Blocked by 5 items')
  })

  it('should handle multiple blockers in list', () => {
    const data: BlockedByLogic = {
      itemId: 'item-1',
      blockedBy: ['blocker-1', 'blocker-2', 'blocker-3'],
    }
    expect(shouldRenderBadge(data)).toBe(true)
    expect(data.blockedBy?.length).toBe(3)
  })
})
